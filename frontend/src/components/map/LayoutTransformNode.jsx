import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import { BASE_URL } from '@/lib/api';

export default function LayoutTransformNode({ 
  layout, 
  map,
  isSelected,
  onSelect,
  onTransformChange,
  onTransformEnd
}) {
  const [imgSize, setImgSize] = useState(null);
  const [svgUrl, setSvgUrl] = useState(null);
  const [interactionPolygon, setInteractionPolygon] = useState(null);

  // Portal into Leaflet custom layer
  const [portalNode, setPortalNode] = useState(null);
  const layerRef = useRef(null);
  
  // Mutable interaction state
  const stateRef = useRef({
    lat: layout.mapLatitude,
    lng: layout.mapLongitude,
    scale: layout.mapScale || 1,
    rot: layout.mapRotation || 0
  });

  // Sync props to stateRef when updated externally
  useEffect(() => {
    stateRef.current = {
      lat: layout.mapLatitude,
      lng: layout.mapLongitude,
      scale: layout.mapScale || 1,
      rot: layout.mapRotation || 0
    };
    if (layerRef.current) layerRef.current.updateState();
  }, [layout.mapLatitude, layout.mapLongitude, layout.mapScale, layout.mapRotation]);

  useEffect(() => {
    const url = `${BASE_URL}/api/cad-conversion/${layout.id}/composite-svg?t=${layout.updatedAt || Date.now()}`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        const blob = new Blob([data.svg], { type: 'image/svg+xml' });
        setSvgUrl(URL.createObjectURL(blob));
        if (data.interactionPolygon) {
          setInteractionPolygon(data.interactionPolygon);
        } else if (data.geometry) {
          const g = data.geometry;
          setInteractionPolygon({
            vertices: [
              [g.left, g.top], [g.left + g.width, g.top],
              [g.left + g.width, g.top + g.height], [g.left, g.top + g.height]
            ],
            centroid: [g.left + g.width / 2, g.top + g.height / 2],
            bounds: g
          });
        }
      })
      .catch(console.error);
  }, [layout.id, layout.updatedAt]);

  // Create Leaflet Custom Layer
  useEffect(() => {
    if (!map || !imgSize || !interactionPolygon) return;

    // The geographic center of the layout corresponds to the mathematical centroid of the polygon
    const centroidPx = {
      x: interactionPolygon.centroid[0] * imgSize.w,
      y: interactionPolygon.centroid[1] * imgSize.h
    };

    const CustomOverlay = L.Layer.extend({
      onAdd(m) {
        this._map = m;
        this._container = L.DomUtil.create('div', 'leaflet-zoom-animated cad-transform-node group');
        this._container.style.position = 'absolute';
        // We set the CSS transform-origin to the polygon centroid
        this._container.style.transformOrigin = `${centroidPx.x}px ${centroidPx.y}px`;
        
        setPortalNode(this._container);

        const pane = m.getPane ? m.getPane('overlayPane') : (m.getPanes ? m.getPanes().overlayPane : null);
        if (pane) pane.appendChild(this._container);

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
      _getPxBounds(zoom, center) {
        const state = stateRef.current;
        let centerLp;
        if (zoom !== undefined && center !== undefined) {
          centerLp = this._map._latLngToNewLayerPoint([state.lat, state.lng], zoom, center);
        } else {
          centerLp = this._map.latLngToLayerPoint([state.lat, state.lng]);
        }

        return { centerLp };
      },
      _update() {
        if (!this._map || !this._container) return;
        const state = stateRef.current;
        const { centerLp } = this._getPxBounds();
        
        // Calculate the base pixel scale (map scale * current map zoom scale)
        // Wait, L.DomUtil.setTransform applies translate3d and scale.
        // It's cleaner to position the container top-left so that its origin is at centerLp minus centroid
        const zoomScale = Math.pow(2, this._map.getZoom() - 17); // Or use any base zoom, mapScale handles relative sizing
        const finalScale = state.scale * zoomScale;
        
        const topLeftPoint = L.point(centerLp.x - centroidPx.x, centerLp.y - centroidPx.y);
        
        // We don't use L.DomUtil.setTransform because it wipes our custom CSS rotation. 
        // Instead, we manipulate CSS directly, mirroring the native approach.
        L.DomUtil.setPosition(this._container, topLeftPoint);
        this._container.style.transform = `${this._container.style.transform.replace(/rotate\([^)]*\)/g, '').trim()} rotate(${state.rot}deg) scale(${finalScale})`;
        
        // Pass scale to CSS var for child handles to invert
        this._container.style.setProperty('--combined-scale', finalScale);
      },
      _animateZoom(e) {
        if (!this._map || !this._container) return;
        const state = stateRef.current;
        const { centerLp } = this._getPxBounds(e.zoom, e.center);
        
        const zoomScale = Math.pow(2, e.zoom - 17);
        const finalScale = state.scale * zoomScale;
        
        const topLeftPoint = L.point(centerLp.x - centroidPx.x, centerLp.y - centroidPx.y);
        
        L.DomUtil.setTransform(this._container, topLeftPoint, 1); 
        this._container.style.transform = `${this._container.style.transform.replace(/rotate\([^)]*\)/g, '').trim()} rotate(${state.rot}deg) scale(${finalScale})`;
        this._container.style.setProperty('--combined-scale', finalScale);
      }
    });

    const layer = new CustomOverlay();
    map.addLayer(layer);
    layerRef.current = layer;

    return () => {
      try { map.removeLayer(layer); } catch {}
      layerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, imgSize, interactionPolygon]);

  // Math Helper
  const rotatePoint = (pt, angleDeg) => {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return { x: pt.x * cos - pt.y * sin, y: pt.x * sin + pt.y * cos };
  };

  const isTransforming = useRef(false);

  const handlePointerDown = (e, type, vertexIndex) => {
    if (!isSelected || !map || !interactionPolygon || !imgSize) return;
    e.stopPropagation();
    e.preventDefault();

    isTransforming.current = true;
    const snap = { ...stateRef.current };
    
    // Zoom scale coefficient
    const zoomScale = Math.pow(2, map.getZoom() - 17);

    const centerLp = map.latLngToLayerPoint([snap.lat, snap.lng]);
    const centroidPx = { x: interactionPolygon.centroid[0] * imgSize.w, y: interactionPolygon.centroid[1] * imgSize.h };

    let fixedAnchorLocal = { x: 0, y: 0 };
    if (type === 'resize' && vertexIndex !== null) {
      // vertexIndex here is now the actual grabbed pixel coordinate {x, y}
      const gx = vertexIndex.x;
      const gy = vertexIndex.y;
      
      let maxDistSq = -1;
      const vertices = interactionPolygon.vertices;
      for (let i = 0; i < vertices.length; i++) {
        const vx = vertices[i][0] * imgSize.w;
        const vy = vertices[i][1] * imgSize.h;
        const distSq = (vx - gx) ** 2 + (vy - gy) ** 2;
        if (distSq > maxDistSq) {
          maxDistSq = distSq;
          fixedAnchorLocal = { x: vx, y: vy };
        }
      }
      fixedAnchorLocal = { x: fixedAnchorLocal.x - centroidPx.x, y: fixedAnchorLocal.y - centroidPx.y };
    }

    const startX = e.clientX;
    const startY = e.clientY;

    const onPointerMove = (moveEv) => {
      moveEv.stopPropagation();
      moveEv.preventDefault();

      if (type === 'move') {
        const dX = moveEv.clientX - startX;
        const dY = moveEv.clientY - startY;
        const ll1 = map.containerPointToLatLng([0, 0]);
        const ll2 = map.containerPointToLatLng([dX, dY]);
        const dLng = ll2.lng - ll1.lng;
        const dLat = ll2.lat - ll1.lat;
        
        stateRef.current.lat = snap.lat + dLat;
        stateRef.current.lng = snap.lng + dLng;
      } 
      else if (type === 'rotate') {
        const mouseLp = map.mouseEventToLayerPoint(moveEv);
        const dx = mouseLp.x - centerLp.x;
        const dy = mouseLp.y - centerLp.y;
        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
        angle += 90;
        stateRef.current.rot = angle;
      } 
      else if (type === 'resize' && vertexIndex !== null) {
        const mouseLp = map.mouseEventToLayerPoint(moveEv);
        const R = snap.rot;
        const S = snap.scale;
        const Z = zoomScale;

        const fixedLocalScaled = { x: fixedAnchorLocal.x * S * Z, y: fixedAnchorLocal.y * S * Z };
        const fixedRotated = rotatePoint(fixedLocalScaled, R);
        const fixedLp = { x: centerLp.x + fixedRotated.x, y: centerLp.y + fixedRotated.y };

        const deltaLp = { x: mouseLp.x - centerLp.x, y: mouseLp.y - centerLp.y };
        const localMouseScaled = rotatePoint(deltaLp, -R);
        const localMouse = { x: localMouseScaled.x / (S * Z), y: localMouseScaled.y / (S * Z) };

        const gx = vertexIndex.x;
        const gy = vertexIndex.y;
        const startLocalX = gx - centroidPx.x;
        const startLocalY = gy - centroidPx.y;
        
        const originalDistSq = (startLocalX - fixedAnchorLocal.x) ** 2 + (startLocalY - fixedAnchorLocal.y) ** 2;
        const newDistSq = (localMouse.x - fixedAnchorLocal.x) ** 2 + (localMouse.y - fixedAnchorLocal.y) ** 2;
        if (originalDistSq < 1) return;
        
        const scaleRatio = Math.sqrt(newDistSq / originalDistSq);
        let newScale = S * scaleRatio;
        if (newScale < 0.001) newScale = 0.001;

        const newFixedLocalScaled = { x: fixedAnchorLocal.x * newScale * Z, y: fixedAnchorLocal.y * newScale * Z };
        const newFixedRotated = rotatePoint(newFixedLocalScaled, R);
        const newCenterLp = { x: fixedLp.x - newFixedRotated.x, y: fixedLp.y - newFixedRotated.y };

        const newLatLng = map.layerPointToLatLng(newCenterLp);
        
        stateRef.current.scale = newScale;
        stateRef.current.lat = newLatLng.lat;
        stateRef.current.lng = newLatLng.lng;
      }

      // Sync layer natively without React overhead
      if (layerRef.current) layerRef.current.updateState();
    };

    const onPointerUp = (upEv) => {
      upEv.stopPropagation();
      upEv.preventDefault();
      
      isTransforming.current = false;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      
      onTransformChange({
        mapScale: stateRef.current.scale,
        mapRotation: stateRef.current.rot,
        mapLatitude: stateRef.current.lat,
        mapLongitude: stateRef.current.lng
      });
      onTransformEnd();
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  };

  if (!imgSize || !svgUrl || !interactionPolygon || !portalNode) {
    return (
      <div style={{ opacity: 0, position: 'absolute', pointerEvents: 'none' }}>
        {svgUrl && <img 
          src={svgUrl} 
          onLoad={(e) => setImgSize({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
          alt="layout preview"
        />}
      </div>
    );
  }

  const polygonPoints = interactionPolygon.vertices.map(v => `${v[0] * imgSize.w},${v[1] * imgSize.h}`).join(' ');
  const centroidPx = { x: interactionPolygon.centroid[0] * imgSize.w, y: interactionPolygon.centroid[1] * imgSize.h };

  // 1. Generate Vertex Handles
  const verticesPx = interactionPolygon.vertices.map(v => ({ x: v[0] * imgSize.w, y: v[1] * imgSize.h }));
  
  // 2. Generate Edge Midpoint Handles
  const midpointsPx = [];
  const edges = [];
  for (let i = 0; i < verticesPx.length; i++) {
    const p1 = verticesPx[i];
    const p2 = verticesPx[(i + 1) % verticesPx.length];
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    midpointsPx.push({ x: mx, y: my });
    edges.push({ p1, p2, mx, my });
  }

  // 3. Find Top-most Edge (minimum Y at midpoint)
  let topEdge = edges[0];
  for (const edge of edges) {
    if (edge.my < topEdge.my) topEdge = edge;
  }

  // 4. Calculate Outward Normal for Rotation Handle
  const dx = topEdge.p2.x - topEdge.p1.x;
  const dy = topEdge.p2.y - topEdge.p1.y;
  let nx = -dy; // perpendicular
  let ny = dx;
  const len = Math.sqrt(nx * nx + ny * ny);
  if (len > 0) { nx /= len; ny /= len; }
  
  // Ensure normal points OUTWARD (away from centroid)
  const toCentroidX = centroidPx.x - topEdge.mx;
  const toCentroidY = centroidPx.y - topEdge.my;
  const dot = nx * toCentroidX + ny * toCentroidY;
  if (dot > 0) {
    nx = -nx; ny = -ny; // Flip to point outward
  }

  // Position rotation handle 40px outward
  const rotHandlePx = { x: topEdge.mx + nx * 40, y: topEdge.my + ny * 40 };

  const content = (
    <div style={{ width: `${imgSize.w}px`, height: `${imgSize.h}px`, pointerEvents: 'none', userSelect: 'none' }}>
      <img 
        src={svgUrl} 
        style={{ width: '100%', height: '100%', opacity: 0.85, pointerEvents: 'none' }} 
        draggable="false"
        alt="cad layout"
      />
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
        <polygon 
          points={polygonPoints} 
          fill="transparent" 
          stroke={isSelected ? "#3b82f6" : "transparent"} 
          strokeWidth={isSelected ? 'calc(1.5 / var(--combined-scale))' : 0}
          strokeLinejoin="round"
          style={{ pointerEvents: 'auto', cursor: isSelected ? 'move' : 'pointer' }}
          onClick={(e) => { e.stopPropagation(); if (!isSelected && onSelect) onSelect(); }}
          onPointerDown={(e) => handlePointerDown(e, 'move', null)}
        />
        {isSelected && (
          <line 
            x1={topEdge.mx} y1={topEdge.my} 
            x2={`calc(${topEdge.mx}px + ${nx} * 40px / var(--combined-scale))`} 
            y2={`calc(${topEdge.my}px + ${ny} * 40px / var(--combined-scale))`} 
            stroke="#3b82f6" strokeWidth="calc(1.5 / var(--combined-scale))" 
            pointerEvents="none"
          />
        )}
      </svg>
      {isSelected && (
        <>
          {/* Centroid Crosshair */}
          <div className="absolute w-2 h-2 rounded-full border border-[#3b82f6] pointer-events-none" 
               style={{ left: `${centroidPx.x}px`, top: `${centroidPx.y}px`, transform: `translate(-50%, -50%) scale(calc(1 / var(--combined-scale)))` }}>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-full bg-[#3b82f6]"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-0.5 bg-[#3b82f6]"></div>
          </div>
          
          {/* Rotation Handle */}
          <div 
            className="absolute w-4 h-4 bg-white border-2 border-[#3b82f6] rounded-full cursor-crosshair hover:scale-125 transition-transform shadow-md"
            style={{ 
              left: `calc(${topEdge.mx}px + ${nx} * 40px / var(--combined-scale))`, 
              top: `calc(${topEdge.my}px + ${ny} * 40px / var(--combined-scale))`, 
              transform: `translate(-50%, -50%) scale(calc(1 / var(--combined-scale)))`, 
              transformOrigin: 'center', pointerEvents: 'auto' 
            }}
            onPointerDown={(e) => handlePointerDown(e, 'rotate', null)}
            title="Rotate"
          ></div>

          {/* Vertex Handles */}
          {verticesPx.map((v, idx) => (
            <Handle key={`v-${idx}`} x={v.x} y={v.y} onDown={e => handlePointerDown(e, 'resize', v)} />
          ))}

          {/* Midpoint Handles */}
          {midpointsPx.map((m, idx) => (
            <Handle key={`m-${idx}`} x={m.x} y={m.y} onDown={e => handlePointerDown(e, 'resize', m)} />
          ))}
        </>
      )}
    </div>
  );

  return createPortal(content, portalNode);
}

function Handle({ x, y, onDown }) {
  return (
    <div 
      className="absolute bg-white border-2 border-[#3b82f6] shadow-sm pointer-events-auto"
      style={{ left: `${x}px`, top: `${y}px`, width: '10px', height: '10px', transform: `translate(-50%, -50%) scale(calc(1 / var(--combined-scale)))`, cursor: 'crosshair' }}
      onPointerDown={onDown}
    ></div>
  );
}
