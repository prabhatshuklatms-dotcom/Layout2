import React, { useState, useEffect } from 'react';

export default function AmenitiesOverlay({
  placedAmenities,
  masterAmenities,
  scale,
  svgRef,
  onAmenityTransformEnd,
  selectedPlacementIds,
  onSelectionChange
}) {
  const [dragState, setDragState] = useState(null);
  
  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (e) => {
      if (!svgRef.current) return;
      const svgEl = svgRef.current.querySelector('svg');
      if (!svgEl) return;
      
      const pt = svgEl.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svgEl.getScreenCTM().inverse());
      
      let updates = { ...dragState.updates };

      if (dragState.mode === 'move') {
        updates.x = dragState.original.x + (svgP.x - dragState.startX);
        updates.y = dragState.original.y + (svgP.y - dragState.startY);
      } else if (dragState.mode === 'rotate') {
        const cx = dragState.original.x;
        const cy = dragState.original.y;
        // atan2 is (y, x). The screen Y axis goes down, which matches SVG Y axis.
        // We want 0 degrees to be straight up if rotation handle is straight up.
        // Rotation handle is at (0, -h/2).
        const angleRad = Math.atan2(svgP.y - cy, svgP.x - cx);
        let angleDeg = (angleRad * 180) / Math.PI;
        // +90 because our handle is at -y (top)
        updates.rotation = (angleDeg + 90) % 360;
      } else {
        // Resizing
        // Calculate local delta
        const dxWorld = svgP.x - dragState.startX;
        const dyWorld = svgP.y - dragState.startY;
        
        const rotRad = (dragState.original.rotation || 0) * Math.PI / 180;
        const cosR = Math.cos(-rotRad);
        const sinR = Math.sin(-rotRad);
        
        const dxLocal = dxWorld * cosR - dyWorld * sinR;
        const dyLocal = dxWorld * sinR + dyWorld * cosR;

        let dw = 0;
        let dh = 0;

        if (dragState.mode.includes('e')) dw = dxLocal;
        if (dragState.mode.includes('w')) dw = -dxLocal;
        if (dragState.mode.includes('s')) dh = dyLocal;
        if (dragState.mode.includes('n')) dh = -dyLocal;

        let newW = Math.max(0.01, dragState.original.width + dw);
        let newH = Math.max(0.01, dragState.original.height + dh);

        // Aspect ratio lock on corners with Shift
        if (e.shiftKey && dragState.mode.length === 2) {
          const ratio = dragState.original.width / dragState.original.height;
          if (newW / newH > ratio) {
            newW = newH * ratio;
          } else {
            newH = newW / ratio;
          }
          // Recompute dw, dh based on new locked w/h to adjust center correctly
          dw = (newW - dragState.original.width) * (dragState.mode.includes('w') ? 1 : 1);
          dh = (newH - dragState.original.height) * (dragState.mode.includes('n') ? 1 : 1);
        }

        // Adjust center to keep opposite edge stationary
        const actualDw = newW - dragState.original.width;
        const actualDh = newH - dragState.original.height;

        let centerDxLocal = 0;
        let centerDyLocal = 0;

        if (dragState.mode.includes('e')) centerDxLocal = actualDw / 2;
        if (dragState.mode.includes('w')) centerDxLocal = -actualDw / 2;
        if (dragState.mode.includes('s')) centerDyLocal = actualDh / 2;
        if (dragState.mode.includes('n')) centerDyLocal = -actualDh / 2;

        const centerDxWorld = centerDxLocal * Math.cos(rotRad) - centerDyLocal * Math.sin(rotRad);
        const centerDyWorld = centerDxLocal * Math.sin(rotRad) + centerDyLocal * Math.cos(rotRad);

        updates.width = newW;
        updates.height = newH;
        updates.x = dragState.original.x + centerDxWorld;
        updates.y = dragState.original.y + centerDyWorld;
      }
      
      setDragState(prev => ({ ...prev, updates }));
    };

    const handlePointerUp = () => {
      // If anything changed
      if (Object.keys(dragState.updates).length > 0) {
        onAmenityTransformEnd(dragState.id, dragState.updates);
      }
      setDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, svgRef, onAmenityTransformEnd]);

  if (!placedAmenities || placedAmenities.length === 0) return null;

  const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const actualScale = scale || 1;
  const strokeW = 1.5 / actualScale;
  const handleR = 4 / actualScale;
  const rotateDist = 24 / actualScale;

  const handlePointerDown = (e, id, mode, original) => {
    e.stopPropagation();
    e.preventDefault();
    if (mode === 'move') {
      onSelectionChange([id]);
    }
    
    if (!svgRef.current) return;
    const svgEl = svgRef.current.querySelector('svg');
    const pt = svgEl.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svgEl.getScreenCTM().inverse());
    
    setDragState({
      id,
      mode,
      startX: svgP.x,
      startY: svgP.y,
      original: { ...original },
      updates: {}
    });
  };

  return (
    <g>
      {placedAmenities.map(placement => {
        const master = masterAmenities.find(m => m.id === placement.amenityId);
        if (!master) return null;
        
        const isSelected = selectedPlacementIds.includes(placement.id);
        
        // Use dragged values if currently dragging this element, else use placement values
        const isDraggingThis = dragState && dragState.id === placement.id;
        const w = (isDraggingThis && dragState.updates.width !== undefined) ? dragState.updates.width : (placement.width || master.defaultWidth || 20);
        const h = (isDraggingThis && dragState.updates.height !== undefined) ? dragState.updates.height : (placement.height || master.defaultHeight || 20);
        const x = (isDraggingThis && dragState.updates.x !== undefined) ? dragState.updates.x : placement.x;
        const y = (isDraggingThis && dragState.updates.y !== undefined) ? dragState.updates.y : placement.y;
        const rotation = (isDraggingThis && dragState.updates.rotation !== undefined) ? dragState.updates.rotation : (placement.rotation || 0);

        return (
          <g
            key={`amenity-${placement.id}`}
            transform={`translate(${x}, ${y}) rotate(${rotation})`}
          >
            {/* Image (Move Area) */}
            <image 
              href={`${BASE_URL}${master.iconPath}`} 
              x={-w/2} 
              y={-h/2} 
              width={w} 
              height={h} 
              preserveAspectRatio="xMidYMid meet"
              className="cursor-move"
              onPointerDown={(e) => handlePointerDown(e, placement.id, 'move', { x, y, width: w, height: h, rotation })}
            />
            
            {/* Transform Controls */}
            {isSelected && (
              <g>
                {/* Bounding Box */}
                <rect 
                  x={-w/2} y={-h/2} 
                  width={w} height={h} 
                  fill="none" 
                  stroke="#3b82f6" 
                  strokeWidth={strokeW} 
                  pointerEvents="none"
                />

                {/* Rotation Stem & Handle */}
                <line 
                  x1={0} y1={-h/2} 
                  x2={0} y2={-h/2 - rotateDist} 
                  stroke="#3b82f6" 
                  strokeWidth={strokeW} 
                />
                <circle 
                  cx={0} cy={-h/2 - rotateDist} 
                  r={handleR} 
                  fill="#ffffff" 
                  stroke="#3b82f6" 
                  strokeWidth={strokeW}
                  className="cursor-grab active:cursor-grabbing"
                  onPointerDown={(e) => handlePointerDown(e, placement.id, 'rotate', { x, y, width: w, height: h, rotation })}
                />

                {/* 8 Resize Handles */}
                {/* NW */}
                <rect x={-w/2 - handleR} y={-h/2 - handleR} width={handleR*2} height={handleR*2} fill="#ffffff" stroke="#3b82f6" strokeWidth={strokeW} className="cursor-nwse-resize" onPointerDown={(e) => handlePointerDown(e, placement.id, 'nw', { x, y, width: w, height: h, rotation })} />
                {/* N */}
                <rect x={-handleR} y={-h/2 - handleR} width={handleR*2} height={handleR*2} fill="#ffffff" stroke="#3b82f6" strokeWidth={strokeW} className="cursor-ns-resize" onPointerDown={(e) => handlePointerDown(e, placement.id, 'n', { x, y, width: w, height: h, rotation })} />
                {/* NE */}
                <rect x={w/2 - handleR} y={-h/2 - handleR} width={handleR*2} height={handleR*2} fill="#ffffff" stroke="#3b82f6" strokeWidth={strokeW} className="cursor-nesw-resize" onPointerDown={(e) => handlePointerDown(e, placement.id, 'ne', { x, y, width: w, height: h, rotation })} />
                {/* W */}
                <rect x={-w/2 - handleR} y={-handleR} width={handleR*2} height={handleR*2} fill="#ffffff" stroke="#3b82f6" strokeWidth={strokeW} className="cursor-ew-resize" onPointerDown={(e) => handlePointerDown(e, placement.id, 'w', { x, y, width: w, height: h, rotation })} />
                {/* E */}
                <rect x={w/2 - handleR} y={-handleR} width={handleR*2} height={handleR*2} fill="#ffffff" stroke="#3b82f6" strokeWidth={strokeW} className="cursor-ew-resize" onPointerDown={(e) => handlePointerDown(e, placement.id, 'e', { x, y, width: w, height: h, rotation })} />
                {/* SW */}
                <rect x={-w/2 - handleR} y={h/2 - handleR} width={handleR*2} height={handleR*2} fill="#ffffff" stroke="#3b82f6" strokeWidth={strokeW} className="cursor-nesw-resize" onPointerDown={(e) => handlePointerDown(e, placement.id, 'sw', { x, y, width: w, height: h, rotation })} />
                {/* S */}
                <rect x={-handleR} y={h/2 - handleR} width={handleR*2} height={handleR*2} fill="#ffffff" stroke="#3b82f6" strokeWidth={strokeW} className="cursor-ns-resize" onPointerDown={(e) => handlePointerDown(e, placement.id, 's', { x, y, width: w, height: h, rotation })} />
                {/* SE */}
                <rect x={w/2 - handleR} y={h/2 - handleR} width={handleR*2} height={handleR*2} fill="#ffffff" stroke="#3b82f6" strokeWidth={strokeW} className="cursor-nwse-resize" onPointerDown={(e) => handlePointerDown(e, placement.id, 'se', { x, y, width: w, height: h, rotation })} />
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}
