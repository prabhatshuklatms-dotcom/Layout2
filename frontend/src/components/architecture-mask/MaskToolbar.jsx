'use client';

import React from 'react';
import { useMaskEditor } from '@/store/useMaskEditor';
import { MousePointer2, Undo2, Redo2, Trash2, MapPin, Building2, Trees, CircleParking, Car, SquareDashedBottom, Eye, EyeOff, Download } from 'lucide-react';
import { exportToSVG, exportToGeoJSON, exportToJSON } from '@/lib/exportLayout';
import { getPreviewUrl } from '@/lib/api';

const TOOLS = [
  { id: 'pointer', icon: MousePointer2, label: 'Select / Move' },
  { id: 'plot', icon: MapPin, label: 'Plot' },
  { id: 'road', icon: SquareDashedBottom, label: 'Road' },
  { id: 'commercial', icon: Building2, label: 'Commercial' },
  { id: 'amenity', icon: Trees, label: 'Amenity' },
  { id: 'parking', icon: CircleParking, label: 'Parking' },
];

export default function MaskToolbar() {
  const { 
    mode, setMode, undo, redo, deleteSelected, selectedIds, polygons, setPolygons,
    imageVisible, setImageVisible, imageOpacity, setImageOpacity,
    activeArchitectureId, architectureFiles
  } = useMaskEditor();


  const handleExport = (format) => {
    if (format === 'svg') {
      const activeFile = architectureFiles.find(f => f.id === activeArchitectureId);
      // Fallback dimensions if missing
      const w = activeFile?.imageWidth || 2000;
      const h = activeFile?.imageHeight || 2000;
      exportToSVG(polygons, w, h);
    } else if (format === 'geojson') {
      exportToGeoJSON(polygons);
    } else if (format === 'json') {
      exportToJSON(polygons);
    }
  };

  return (
    <div className="h-14 bg-zinc-950 border-b border-zinc-800 flex items-center px-4 justify-between shrink-0 shadow-sm z-10">
      
      {/* Drawing Tools */}
      <div className="flex items-center gap-1.5">
        {TOOLS.map(t => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={`p-2 rounded flex items-center justify-center transition-colors group relative
              ${mode === t.id 
                ? 'bg-indigo-600 text-white shadow-inner' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
            title={t.label}
          >
            <t.icon size={18} strokeWidth={mode === t.id ? 2.5 : 2} />
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-zinc-800 mx-2" />

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={undo}
          className="p-2 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={18} />
        </button>
        <button
          onClick={redo}
          className="p-2 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={18} />
        </button>
        
        <div className="w-px h-6 bg-zinc-800 mx-2" />

        <button
          onClick={deleteSelected}
          disabled={selectedIds.length === 0}
          className={`p-2 rounded transition-colors ${
            selectedIds.length > 0 
              ? 'text-red-400 hover:bg-red-500/10' 
              : 'text-zinc-700 cursor-not-allowed'
          }`}
          title="Delete Selected (Del)"
        >
          <Trash2 size={18} />
        </button>
      </div>
      
      <div className="w-px h-6 bg-zinc-800 mx-2" />



      <div className="flex-1" />
      
      {/* Reference Image Controls */}
      <div className="flex items-center gap-3 mr-4 bg-zinc-900 px-3 py-1.5 rounded border border-zinc-800">
        <button
          onClick={() => setImageVisible(!imageVisible)}
          className="text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Toggle Image Visibility"
        >
          {imageVisible ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
        {imageVisible && (
          <input
            type="range"
            min="0.1" max="1" step="0.05"
            value={imageOpacity}
            onChange={(e) => setImageOpacity(parseFloat(e.target.value))}
            className="w-20 accent-indigo-500"
            title="Image Opacity"
          />
        )}
      </div>

      {/* Export Menu */}
      <div className="flex items-center mr-4 group relative">
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors border border-zinc-700">
          <Download size={16} />
          Export
        </button>
        <div className="absolute top-full right-0 mt-1 w-32 bg-zinc-800 border border-zinc-700 rounded shadow-xl hidden group-hover:block z-50">
          <button onClick={() => handleExport('svg')} className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white">SVG</button>
          <button onClick={() => handleExport('geojson')} className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white">GeoJSON</button>
          <button onClick={() => handleExport('json')} className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white">JSON</button>
        </div>
      </div>
      
      {/* Save Status / Stats */}
      <div className="flex items-center gap-4 text-xs text-zinc-500 font-medium">
        <span>{polygons.length} Polygons</span>
        <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded transition-colors shadow">
          Save Mask
        </button>
      </div>

    </div>
  );
}
