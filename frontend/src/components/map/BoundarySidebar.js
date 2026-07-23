'use client';

import { useState } from 'react';
import { useBoundaryStore } from '@/store/boundaryStore';
import { updateBoundary, deleteBoundary } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { geojsonAreaM2, formatArea } from '@/lib/geoUtils';

export default function BoundarySidebar() {
  const boundaries          = useBoundaryStore((s) => s.boundaries);
  const activeBoundaryId    = useBoundaryStore((s) => s.activeBoundaryId);
  const setActiveBoundaryId = useBoundaryStore((s) => s.setActiveBoundaryId);
  const removeBoundary      = useBoundaryStore((s) => s.removeBoundary);
  const replaceBoundary     = useBoundaryStore((s) => s.replaceBoundary);
  const toggleVisibility    = useBoundaryStore((s) => s.toggleVisibility);
  const toggleMap           = useBoundaryStore((s) => s.toggleMap);
  const mapOpen             = useBoundaryStore((s) => s.mapOpen);

  async function handleDelete(id) {
    try { await deleteBoundary(id); removeBoundary(id); }
    catch (err) { console.error(err); }
  }

  async function handleToggleVisible(id) {
    const b = boundaries.find((x) => x.id === id);
    if (!b) return;
    toggleVisibility(id);
    try { const res = await updateBoundary(id, { visible: !b.visible }); replaceBoundary(res); }
    catch (err) { toggleVisibility(id); console.error(err); }
  }

  async function handleRename(id, name) {
    try { const res = await updateBoundary(id, { name }); replaceBoundary(res); }
    catch (err) { console.error(err); }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 shrink-0">
        <div>
          <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Land Boundaries</h2>
          <p className="text-[10px] text-zinc-700 mt-0.5">{boundaries.length} area{boundaries.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={toggleMap} title="Open Map Workspace"
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors
            ${mapOpen ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-blue-500/60 hover:text-blue-400'}`}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
            <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
          </svg>
          Map
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1 min-h-0">
        {boundaries.length === 0 ? (
          <div className="text-[11px] text-zinc-700 text-center mt-6 px-3 leading-relaxed">
            Open the Map to draw land boundaries.
          </div>
        ) : (
          boundaries.map((b) => (
            <SidebarRow key={b.id} boundary={b}
              isActive={b.id === activeBoundaryId}
              onSelect={() => setActiveBoundaryId(b.id === activeBoundaryId ? null : b.id)}
              onDelete={handleDelete}
              onToggleVisible={handleToggleVisible}
              onRename={handleRename} />
          ))
        )}
      </div>
    </div>
  );
}

function SidebarRow({ boundary, isActive, onSelect, onDelete, onToggleVisible, onRename }) {
  const [renaming, setRenaming] = useState(false);
  const [nameVal,  setNameVal]  = useState(boundary.name);

  const area = boundary.area ?? geojsonAreaM2(boundary.geometry);

  function commitRename() {
    setRenaming(false);
    if (nameVal.trim() && nameVal !== boundary.name) onRename(boundary.id, nameVal.trim());
  }

  return (
    <div onClick={() => !renaming && onSelect()}
      className={`group flex items-start gap-2 px-2.5 py-2 rounded-lg cursor-pointer border transition-all duration-150
        ${isActive ? 'border-blue-500/60 bg-blue-500/8' : 'border-zinc-700/60 hover:border-zinc-600 bg-zinc-800/40'}
        ${!boundary.visible ? 'opacity-40' : ''}`}>

      {/* Color dot */}
      <div className="w-2 h-2 rounded-full shrink-0 border border-white/20 mt-1"
           style={{ background: boundary.color ?? '#3b82f6' }} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {renaming ? (
          <input autoFocus value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false); }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-zinc-700 border border-blue-500 rounded px-1.5 py-0.5 text-[11px] text-zinc-100 focus:outline-none" />
        ) : (
          <span className="text-[11px] text-zinc-300 font-medium block truncate">{boundary.name}</span>
        )}
        {area !== null && <span className="text-[10px] text-zinc-600">{formatArea(area)}</span>}
        <span className="text-[9px] text-zinc-700 block">{formatDate(boundary.createdAt)}</span>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {/* Visibility */}
        <button onClick={(e) => { e.stopPropagation(); onToggleVisible(boundary.id); }}
          title={boundary.visible ? 'Hide' : 'Show'}
          className="text-zinc-600 hover:text-zinc-300 transition-colors">
          {boundary.visible
            ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          }
        </button>
        {/* Rename */}
        <button onClick={(e) => { e.stopPropagation(); setRenaming(true); setNameVal(boundary.name); }}
          title="Rename" className="text-zinc-600 hover:text-zinc-300 transition-colors">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        {/* Delete */}
        <button onClick={(e) => { e.stopPropagation(); onDelete(boundary.id); }}
          title="Delete" className="text-zinc-700 hover:text-red-400 transition-colors">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
