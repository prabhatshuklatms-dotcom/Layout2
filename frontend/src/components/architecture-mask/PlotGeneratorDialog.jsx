'use client';

import React, { useState } from 'react';
import { useMaskEditor } from '@/store/useMaskEditor';

export default function PlotGeneratorDialog({ isOpen, onClose }) {
  const { selectedIds, polygons, setPolygons } = useMaskEditor();
  const [count, setCount] = useState(5);
  const [direction, setDirection] = useState('horizontal'); // 'horizontal' or 'vertical'
  const [spacing, setSpacing] = useState(0);
  
  if (!isOpen) return null;

  const handleGenerate = () => {
    const source = polygons.find(p => p.id === selectedIds[0]);
    if (!source) return;

    // Very naive bounding box math for cloning offsets
    const pts = source.geometry.coordinates[0];
    const xs = pts.map(p => p[0]);
    const ys = pts.map(p => p[1]);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);

    const newPolygons = [];
    for (let i = 1; i <= count; i++) {
      const offsetX = direction === 'horizontal' ? i * (width + Number(spacing)) : 0;
      const offsetY = direction === 'vertical' ? i * (height + Number(spacing)) : 0;
      
      const newPts = pts.map(p => [p[0] + offsetX, p[1] + offsetY]);
      
      newPolygons.push({
        ...source,
        id: Date.now() + i, // Generate temporary ID until saved
        geometry: { type: 'Polygon', coordinates: [newPts] },
        properties: { ...source.properties, plotNumber: (Number(source.properties?.plotNumber || 0) + i).toString() }
      });
    }

    setPolygons([...polygons, ...newPolygons]);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100]">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl w-96 overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
          <h2 className="text-sm font-semibold text-zinc-200">Smart Plot Generator</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">&times;</button>
        </div>
        
        <div className="p-4 space-y-4 text-zinc-300">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Number of Plots</label>
            <input 
              type="number" min="1" max="100"
              value={count} onChange={e => setCount(Number(e.target.value))}
              className="w-full bg-black border border-zinc-700 rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Direction</label>
            <select
              value={direction} onChange={e => setDirection(e.target.value)}
              className="w-full bg-black border border-zinc-700 rounded px-3 py-1.5 text-sm"
            >
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Spacing (px)</label>
            <input 
              type="number" 
              value={spacing} onChange={e => setSpacing(Number(e.target.value))}
              className="w-full bg-black border border-zinc-700 rounded px-3 py-1.5 text-sm"
            />
          </div>
        </div>
        
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-sm font-medium transition-colors">Cancel</button>
          <button onClick={handleGenerate} className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors">Generate</button>
        </div>
      </div>
    </div>
  );
}
