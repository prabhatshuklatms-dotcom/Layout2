'use client';

/**
 * MapWorkspace  —  full-screen Leaflet map modal
 * Responsibility: Draw and manage Land Boundaries ONLY.
 * Overlay placement is handled by Overlay Studio (/projects/[id]/overlay).
 */

import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useBoundaryStore, BOUNDARY_DRAW_MODE, PALETTE } from '@/store/boundaryStore';
import { createBoundary, updateBoundary, deleteBoundary } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { geojsonAreaM2, formatArea } from '@/lib/geoUtils';

const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-zinc-900">
      <div className="flex flex-col items-center gap-3 text-zinc-500">
        <svg className="animate-spin w-6 h-6" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3"/>
          <path d="M12 3A9 9 0 0 1 21 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
        </svg>
        <span className="text-sm">Loading map…</span>
      </div>
    </div>
  ),
});

// ─── Color picker ─────────────────────────────────────────────────────────────
function ColorPicker({ value, onChange }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {PALETTE.map((c) => (
        <button key={c} onClick={() => onChange(c)} style={{ background: c }}
          className={`w-5 h-5 rounded-full border-2 transition-transform
            ${value === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
          title={c} />
      ))}
    </div>
  );
}

// ─── Boundary list row ────────────────────────────────────────────────────────
function BoundaryRow({ boundary, isActive, onSelect, onRename, onDelete, onToggleVisible }) {
  const [renaming, setRenaming] = useState(false);
  const [nameVal,  setNameVal]  = useState(boundary.name);
  const area = boundary.area ?? geojsonAreaM2(boundary.geometry);

  function handleRenameBlur() {
    setRenaming(false);
    if (nameVal.trim() && nameVal !== boundary.name) onRename(boundary.id, nameVal.trim());
  }

  return (
    <div onClick={() => !renaming && onSelect(boundary.id)}
      className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer
                  border transition-all duration-150
                  ${isActive ? 'border-blue-500/60 bg-blue-500/8' : 'border-zinc-700/60 hover:border-zinc-600 bg-zinc-800/40'}
                  ${!boundary.visible ? 'opacity-40' : ''}`}>
      <div className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
           style={{ background: boundary.color ?? '#3b82f6' }} />
      <div className="flex-1 min-w-0">
        {renaming ? (
          <input autoFocus value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={handleRenameBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRenameBlur(); if (e.key === 'Escape') setRenaming(false); }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-zinc-700 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-zinc-100 focus:outline-none" />
        ) : (
          <div>
            <span className="text-[11px] text-zinc-300 font-medium truncate block">{boundary.name}</span>
            {area !== null && <span className="text-[10px] text-zinc-600">{formatArea(area)}</span>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={(e) => { e.stopPropagation(); onToggleVisible(boundary.id); }}
          title={boundary.visible ? 'Hide' : 'Show'}
          className="text-zinc-600 hover:text-zinc-300 transition-colors">
          {boundary.visible
            ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
        </button>
        <button onClick={(e) => { e.stopPropagation(); setRenaming(true); setNameVal(boundary.name); }}
          title="Rename" className="text-zinc-600 hover:text-zinc-300 transition-colors">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
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

// ─── Tool definitions ─────────────────────────────────────────────────────────
const TOOLS = [
  {
    mode: BOUNDARY_DRAW_MODE.POINTER, label: 'Pointer', title: 'Select boundary',
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 3l14 9-7 1-4 7z"/></svg>,
  },
  {
    mode: BOUNDARY_DRAW_MODE.POLYGON, label: 'Polygon', title: 'Draw polygon boundary',
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polygon points="12,3 21,9 18,20 6,20 3,9" strokeDasharray="3 2"/></svg>,
  },
  {
    mode: BOUNDARY_DRAW_MODE.RECTANGLE, label: 'Rectangle', title: 'Draw rectangle boundary',
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2"/></svg>,
  },
  {
    mode: BOUNDARY_DRAW_MODE.EDIT, label: 'Edit', title: 'Move / reshape selected boundary',
    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  },
];

// ─── Main component ───────────────────────────────────────────────────────────
export default function MapWorkspace({ projectId, onClose }) {
  const boundaries          = useBoundaryStore((s) => s.boundaries);
  const addBoundary         = useBoundaryStore((s) => s.addBoundary);
  const replaceBoundary     = useBoundaryStore((s) => s.replaceBoundary);
  const removeBoundary      = useBoundaryStore((s) => s.removeBoundary);
  const toggleVisibility    = useBoundaryStore((s) => s.toggleVisibility);
  const activeBoundaryId    = useBoundaryStore((s) => s.activeBoundaryId);
  const setActiveBoundaryId = useBoundaryStore((s) => s.setActiveBoundaryId);
  const drawingBoundary     = useBoundaryStore((s) => s.drawingBoundary);
  const setDrawingBoundary  = useBoundaryStore((s) => s.setDrawingBoundary);
  const drawMode            = useBoundaryStore((s) => s.drawMode);
  const setDrawMode         = useBoundaryStore((s) => s.setDrawMode);
  const nextColor           = useBoundaryStore((s) => s.nextColor);
  const cycleColor          = useBoundaryStore((s) => s.cycleColor);

  const [mapType,      setMapType]      = useState('satellite');
  const [saving,       setSaving]       = useState(false);
  const [pendingGeo,   setPendingGeo]   = useState(null);
  const [pendingName,  setPendingName]  = useState('');
  const [pendingColor, setPendingColor] = useState(nextColor);
  const [pendingType,  setPendingType]  = useState('POLYGON');

  const mapRef = useRef(null);

  function pickTool(mode) {
    setDrawMode(mode);
    if (mode === BOUNDARY_DRAW_MODE.POINTER || mode === BOUNDARY_DRAW_MODE.EDIT) {
      setDrawingBoundary(false);
      setPendingGeo(null);
    }
  }

  const handleDrawComplete = useCallback((geojson, mode) => {
    setDrawingBoundary(false);
    const area = geojsonAreaM2(geojson);
    setPendingGeo({ ...geojson, _area: area });
    setPendingColor(nextColor);
    setPendingType(mode === BOUNDARY_DRAW_MODE.RECTANGLE ? 'RECTANGLE' : 'POLYGON');
    setPendingName(`Site ${String.fromCharCode(65 + boundaries.length)}`);
  }, [nextColor, boundaries.length, setDrawingBoundary]);

  function cancelDraw() { setDrawingBoundary(false); setPendingGeo(null); }

  async function handleSaveBoundary() {
    if (!pendingName.trim() || !pendingGeo) return;
    setSaving(true);
    try {
      const { _area, ...geoToSave } = pendingGeo;
      const res = await createBoundary(projectId, {
        name: pendingName.trim(), geometry: geoToSave,
        boundaryType: pendingType, color: pendingColor, area: _area ?? null,
      });
      const newBoundary = res?.data ?? res;
      addBoundary(newBoundary);
      setActiveBoundaryId(newBoundary.id);
      cycleColor();
      setPendingGeo(null);
      setPendingName('');
    } catch (err) { console.error('[MapWorkspace] save failed:', err.message); }
    finally { setSaving(false); }
  }

  async function handleRename(id, name) {
    try { const res = await updateBoundary(id, { name }); replaceBoundary(res?.data ?? res); }
    catch (err) { console.error(err); }
  }

  async function handleDelete(id) {
    if (!id) {
      removeBoundary(id);
      return;
    }
    try { await deleteBoundary(id); removeBoundary(id); }
    catch (err) { console.error(err); }
  }

  async function handleToggleVisible(id) {
    const b = boundaries.find((x) => x.id === id);
    if (!b) return;
    toggleVisibility(id);
    try { const res = await updateBoundary(id, { visible: !b.visible }); replaceBoundary(res?.data ?? res); }
    catch (err) { toggleVisibility(id); console.error(err); }
  }

  async function handleMoveComplete(id, newGeojson) {
    const area = geojsonAreaM2(newGeojson);
    try {
      const res = await updateBoundary(id, { geometry: newGeojson, area: area ?? undefined });
      replaceBoundary(res?.data ?? res);
    } catch (err) { console.error(err); }
  }

  function handleFitBounds() { mapRef.current?.fitToBounds?.(); }
  function handleApplyEdit()  { mapRef.current?.applyEdit?.(); }

  const MAP_TYPES = [
    { val: 'satellite', label: 'Satellite' },
    { val: 'hybrid',    label: 'Hybrid' },
    { val: 'street',    label: 'Street' },
  ];

  const isDrawTool = drawMode === BOUNDARY_DRAW_MODE.POLYGON || drawMode === BOUNDARY_DRAW_MODE.RECTANGLE;
  const isEditMode = drawMode === BOUNDARY_DRAW_MODE.EDIT;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-[#0d0d0d]">

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0 select-none flex-wrap">
        <div className="flex items-center gap-2 mr-2">
          <div className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-sm font-semibold text-zinc-200">Map Workspace</span>
          <span className="text-[10px] text-zinc-600 ml-1">— Draw Land Boundaries</span>
        </div>

        {/* Map type */}
        <div className="flex items-center gap-0.5 bg-zinc-800 border border-zinc-700 rounded-lg p-0.5">
          {MAP_TYPES.map(({ val, label }) => (
            <button key={val} onClick={() => setMapType(val)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors
                ${mapType === val ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Tool selector */}
        <div className="flex items-center gap-0.5 bg-zinc-800 border border-zinc-700 rounded-lg p-0.5">
          {TOOLS.map(({ mode, label, title, icon }) => (
            <button key={mode} onClick={() => pickTool(mode)} title={title} disabled={!!pendingGeo}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium
                          transition-colors disabled:opacity-30
                          ${drawMode === mode ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-zinc-200'}`}>
              {icon}{label}
            </button>
          ))}
        </div>

        {/* Draw / Cancel */}
        {isDrawTool && !pendingGeo && (
          <button onClick={() => drawingBoundary ? cancelDraw() : setDrawingBoundary(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors
              ${drawingBoundary
                ? 'bg-red-900/40 border-red-700/60 text-red-400'
                : 'bg-blue-600 border-blue-500 text-white hover:bg-blue-500'}`}>
            {drawingBoundary ? 'Cancel' : 'Draw Boundary'}
          </button>
        )}

        {/* Apply edit */}
        {isEditMode && activeBoundaryId && (
          <button onClick={handleApplyEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                       bg-emerald-700 border border-emerald-600 text-white hover:bg-emerald-600 transition-colors">
            ✓ Apply Changes
          </button>
        )}

        {/* Color swatch */}
        {isDrawTool && !drawingBoundary && !pendingGeo && (
          <div className="w-6 h-6 rounded-full border-2 border-zinc-600 shrink-0"
               style={{ background: nextColor }} title="Color for next boundary" />
        )}

        {/* Fit to bounds */}
        <button onClick={handleFitBounds} disabled={!boundaries.length}
          title="Fit map to all boundaries"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                     border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200
                     transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
          Fit
        </button>

        {/* Close */}
        <button onClick={onClose}
          className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg
                     text-zinc-500 hover:bg-zinc-700 hover:text-zinc-200 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* ── Main: map + sidebar ───────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Map */}
        <div className="flex-1 relative">
          <LeafletMap
            ref={mapRef}
            mapType={mapType}
            drawMode={drawMode}
            drawingBoundary={drawingBoundary}
            boundaries={boundaries}
            activeBoundaryId={activeBoundaryId}
            currentColor={nextColor}
            onDrawComplete={handleDrawComplete}
            onSelectBoundary={setActiveBoundaryId}
            onMoveComplete={handleMoveComplete}
          />

          {/* Draw hint */}
          {drawingBoundary && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[9000]
                            bg-zinc-950/95 backdrop-blur border border-zinc-700
                            rounded-xl px-4 py-2.5 text-sm text-zinc-300 pointer-events-none">
              {drawMode === BOUNDARY_DRAW_MODE.POLYGON
                ? 'Continue placing points. Click the first point to close the polygon, double-click the last point, or press Enter to finish.'
                : 'Click and drag to draw rectangle · Esc to cancel'}
            </div>
          )}

          {/* Edit hint */}
          {isEditMode && activeBoundaryId && !pendingGeo && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[9000]
                            bg-zinc-950/95 backdrop-blur border border-amber-700/60
                            rounded-xl px-4 py-2.5 text-sm text-amber-300 pointer-events-none">
              Drag vertex handles to reshape · Enter or "Apply Changes" to save · Esc to cancel
            </div>
          )}

          {/* Save boundary form */}
          {pendingGeo && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[9000]
                            bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl
                            px-5 py-4 flex flex-col gap-3" style={{ minWidth: 340 }}>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
                     style={{ background: pendingColor }} />
                <span className="text-xs font-semibold text-zinc-200 uppercase tracking-widest">
                  Name this boundary
                </span>
                {pendingGeo._area !== null && (
                  <span className="ml-auto text-[11px] text-zinc-500 font-mono">
                    {formatArea(pendingGeo._area)}
                  </span>
                )}
              </div>
              <input autoFocus value={pendingName}
                onChange={(e) => setPendingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveBoundary();
                  if (e.key === 'Escape') setPendingGeo(null);
                }}
                placeholder="Site A, Commercial Zone, Garden…"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2
                           text-sm text-zinc-200 placeholder-zinc-600
                           focus:outline-none focus:border-blue-500 transition-colors" />
              <div>
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1.5">Color</p>
                <ColorPicker value={pendingColor} onChange={setPendingColor} />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setPendingGeo(null)} disabled={saving}
                  className="flex-1 py-2 rounded-lg border border-zinc-700 text-xs text-zinc-400
                             hover:bg-zinc-700 transition-colors disabled:opacity-50">
                  Discard
                </button>
                <button onClick={handleSaveBoundary} disabled={!pendingName.trim() || saving}
                  className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs
                             font-semibold text-white transition-colors disabled:opacity-40">
                  {saving ? 'Saving…' : 'Save Boundary'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Right sidebar ─────────────────────────────────────────────── */}
        <div className="w-60 bg-zinc-900 border-l border-zinc-800 flex flex-col overflow-hidden">
          <div className="px-3 py-2.5 border-b border-zinc-800 shrink-0">
            <h3 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              Land Boundaries
            </h3>
            <p className="text-[10px] text-zinc-700 mt-0.5">
              {boundaries.length} area{boundaries.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1 min-h-0">
            {boundaries.length === 0 ? (
              <div className="text-[11px] text-zinc-700 text-center mt-10 px-3 leading-relaxed">
                Select "Polygon" or "Rectangle" tool then click "Draw Boundary".
              </div>
            ) : (
              boundaries.map((b, index) => (
                <BoundaryRow key={b.id || `boundary-${index}`} boundary={b}
                  isActive={b.id === activeBoundaryId}
                  onSelect={setActiveBoundaryId}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  onToggleVisible={handleToggleVisible} />
              ))
            )}
          </div>

          {/* Active boundary properties */}
          {activeBoundaryId && (() => {
            const b = boundaries.find((x) => x.id === activeBoundaryId);
            if (!b) return null;
            const geo = b.geometry?.geometry ?? b.geometry;
            const coordCount = geo?.coordinates?.[0]?.length ?? 0;
            const area = b.area ?? geojsonAreaM2(b.geometry);
            return (
              <div className="border-t border-zinc-800 px-3 py-3 shrink-0 space-y-2">
                <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold">Properties</p>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border border-white/20 shrink-0"
                       style={{ background: b.color ?? '#3b82f6' }} />
                  <span className="text-xs text-zinc-300 font-medium truncate">{b.name}</span>
                </div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Type</span>
                    <span className="text-zinc-300 font-mono">{b.boundaryType ?? geo?.type ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Points</span>
                    <span className="text-zinc-300 font-mono">{coordCount}</span>
                  </div>
                  {area !== null && (
                    <div className="flex justify-between">
                      <span className="text-zinc-600">Area</span>
                      <span className="text-zinc-300 font-mono">{formatArea(area)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-zinc-600">Created</span>
                    <span className="text-zinc-400">{formatDate(b.createdAt)}</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(b.id)}
                  className="w-full py-1.5 rounded-lg border border-red-800/40 text-red-400
                             text-xs hover:bg-red-500/10 transition-colors">
                  Delete Boundary
                </button>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
