'use client';

import React, { useRef, useEffect } from 'react';
import { Group, Line, Circle, Transformer } from 'react-konva';

export default function PolygonEditor({ 
  polygon, 
  isSelected, 
  onSelect, 
  onChange,
  mode,
  zoom
}) {
  const shapeRef = useRef();
  const trRef = useRef();

  useEffect(() => {
    if (isSelected && trRef.current && mode === 'pointer') {
      // we need to attach transformer manually
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected, mode]);

  // Flatten points [x1, y1, x2, y2, ...] for Konva Line
  const points = polygon.geometry.coordinates[0].flatMap(p => p);

  return (
    <Group
      draggable={isSelected && mode === 'pointer' && !polygon.locked}
      onDragEnd={(e) => {
        // Handle drag end logic to update coordinates
      }}
    >
      <Line
        ref={shapeRef}
        points={points}
        fill={polygon.color}
        stroke={polygon.borderColor}
        strokeWidth={2 / zoom}
        opacity={polygon.opacity}
        closed
        onClick={onSelect}
        onTap={onSelect}
      />
      {isSelected && mode === 'pointer' && !polygon.locked && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            // limit resize
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </Group>
  );
}
