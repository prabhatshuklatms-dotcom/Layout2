'use client';

/**
 * PlaceOverlayDialog
 *
 * Shown inside MapWorkspace. Lets the user pick:
 *   1. An Architecture Region  (fetched from GET /projects/:id/regions)
 *   2. A Land Boundary         (already in Zustand boundaryStore)
 *
 * Then calls POST /projects/:id/map-overlays and pushes the result into
 * overlayStore so the canvas renders it immediately.
 */

import { useState, useEffect } from 'react';
import { useBoundaryStore } from '@/store/boundaryStore';
import { useOverlayStore }  from '@/store/overlayStore';
import { useRegionStore }   from '@/store/regionStore';
import { placeMapOverlay }  from '@/lib/api';

export default function PlaceOverlayDialog({ projectId, onClose, onPlaced, onCloseWorkspace }) {
  const boundaries   = useBoundaryStore((s) => s.boundaries);
  const regions      = useRegionStore((s) => s.regions);
  const addOverlay   = useOverlayStore((s) => s.addOverlay);
  const setActiveOverlayId = useOverlayStore((s) => s.setActiveOverlayId);

  const [regionId,    setRegionId]    = useState('');
  const [boundaryId,  setBoundaryId]  = useState('');
  const [autoFit,     setAutoFit]     = useState(true);
  const [placing,     setPlacing]     = useState(false);
  const [error,       setError]       = useState(null);

  // Pre-select first items for convenience
  useEffect(() => {
    if (regions.length    && !regionId)   setRegionId(String(regions[0].id));
    if (boundaries.length && !boundaryId) setBoundaryId(String(boundaries[0].id));
  }, [regions, boundaries]);

  const noRegions    = regions.length    === 0;
  const noBoundaries = boundaries.length === 0;
  const canPlace     = !noRegions && !noBoundaries && regionId && boundaryId && !placing;

  async function handlePlace() {
    if (!canPlace) return;
    setPlacing(true);
    setError(null);
    try {
      const res = await placeMapOverlay(projectId, {
        regionId:        Number(regionId),
        boundaryId:      Number(boundaryId),
        autoFit,
        keepAspectRatio: true,
      });
      // Push overlay into store — OverlayCanvas on ViewerPage will render it immediately
      addOverlay(res);
      setActiveOverlayId(res.id);
      // Close dialog first, then close the full MapWorkspace so ViewerPage is revealed
      // with the new overlay already visible on the canvas
      onClose?.();
      onCloseWorkspace?.();
      onPlaced?.(res);
    } catch (err) {
      setError(err.message || 'Placement failed. Please try again.');
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl w-[400px] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
          <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-zinc-200">Place Overlay</h2>
            <p className="text-[11px] text-zinc-600 mt-0.5">
              Map an architecture region onto a land boundary
            </p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-500
                       hover:bg-zinc-700 hover:text-zinc-200 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">

          {/* Architecture Region */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
              Architecture Region
            </label>
            {noRegions ? (
              <div className="flex items-center justify-between rounded-lg border border-dashed border-zinc-700
                              bg-zinc-800/40 px-3 py-2.5">
                <span className="text-[11px] text-zinc-600">No Architecture Regions available.</span>
              </div>
            ) : (
              <select
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5
                           text-sm text-zinc-200 focus:outline-none focus:border-amber-500 transition-colors
                           appearance-none cursor-pointer"
              >
                <option value="">— Select a region —</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.architectureFile?.originalName ? ` · ${r.architectureFile.originalName}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Land Boundary */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">
              Target Land Boundary
            </label>
            {noBoundaries ? (
              <div className="flex items-center justify-between rounded-lg border border-dashed border-zinc-700
                              bg-zinc-800/40 px-3 py-2.5">
                <span className="text-[11px] text-zinc-600">No saved land boundaries.</span>
                <button onClick={onClose}
                  className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors font-medium">
                  Create Boundary →
                </button>
              </div>
            ) : (
              <select
                value={boundaryId}
                onChange={(e) => setBoundaryId(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5
                           text-sm text-zinc-200 focus:outline-none focus:border-amber-500 transition-colors
                           appearance-none cursor-pointer"
              >
                <option value="">— Select a boundary —</option>
                {boundaries.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.area ? ` · ${formatArea(b.area)}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Options */}
          <div className="flex items-center gap-3 px-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => setAutoFit(!autoFit)}
                className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer
                  ${autoFit ? 'bg-amber-500' : 'bg-zinc-700'}`}>
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform
                  ${autoFit ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-xs text-zinc-400">Auto-fit to boundary</span>
            </label>
          </div>

          {/* Preview info */}
          {regionId && boundaryId && (
            <PreviewInfo
              region={regions.find((r) => r.id === Number(regionId))}
              boundary={boundaries.find((b) => b.id === Number(boundaryId))}
              autoFit={autoFit}
            />
          )}

          {/* Error */}
          {error && (
            <div className="text-[11px] text-red-400 bg-red-950/40 border border-red-800/40
                            rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2.5 px-5 py-4 border-t border-zinc-800">
          <button onClick={onClose} disabled={placing}
            className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-sm text-zinc-400
                       hover:bg-zinc-800 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={handlePlace}
            disabled={!canPlace}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all
              ${canPlace
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20'
                : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'}`}
          >
            {placing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3"/>
                  <path d="M12 3A9 9 0 0 1 21 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                Placing…
              </span>
            ) : (
              '⬡ Place Overlay'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Preview calculation helper ────────────────────────────────────────────────
function PreviewInfo({ region, boundary, autoFit }) {
  if (!region || !boundary) return null;

  const geo  = boundary.geometry?.geometry ?? boundary.geometry;
  const ring = geo?.coordinates?.[0];
  if (!ring) return null;

  const lngs = ring.map(([lng]) => lng);
  const lats = ring.map(([, lat]) => lat);
  const bW   = Math.max(...lngs) - Math.min(...lngs);
  const bH   = Math.max(...lats) - Math.min(...lats);

  const rW   = region.width;
  const rH   = region.height;

  let label = '';
  if (autoFit && rW > 0 && rH > 0 && bW > 0 && bH > 0) {
    const scale = Math.min(bW / rW, bH / rH);
    label = `Scale ×${scale.toFixed(4)} → ${(rW * scale).toFixed(4)}° × ${(rH * scale).toFixed(4)}°`;
  }

  return (
    <div className="bg-zinc-800/60 rounded-lg px-3 py-2.5 space-y-1 border border-zinc-700/40">
      <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold">Preview</p>
      <div className="text-[11px] text-zinc-400 space-y-0.5">
        <div className="flex justify-between">
          <span className="text-zinc-600">Region</span>
          <span className="font-mono">{region.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-600">Boundary</span>
          <span className="font-mono">{boundary.name}</span>
        </div>
        {label && (
          <div className="flex justify-between">
            <span className="text-zinc-600">Fit</span>
            <span className="font-mono text-amber-400">{label}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tiny area formatter (duplicated here to avoid import issues) ──────────────
function formatArea(m2) {
  if (!m2) return '';
  if (m2 >= 1_000_000) return `${(m2 / 1_000_000).toFixed(2)} km²`;
  if (m2 >= 10_000)    return `${(m2 / 10_000).toFixed(2)} ha`;
  return `${Math.round(m2).toLocaleString()} m²`;
}
