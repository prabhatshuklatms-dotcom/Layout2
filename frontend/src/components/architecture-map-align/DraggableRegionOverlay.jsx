'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import { getPreviewUrl } from '@/lib/api';

/**
 * DraggableRegionOverlay
 * Renders an architecture region image as a positioned Leaflet layer.
 * Receives the vanilla Leaflet map instance via the `map` prop
 * (no React-Leaflet context needed).
 */
export default function DraggableRegionOverlay({ map, alignment, isActive, onClick, onSave, onDelete }) {
  const layerRef = useRef(null);
  const [portalNode, setPortalNode] = useState(null);
  // Keep fresh values accessible inside the Leaflet layer closure without re-creating the layer
  const [localLat, setLocalLat] = useState(alignment.latitude);
  const [localLng, setLocalLng] = useState(alignment.longitude);
  const [localW, setLocalW] = useState(alignment.width);
  const [localH, setLocalH] = useState(alignment.height);
  const [localRot, setLocalRot] = useState(alignment.rotation || 0);
  const [localOpacity, setLocalOpacity] = useState(alignment.opacity ?? 1);
  const [isDragging, setIsDragging] = useState(false);
  const stateRef = useRef({ lat: alignment.latitude, lng: alignment.longitude, w: alignment.width, h: alignment.height, rot: alignment.rotation || 0 });

  // Sync props to local state when alignment is updated externally
  useEffect(() => {
    setLocalLat(alignment.latitude);
    setLocalLng(alignment.longitude);
    setLocalW(alignment.width);
    setLocalH(alignment.height);
    setLocalRot(alignment.rotation || 0);
    setLocalOpacity(alignment.opacity ?? 1);
  }, [alignment]);

  // ── Mount / unmount custom Leaflet layer ──────────────────────────────────
  useEffect(() => {
    if (!map) return;

    const CustomOverlay = L.Layer.extend({
      onAdd(m) {
        this._map = m;
        this._container = L.DomUtil.create('div', 'leaflet-zoom-animated');
        this._container.style.position = 'absolute';
        this._container.style.transformOrigin = '0 0';
        
        // Notify React to portal into this container
        setPortalNode(this._container);

        const pane = m.getPane ? m.getPane('overlayPane') : (m.getPanes ? m.getPanes().overlayPane : null);
        const fallbackPane = m.getPane ? m.getPane('mapPane') : (m.getPanes ? m.getPanes().mapPane : null);
        
        const targetPane = pane || fallbackPane;
        if (targetPane) {
          targetPane.appendChild(this._container);
        } else {
          console.error('[DraggableRegionOverlay] Could not find a Leaflet pane to attach to.', m);
        }
        
        m.on('zoomend viewreset', this._update, this);
        m.on('zoomanim', this._animateZoom, this);
        this._update();
      },
      onRemove(m) {
        m.off('zoomend viewreset', this._update, this);
        m.off('zoomanim', this._animateZoom, this);
        if (this._container?.parentNode) this._container.parentNode.removeChild(this._container);
        setPortalNode(null);
      },
      updateState() {
        this._update();
      },
      _getBounds(lat, lng, w, h) {
        // Convert width/height in meters to lat/lng degrees accurately
        const dLat = (h / 2) / 111320;
        const dLng = (w / 2) / (111320 * Math.cos(lat * Math.PI / 180));
        return L.latLngBounds(
          [lat + dLat, lng - dLng], // NW
          [lat - dLat, lng + dLng]  // SE
        );
      },
      _update() {
        const { lat, lng, w, h } = stateRef.current;
        if (!this._map || lat === undefined) return;
        
        const bounds = this._getBounds(lat, lng, w, h);
        const nw = this._map.latLngToLayerPoint(bounds.getNorthWest());
        const se = this._map.latLngToLayerPoint(bounds.getSouthEast());
        
        const pxW = se.x - nw.x;
        const pxH = se.y - nw.y;
        
        L.DomUtil.setPosition(this._container, nw);
        this._container.style.width  = `${pxW}px`;
        this._container.style.height = `${pxH}px`;
      },
      _animateZoom(e) {
        const { lat, lng, w, h } = stateRef.current;
        if (!this._map || lat === undefined) return;
        
        const bounds = this._getBounds(lat, lng, w, h);
        const topLeft = this._map._latLngToNewLayerPoint(bounds.getNorthWest(), e.zoom, e.center);
        const scale = this._map.getZoomScale(e.zoom);
        
        L.DomUtil.setTransform(this._container, topLeft, scale);
      },
    });

    const layer = new CustomOverlay();
    map.addLayer(layer);
    layerRef.current = layer;

    return () => {
      try { map.removeLayer(layer); } catch {}
      layerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Re-trigger layer position update when local state changes
  useEffect(() => {
    stateRef.current = { lat: localLat, lng: localLng, w: localW, h: localH, rot: localRot };
    if (layerRef.current) {
      layerRef.current.updateState();
    }
  }, [localLat, localLng, localW, localH, localRot]);

  // ── Drag to reposition ────────────────────────────────────────────────────
  const handleDragStart = (e) => {
    if (!isActive) return;
    e.stopPropagation();
    e.preventDefault();
    setIsDragging(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startLat = stateRef.current.lat;
    const startLng = stateRef.current.lng;

    const onMouseMove = (mv) => {
      const ll1 = map.containerPointToLatLng([0, 0]);
      const ll2 = map.containerPointToLatLng([mv.clientX - startX, mv.clientY - startY]);
      
      const dLng = ll2.lng - ll1.lng;
      const dLat = ll2.lat - ll1.lat;
      
      setLocalLat(startLat + dLat);
      setLocalLng(startLng + dLng);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleResizeStart = (e, dir) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const snap = { ...stateRef.current };

    const onMouseMove = (mv) => {
      const dx = mv.clientX - startX;
      const dy = mv.clientY - startY;

      // Unrotate the pixel delta
      const rad = -(snap.rot) * Math.PI / 180;
      const dpX = dx * Math.cos(rad) - dy * Math.sin(rad);
      const dpY = dx * Math.sin(rad) + dy * Math.cos(rad);

      let deltaW = 0, deltaH = 0;
      let shiftX = 0, shiftY = 0;

      if (dir.includes('e')) { deltaW = dpX;  shiftX = dpX / 2; }
      if (dir.includes('w')) { deltaW = -dpX; shiftX = dpX / 2; }
      if (dir.includes('s')) { deltaH = dpY;  shiftY = dpY / 2; }
      if (dir.includes('n')) { deltaH = -dpY; shiftY = dpY / 2; }

      // Convert pixel deltas to meters for width/height
      const metersPerPx = (40075016.686 * Math.abs(Math.cos(snap.lat * Math.PI / 180))) / Math.pow(2, map.getZoom() + 8);
      const newW = Math.max(1, snap.w + deltaW * metersPerPx);
      const newH = Math.max(1, snap.h + deltaH * metersPerPx);

      // Rotate the local center shift back to screen coordinates
      const rad2 = snap.rot * Math.PI / 180;
      const screen_cx = shiftX * Math.cos(rad2) - shiftY * Math.sin(rad2);
      const screen_cy = shiftX * Math.sin(rad2) + shiftY * Math.cos(rad2);

      // Apply screen pixel shift to the current center
      const centerPx = map.latLngToContainerPoint([snap.lat, snap.lng]);
      const newLatLng = map.containerPointToLatLng(L.point(centerPx.x + screen_cx, centerPx.y + screen_cy));

      setLocalW(newW);
      setLocalH(newH);
      setLocalLng(newLatLng.lng);
      setLocalLat(newLatLng.lat);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleRotateStart = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const snap = { ...stateRef.current };

    const cp = map.latLngToContainerPoint([snap.lat, snap.lng]);
    const rect = map.getContainer().getBoundingClientRect();
    const centerScreenX = cp.x + rect.left;
    const centerScreenY = cp.y + rect.top;

    const startA = Math.atan2(e.clientY - centerScreenY, e.clientX - centerScreenX);
    const startRot = snap.rot;

    const onMouseMove = (mv) => {
      const a = Math.atan2(mv.clientY - centerScreenY, mv.clientX - centerScreenX);
      setLocalRot(startRot + (a - startA) * 180 / Math.PI);
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const renderHandles = () => {
    if (!isActive) return null;
    const handles = [
      { id: 'nw', top: '-4px', left: '-4px', cursor: 'nwse-resize' },
      { id: 'ne', top: '-4px', right: '-4px', cursor: 'nesw-resize' },
      { id: 'se', bottom: '-4px', right: '-4px', cursor: 'nwse-resize' },
      { id: 'sw', bottom: '-4px', left: '-4px', cursor: 'nesw-resize' },
      { id: 'n', top: '-4px', left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' },
      { id: 's', bottom: '-4px', left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' },
      { id: 'e', top: '50%', right: '-4px', transform: 'translateY(-50%)', cursor: 'ew-resize' },
      { id: 'w', top: '50%', left: '-4px', transform: 'translateY(-50%)', cursor: 'ew-resize' },
    ];

    return (
      <>
        <div className="absolute inset-0 border-2 border-emerald-500 pointer-events-none" />
        
        {handles.map(h => (
          <div
            key={h.id}
            onMouseDown={(e) => handleResizeStart(e, h.id)}
            className="absolute w-2 h-2 bg-black border-[1.5px] border-emerald-500 pointer-events-auto shadow-sm"
            style={{
              top: h.top, bottom: h.bottom, left: h.left, right: h.right,
              transform: h.transform, cursor: h.cursor
            }}
          />
        ))}

        <div 
          className="absolute left-1/2 -top-10 w-px h-10 border-l-[1.5px] border-dashed border-indigo-500 pointer-events-none"
          style={{ transform: 'translateX(-50%)' }}
        />
        <div
          onMouseDown={handleRotateStart}
          className="absolute left-1/2 -top-10 w-4 h-4 bg-indigo-500 border-2 border-white rounded-full pointer-events-auto cursor-crosshair shadow-sm hover:scale-110 transition-transform"
          style={{ transform: 'translate(-50%, -50%)' }}
        />
      </>
    );
  };

  const content = (
    <div
      onMouseDown={handleDragStart}
      onClick={onClick}
      className={`absolute inset-0 w-full h-full origin-center select-none ${isActive ? 'z-50' : 'z-10'} ${isActive ? 'cursor-move' : 'cursor-pointer'}`}
      style={{
        transform: `rotate(${localRot}deg)`,
        opacity: localOpacity,
        pointerEvents: 'auto',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getPreviewUrl(alignment.architectureRegion?.architectureFileId)}
        alt="Overlay"
        draggable={false}
        className="w-full h-full object-fill pointer-events-none"
      />

      {renderHandles()}

      {isActive && (
        <div
          className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-700 p-1 flex items-center gap-2 rounded shadow-xl pointer-events-auto w-max"
          onMouseDown={e => e.stopPropagation()}
        >
          <button
            onClick={() => onSave({
              ...alignment,
              latitude: localLat, longitude: localLng,
              width: localW, height: localH,
              rotation: localRot, opacity: localOpacity,
            })}
            className="text-[10px] bg-indigo-600 px-3 py-1 rounded text-white hover:bg-indigo-500 font-medium"
          >Save</button>
          <button
            onClick={onDelete}
            className="text-[10px] bg-red-600/20 px-3 py-1 rounded text-red-500 hover:bg-red-600/30 font-medium"
          >Delete</button>
          
          <div className="w-px h-4 bg-zinc-700 mx-1" />
          
          <label className="text-[10px] text-zinc-400 font-medium">Opacity</label>
          <input
            type="range" min="0.1" max="1" step="0.05"
            value={localOpacity}
            onChange={e => setLocalOpacity(parseFloat(e.target.value))}
            className="w-16 accent-indigo-500"
          />
        </div>
      )}
    </div>
  );

  return portalNode ? createPortal(content, portalNode) : null;
}
