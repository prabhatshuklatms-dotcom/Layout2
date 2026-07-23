'use client';

import { useState } from 'react';
import { useBoundaryStore, PALETTE } from '@/store/boundaryStore';
import { updateBoundary, deleteBoundary } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { geojsonAreaM2, formatArea } from '@/lib/geoUtils';

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] text-zinc-500 shrink-0">{label}</span>
      <span className="text-[11px] text-zinc-200 font-mono text-right">{value ?? '—'}</span>
    </div>
  );
}

function EmptyPanel() {
  return (
    <aside className="w-56 shrink-0 bg-zinc-900 border-l border-zinc-800 flex flex-col">
      <div className="px-3 py-2.5 border-b border-zinc-800">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Boundary</h2>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-700 text-xs text-center px-4 gap-2">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2">
          <polygon points="12,3 21,9 18,20 6,20 3,9"/>
        </svg>
        <p>Click a land boundary to view its properties</p>
      </div>
    </aside>
  );
}

export default function BoundaryPropertiesPanel() {
  const boundaries          = useBoundaryStore((s) => s.boundaries);
  const activeBoundaryId    = useBoundaryStore((s) => s.activeBoundaryId);
  const setActiveBoundaryId = useBoundaryStore((s) => s.setActiveBoundaryId);
  const replaceBoundary     = useBoundaryStore((s) => s.replaceBoundary);
  const removeBoundary      = useBoundaryStore((s) => s.removeBoundary);
  const toggleVisibility    = useBoundaryStore((s) => s.toggleVisibility);
  const toggleMap           = useBoundaryStore((s) => s.toggleMap);

  const boundary = boundaries.find((b) => b.id === activeBoundaryId) ?? null;
  const [editingName, setEditingName] = useState(false);
  const [nameVal,     setNameVal]     = useState('');

  if (!boundary) return <EmptyPanel />;

  const geo        = boundary.geometry?.geometry ?? boundary.geometry;
  const coordCount = geo?.coordinates?.[0]?.length ?? 0;
  const area       = boundary.area ?? geojsonAreaM2(boundary.geometry);

  async function saveName(v) {
    setEditingName(false);
    if (!v.trim() || v === boundary.name) return;
    try { const res = await updateBoundary(boundary.id, { name: v.trim() }); replaceBoundary(res); }
    catch (err) { console.error(err); }
  }

  async function saveColor(c) {
    try { const res = await updateBoundary(boundary.id, { color: c }); replaceBoundary(res); }
    catch (err) { console.error(err); }
  }

  async function handleToggleVisible() {
    toggleVisibility(boundary.id);
    try { const res = await updateBoundary(boundary.id, { visible: !boundary.visible }); replaceBoundary(res); }
    catch (err) { toggleVisibility(boundary.id); console.error(err); }
  }

  async function handleDelete() {
    try { await deleteBoundary(boundary.id); removeBoundary(boundary.id); setActiveBoundaryId(null); }
    catch (err) { console.error(err); }
  }

  return (
    <aside className="w-56 shrink-0 bg-zinc-900 border-l border-zinc-800 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-3 py-2.5 border-b border-zinc-800 flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
             style={{ background: boundary.color ?? '#3b82f6' }} />
        <div className="flex-1 min-w-0">
          {editingName ? (
            <input autoFocus value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onBlur={() => saveName(nameVal)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveName(nameVal); if (e.key === 'Escape') setEditingName(false); }}
              className="w-full bg-zinc-800 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-zinc-100 focus:outline-none" />
          ) : (
            <button onClick={() => { setNameVal(boundary.name); setEditingName(true); }}
              className="w-full text-left text-xs font-semibold text-zinc-200 hover:text-white transition-colors truncate"
              title="Click to rename">
              {boundary.name}
            </button>
          )}
        </div>

        {/* Visibility toggle */}
        <button onClick={handleToggleVisible} title={boundary.visible ? 'Hide boundary' : 'Show boundary'}
          className={`w-6 h-6 flex items-center justify-center rounded transition-colors
            ${boundary.visible ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-700 hover:text-zinc-400'}`}>
          {boundary.visible
            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          }
        </button>

        <span className="text-[10px] text-zinc-600 font-mono shrink-0">#{boundary.id}</span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-4">

        {/* Geometry */}
        <div className="space-y-2">
          <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold">Geometry</p>
          <Row label="Type"   value={boundary.boundaryType ?? geo?.type ?? '—'} />
          <Row label="Points" value={coordCount} />
          {area !== null && <Row label="Area" value={formatArea(area)} />}
        </div>

        <div className="h-px bg-zinc-800" />

        {/* Color */}
        <div className="space-y-2">
          <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold">Color</p>
          <div className="flex flex-wrap gap-1.5">
            {PALETTE.map((c) => (
              <button key={c} onClick={() => saveColor(c)} style={{ background: c }}
                className={`w-5 h-5 rounded-full border-2 transition-transform
                  ${boundary.color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                title={c} />
            ))}
          </div>
        </div>

        <div className="h-px bg-zinc-800" />

        {/* Metadata */}
        <div className="space-y-2">
          <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold">Info</p>
          <Row label="ID"      value={`#${boundary.id}`} />
          <Row label="Visible" value={boundary.visible ? 'Yes' : 'No'} />
          <Row label="Created" value={formatDate(boundary.createdAt)} />
          <Row label="Updated" value={formatDate(boundary.updatedAt)} />
        </div>

        <div className="h-px bg-zinc-800" />

        {/* Actions */}
        <div className="space-y-2">
          <button onClick={toggleMap}
            className="w-full py-1.5 rounded-lg border border-blue-700/40 text-blue-400
                       text-xs hover:bg-blue-500/10 transition-colors flex items-center justify-center gap-1.5">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
            </svg>
            Open Map
          </button>
          <button onClick={handleDelete}
            className="w-full py-1.5 rounded-lg border border-red-800/40 text-red-400
                       text-xs hover:bg-red-500/10 transition-colors">
            Delete Boundary
          </button>
        </div>
      </div>
    </aside>
  );
}
