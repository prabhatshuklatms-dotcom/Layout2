'use client';
/**
 * MapViewClient — /map-view
 *
 * Satellite map with editing experience identical to /map (ExplorerMap).
 * Only difference: real Leaflet satellite/street/hybrid tile map instead of SVG workspace.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import Link    from 'next/link';
import dynamic from 'next/dynamic';
import { getAllProjects, getBoundaries, getRegionsByProject, updateRegion } from '@/lib/api';
import { TOOL } from './LeafletMapView';

const LeafletMapView = dynamic(() => import('./LeafletMapView'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3 text-zinc-500">
        <svg className="animate-spin w-7 h-7" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3"/>
          <path d="M12 3A9 9 0 0 1 21 12" stroke="#6366f1" strokeWidth="3" strokeLinecap="round"/>
        </svg>
        <span className="text-sm">Loading map…</span>
      </div>
    </div>
  ),
});

// ─── Toolbar — matches /map SVGWorkspace toolbar exactly ─────────────────────
function Toolbar({
  tool, setTool,
  activeRegionId,
  crop, onSave, onClearCrop,
  saving, saved, saveError,
  onFit, onResetView, onZoomIn, onZoomOut,
}) {
  const hasCrop = !!crop;

  function ToolBtn({ t, label, title, icon, active: forceActive, onClick: customClick }) {
    const isActive = forceActive ?? tool === t;
    const colorMap = {
      [TOOL.SELECT]:    'bg-emerald-600/20 border-emerald-500/50 text-emerald-300',
      [TOOL.PAN]:       'bg-zinc-600/30 border-zinc-500/60 text-zinc-200',
      [TOOL.CROP_RECT]: 'bg-amber-500/20 border-amber-500/60 text-amber-300',
      [TOOL.CROP_POLY]: 'bg-violet-500/20 border-violet-500/60 text-violet-300',
      [TOOL.FIT_BOUNDARY]: 'bg-sky-500/20 border-sky-500/60 text-sky-300',
    };
    const handleClick = customClick ?? (() => setTool(t));
    return (
      <button onClick={handleClick} title={title}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px]
                    font-medium transition-colors
          ${isActive
            ? (colorMap[t] ?? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300')
            : 'border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500'}`}>
        {icon}{label}
      </button>
    );
  }

  return (
    <div className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-zinc-900/80
                    border-b border-zinc-800 select-none flex-wrap z-10">

      {/* View controls — always visible */}
      <button onClick={onFit} title="Fit to boundaries (Ctrl+0)"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-700
                   text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-[11px] transition-colors">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
          <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
        </svg>Fit
      </button>
      <button onClick={onResetView} title="Reset view"
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-700
                   text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-[11px] transition-colors">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
        </svg>Reset View
      </button>
      <button onClick={onZoomIn} title="Zoom in"
        className="w-7 h-7 flex items-center justify-center rounded-lg border border-zinc-700
                   text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-base transition-colors">+</button>
      <button onClick={onZoomOut} title="Zoom out"
        className="w-7 h-7 flex items-center justify-center rounded-lg border border-zinc-700
                   text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-base transition-colors">−</button>

      <div className="w-px h-4 bg-zinc-700 mx-1"/>

      {/* Pan — always visible */}
      <ToolBtn t={TOOL.PAN} label="Pan" title="Pan map (hold Space)"
        icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0M10 10V6a2 2 0 0 0-4 0"/>
          <path d="M6 14v0a6 6 0 0 0 6 6h2a6 6 0 0 0 6-6v-3"/>
        </svg>}/>

      {activeRegionId && (<>
        <div className="w-px h-4 bg-zinc-700 mx-1"/>
        <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-semibold shrink-0">Tools</span>

        {/* Select */}
        <ToolBtn t={TOOL.SELECT} label="Select" title="Select · drag to move · handles to resize · blue dot to rotate"
          icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 3l14 9-7 1-4 7z"/></svg>}/>

        {/* Crop Rect */}
        <ToolBtn t={TOOL.CROP_RECT} label="Crop Rect" title="Crop — drag rectangle · handles to resize"
          icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="6 2 6 8 2 8"/><polyline points="18 22 18 16 22 16"/>
            <path d="M6 8H22V22"/><path d="M2 8V22H18"/>
          </svg>}/>

        {/* Crop Poly */}
        <ToolBtn t={TOOL.CROP_POLY} label="Crop Poly" title="Crop polygon — click points · Enter or dblclick to finish · Esc cancel"
          icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polygon points="12,3 21,9 18,20 6,20 3,9" strokeDasharray="3 2"/>
          </svg>}/>

        {/* Fit Boundary */}
        <ToolBtn t={TOOL.FIT_BOUNDARY} label="Fit Boundary" title="Manually fit image edges to boundary"
          icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <path d="M8 12h8"/><path d="M12 8v8"/>
          </svg>}/>

        {tool===TOOL.CROP_RECT && (
          <span className="text-[10px] text-amber-500/80 italic ml-0.5">Drag to draw · Handles to resize · Drag again to redraw</span>
        )}
        {tool===TOOL.CROP_POLY && (
          <span className="text-[10px] text-violet-400/80 italic ml-0.5">Continue placing points. Click the first point to close the polygon, double-click the last point, or press Enter to finish.</span>
        )}

        {hasCrop && (
          <button onClick={onClearCrop}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px]
                       font-semibold bg-red-950/80 border border-red-700 text-red-300
                       hover:bg-red-900 hover:border-red-500 transition-colors ml-1">
            ✕ Reset Crop
          </button>
        )}

        {activeRegionId && (
          <button onClick={onSave} disabled={saving}
            title={saveError || undefined}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px]
                        font-semibold border transition-colors ml-1 disabled:opacity-50
              ${saveError
                ? 'bg-red-950/80 border-red-700 text-red-300'
                : saved
                  ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                  : 'bg-blue-950/80 border-blue-700 text-blue-300 hover:bg-blue-900 hover:border-blue-500'
              }`}>
            {saving ? 'Saving…' : saveError ? '✕ Failed' : saved ? '✓ Saved' : (hasCrop ? '✂ Cut & Save' : '✓ Save Edits')}
          </button>
        )}
      </>)}

      <span className="ml-auto text-[10px] text-zinc-700 hidden md:inline">
        {!activeRegionId
          ? 'Click a region on the map to select it'
          : tool===TOOL.SELECT
            ? 'Drag to move · Corner handles to resize · Blue dot to rotate'
            : tool===TOOL.PAN
              ? 'Drag to pan · Scroll to zoom'
              : ''}
      </span>
    </div>
  );
}

// ─── Left side panel ──────────────────────────────────────────────────────────
function SidePanel({ project, boundaries, regions, activeRegionId, setActiveRegionId,
                     hiddenIds, toggleHidden, crops }) {
  return (
    <aside className="w-64 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 shrink-0">
        <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-semibold">Map View</p>
        <div className="flex items-center gap-2 mt-1">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 shrink-0"/>
          <span className="text-sm font-semibold text-zinc-100 truncate">{project?.name ?? '—'}</span>
        </div>
      </div>

      {boundaries.length > 0 && (
        <div className="px-4 py-2 border-b border-zinc-800 shrink-0">
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-semibold mb-1">
            Boundaries ({boundaries.length})
          </p>
          <div className="space-y-0.5 max-h-20 overflow-y-auto">
            {boundaries.map(b => (
              <div key={b.id} className="flex items-center gap-2 text-[11px] text-zinc-400">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: b.color ?? '#3b82f6' }}/>
                <span className="truncate">{b.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-2 border-b border-zinc-800">
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-semibold">
            Regions ({regions.length})
          </p>
        </div>
        {regions.length === 0 ? (
          <p className="text-[11px] text-zinc-700 text-center mt-6 px-4 leading-relaxed">
            No regions. Create them in the Viewer.
          </p>
        ) : (
          <div className="p-2 space-y-0.5">
            {regions.map(r => {
              const isActive = r.id === activeRegionId;
              const isHidden = hiddenIds.has(r.id);
              const hasCrop  = !!crops[r.id];
              return (
                <button key={r.id}
                  onClick={() => setActiveRegionId(r.id === activeRegionId ? null : r.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px]
                              transition-colors text-left group
                    ${isActive
                      ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-zinc-400 hover:bg-zinc-800 border border-transparent'}`}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="shrink-0">
                    {r.shapeType === 'POLYGON'
                      ? <polygon points="12,3 21,9 18,20 6,20 3,9"/>
                      : <rect x="3" y="3" width="18" height="18" rx="2"/>}
                  </svg>
                  <span className="flex-1 truncate">{r.name}</span>
                  {hasCrop && <span title="Crop applied" className="text-amber-500 text-[10px]">✂</span>}
                  <span onClick={e => { e.stopPropagation(); toggleHidden(r.id); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    title={isHidden ? 'Show' : 'Hide'}>
                    {isHidden
                      ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10 10 0 0 1 12 20c-7 0-11-8-11-8a18 18 0 0 1 5.06-5.94"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-zinc-800 shrink-0 space-y-1.5">
        {project?.id && (<>
          <Link href={`/projects/${project.id}/viewer`}
            className="flex items-center gap-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/>
            </svg>Viewer
          </Link>
          <Link href={`/projects/${project.id}/overlay`}
            className="flex items-center gap-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>Overlay Studio
          </Link>
        </>)}
      </div>
    </aside>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function MapViewClient() {
  const [projects,     setProjects]     = useState([]);
  const [activeId,     setActiveId]     = useState(null);
  const [boundaries,   setBoundaries]   = useState([]);
  const [regions,      setRegions]      = useState([]);
  const [loadingProjs, setLoadingProjs] = useState(true);
  const [loadingData,  setLoadingData]  = useState(false);
  const [projError,    setProjError]    = useState(null);
  const [activeRegionId, setActiveRegionId] = useState(null);
  const [hiddenIds,    setHiddenIds]    = useState(new Set());
  const [tool,         setTool]         = useState(TOOL.SELECT);
  const [crops,        setCrops]        = useState({});
  const [savingId,     setSavingId]     = useState(null);
  const [savedId,      setSavedId]      = useState(null);
  const [saveError,    setSaveError]    = useState(null);

  // Live per-region state from LeafletMapView (position, rotation)
  const mapLocalStateRef = useRef(null);
  const handleLocalStateChange = useCallback((localRef) => {
    mapLocalStateRef.current = localRef;
  }, []);

  const setCropForRegion   = useCallback((id, crop) => setCrops(p => ({ ...p, [id]: crop })), []);
  const clearCropForRegion = useCallback((id) => setCrops(p => { const n={...p}; delete n[id]; return n; }), []);
  const toggleHidden = useCallback((id) => {
    setHiddenIds(prev => { const n=new Set(prev); if(n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);

  // Reset tool when active region changes
  useEffect(() => { setTool(TOOL.SELECT); }, [activeRegionId]);

  // Load projects
  useEffect(() => {
    (async () => {
      setLoadingProjs(true); setProjError(null);
      try {
        const res  = await getAllProjects();
        const list = Array.isArray(res) ? res : (res?.data ?? []);
        const active = list.filter(p => p.status === 'ACTIVE');
        setProjects(active);
        if (active.length > 0) setActiveId(active[0].id);
      } catch (err) { setProjError(err.message || 'Failed to load projects'); }
      finally { setLoadingProjs(false); }
    })();
  }, []);

  // Load boundaries + regions when project changes
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setLoadingData(true);
    setBoundaries([]); setRegions([]);
    setActiveRegionId(null); setHiddenIds(new Set()); setCrops({});

    Promise.all([getBoundaries(activeId), getRegionsByProject(activeId)])
      .then(([bRes, rRes]) => {
        if (cancelled) return;
        setBoundaries((Array.isArray(bRes) ? bRes : bRes?.data ?? []).filter(b => b.visible !== false));
        setRegions(Array.isArray(rRes) ? rRes : rRes?.data ?? []);
      })
      .catch(err => { if (!cancelled) console.error('[MapView]', err.message); })
      .finally(() => { if (!cancelled) setLoadingData(false); });

    return () => { cancelled = true; };
  }, [activeId]);

  // Save crop / transform for active region
  const handleSave = useCallback(async (explicitId, explicitPayload) => {
    const idToSave = (explicitId && typeof explicitId !== 'object') ? explicitId : activeRegionId;
    if (!idToSave) return;
    const crop   = crops[idToSave];
    const region = regions.find(r => r.id === idToSave);
    if (!region) return;
    setSavingId(idToSave);
    setSaveError(null);
    try {
      // Use live rotation from map if available, fall back to DB value
      const liveState = mapLocalStateRef.current?.current?.[idToSave];
      const rotation  = liveState?.rotation ?? region.rotation ?? 0;
      let payload = { rotation };
      
      let geoToViewerScale = 1;
      let fitGeo = null;
      if (boundaries.length > 0) {
        const boundary = boundaries[0];
        const geo  = boundary?.geometry?.geometry ?? boundary?.geometry;
        const ring = geo?.coordinates?.[0];
        if (ring && ring.length >= 3) {
          const lngs = ring.map(([lng]) => lng), lats = ring.map(([,lat]) => lat);
          const bW = Math.max(...lngs) - Math.min(...lngs);
          const bH = Math.max(...lats) - Math.min(...lats);
          const rW = region.width || 200, rH = region.height || 200;
          const scale = Math.min(bW/rW, bH/rH);
          geoToViewerScale = 1 / scale;
          
          const oW = rW * scale;
          const oH = rH * scale;
          const bCX = (Math.min(...lngs) + Math.max(...lngs)) / 2;
          const bCY = (Math.min(...lats) + Math.max(...lats)) / 2;
          fitGeo = { x: bCX - oW/2, y: bCY - oH/2, w: oW, h: oH };
        }
      }

      if (explicitPayload) {
        if (explicitPayload.points) {
          payload.shapeType = 'POLYGON';
          payload.points = explicitPayload.points;
          const xs = payload.points.map(p => p.x), ys = payload.points.map(p => p.y);
          payload.x      = Math.min(...xs);
          payload.y      = Math.min(...ys);
          payload.width  = Math.max(1, Math.max(...xs) - Math.min(...xs));
          payload.height = Math.max(1, Math.max(...ys) - Math.min(...ys));
          if (explicitPayload.bounds) {
             payload.rotation = explicitPayload.bounds.rotation ?? region.rotation ?? 0;
          }
        } else if (explicitPayload.bounds && fitGeo) {
          const t = explicitPayload.bounds;
          payload.rotation = t.rotation ?? region.rotation ?? 0;
          payload.width = Math.max(1, t.w * geoToViewerScale);
          payload.height = Math.max(1, t.h * geoToViewerScale);
          payload.x = (region.x ?? 0) + (t.x - fitGeo.x) * geoToViewerScale;
          payload.y = (region.y ?? 0) - (t.y - fitGeo.y) * geoToViewerScale;
        }
      } else if (crop) {
        if (crop.type === 'rect') {
          payload.shapeType = 'RECTANGLE';
          payload.x      = (region.x ?? 0) + (crop.cx * geoToViewerScale);
          payload.y      = (region.y ?? 0) + (crop.cy * geoToViewerScale);
          payload.width  = Math.max(1, crop.cw * geoToViewerScale);
          payload.height = Math.max(1, crop.ch * geoToViewerScale);
        } else if (crop.type === 'poly') {
          payload.shapeType = 'POLYGON';
          payload.points = crop.points.map(p => ({
            x: (region.x ?? 0) + (p.x * geoToViewerScale),
            y: (region.y ?? 0) + (p.y * geoToViewerScale)
          }));
          const xs = payload.points.map(p => p.x), ys = payload.points.map(p => p.y);
          payload.x      = Math.min(...xs);
          payload.y      = Math.min(...ys);
          payload.width  = Math.max(1, Math.max(...xs) - Math.min(...xs));
          payload.height = Math.max(1, Math.max(...ys) - Math.min(...ys));
        }
      } else {
        // Not a crop! Save the resized/rotated region bounds from LeafletMapView.
        const t = mapLocalStateRef.current?.current?.[idToSave];
        if (t && fitGeo) {
          payload.rotation = t.rotation ?? region.rotation ?? 0;
          payload.width = Math.max(1, t.w * geoToViewerScale);
          payload.height = Math.max(1, t.h * geoToViewerScale);
          payload.x = (region.x ?? 0) + (t.x - fitGeo.x) * geoToViewerScale;
          payload.y = (region.y ?? 0) - (t.y - fitGeo.y) * geoToViewerScale; // Geo Y is inverted (lat goes up)
        } else {
          payload.x = region.x; payload.y = region.y;
          payload.width = region.width; payload.height = region.height;
        }
      }
      const res = await updateRegion(idToSave, payload);
      const finalPayload = res?.data ?? res ?? payload;
      setRegions(prev => prev.map(r => r.id === idToSave ? { ...r, ...finalPayload } : r));
      
      // Delete localRef so LeafletMapView rebuilds it from the new geometry
      if (mapLocalStateRef.current?.current?.[idToSave]) {
        delete mapLocalStateRef.current.current[idToSave];
      }
      
      clearCropForRegion(idToSave);
      setSavedId(idToSave);
      setTool(TOOL.SELECT); // Exit crop mode
      setTimeout(() => setSavedId(null), 2500);
    } catch (err) {
      console.error('[MapView] save failed:', err.message);
      setSaveError(err.message);
      setTimeout(() => setSaveError(null), 4000);
    } finally {
      setSavingId(null);
    }
  }, [activeRegionId, crops, regions, clearCropForRegion]);

  // Toolbar callbacks that drive the map imperatively
  const handleFit = useCallback(() => {
    window.dispatchEvent(new CustomEvent('mv-fit'));
  }, []);
  const handleResetView = useCallback(() => {
    window.dispatchEvent(new CustomEvent('mv-reset'));
  }, []);
  const handleZoomIn  = useCallback(() => {
    window.dispatchEvent(new CustomEvent('mv-zoom', { detail:'in' }));
  }, []);
  const handleZoomOut = useCallback(() => {
    window.dispatchEvent(new CustomEvent('mv-zoom', { detail:'out' }));
  }, []);

  const activeProject = projects.find(p => p.id === activeId);
  const activeCrop    = activeRegionId ? crops[activeRegionId] ?? null : null;

  return (
    <div className="h-screen flex flex-col bg-[#0d0d0d] text-zinc-100 overflow-hidden">

      {/* Top bar */}
      <header className="shrink-0 bg-zinc-950 border-b border-zinc-800/80 z-10">
        <div className="px-5 h-14 flex items-center gap-4">
          <Link href="/projects" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-700
                            flex items-center justify-center shadow-md shadow-indigo-500/20
                            group-hover:from-indigo-500 transition-all">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                <rect x="1" y="1" width="8" height="8" rx="1.5" fill="white"/>
                <rect x="11" y="1" width="8" height="8" rx="1.5" fill="white" opacity=".65"/>
                <rect x="1" y="11" width="8" height="8" rx="1.5" fill="white" opacity=".65"/>
                <rect x="11" y="11" width="8" height="8" rx="1.5" fill="white" opacity=".35"/>
              </svg>
            </div>
            <div>
              <span className="text-[10px] text-indigo-400 font-semibold uppercase tracking-widest block leading-none">Layout</span>
              <span className="text-sm font-bold text-zinc-100 leading-tight">Map View</span>
            </div>
          </Link>

          <div className="w-px h-6 bg-zinc-800 shrink-0"/>

          {loadingProjs ? (
            <div className="flex items-center gap-2 text-zinc-600 text-sm">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3"/>
                <path d="M12 3A9 9 0 0 1 21 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
              </svg>Loading…
            </div>
          ) : (
            <nav className="flex items-center gap-1.5 overflow-x-auto flex-1 min-w-0">
              {projects.map(proj => (
                <button key={proj.id} onClick={() => setActiveId(proj.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap
                               transition-all duration-150 shrink-0
                    ${activeId === proj.id
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                      : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700/60'}`}>
                  {proj.name}
                </button>
              ))}
              {projects.length === 0 && <span className="text-xs text-zinc-600 italic">No active projects</span>}
            </nav>
          )}

          <div className="flex items-center gap-3 ml-2 shrink-0">
            <Link href="/map" className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors text-xs">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
              </svg>SVG Map
            </Link>
            <Link href="/projects" className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors text-xs">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>Projects
            </Link>
          </div>
        </div>
      </header>

      {/* Body */}
      {projError ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <p className="text-4xl">⚠</p>
            <p className="text-zinc-300 text-sm">{projError}</p>
            <Link href="/projects" className="text-indigo-400 text-sm hover:underline">← Back</Link>
          </div>
        </div>
      ) : loadingProjs ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-zinc-500">
            <svg className="animate-spin w-7 h-7" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3"/>
              <path d="M12 3A9 9 0 0 1 21 12" stroke="#6366f1" strokeWidth="3" strokeLinecap="round"/>
            </svg>
            <span className="text-sm">Loading projects…</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <SidePanel
            project={activeProject}
            boundaries={boundaries}
            regions={regions}
            activeRegionId={activeRegionId}
            setActiveRegionId={setActiveRegionId}
            hiddenIds={hiddenIds}
            toggleHidden={toggleHidden}
            crops={crops}
          />

          <div className="flex-1 flex flex-col overflow-hidden">
            <Toolbar
              tool={tool}
              setTool={setTool}
              activeRegionId={activeRegionId}
              crop={activeCrop}
              onSave={handleSave}
              onClearCrop={() => activeRegionId && clearCropForRegion(activeRegionId)}
              saving={savingId === activeRegionId}
              saved={savedId  === activeRegionId}
              saveError={savingId !== activeRegionId && savedId !== activeRegionId ? saveError : null}
              onFit={handleFit}
              onResetView={handleResetView}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
            />

            <div className="flex-1 relative overflow-hidden">
              {loadingData && (
                <div className="absolute inset-0 z-[9800] flex items-center justify-center
                                bg-zinc-950/60 backdrop-blur-sm pointer-events-none">
                  <div className="flex items-center gap-2.5 bg-zinc-900/95 border border-zinc-700
                                  rounded-xl px-5 py-3 text-sm text-zinc-300 shadow-xl">
                    <svg className="animate-spin w-4 h-4 text-indigo-400" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3"/>
                      <path d="M12 3A9 9 0 0 1 21 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                    </svg>
                    Loading map data…
                  </div>
                </div>
              )}

              {!loadingData && (
                <LeafletMapView
                  key={activeId}
                  boundaries={boundaries}
                  regions={regions}
                  activeRegionId={activeRegionId}
                  setActiveRegionId={setActiveRegionId}
                  hiddenIds={hiddenIds}
                  tool={tool}
                  setTool={setTool}
                  crops={crops}
                  setCropForRegion={setCropForRegion}
                  clearCropForRegion={clearCropForRegion}
                  savingId={savingId}
                  savedId={savedId}
                  onSave={handleSave}
                  onLocalStateChange={handleLocalStateChange}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
