'use client';

import React from 'react';
import { useMaskEditor } from '@/store/useMaskEditor';
import { Eye, EyeOff, Lock, Unlock } from 'lucide-react';

export default function LayerManager() {
  const { layers, setLayerVisibility, setLayerLock } = useMaskEditor();

  return (
    <div className="flex flex-col h-full text-zinc-300">
      <div className="p-3 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Layers</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {layers.map(layer => (
          <div 
            key={layer.id}
            className="flex items-center justify-between p-2 hover:bg-zinc-800/50 rounded group transition-colors"
          >
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-sm shadow-sm" 
                style={{ backgroundColor: layer.color }}
              />
              <span className="text-sm font-medium">{layer.name}</span>
            </div>
            
            <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => setLayerLock(layer.id, !layer.locked)}
                className="text-zinc-500 hover:text-zinc-300 p-1"
                title={layer.locked ? "Unlock layer" : "Lock layer"}
              >
                {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
              </button>
              <button 
                onClick={() => setLayerVisibility(layer.id, !layer.visible)}
                className="text-zinc-500 hover:text-zinc-300 p-1"
                title={layer.visible ? "Hide layer" : "Show layer"}
              >
                {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
