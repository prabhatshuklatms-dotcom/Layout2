import React, { useState } from 'react';
import { getPreviewUrl } from '@/lib/api';

export default function AlignmentSidebar({ regions, alignments, loading }) {
  const [search, setSearch] = useState('');
  
  const filtered = regions.filter(r => r.name?.toLowerCase().includes(search.toLowerCase()));

  const handleDragStart = (e, region) => {
    // Pass the region ID to the drop handler
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'ARCHITECTURE_REGION',
      region
    }));
  };

  return (
    <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full shrink-0 z-20 shadow-xl">
      <div className="p-3 border-b border-zinc-800">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
          Architecture Regions
        </h2>
        <input 
          type="text" 
          placeholder="Search regions..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-zinc-800/80 border border-zinc-700 rounded pl-2 pr-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
        />
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {loading ? (
          <p className="text-xs text-zinc-500 text-center mt-4">Loading regions...</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center mt-4">No regions found.</p>
        ) : (
          filtered.map(region => {
            const hasAlignment = alignments.some(a => a.architectureRegionId === region.id);
            
            return (
              <div 
                key={region.id}
                draggable
                onDragStart={(e) => handleDragStart(e, region)}
                className="bg-zinc-800 rounded border border-zinc-700/60 p-2 cursor-grab active:cursor-grabbing hover:border-indigo-500 transition-colors group"
              >
                <div className="w-full aspect-[4/3] bg-zinc-900 rounded overflow-hidden mb-2 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={getPreviewUrl(region.architectureFileId)} 
                    alt={region.name}
                    className="w-full h-full object-contain p-1"
                  />
                  {hasAlignment && (
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500" title="Aligned" />
                  )}
                </div>
                <p className="text-xs text-zinc-200 font-medium truncate">{region.name}</p>
                <p className="text-[10px] text-zinc-500 truncate">Drag to map</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
