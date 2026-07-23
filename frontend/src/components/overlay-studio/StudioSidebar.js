'use client';

/**
 * StudioSidebar  —  Left panel of Overlay Studio
 *
 * Section 1: Attach Layout form
 *   - Architecture Region dropdown  (saved regions from Viewer)
 *   - Land Boundary dropdown        (saved boundaries from Map)
 *   - Keep Aspect Ratio toggle
 *   - Attach Layout button
 *
 * Section 2: Placed Overlay list
 *   - Select / Hide / Lock / Delete per overlay
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRegionStore }      from '@/store/regionStore';
import { useBoundaryStore }    from '@/store/boundaryStore';
import { useOverlayStore }     from '@/store/overlayStore';
import { useOverlayTransform } from '@/hooks/useOverlayTransform';
import { placeMapOverlay }     from '@/lib/api';
// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ on, onChange, label }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <div onClick={() => onChange(!on)}
        className={`w-8 h-4 rounded-full relative transition-colors cursor-pointer
          ${on ? 'bg-amber-500' : 'bg-zinc-700'}`}>
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform
          ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
      <span className="text-xs text-zinc-400">{label}</span>
    </label>
  );
}

// ─── Empty state hint ─────────────────────────────────────────────────────────
function EmptyHint({ message, linkHref, linkLabel }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-800/30 px-3 py-2.5 space-y-1.5">
      <p className="text-[11px] text-zinc-600">{message}</p>
      {linkHref && (
        <Link href={linkHref}
          className="text-[11px] text-amber-500 hover:text-amber-400 transition-colors font-medium">
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}

// ─── Attach Layout form ───────────────────────────────────────────────────────
function AttachForm({ projectId }) {
  const regions       = useRegionStore((s) => s.regions);
  const boundaries    = useBoundaryStore((s) => s.boundaries);
  const setStudioSel  = useBoundaryStore((s) => s.setStudioSelectedBoundaryId);
  const addOverlay    = useOverlayStore((s) => s.addOverlay);
  const setActiveId   = useOverlayStore((s) => s.setActiveOverlayId);

  const [regionId,   setRegionId]   = useState('');
  const [boundaryId, setBoundaryId] = useState('');
  const [keepAR,     setKeepAR]     = useState(true);
  const [placing,    setPlacing]    = useState(false);
  const [error,      setError]      = useState(null);
  const [placed,     setPlaced]     = useState(false);

  // Pre-select first available items and notify map immediately
  useEffect(() => {
    if (regions.length    && !regionId)   setRegionId(String(regions[0].id));
    if (boundaries.length && !boundaryId) {
      const firstId = String(boundaries[0].id);
      setBoundaryId(firstId);
      setStudioSel(Number(firstId));
    }
  }, [regions, boundaries]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync boundary selection → map whenever it changes
  function handleBoundaryChange(val) {
    setBoundaryId(val);
    setStudioSel(val ? Number(val) : null);
  }

  const noRegions    = regions.length    === 0;
  const noBoundaries = boundaries.length === 0;
  const canAttach    = !noRegions && !noBoundaries && regionId && boundaryId && !placing;

  async function handleAttach() {
    if (!canAttach) return;
    setPlacing(true);
    setError(null);
    setPlaced(false);
    try {
      const res = await placeMapOverlay(projectId, {
        regionId:        Number(regionId),
        boundaryId:      Number(boundaryId),
        autoFit:         true,
        keepAspectRatio: keepAR,
      });
      addOverlay(res);
      setActiveId(res.id);
      setPlaced(true);
      setTimeout(() => setPlaced(false), 2500);
    } catch (e) {
      setError(e.message || 'Placement failed. Try again.');
    } finally {
      setPlacing(false);
    }
  }

  const selRegion   = regions.find((r) => r.id === Number(regionId));
  const selBoundary = boundaries.find((b) => b.id === Number(boundaryId));

  return (
    <div className="p-3 space-y-4">
      <div>
        <p className="text-[9px] font-semibold text-zinc-600 uppercase tracking-wider mb-3">
          Attach Layout
        </p>

        {/* Region */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-zinc-500 font-medium">Architecture Region</label>
          {noRegions ? (
            <EmptyHint
              message="No Architecture Regions. Create them in the Viewer first."
              linkHref={`/projects/${projectId}/viewer`}
              linkLabel="Go to Viewer" />
          ) : (
            <select value={regionId} onChange={(e) => setRegionId(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2
                         text-xs text-zinc-200 focus:outline-none focus:border-amber-500 transition-colors">
              <option value="">— Select region —</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.architectureFile?.originalName ? ` · ${r.architectureFile.originalName}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Region preview card */}
        {selRegion && (
          <div className="mt-2 rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-2.5 py-2 space-y-0.5">
            <p className="text-[10px] font-medium text-zinc-300 truncate">{selRegion.name}</p>
            <p className="text-[9px] text-zinc-600">
              {selRegion.width?.toFixed(0)} × {selRegion.height?.toFixed(0)} px
              {selRegion.shapeType ? ` · ${selRegion.shapeType}` : ''}
            </p>
          </div>
        )}

        {/* Boundary */}
        <div className="space-y-1.5 mt-3">
          <label className="text-[10px] text-zinc-500 font-medium">Land Boundary</label>
          {noBoundaries ? (
            <EmptyHint
              message="No Land Boundaries. Draw them in the Map Workspace first."
              linkHref={`/projects/${projectId}/viewer?map=1`}
              linkLabel="Go to Map Workspace" />
          ) : (
            <select value={boundaryId} onChange={(e) => handleBoundaryChange(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2
                         text-xs text-zinc-200 focus:outline-none focus:border-amber-500 transition-colors">
              <option value="">— Select boundary —</option>
              {boundaries.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Boundary preview card */}
        {selBoundary && (
          <div className="mt-2 rounded-lg border border-zinc-700/60 bg-zinc-800/40 px-2.5 py-2 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full shrink-0"
                   style={{ background: selBoundary.color ?? '#3b82f6' }} />
              <p className="text-[10px] font-medium text-zinc-300 truncate">{selBoundary.name}</p>
            </div>
            {selBoundary.boundaryType && (
              <p className="text-[9px] text-zinc-600">{selBoundary.boundaryType}</p>
            )}
          </div>
        )}
      </div>

      {/* Options */}
      <Toggle on={keepAR} onChange={setKeepAR} label="Keep aspect ratio" />

      {/* Error */}
      {error && (
        <div className="text-[11px] text-red-400 bg-red-950/40 border border-red-800/40
                        rounded-lg px-2.5 py-2 leading-relaxed">
          {error}
        </div>
      )}

      {/* Attach button */}
      <button onClick={handleAttach} disabled={!canAttach}
        className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all
          ${placed
            ? 'bg-emerald-600 text-white'
            : canAttach
              ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20'
              : 'bg-zinc-700/60 text-zinc-500 cursor-not-allowed'}`}>
        {placing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3"/>
              <path d="M12 3A9 9 0 0 1 21 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            </svg>
            Attaching…
          </span>
        ) : placed ? '✓ Layout Attached' : '⬡ Attach Layout'}
      </button>
    </div>
  );
}

