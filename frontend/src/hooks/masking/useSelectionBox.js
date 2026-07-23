'use client';

import React, { useRef, useEffect } from 'react';
import { Rect } from 'react-konva';
import { useMaskEditor } from '@/store/useMaskEditor';

export function useSelectionBox(stageRef) {
  const { mode, selectPolygon, polygons, layers } = useMaskEditor();
  const boxRef = useRef(null);
  const selectionRef = useRef({ visible: false, x1: 0, y1: 0, x2: 0, y2: 0 });

  useEffect(() => {
    if (mode !== 'pointer') return;
    
    const stage = stageRef.current;
    if (!stage) return;

    let isSelecting = false;

    const handleMouseDown = (e) => {
      // Do nothing if we mousedown on any shape
      if (e.target !== stage && e.target.parent?.className !== 'Layer') {
        return;
      }
      
      e.evt.preventDefault();
      const pos = stage.getRelativePointerPosition();
      
      isSelecting = true;
      selectionRef.current = {
        visible: true,
        x1: pos.x,
        y1: pos.y,
        x2: pos.x,
        y2: pos.y,
      };
      
      updateBox();
    };

    const handleMouseMove = (e) => {
      if (!isSelecting) return;
      e.evt.preventDefault();
      
      const pos = stage.getRelativePointerPosition();
      selectionRef.current.x2 = pos.x;
      selectionRef.current.y2 = pos.y;
      
      updateBox();
    };

    const handleMouseUp = (e) => {
      if (!isSelecting) return;
      isSelecting = false;
      selectionRef.current.visible = false;
      updateBox();
      
      // Calculate intersection
      const { x1, y1, x2, y2 } = selectionRef.current;
      const box = {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x1 - x2),
        height: Math.abs(y1 - y2)
      };

      // Select polygons intersecting the box
      if (box.width > 2 || box.height > 2) {
        const selected = polygons.filter(p => {
          // Check layer visibility
          const layer = layers.find(l => l.id === p.layer);
          if (layer && (!layer.visible || layer.locked)) return false;

          const pts = p.geometry.coordinates[0];
          // simple check: if any point is inside the selection box
          return pts.some(pt => pt[0] >= box.x && pt[0] <= box.x + box.width &&
                                pt[1] >= box.y && pt[1] <= box.y + box.height);
        });
        
        if (selected.length > 0) {
          // If shift key held, append to selection (omitted here for simplicity, but could be added)
          useMaskEditor.setState({ selectedIds: selected.map(p => p.id) });
        } else {
          useMaskEditor.setState({ selectedIds: [] });
        }
      } else {
        // Just a click on empty canvas
        useMaskEditor.setState({ selectedIds: [] });
      }
    };

    const updateBox = () => {
      if (!boxRef.current) return;
      if (!selectionRef.current.visible) {
        boxRef.current.visible(false);
        return;
      }

      boxRef.current.visible(true);
      const { x1, y1, x2, y2 } = selectionRef.current;
      boxRef.current.setAttrs({
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x1 - x2),
        height: Math.abs(y1 - y2),
      });
      boxRef.current.getLayer().batchDraw();
    };

    stage.on('mousedown touchstart', handleMouseDown);
    stage.on('mousemove touchmove', handleMouseMove);
    stage.on('mouseup touchend', handleMouseUp);

    return () => {
      stage.off('mousedown touchstart', handleMouseDown);
      stage.off('mousemove touchmove', handleMouseMove);
      stage.off('mouseup touchend', handleMouseUp);
    };
  }, [mode, stageRef, polygons, layers]);

  return { boxRef };
}
