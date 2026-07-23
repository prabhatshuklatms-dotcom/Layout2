'use client';

/**
 * StudioMap  —  Leaflet map for Overlay Studio.
 *
 * Features:
 *   - Satellite / Street / Hybrid tile layers
 *   - Saved overlays rendered as L.imageOverlay
 *   - Active overlay: drag to move, corner handles to resize, rotate handle
 *   - Selected boundary outline + fly-to
 */

import { useEffect, useRef, useState } from 'react';
import { useOverlayStore }     from '@/store/overlayStore';
import { useBoundaryStore }    from '@/store/boundaryStore';
import { useOverlayTransform } from '@/hooks/useOverlayTransform';
import { getPreviewUrl }       from '@/lib/api';

// ─── Handle sizes (px on screen) ─────────────────────────────────────────────
const CORNER_R  = 7;   // resize handle radius
const ROTATE_R  = 7;   // rotate handle radius
const ROTATE_OFFSET = 28; // px above the top-centre

export default function StudioMap({ projectId: _projectId }) {
  const containerRef     = useRef(null);
  const mapRef           = useRef(null);
  const tileRef          = useRef(null);
  const labelTileRef     = useRef(null);
  const LRef             = useRef(null);
  const overlayLayersRef = useRef({});   // id → { imageOverlay, outline }
  const boundaryLayerRef = useRef(null);
  const handleLayerRef   = useRef(null); // SVG overlay for active handles

  const [mapType, setMapType] = useState('satellite');

  const overlays         = useOverlayStore((s) => s.overlays);
  const activeOverlayId  = useOverlayStore((s) => s.activeOverlayId);
  const setActiveOverlayId = useOverlayStore((s) => s.setActiveOverlayId);

  const boundaries              = useBoundaryStore((s) => s.boundaries);
  const studioSelectedBoundaryId = useBoundaryStore((s) => s.studioSelectedBoundaryId);

  const { move, resize } = useOverlayTransform();

  // ── Init Leaflet map ───────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;
    if (containerRef.current?._leaflet_id) containerRef.current._leaflet_id = null;

    import('leaflet').then((mod) => {
      if (!containerRef.current || mapRef.current) return;
      const Lf = mod.default;
      LRef.current = Lf;

      delete Lf.Icon.Default.prototype._getIconUrl;
      Lf.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = Lf.map(containerRef.current, {
        center: [20.5937, 78.9629],
        zoom: 5,
        zoomControl: false,
      });
      Lf.control.zoom({ position: 'bottomright' }).addTo(map);

      const { base, label } = buildTileLayers(Lf, 'satellite');
      tileRef.current = base.addTo(map);
      if (label) labelTileRef.current = label.addTo(map);

      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      if (containerRef.current) delete containerRef.current._leaflet_id;
    };
  }, []);

  // ── Swap tile layers ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current, Lf = LRef.current;
    if (!map || !Lf) return;
    if (tileRef.current) map.removeLayer(tileRef.current);
    if (labelTileRef.current) { map.removeLayer(labelTileRef.current); labelTileRef.current = null; }
    const { base, label } = buildTileLayers(Lf, mapType);
    tileRef.current = base.addTo(map);
    if (label) labelTileRef.current = label.addTo(map);
  }, [mapType]);

  // ── Boundary outline ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!studioSelectedBoundaryId) {
      if (boundaryLayerRef.current && mapRef.current) {
        try { mapRef.current.removeLayer(boundaryLayerRef.current); } catch {}
        boundaryLayerRef.current = null;
      }
      return;
    }
    const boundary = boundaries.find((b) => b.id === studioSelectedBoundaryId);
    if (!boundary?.geometry) return;

    const apply = () => {
      const map = mapRef.current, Lf = LRef.current;
      if (!map || !Lf) return false;
      if (boundaryLayerRef.current) { try { map.removeLayer(boundaryLayerRef.current); } catch {} boundaryLayerRef.current = null; }
      try {
        const layer = Lf.geoJSON(boundary.geometry, {
          style: { color: boundary.color ?? '#3b82f6', weight: 3, fillOpacity: 0.12, fillColor: boundary.color ?? '#3b82f6', dashArray: '8,6' },
        }).addTo(map);
        boundaryLayerRef.current = layer;
        const bounds = layer.getBounds();
        if (bounds.isValid()) map.fitBounds(bounds.pad(0.3), { maxZoom: 17, animate: true, duration: 0.8 });
        return true;
      } catch { return false; }
    };

    if (!apply()) {
      const iv = setInterval(() => { if (apply()) clearInterval(iv); }, 100);
      return () => clearInterval(iv);
    }
  }, [studioSelectedBoundaryId, boundaries]);

  // ── Render overlays (image layers) ────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current, Lf = LRef.current;
    if (!map || !Lf) return;

    // Remove deleted overlays
    Object.keys(overlayLayersRef.current).forEach((sid) => {
      const id = Number(sid);
      if (!overlays.find((o) => o.id === id)) {
        const l = overlayLayersRef.current[sid];
        try { map.removeLayer(l.imageOverlay); } catch {}
        try { map.removeLayer(l.outline); } catch {}
        delete overlayLayersRef.current[sid];
      }
    });

    overlays.forEach((ov) => {
      if (!ov.visible) {
        if (overlayLayersRef.current[ov.id]) {
          const l = overlayLayersRef.current[ov.id];
          try { map.removeLayer(l.imageOverlay); } catch {}
          try { map.removeLayer(l.outline); } catch {}
          delete overlayLayersRef.current[ov.id];
        }
        return;
      }

      const isActive = ov.id === activeOverlayId;
      const bounds   = [[ov.y, ov.x], [ov.y + ov.height, ov.x + ov.width]];

      if (overlayLayersRef.current[ov.id]) {
        const l = overlayLayersRef.current[ov.id];
        l.imageOverlay.setBounds(bounds);
        l.imageOverlay.setOpacity(ov.opacity ?? 1);
        l.outline.setBounds(bounds);
        l.outline.setStyle({ color: isActive ? '#f59e0b' : 'transparent', weight: 2, fillOpacity: 0, dashArray: '4,4' });
        return;
      }

      try {
        const imgUrl = ov.architectureFileId ? getPreviewUrl(ov.architectureFileId) : null;
        if (!imgUrl) return;

        const imageOverlay = Lf.imageOverlay(imgUrl, bounds, {
          opacity: ov.opacity ?? 1,
          interactive: true,
          className: `overlay-image overlay-${ov.id}`,
        }).addTo(map);

        const outline = Lf.rectangle(bounds, {
          color: isActive ? '#f59e0b' : 'transparent',
          weight: 2, fillOpacity: 0, dashArray: '4,4', interactive: false,
        }).addTo(map);

        imageOverlay.on('click', (e) => {
          e.originalEvent?.stopPropagation();
          if (!ov.locked) setActiveOverlayId(ov.id === activeOverlayId ? null : ov.id);
        });

        overlayLayersRef.current[ov.id] = { imageOverlay, outline };
      } catch (err) {
        console.error(`[StudioMap] overlay ${ov.id}:`, err.message);
      }
    });
  }, [overlays, activeOverlayId, setActiveOverlayId]);

  // ── Interactive handles for active overlay ────────────────────────────────
  useEffect(() => {
    const map = mapRef.current, Lf = LRef.current;
    if (!map || !Lf) return;

    // Remove previous handle layer
    if (handleLayerRef.current) {
      try { map.removeLayer(handleLayerRef.current); } catch {}
      handleLayerRef.current = null;
    }

    if (!activeOverlayId) return;
    const ov = overlays.find((o) => o.id === activeOverlayId);
    if (!ov || !ov.visible || ov.locked) return;

    // We use a Leaflet SVG overlay covering the whole world so we can freely
    // draw handles in geo-projected space without fighting coordinate systems.
    const svgLayer = Lf.svg({ padding: 1 }).addTo(map);
    handleLayerRef.current = svgLayer;

    // SVG namespace
    const NS = 'http://www.w3.org/2000/svg';

    function latLngToLayerPoint(lat, lng) {
      return map.latLngToLayerPoint([lat, lng]);
    }

    function createElement(tag, attrs) {
      const el = document.createElementNS(NS, tag);
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
      return el;
    }

    // ── Disable map drag while a handle is being interacted with ─────────────
    let dragWasEnabled = false;
    function lockMap() { dragWasEnabled = map.dragging.enabled(); map.dragging.disable(); }
    function unlockMap() { if (dragWasEnabled) map.dragging.enable(); }

    // ── Render handles onto the pane SVG ──────────────────────────────────────
    // The leaflet SVG renderer attaches an <svg> to a pane. We find that SVG
    // and append our handle elements directly.
    // Wait one frame for Leaflet to finish adding the layer.
    const frameId = requestAnimationFrame(() => {
      const pane = map.getPanes().overlayPane;
      if (!pane) return;
      const svgEl = pane.querySelector('svg');
      if (!svgEl) return;

      // Container <g> for all handles
      const g = createElement('g', { class: 'studio-handles' });
      svgEl.appendChild(g);

      function drawHandles() {
        // Clear existing
        while (g.firstChild) g.removeChild(g.firstChild);

        const curOv = useOverlayStore.getState().overlays.find((o) => o.id === activeOverlayId);
        if (!curOv) return;

        const { x, y, width: w, height: h } = curOv;
        // Corners: [lat, lng]
        const sw = [y,       x];
        const se = [y,       x + w];
        const ne = [y + h,   x + w];
        const nw = [y + h,   x];
        const tc = [y + h,   x + w / 2]; // top-centre (rotate)

        // Convert all to layer points
        const pts = { sw, se, ne, nw, tc };
        const px  = {};
        Object.entries(pts).forEach(([k, ll]) => {
          const p = latLngToLayerPoint(ll[0], ll[1]);
          px[k] = p;
        });

        // Draw the dashed outline rect
        const outline = createElement('rect', {
          x:      Math.min(px.sw.x, px.ne.x),
          y:      Math.min(px.ne.y, px.sw.y),
          width:  Math.abs(px.ne.x - px.sw.x),
          height: Math.abs(px.ne.y - px.sw.y),
          fill:   'none',
          stroke: '#f59e0b',
          'stroke-width': '2',
          'stroke-dasharray': '6 4',
          'pointer-events': 'none',
        });
        g.appendChild(outline);

        // Rotate handle line
        const midTopX = (px.nw.x + px.ne.x) / 2;
        const midTopY = (px.nw.y + px.ne.y) / 2;
        const rotHandleY = midTopY - ROTATE_OFFSET;
        const rotLine = createElement('line', {
          x1: midTopX, y1: midTopY,
          x2: midTopX, y2: rotHandleY,
          stroke: '#6366f1', 'stroke-width': '1.5', 'stroke-dasharray': '3 2',
          'pointer-events': 'none',
        });
        g.appendChild(rotLine);

        // ── Corner resize handles ─────────────────────────────────────────────
        const corners = [
          { key: 'nw', p: px.nw, corner: 'nw' },
          { key: 'ne', p: px.ne, corner: 'ne' },
          { key: 'se', p: px.se, corner: 'se' },
          { key: 'sw', p: px.sw, corner: 'sw' },
        ];

        corners.forEach(({ p, corner }) => {
          const handle = createElement('rect', {
            x: p.x - CORNER_R, y: p.y - CORNER_R,
            width: CORNER_R * 2, height: CORNER_R * 2,
            fill: '#0a0a0a', stroke: '#f59e0b', 'stroke-width': '2',
            rx: '2', cursor: 'nwse-resize', style: 'cursor: nwse-resize',
          });

          handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            lockMap();
            const startOv = useOverlayStore.getState().overlays.find((o) => o.id === activeOverlayId);
            if (!startOv) return;
            const snap = { x: startOv.x, y: startOv.y, w: startOv.width, h: startOv.height };
            const startLL = map.containerPointToLatLng([e.clientX - map.getContainer().getBoundingClientRect().left,
                                                         e.clientY - map.getContainer().getBoundingClientRect().top]);
            const startLat = startLL.lat, startLng = startLL.lng;

            const onMove = (ev) => {
              const rect = map.getContainer().getBoundingClientRect();
              const ll = map.containerPointToLatLng([ev.clientX - rect.left, ev.clientY - rect.top]);
              const dLat = ll.lat - startLat, dLng = ll.lng - startLng;
              let { x, y, w, h } = snap;
              if (corner === 'se') { w = Math.max(0.00001, snap.w + dLng); h = Math.max(0.00001, snap.h - dLat); y = snap.y + snap.h - h; }
              if (corner === 'sw') { x = snap.x + dLng; w = Math.max(0.00001, snap.w - dLng); h = Math.max(0.00001, snap.h - dLat); y = snap.y + snap.h - h; }
              if (corner === 'ne') { w = Math.max(0.00001, snap.w + dLng); h = Math.max(0.00001, snap.h + dLat); }
              if (corner === 'nw') { x = snap.x + dLng; w = Math.max(0.00001, snap.w - dLng); h = Math.max(0.00001, snap.h + dLat); }
              resize(activeOverlayId, w, h);
              move(activeOverlayId, x, y);
              drawHandles();
            };

            const onUp = () => {
              window.removeEventListener('mousemove', onMove);
              window.removeEventListener('mouseup', onUp);
              unlockMap();
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          });

          g.appendChild(handle);
        });

        // ── Drag to move ──────────────────────────────────────────────────────
        const hitArea = createElement('rect', {
          x:      Math.min(px.sw.x, px.ne.x) + CORNER_R * 2 + 2,
          y:      Math.min(px.ne.y, px.sw.y) + CORNER_R * 2 + 2,
          width:  Math.max(0, Math.abs(px.ne.x - px.sw.x) - (CORNER_R * 4 + 4)),
          height: Math.max(0, Math.abs(px.ne.y - px.sw.y) - (CORNER_R * 4 + 4)),
          fill: 'transparent', cursor: 'move',
        });

        hitArea.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          lockMap();
          const startOv = useOverlayStore.getState().overlays.find((o) => o.id === activeOverlayId);
          if (!startOv) return;
          const rect = map.getContainer().getBoundingClientRect();
          const startLL = map.containerPointToLatLng([e.clientX - rect.left, e.clientY - rect.top]);
          const origX = startOv.x, origY = startOv.y;
          const startLat = startLL.lat, startLng = startLL.lng;

          const onMove = (ev) => {
            const r = map.getContainer().getBoundingClientRect();
            const ll = map.containerPointToLatLng([ev.clientX - r.left, ev.clientY - r.top]);
            move(activeOverlayId, origX + (ll.lng - startLng), origY + (ll.lat - startLat));
            drawHandles();
          };
          const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            unlockMap();
          };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        });
        g.appendChild(hitArea);

        // ── Rotate handle ─────────────────────────────────────────────────────
        const rotHandle = createElement('circle', {
          cx: midTopX, cy: rotHandleY,
          r: ROTATE_R,
          fill: '#6366f1', stroke: '#fff', 'stroke-width': '2',
          cursor: 'crosshair',
        });

        rotHandle.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          lockMap();
          // Note: L.imageOverlay doesn't support CSS rotation natively.
          // We update the rotation in store and the properties panel shows it.
          // Actual visual rotation on map would require a custom SVG overlay.
          // For now we compute the angle and store it.
          const curOv2 = useOverlayStore.getState().overlays.find((o) => o.id === activeOverlayId);
          if (!curOv2) return;
          const rect = map.getContainer().getBoundingClientRect();
          const centerX = (px.nw.x + px.se.x) / 2;
          const centerY = (px.nw.y + px.se.y) / 2;

          const onMove = (ev) => {
            const mx = ev.clientX - rect.left - map.getPanes().overlayPane.getBoundingClientRect().left;
            const my = ev.clientY - rect.top  - map.getPanes().overlayPane.getBoundingClientRect().top;
            const angle = (Math.atan2(my - centerY, mx - centerX) * 180 / Math.PI) + 90;
            useOverlayStore.getState().replaceOverlay({ ...curOv2, rotation: ((angle % 360) + 360) % 360 });
            drawHandles();
          };
          const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            unlockMap();
          };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        });
        g.appendChild(rotHandle);
      }

      drawHandles();

      // Redraw handles on map move/zoom
      map.on('move zoom', drawHandles);

      // Cleanup
      handleLayerRef.current._drawHandles = drawHandles;
      handleLayerRef.current._g = g;
      handleLayerRef.current._cleanup = () => {
        map.off('move zoom', drawHandles);
        if (g.parentNode) g.parentNode.removeChild(g);
      };
    });

    return () => {
      cancelAnimationFrame(frameId);
      if (handleLayerRef.current?._cleanup) handleLayerRef.current._cleanup();
      if (handleLayerRef.current) {
        try { map.removeLayer(handleLayerRef.current); } catch {}
        handleLayerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOverlayId, overlays]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full">
      <style>{`
        @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        .leaflet-container { background: #1c1c1c; font-family: inherit; }
        .overlay-image { cursor: pointer; transition: opacity 0.2s; }
        .overlay-image:hover { opacity: 0.9 !important; }
        .studio-handles { pointer-events: all; }
      `}</style>

      {/* Map type switcher */}
      <div className="absolute top-3 left-3 z-[9000] flex gap-1 bg-zinc-950/95 backdrop-blur
                      border border-zinc-700 rounded-lg p-1">
        {['satellite','street','hybrid'].map((t) => (
          <button key={t} onClick={() => setMapType(t)}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors capitalize
              ${mapType === t ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Active overlay hint */}
      {activeOverlayId && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-[9000] pointer-events-none
                        bg-zinc-950/90 backdrop-blur border border-zinc-700 rounded-lg
                        px-3 py-1.5 text-[11px] text-zinc-400">
          Drag to move · Corner handles to resize · Use Properties panel for rotation &amp; opacity
        </div>
      )}

      {overlays.length === 0 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[9000]
                        bg-zinc-950/95 backdrop-blur border border-zinc-700 rounded-xl p-6 max-w-sm text-center">
          <p className="text-sm text-zinc-400 mb-2">No overlays placed yet</p>
          <p className="text-xs text-zinc-600 leading-relaxed">
            Use the sidebar to select a region and boundary, then click "Attach Layout".
          </p>
        </div>
      )}

      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

// ─── Tile layer factory ───────────────────────────────────────────────────────
function buildTileLayers(Lf, type) {
  if (type === 'satellite') {
    return {
      base: Lf.tileLayer(
        'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        { attribution: '© Google', maxZoom: 21, subdomains: ['0','1','2','3'] },
      ),
      label: null,
    };
  }
  if (type === 'hybrid') {
    return {
      base: Lf.tileLayer(
        'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
        { attribution: '© Google', maxZoom: 21, subdomains: ['0','1','2','3'] },
      ),
      label: Lf.tileLayer(
        'https://mt{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}',
        { attribution: '© Google', maxZoom: 21, subdomains: ['0','1','2','3'], opacity: 0.9 },
      ),
    };
  }
  return {
    base: Lf.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution: '© OpenStreetMap contributors', maxZoom: 19 },
    ),
    label: null,
  };
}
