'use client';

import React from 'react';
import { useMaskEditor } from '@/store/useMaskEditor';
import { getPreviewUrl } from '@/lib/api';

export default function MaskSidebar() {
  const { 
    architectureFiles, 
    activeArchitectureId, 
    setActiveArchitectureId, 
    loadingFiles,
    activeProjectId 
  } = useMaskEditor();

  if (!activeProjectId) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-zinc-500">
        Select a project above.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-300">
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 shrink-0">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Architecture Library
        </h2>
        <input 
          type="text" 
          placeholder="Search architecture..." 
          className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-hide">
        {loadingFiles ? (
          <div className="text-sm text-zinc-500 text-center py-4">Loading...</div>
        ) : architectureFiles.length === 0 ? (
          <div className="text-sm text-zinc-500 text-center py-4">No architecture found.</div>
        ) : (
          architectureFiles.map(file => (
            <button
              key={file.id}
              onClick={() => setActiveArchitectureId(file.id)}
              className={`w-full text-left p-2 rounded-lg border transition-all group
                ${activeArchitectureId === file.id 
                  ? 'border-indigo-500 bg-indigo-500/10' 
                  : 'border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900'}`}
            >
              <div className="w-full aspect-video bg-black rounded overflow-hidden relative mb-2 border border-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={getPreviewUrl(file.id)} 
                  alt={file.originalName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-sm font-medium truncate text-zinc-200">
                {file.originalName}
              </div>
              <div className="text-xs text-zinc-500 mt-1 flex justify-between items-center">
                <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
                {file.fileType === 'pdf' ? (
                   <span className="bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded text-[10px] font-bold">PDF</span>
                ) : (
                   <span className="bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-bold">IMG</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
