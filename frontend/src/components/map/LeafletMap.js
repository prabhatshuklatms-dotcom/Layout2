'use client';

/**
 * LeafletMap — pure Leaflet (no React Leaflet) to avoid SSR issues.
 *
 * Tools:
 *  POINTER   — click boundary to select; cursor default
 *  POLYGON   — click points, double-click / Enter to finish
 *  RECTANGLE — click+drag
 *  EDIT      — drag the selected boundary to move it; double-click vertex to delete it
 *
 * Other features:
 *  - Satellite / Street / Hybrid tile layers
 *  - Per-boundary color + visibility
 *  - Fit to bounds on demand (imperative ref)
 *  - Nominatim place search
 *  - Escape cancels draw / edit
 */

import {
  useEffect, useRef, useState, useCallback,
  useImperativeHandle, forwardRef,
} from 'react';
import { createPortal } from 'react-dom';
import 'leaflet/dist/leaflet.css';
import { BASE_URL } from '@/lib/api';
import LayoutTransformNode from './LayoutTransformNode';

export const BOUNDARY_DRAW_MODE = {
  POINTER: 'POINTER',
  POLYGON: 'POLYGON',
  RECTANGLE: 'RECTANGLE',
  EDIT: 'EDIT',
};

const LeafletMap = forwardRef(function LeafletMap(
  {
    mapType, drawMode, drawingBoundary,
    boundaries, activeBoundaryId, currentColor,
    onDrawComplete, onSelectBoundary, onMoveComplete,
    initialBounds, staticPreview, onLayoutDrop,
    layouts, onLayoutUpdate
  },
  ref,
) {
  const containerRef   = useRef(null);
  const mapRef         = useRef(null);
  const tileRef        = useRef(null);
  const labelTileRef   = useRef(null);
  const boundaryLayers = useRef({});   // id → L.GeoJSON layer
  const editLayerRef   = useRef(null); // the draggable edit layer
  const drawPtsRef     = useRef([]);
  const drawMarkersRef = useRef([]);
  const previewRef     = useRef(null);
  const rectStartRef   = useRef(null);
  const rectLayerRef   = useRef(null);
  const isDrawing      = useRef(false);
  const L              = useRef(null);

  const [search,    setSearch]    = useState('');
  const [searching, setSearching] = useState(false);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  const [selectedLayoutId, setSelectedLayoutId] = useState(null);
  const [draftTransforms, setDraftTransforms] = useState({});
  const [currentZoom, setCurrentZoom] = useState(18);
  const baseZoom = 18;
  const [portalTargets, setPortalTargets] = useState({});

  // ── Expose fitBounds imperatively ──────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    fitToBounds() {
      const map = mapRef.current;
      if (!map) return;
      const layers = Object.values(boundaryLayers.current);
      if (!layers.length) return;
      try {
        const group = L.current.featureGroup(layers);
        map.fitBounds(group.getBounds().pad(0.2));
      } catch { /* empty */ }
    },
  }));

  // ── Init map ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;
    if (containerRef.current?._leaflet_id) {
      containerRef.current._leaflet_id = null;
    }

    import('leaflet').then((mod) => {
      if (!containerRef.current || mapRef.current) return;
      const Lf = mod.default;
      L.current = Lf;
      setLeafletLoaded(true);

      delete Lf.Icon.Default.prototype._getIconUrl;
      Lf.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const mapOpts = { zoomControl: false };
      if (!initialBounds) {
        mapOpts.center = [20.5937, 78.9629];
        mapOpts.zoom = 5;
      }

      const map = Lf.map(containerRef.current, mapOpts);
      if (initialBounds) {
        map.fitBounds(initialBounds);
      }

      if (!staticPreview) {
        Lf.control.zoom({ position: 'bottomright' }).addTo(map);
      }

      map.on('zoom', () => {
        setCurrentZoom(map.getZoom());
      });


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
    const map = mapRef.current;
    const Lf  = L.current;
    if (!map || !Lf) return;
    if (tileRef.current)      map.removeLayer(tileRef.current);
    if (labelTileRef.current) { map.removeLayer(labelTileRef.current); labelTileRef.current = null; }
    const { base, label } = buildTileLayers(Lf, mapType);
    tileRef.current = base.addTo(map);
    if (label) labelTileRef.current = label.addTo(map);
  }, [mapType]);

  // ── Render saved boundaries ────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const Lf  = L.current;
    if (!map || !Lf) return;

    // Remove layers for deleted boundaries
    Object.keys(boundaryLayers.current).forEach((sid) => {
      const numId = Number(sid);
      if (!boundaries.find((b) => b.id === numId)) {
        try { map.removeLayer(boundaryLayers.current[sid]); } catch {}
        delete boundaryLayers.current[sid];
      }
    });

    boundaries.forEach((b) => {
      // Handle visibility
      if (!b.visible) {
        if (boundaryLayers.current[b.id]) {
          try { map.removeLayer(boundaryLayers.current[b.id]); } catch {}
          delete boundaryLayers.current[b.id];
        }
        return;
      }

      const isActive = b.id === activeBoundaryId;
      const color    = b.color ?? '#3b82f6';
      const style = {
        color,
        weight:      isActive ? 3 : 2,
        fillOpacity: isActive ? 0.25 : 0.12,
        fillColor:   color,
        dashArray:   isActive ? null : '5,4',
      };

      if (boundaryLayers.current[b.id]) {
        boundaryLayers.current[b.id].setStyle(style);
        // Update tooltip text in case name changed
        try {
          boundaryLayers.current[b.id].unbindTooltip();
          boundaryLayers.current[b.id].bindTooltip(b.name, {
            permanent: false, direction: 'center',
            className: 'leaflet-tooltip-custom',
          });
        } catch {}
      } else {
        try {
          const layer = Lf.geoJSON(b.geometry, { style })
            .on('click', (e) => {
              e.originalEvent?.stopPropagation();
              onSelectBoundary(b.id);
            })
            .addTo(map);

          layer.bindTooltip(b.name, {
            permanent: false, direction: 'center',
            className: 'leaflet-tooltip-custom',
          });

          boundaryLayers.current[b.id] = layer;
        } catch { /* malformed geometry */ }
      }
    });
  }, [boundaries, activeBoundaryId, onSelectBoundary]);

  // ── Edit / Move mode ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const Lf  = L.current;
    if (!map || !Lf) return;

    // Tear down any previous edit layer
    if (editLayerRef.current) {
      try { map.removeLayer(editLayerRef.current.poly); } catch {}
      editLayerRef.current.markers?.forEach((m) => { try { map.removeLayer(m); } catch {} });
      editLayerRef.current.midMarkers?.forEach((m) => { try { map.removeLayer(m); } catch {} });
      editLayerRef.current = null;
    }

    if (drawMode !== BOUNDARY_DRAW_MODE.EDIT || !activeBoundaryId) return;

    const boundary = boundaries.find((b) => b.id === activeBoundaryId);
    if (!boundary) return;

    const geo = boundary.geometry?.geometry ?? boundary.geometry;
    if (!geo?.coordinates?.[0]) return;

    const color = boundary.color ?? '#3b82f6';
    const ring  = geo.coordinates[0].slice(0, -1);

    let latLngs = ring.map(([lng, lat]) => Lf.latLng(lat, lng));

    if (boundaryLayers.current[activeBoundaryId]) {
      try { map.removeLayer(boundaryLayers.current[activeBoundaryId]); } catch {}
      delete boundaryLayers.current[activeBoundaryId];
    }

    const poly = Lf.polygon(latLngs, {
      color, weight: 2, fillOpacity: 0.2, fillColor: color, dashArray: '5,4',
    }).addTo(map);

    let markers = [];
    let midMarkers = [];

    function buildMarkers() {
      markers.forEach(m => { try { map.removeLayer(m); } catch {} });
      midMarkers.forEach(m => { try { map.removeLayer(m); } catch {} });
      markers = [];
      midMarkers = [];

      latLngs.forEach((ll, i) => {
        // Main vertex marker
        const m = Lf.circleMarker(ll, {
          radius: 6, color: '#fff', fillColor: color,
          fillOpacity: 1, weight: 2, className: 'boundary-vertex',
        }).addTo(map);

        m.on('mousedown', () => {
          map.dragging.disable();
          function onMove(e) { 
            latLngs[i] = e.latlng;
            m.setLatLng(e.latlng); 
            poly.setLatLngs(latLngs);
            refreshMidMarkers();
          }
          function onUp() {
            map.dragging.enable();
            map.off('mousemove', onMove);
            map.off('mouseup',   onUp);
          }
          map.on('mousemove', onMove);
          map.on('mouseup',   onUp);
        });

        // Double click to delete vertex
        m.on('dblclick', (e) => {
          e.originalEvent?.stopPropagation();
          if (latLngs.length <= 3) return; // Cannot have less than 3 points
          latLngs.splice(i, 1);
          poly.setLatLngs(latLngs);
          buildMarkers(); // Rebuild everything due to index shift
        });

        markers.push(m);
      });

      // Midpoint markers
      refreshMidMarkers();
    }

    function refreshMidMarkers() {
      midMarkers.forEach(m => { try { map.removeLayer(m); } catch {} });
      midMarkers = [];

      for (let i = 0; i < latLngs.length; i++) {
        const p1 = latLngs[i];
        const p2 = latLngs[(i + 1) % latLngs.length];
        const mid = Lf.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);

        const mMid = Lf.circleMarker(mid, {
          radius: 5, color: '#fff', fillColor: color,
          fillOpacity: 0.5, weight: 1, className: 'boundary-vertex-mid',
        }).addTo(map);

        mMid.on('mousedown', () => {
          // Convert midpoint to real vertex
          latLngs.splice(i + 1, 0, mid);
          poly.setLatLngs(latLngs);
          buildMarkers();
          // The newly created marker at i+1 doesn't automatically start dragging, 
          // user will have to click and drag it.
        });
        midMarkers.push(mMid);
      }
      
      if (editLayerRef.current) {
        editLayerRef.current.markers = markers;
        editLayerRef.current.midMarkers = midMarkers;
      }
    }

    buildMarkers();

    function finishEdit() {
      if (!editLayerRef.current) return;
      const coords = [...latLngs, latLngs[0]].map((ll) => [ll.lng, ll.lat]);
      const newGeo = {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coords] },
        properties: {},
      };
      onMoveComplete(activeBoundaryId, newGeo);
    }

    function onKeyDown(e) {
      if (e.key === 'Enter') finishEdit();
      if (e.key === 'Escape') {
        if (editLayerRef.current) {
          try { map.removeLayer(editLayerRef.current.poly); } catch {}
          editLayerRef.current.markers.forEach((m) => { try { map.removeLayer(m); } catch {} });
          editLayerRef.current.midMarkers.forEach((m) => { try { map.removeLayer(m); } catch {} });
          editLayerRef.current = null;
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    editLayerRef.current = { poly, markers, finishEdit };

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (editLayerRef.current) {
        try { map.removeLayer(editLayerRef.current.poly); } catch {}
        editLayerRef.current.markers?.forEach((m) => { try { map.removeLayer(m); } catch {} });
        editLayerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawMode, activeBoundaryId]);

  // Expose finishEdit via ref so MapWorkspace toolbar can trigger "Apply"
  useImperativeHandle(ref, () => ({
    fitToBounds() {
      const map = mapRef.current;
      if (!map) return;
      const layers = Object.values(boundaryLayers.current);
      if (!layers.length) return;
      try {
        const group = L.current.featureGroup(layers);
        map.fitBounds(group.getBounds().pad(0.2));
      } catch {}
    },
    applyEdit() {
      editLayerRef.current?.finishEdit?.();
    },
  }));

  // ── Draw mode ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const Lf  = L.current;
    if (!map || !Lf) return;

    if (!drawingBoundary) {
      cleanupDraw(map, Lf);
      map.getContainer().style.cursor =
        drawMode === BOUNDARY_DRAW_MODE.POINTER ? 'default' :
        drawMode === BOUNDARY_DRAW_MODE.EDIT    ? 'grab'    : '';
      return;
    }

    map.getContainer().style.cursor = 'crosshair';

    // ── Polygon ──────────────────────────────────────────────────────────
    function onPolyClick(e) {
      if (drawMode !== BOUNDARY_DRAW_MODE.POLYGON) return;
      e.originalEvent?.stopPropagation();
      isDrawing.current = true;
      const pt = [e.latlng.lat, e.latlng.lng];
      drawPtsRef.current.push(pt);

      const m = Lf.circleMarker(e.latlng, {
        radius: 5, color: currentColor, fillColor: currentColor, fillOpacity: 1, weight: 2,
      }).addTo(map);
      drawMarkersRef.current.push(m);

      if (previewRef.current) map.removeLayer(previewRef.current);
      if (drawPtsRef.current.length > 1) {
        previewRef.current = Lf.polyline(drawPtsRef.current, {
          color: currentColor, weight: 2, dashArray: '6,4',
        }).addTo(map);
      }
    }

    function onPolyDblClick(e) {
      if (drawMode !== BOUNDARY_DRAW_MODE.POLYGON) return;
      const pts = drawPtsRef.current;
      if (pts.length < 3) return;
      e.originalEvent?.stopPropagation();
      finishPolygon(map, Lf, pts);
    }

    function finishPolygon(map, Lf, pts) {
      const coords = [...pts, pts[0]].map(([lat, lng]) => [lng, lat]);
      const geo = {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coords] },
        properties: {},
      };
      cleanupDraw(map, Lf);
      map.getContainer().style.cursor = '';
      onDrawComplete(geo, BOUNDARY_DRAW_MODE.POLYGON);
    }

    // ── Rectangle ────────────────────────────────────────────────────────
    function onMouseDown(e) {
      if (drawMode !== BOUNDARY_DRAW_MODE.RECTANGLE) return;
      if (e.originalEvent?.button !== 0) return;
      isDrawing.current = true;
      rectStartRef.current = e.latlng;
    }

    function onMouseMove(e) {
      if (drawMode !== BOUNDARY_DRAW_MODE.RECTANGLE || !isDrawing.current || !rectStartRef.current) return;
      if (rectLayerRef.current) map.removeLayer(rectLayerRef.current);
      rectLayerRef.current = Lf.rectangle(
        Lf.latLngBounds(rectStartRef.current, e.latlng),
        { color: currentColor, weight: 2, fillOpacity: 0.1, dashArray: '6,4' },
      ).addTo(map);
    }

    function onMouseUp(e) {
      if (drawMode !== BOUNDARY_DRAW_MODE.RECTANGLE || !isDrawing.current || !rectStartRef.current) return;
      isDrawing.current = false;
      const bounds = Lf.latLngBounds(rectStartRef.current, e.latlng);
      if (rectLayerRef.current) { map.removeLayer(rectLayerRef.current); rectLayerRef.current = null; }
      rectStartRef.current = null;

      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const coords = [
        [sw.lng, sw.lat], [ne.lng, sw.lat],
        [ne.lng, ne.lat], [sw.lng, ne.lat], [sw.lng, sw.lat],
      ];
      const geo = {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [coords] },
        properties: {},
      };
      cleanupDraw(map, Lf);
      map.getContainer().style.cursor = '';
      onDrawComplete(geo, BOUNDARY_DRAW_MODE.RECTANGLE);
    }

    function onKeyDown(e) {
      if (e.key === 'Enter' && drawMode === BOUNDARY_DRAW_MODE.POLYGON) {
        const pts = drawPtsRef.current;
        if (pts.length >= 3) finishPolygon(map, Lf, pts);
      }
      if (e.key === 'Escape') {
        cleanupDraw(map, Lf);
        map.getContainer().style.cursor = '';
      }
    }

    map.on('click',     onPolyClick);
    map.on('dblclick',  onPolyDblClick);
    map.on('mousedown', onMouseDown);
    map.on('mousemove', onMouseMove);
    map.on('mouseup',   onMouseUp);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      map.off('click',     onPolyClick);
      map.off('dblclick',  onPolyDblClick);
      map.off('mousedown', onMouseDown);
      map.off('mousemove', onMouseMove);
      map.off('mouseup',   onMouseUp);
      window.removeEventListener('keydown', onKeyDown);
      cleanupDraw(map, Lf);
      if (map.getContainer()) map.getContainer().style.cursor = '';
    };
  }, [drawingBoundary, drawMode, currentColor, onDrawComplete]);

  function cleanupDraw(map, Lf) {
    isDrawing.current = false;
    drawPtsRef.current = [];
    drawMarkersRef.current.forEach((m) => { try { map.removeLayer(m); } catch {} });
    drawMarkersRef.current = [];
    if (previewRef.current)   { try { map.removeLayer(previewRef.current); }   catch {} previewRef.current = null; }
    if (rectLayerRef.current) { try { map.removeLayer(rectLayerRef.current); } catch {} rectLayerRef.current = null; }
  }

  // ── Render Layouts ──────────────────────────────────────────────────────────
  const layoutLayers = useRef({});
  useEffect(() => {
    const map = mapRef.current;
    const Lf = L.current;
    if (!map || !Lf || !layouts) return;

    let changed = false;
    const newTargets = { ...portalTargets };

    const currentIds = layouts.map(l => l.id);
    for (const id in layoutLayers.current) {
      if (!currentIds.includes(parseInt(id))) {
        try { map.removeLayer(layoutLayers.current[id].marker); } catch {}
        delete layoutLayers.current[id];
        delete newTargets[id];
        changed = true;
      }
    }

    layouts.forEach(layout => {
      if (!layout.mapLatitude || !layout.mapLongitude) {
        if (layoutLayers.current[layout.id]) {
          try { map.removeLayer(layoutLayers.current[layout.id].marker); } catch {}
          delete layoutLayers.current[layout.id];
          delete newTargets[layout.id];
          changed = true;
        }
        return;
      }

      if (layoutLayers.current[layout.id]) {
        const { marker } = layoutLayers.current[layout.id];
        const draft = draftTransforms[layout.id];
        const lat = draft?.mapLatitude ?? layout.mapLatitude;
        const lng = draft?.mapLongitude ?? layout.mapLongitude;
        marker.setLatLng([lat, lng]);
      } else {
        const htmlStr = `<div id="cad-portal-${layout.id}" style="position:relative; width:0; height:0;"></div>`;
        const icon = Lf.divIcon({
          className: 'cad-layout-marker',
          html: htmlStr,
          iconSize: [0, 0],
          iconAnchor: [0, 0]
        });

        const marker = Lf.marker([layout.mapLatitude, layout.mapLongitude], {
          draggable: true,
          icon: icon
        }).addTo(map);

        marker.on('dragstart', () => {
          setSelectedLayoutId(layout.id);
        });
        
        marker.on('dragend', (e) => {
          const latlng = e.target.getLatLng();
          setDraftTransforms(prev => ({
            ...prev,
            [layout.id]: {
              ...(prev[layout.id] || {}),
              mapLatitude: latlng.lat,
              mapLongitude: latlng.lng,
              _dirty: true
            }
          }));
        });
        
        layoutLayers.current[layout.id] = { marker };
        
        const el = marker.getElement()?.querySelector(`#cad-portal-${layout.id}`);
        if (el) {
          layoutLayers.current[layout.id].portalDiv = el;
          newTargets[layout.id] = el;
          changed = true;
        }
      }
    });

    if (changed) {
      setPortalTargets(newTargets);
    }
  }, [layouts, leafletLoaded, draftTransforms]);



  // ── Search ─────────────────────────────────────────────────────────────────
  const handleSearch = useCallback(async (e) => {
    e?.preventDefault();
    if (!search.trim() || !mapRef.current) return;
    setSearching(true);
    try {
      const res  = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=json&limit=1`,
        { headers: { 'Accept-Language': 'en' } },
      );
      const data = await res.json();
      if (data[0]) mapRef.current.setView([+data[0].lat, +data[0].lon], 14);
    } catch { /* network */ } finally { setSearching(false); }
  }, [search]);

  return (
    <div className="relative w-full h-full">
      <style>{`
        @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        .leaflet-container { background: #1c1c1c; font-family: inherit; }
        .leaflet-tooltip-custom {
          background: rgba(15,15,15,0.92); border: 1px solid #3f3f46;
          color: #e4e4e7; font-size: 11px; padding: 3px 8px; border-radius: 6px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        }
        .boundary-vertex { cursor: move !important; }
      `}</style>

      {/* Search bar */}
      {!staticPreview && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[9000]">
          <form onSubmit={handleSearch} className="flex gap-1.5">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
                   width="13" height="13" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search place, city or lat,lng…"
                className="w-80 bg-zinc-950/95 backdrop-blur border border-zinc-700 rounded-xl
                           pl-9 pr-4 py-2 text-sm text-zinc-200 placeholder-zinc-600
                           focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <button type="submit" disabled={searching}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm
                               font-semibold rounded-xl transition-colors disabled:opacity-50">
              {searching ? '…' : 'Go'}
            </button>
          </form>
        </div>
      )}

      <div 
        ref={containerRef} 
        className="w-full h-full" 
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (!mapRef.current || !onLayoutDrop) return;
          try {
            const layoutData = e.dataTransfer.getData('application/json');
            if (!layoutData) return;
            const layout = JSON.parse(layoutData);
            
            const rect = containerRef.current.getBoundingClientRect();
            const point = L.current.point(e.clientX - rect.left, e.clientY - rect.top);
            const latlng = mapRef.current.containerPointToLatLng(point);
            
            onLayoutDrop(layout, latlng);
          } catch (err) {
            console.error("Drop error", err);
          }
        }}
        onClick={(e) => {
          // If we clicked on the map directly (not on a marker/portal), deselect
          if (e.target.classList.contains('leaflet-container')) {
            setSelectedLayoutId(null);
          }
        }}
      />

      {/* Floating Save Placement Button */}
      {Object.keys(draftTransforms).some(id => draftTransforms[id]._dirty) && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[9000]">
          <button
            onClick={() => {
              Object.keys(draftTransforms).forEach(id => {
                const draft = draftTransforms[id];
                if (draft._dirty && onLayoutUpdate) {
                  onLayoutUpdate(parseInt(id), {
                    mapLatitude: draft.mapLatitude,
                    mapLongitude: draft.mapLongitude,
                    mapScale: draft.mapScale,
                    mapRotation: draft.mapRotation
                  });
                }
              });
              setDraftTransforms({});
              setSelectedLayoutId(null);
            }}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-full shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all transform hover:scale-105 pointer-events-auto"
          >
            Save Placement
          </button>
        </div>
      )}

      {/* React Portals for Layouts */}
      {Object.keys(portalTargets).map(id => {
        const layout = layouts?.find(l => l.id === parseInt(id));
        if (!layout) return null;
        const target = portalTargets[id];
        const draft = draftTransforms[id] || {};
        
        const activeLayout = {
           ...layout,
           mapScale: draft.mapScale ?? layout.mapScale ?? 1,
           mapRotation: draft.mapRotation ?? layout.mapRotation ?? 0
        };

        return createPortal(
          <LayoutTransformNode
            layout={activeLayout}
            map={mapRef.current}
            isSelected={selectedLayoutId === layout.id}
            onSelect={() => setSelectedLayoutId(layout.id)}
            zoomScale={Math.pow(2, currentZoom - baseZoom)}
            onTransformChange={(newDraft) => {
              if (mapRef.current) mapRef.current.dragging.disable();
              if (layoutLayers.current[layout.id]?.marker) {
                layoutLayers.current[layout.id].marker.dragging.disable();
              }

              setDraftTransforms(prev => ({
                ...prev,
                [layout.id]: {
                  ...(prev[layout.id] || {}),
                  mapScale: newDraft.scaleX,
                  mapRotation: newDraft.rotation,
                  mapLatitude: newDraft.mapLatitude,
                  mapLongitude: newDraft.mapLongitude,
                  _dirty: true
                }
              }));
            }}
            onTransformEnd={(finalState) => {
              if (mapRef.current) mapRef.current.dragging.enable();
              if (layoutLayers.current[layout.id]?.marker) {
                layoutLayers.current[layout.id].marker.dragging.enable();
              }
            }}
          />,
          target
        );
      })}
    </div>
  );
});

export default LeafletMap;

// ─── Tile layer factory ────────────────────────────────────────────────────────
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
