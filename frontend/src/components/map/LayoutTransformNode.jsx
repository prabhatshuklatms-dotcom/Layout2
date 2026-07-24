import React, { useState, useEffect, useRef } from 'react';
import { BASE_URL } from '@/lib/api';

export default function LayoutTransformNode({ 
  layout, 
  map,
  isSelected, 
  onSelect,
  zoomScale,
  onTransformChange,
  onTransformEnd
}) {
  const containerRef = useRef(null);
  const [imgSize, setImgSize] = useState(null); // { w, h }

  // Draft state matches layout exactly initially
  const [draft, setDraft] = useState({
    mapScale: layout.mapScale || 1,
    mapRotation: layout.mapRotation || 0,
    mapLatitude: layout.mapLatitude,
    mapLongitude: layout.mapLongitude
  });

  useEffect(() => {
    setDraft({
      mapScale: layout.mapScale || 1,
      mapRotation: layout.mapRotation || 0,
      mapLatitude: layout.mapLatitude,
      mapLongitude: layout.mapLongitude
    });
  }, [layout.mapScale, layout.mapRotation, layout.mapLatitude, layout.mapLongitude]);

  const isTransforming = useRef(false);

  // --- Math Helpers ---
  const rotatePoint = (pt, angleDeg) => {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
      x: pt.x * cos - pt.y * sin,
      y: pt.x * sin + pt.y * cos
    };
  };

  // --- Interaction Handlers ---
  const handlePointerDown = (e, type, dir) => {
    if (!isSelected || !map || !imgSize) return;
    e.stopPropagation();
    e.preventDefault();

    isTransforming.current = true;
    const startDraft = { ...draft };
    
    // Initial center in LayerPoints
    const centerLp = map.latLngToLayerPoint([startDraft.mapLatitude, startDraft.mapLongitude]);

    const onPointerMove = (moveEv) => {
      moveEv.stopPropagation();
      moveEv.preventDefault();

      const mouseLp = map.mouseEventToLayerPoint(moveEv);

      if (type === 'rotate') {
        const dx = mouseLp.x - centerLp.x;
        const dy = mouseLp.y - centerLp.y;
        let angle = Math.atan2(dy, dx) * (180 / Math.PI);
        angle += 90; // Handle is at the top
        
        const newDraft = { ...startDraft, mapRotation: angle };
        setDraft(newDraft);
        onTransformChange({
          scaleX: newDraft.mapScale,
          rotation: newDraft.mapRotation,
          mapLatitude: newDraft.mapLatitude,
          mapLongitude: newDraft.mapLongitude
        });
      } 
      else if (type === 'resize') {
        const R = startDraft.mapRotation;
        const S = startDraft.mapScale;
        const Z = zoomScale;

        // Fixed anchors in local unscaled intrinsic space
        // Origin is center (0,0)
        let fx = 0, fy = 0;
        const w2 = imgSize.w / 2;
        const h2 = imgSize.h / 2;

        if (dir === 'nw') { fx = w2; fy = h2; }
        if (dir === 'ne') { fx = -w2; fy = h2; }
        if (dir === 'sw') { fx = w2; fy = -h2; }
        if (dir === 'se') { fx = -w2; fy = -h2; }
        if (dir === 'n')  { fx = 0; fy = h2; }
        if (dir === 's')  { fx = 0; fy = -h2; }
        if (dir === 'e')  { fx = -w2; fy = 0; }
        if (dir === 'w')  { fx = w2; fy = 0; }

        // Absolute fixed point in LayerPoints
        const fixedLocalScaled = { x: fx * S * Z, y: fy * S * Z };
        const fixedRotated = rotatePoint(fixedLocalScaled, R);
        const fixedLp = { x: centerLp.x + fixedRotated.x, y: centerLp.y + fixedRotated.y };

        // Mouse relative to old center, unrotated and unscaled
        const deltaLp = { x: mouseLp.x - centerLp.x, y: mouseLp.y - centerLp.y };
        const localMouseScaled = rotatePoint(deltaLp, -R);
        const localMouse = { 
          x: localMouseScaled.x / (S * Z), 
          y: localMouseScaled.y / (S * Z) 
        };

        // Determine new width/height in intrinsic space
        let newW = imgSize.w;
        let newH = imgSize.h;

        if (dir.includes('n')) newH = fy - localMouse.y;
        if (dir.includes('s')) newH = localMouse.y - fy;
        if (dir.includes('w')) newW = fx - localMouse.x;
        if (dir.includes('e')) newW = localMouse.x - fx;

        // Force proportional scaling
        let scaleRatio = 1;
        if (['nw','ne','sw','se'].includes(dir)) {
          scaleRatio = Math.max(newW / imgSize.w, newH / imgSize.h);
        } else if (['n','s'].includes(dir)) {
          scaleRatio = newH / imgSize.h;
        } else if (['e','w'].includes(dir)) {
          scaleRatio = newW / imgSize.w;
        }

        let newScale = S * scaleRatio;
        if (newScale < 0.05) newScale = 0.05; // min scale

        // Calculate new center
        const newFixedLocalScaled = { x: fx * newScale * Z, y: fy * newScale * Z };
        const newFixedRotated = rotatePoint(newFixedLocalScaled, R);
        const newCenterLp = { x: fixedLp.x - newFixedRotated.x, y: fixedLp.y - newFixedRotated.y };

        // Convert back to latLng
        const newLatLng = map.layerPointToLatLng(newCenterLp);

        const newDraft = { 
          ...startDraft, 
          mapScale: newScale,
          mapLatitude: newLatLng.lat,
          mapLongitude: newLatLng.lng
        };
        setDraft(newDraft);
        onTransformChange({
          scaleX: newDraft.mapScale,
          rotation: newDraft.mapRotation,
          mapLatitude: newDraft.mapLatitude,
          mapLongitude: newDraft.mapLongitude
        });
      }
    };

    const onPointerUp = (upEv) => {
      upEv.stopPropagation();
      upEv.preventDefault();
      isTransforming.current = false;
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      
      onTransformEnd();
    };

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  };

  const svgUrl = `${BASE_URL}/api/cad-conversion/${layout.id}/composite-svg?t=${layout.updatedAt || Date.now()}`;

  const combinedScale = draft.mapScale * zoomScale;
  
  // If img hasn't loaded, hide everything except the img itself (so it can load)
  if (!imgSize) {
    return (
      <div style={{ opacity: 0, position: 'absolute', pointerEvents: 'none' }}>
        <img 
          src={svgUrl} 
          onLoad={(e) => {
            setImgSize({ w: e.target.naturalWidth, h: e.target.naturalHeight });
          }}
        />
      </div>
    );
  }

  const transformStyle = {
    position: 'absolute',
    left: 0,
    top: 0,
    transform: `translate(-50%, -50%) rotate(${draft.mapRotation}deg) scale(${combinedScale})`,
    transformOrigin: 'center center',
    width: `${imgSize.w}px`,
    height: `${imgSize.h}px`,
    pointerEvents: 'auto',
    cursor: isSelected ? 'move' : 'pointer',
    border: isSelected ? '1.5px solid #3b82f6' : 'none',
    boxShadow: isSelected ? '0 0 0 1px rgba(255,255,255,0.2)' : 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none',
  };

  return (
    <div 
      ref={containerRef}
      style={transformStyle}
      onClick={(e) => {
        if (!isSelected) {
          e.stopPropagation();
          onSelect();
        }
      }}
      className="cad-transform-node group"
    >
      <img 
        src={svgUrl} 
        style={{ width: '100%', height: '100%', opacity: 0.85, pointerEvents: 'none' }} 
        draggable="false" 
      />

      {isSelected && (
        <>
          {/* Center Pivot */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-[#3b82f6] pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-full bg-[#3b82f6]"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-0.5 bg-[#3b82f6]"></div>
          </div>

          {/* Rotation Handle & Line */}
          <div className="absolute left-1/2 -top-8 -translate-x-1/2 w-px h-8 bg-[#3b82f6] pointer-events-none" style={{ transform: `scaleY(${1/combinedScale})`, transformOrigin: 'bottom' }}></div>
          <div 
            className="absolute left-1/2 -top-10 -translate-x-1/2 w-4 h-4 bg-white border-2 border-[#3b82f6] rounded-full cursor-pointer hover:scale-125 transition-transform"
            style={{ transform: `translate(-50%, -50%) scale(${1/combinedScale})`, transformOrigin: 'center' }}
            onPointerDown={(e) => handlePointerDown(e, 'rotate', null)}
            title="Rotate"
          ></div>

          {/* 8 Resize Handles */}
          <Handle pos="nw" style={{ top: 0, left: 0, transform: 'translate(-50%, -50%)' }} onDown={e => handlePointerDown(e, 'resize', 'nw')} invScale={1/combinedScale} />
          <Handle pos="n" style={{ top: 0, left: '50%', transform: 'translate(-50%, -50%)' }} onDown={e => handlePointerDown(e, 'resize', 'n')} invScale={1/combinedScale} />
          <Handle pos="ne" style={{ top: 0, right: 0, transform: 'translate(50%, -50%)' }} onDown={e => handlePointerDown(e, 'resize', 'ne')} invScale={1/combinedScale} />
          
          <Handle pos="e" style={{ top: '50%', right: 0, transform: 'translate(50%, -50%)' }} onDown={e => handlePointerDown(e, 'resize', 'e')} invScale={1/combinedScale} />
          
          <Handle pos="se" style={{ bottom: 0, right: 0, transform: 'translate(50%, 50%)' }} onDown={e => handlePointerDown(e, 'resize', 'se')} invScale={1/combinedScale} />
          <Handle pos="s" style={{ bottom: 0, left: '50%', transform: 'translate(-50%, 50%)' }} onDown={e => handlePointerDown(e, 'resize', 's')} invScale={1/combinedScale} />
          <Handle pos="sw" style={{ bottom: 0, left: 0, transform: 'translate(-50%, 50%)' }} onDown={e => handlePointerDown(e, 'resize', 'sw')} invScale={1/combinedScale} />
          
          <Handle pos="w" style={{ top: '50%', left: 0, transform: 'translate(-50%, -50%)' }} onDown={e => handlePointerDown(e, 'resize', 'w')} invScale={1/combinedScale} />
        </>
      )}
    </div>
  );
}

function Handle({ pos, style, onDown, invScale }) {
  const baseTransform = style.transform || '';
  const fullTransform = `${baseTransform} scale(${invScale})`;

  return (
    <div 
      className="absolute bg-white border border-[#3b82f6] shadow-sm"
      style={{
        ...style,
        width: '10px',
        height: '10px',
        transform: fullTransform,
        cursor: getCursorForPos(pos)
      }}
      onPointerDown={onDown}
    ></div>
  );
}

function getCursorForPos(pos) {
  const map = {
    'nw': 'nwse-resize',
    'se': 'nwse-resize',
    'ne': 'nesw-resize',
    'sw': 'nesw-resize',
    'n': 'ns-resize',
    's': 'ns-resize',
    'e': 'ew-resize',
    'w': 'ew-resize'
  };
  return map[pos] || 'pointer';
}
