'use client';

import React from 'react';
import { useMaskEditor } from '@/store/useMaskEditor';

export default function PropertiesPanel() {
  const { selectedIds, polygons, updatePolygon } = useMaskEditor();
  
  if (selectedIds.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
        Select a polygon to edit properties.
      </div>
    );
  }

  if (selectedIds.length > 1) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 text-sm p-4 text-center">
        Multiple polygons selected. Select one to edit properties.
      </div>
    );
  }

  const polygon = polygons.find(p => p.id === selectedIds[0]);
  if (!polygon) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    updatePolygon(polygon.id, {
      properties: {
        ...(polygon.properties || {}),
        [name]: value
      }
    });
  };

  return (
    <div className="flex flex-col h-full text-zinc-300">
      <div className="p-3 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Properties - {polygon.type}</h3>
      </div>
      
      <div className="p-4 space-y-4">
        
        {/* Plot Properties */}
        {polygon.type === 'plot' && (
          <>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Plot Number</label>
              <input 
                type="text" 
                name="plotNumber"
                value={polygon.properties?.plotNumber || ''}
                onChange={handleChange}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Plot Type</label>
              <select
                name="plotType"
                value={polygon.properties?.plotType || ''}
                onChange={handleChange}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="">Select Type</option>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="mixed">Mixed Use</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Area (sqm)</label>
              <input 
                type="number" 
                name="area"
                value={polygon.properties?.area || ''}
                onChange={handleChange}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </>
        )}

        {/* Road Properties */}
        {polygon.type === 'road' && (
          <>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Road Name</label>
              <input 
                type="text" 
                name="roadName"
                value={polygon.properties?.roadName || ''}
                onChange={handleChange}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Width (m)</label>
              <input 
                type="number" 
                name="width"
                value={polygon.properties?.width || ''}
                onChange={handleChange}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </>
        )}

        {/* Common Properties */}
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1">Remarks</label>
          <textarea 
            name="remarks"
            value={polygon.properties?.remarks || ''}
            onChange={handleChange}
            rows={3}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 resize-none"
          />
        </div>
      </div>
    </div>
  );
}
