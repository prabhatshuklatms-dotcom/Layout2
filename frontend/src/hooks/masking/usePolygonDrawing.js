'use client';

import { useState } from 'react';
import { useMaskEditor } from '@/store/useMaskEditor';

export function usePolygonDrawing() {
  const { mode, setMode, addPolygon, layers } = useMaskEditor();
  const [activePoints, setActivePoints] = useState([]);
  const [mousePos, setMousePos] = useState(null);

  const getLayerProperties = (modeStr) => {
    // defaults
    let color = '#3b82f6';
    let layerId = 'plots';
    
    switch (modeStr) {
      case 'plot': color = '#3b82f6'; layerId = 'plots'; break;
      case 'road': color = '#64748b'; layerId = 'roads'; break;
      case 'amenity': color = '#10b981'; layerId = 'amenities'; break;
      case 'commercial': color = '#f59e0b'; layerId = 'commercial'; break;
      case 'parking': color = '#8b5cf6'; layerId = 'parking'; break;
      case 'landscape': color = '#84cc16'; layerId = 'landscape'; break;
      case 'boundary': color = '#ef4444'; layerId = 'boundary'; break;
    }
    return { color, layerId };
  };

  const handleStageClick = (e) => {
    if (mode === 'pointer') return;
    
    const stage = e.target.getStage();
    const pointer = stage.getRelativePointerPosition();
    const point = [pointer.x, pointer.y];
    
    // Check if double click to finish
    if (e.evt.detail === 2 && activePoints.length >= 2) {
      finishPolygon();
      return;
    }

    setActivePoints([...activePoints, point]);
  };

  const handleMouseMove = (e) => {
    if (mode === 'pointer') return;
    if (activePoints.length === 0) return;
    
    const stage = e.target.getStage();
    const pointer = stage.getRelativePointerPosition();
    setMousePos([pointer.x, pointer.y]);
  };

  const finishPolygon = () => {
    if (activePoints.length < 3) {
      setActivePoints([]);
      setMousePos(null);
      return;
    }
    
    const { color, layerId } = getLayerProperties(mode);
    
    const newPoly = {
      id: Date.now(), // temp ID
      type: mode,
      layer: layerId,
      geometry: { type: 'Polygon', coordinates: [activePoints] },
      color,
      borderColor: color,
      opacity: 0.5,
      locked: false,
      visible: true,
      properties: {}
    };

    addPolygon(newPoly);
    setActivePoints([]);
    setMousePos(null);
    setMode('pointer'); // Switch back to pointer after draw
  };

  return {
    activePoints,
    mousePos,
    handleStageClick,
    handleMouseMove,
    finishPolygon
  };
}