// ─── Overlay list ──────────────────────────────────────────────────────────────
function OverlayList() {
  const overlays    = useOverlayStore((s) => s.overlays);
  const activeId    = useOverlayStore((s) => s.activeOverlayId);
  const setActiveId = useOverlayStore((s) => s.setActiveOverlayId);
  const { setVisible, setLocked, removeActive } = useOverlayTransform();

  const sorted = [...overlays].sort((a, b) => (b.zIndex ?? 1) - (a.zIndex ?? 1));

  return (
    <div className="flex flex-col overflow-hidden min-h-0">
      <div className="px-3 py-2 border-t border-zinc-800 shrink-0 flex items-center justify-between">
        <span className="text-[9px] font-semibold text-zinc-600 uppercase tracking-wider">
          Placed Overlays
        </span>
        <span className="text-[10px] text-zinc-700">{overlays.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1 min-h-0">
        {overlays.length === 0 ? (
          <p className="text-[11px] text-zinc-700 text-center mt-4 px-3 leading-relaxed">
            No overlays placed yet.
          </p>
        ) : (
          sorted.map((ov) => {
            const isAct = ov.id === activeId;
            return (
              <div key={ov.id}
                onClick={() => setActiveId(isAct ? null : ov.id)}
                className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer border
                            transition-all duration-150
                            ${isAct
                              ? 'border-amber-500/50 bg-amber-500/8'
                              : 'border-zinc-700/60 hover:border-zinc-600 bg-zinc-800/40'}`}>

                <div className={`w-1.5 h-1.5 rounded-full shrink-0
                  ${isAct ? 'bg-amber-400' : 'bg-zinc-600'}`} />

                <div className="flex-1 min-w-0">
                  <span className="text-xs text-zinc-300 font-medium truncate block">
                    {ov.name ?? `Overlay #${ov.id}`}
                  </span>
                  {!ov.visible && (
                    <span className="text-[9px] text-zinc-600 italic">hidden</span>
                  )}
                </div>

                <div className={`flex items-center gap-0.5 transition-opacity
                  ${isAct ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>

                  <button title={ov.visible ? 'Hide' : 'Show'}
                    onClick={(e) => { e.stopPropagation(); setVisible(ov.id, !ov.visible); }}
                    className="w-5 h-5 flex items-center justify-center text-zinc-500
                               hover:text-zinc-200 transition-colors rounded">
                    {ov.visible
                      ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><line x1="1" y1="1" x2="23" y2="23"/></svg>}
                  </button>

                  <button title={ov.locked ? 'Unlock' : 'Lock'}
                    onClick={(e) => { e.stopPropagation(); setLocked(ov.id, !ov.locked); }}
                    className="w-5 h-5 flex items-center justify-center text-zinc-500
                               hover:text-zinc-200 transition-colors rounded">
                    {ov.locked
                      ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>}
                  </button>

                  <button title="Delete" disabled={ov.locked}
                    onClick={(e) => { e.stopPropagation(); if (!ov.locked) removeActive(ov.id); }}
                    className="w-5 h-5 flex items-center justify-center text-zinc-600
                               hover:text-red-400 transition-colors rounded disabled:opacity-30">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Main sidebar ──────────────────────────────────────────────────────────────
export default function StudioSidebar({ projectId }) {
  return (
    <aside className="w-72 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-hidden">
      <div className="px-3 py-2.5 border-b border-zinc-800 shrink-0">
        <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
          Overlay Studio
        </h2>
        <p className="text-[9px] text-zinc-700 mt-0.5">
          Select a region and boundary, then attach
        </p>
      </div>

      <div className="overflow-y-auto scrollbar-thin" style={{ maxHeight: '68%' }}>
        <AttachForm projectId={projectId} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <OverlayList />
      </div>
    </aside>
  );
}
