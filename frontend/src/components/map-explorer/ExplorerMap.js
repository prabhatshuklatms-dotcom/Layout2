'use client';
/**
 * ExplorerMap — single interaction-layer architecture.
 * One transparent <rect> on top captures all pointer events.
 * All images have pointerEvents:none.
 * Hit-testing is manual (bounding-box), not SVG-bubble-based.
 * useInteraction() owns every drag/crop/pan state.
 * Spacebar = temporary PAN mode.
 * Action buttons are HTML divs above the SVG so they are never blocked.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRegionsByProject } from '@/lib/api';
import CoordinateTransformer from '../editor/utils/CoordinateTransformer';
import { extractPoints, getBBox, polyCentroid } from '../editor/utils/geometry';
import useRegionStates from '@/hooks/useRegionStates';
import useInteraction from '@/hooks/useInteraction';
import { RegionRenderer } from '../editor/renderers/RegionRenderer';
import { HandleRenderer } from '../editor/renderers/HandleRenderer';
import { CropRenderer } from '../editor/renderers/CropRenderer';
import {
  TOOL,
  CANVAS_W,
  CANVAS_H,
  PAD,
  IL_ORIGIN,
  IL_SIZE,
} from '../editor/constants';


function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-2 text-[11px]">
      <span className="text-zinc-500 shrink-0">{label}</span>
      <span className="text-zinc-300 font-mono text-right">{value ?? '—'}</span>
    </div>
  );
}
function Sec({ title, children }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-semibold">{title}</p>
      {children}
    </div>
  );
}

function LeftPanel({ boundary, boundaries, onSelect, regions, activeRegionId, onSelectRegion }) {
  const pts   = extractPoints(boundary);
  const bbox  = pts.length ? getBBox(pts) : null;
  const c     = polyCentroid(pts);
  const geo   = boundary?.geometry?.geometry ?? boundary?.geometry;
  const color = boundary?.color ?? '#3b82f6';

  return (
    <aside className="w-72 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-hidden h-full">
      <div className="px-4 py-3 border-b border-zinc-800 shrink-0">
        <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-semibold">Boundary Workspace</p>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="w-3 h-3 rounded-full shrink-0 border border-white/15" style={{ background: color }}/>
          <span className="text-sm font-semibold text-zinc-100 truncate">{boundary?.name ?? '—'}</span>
        </div>
      </div>

      {boundaries.length > 1 && (
        <div className="px-3 py-2 border-b border-zinc-800 shrink-0 space-y-1">
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-semibold">Select Boundary</p>
          <div className="space-y-0.5 max-h-28 overflow-y-auto">
            {boundaries.map(b => (
              <button key={b.id} onClick={() => onSelect(b.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs
                            transition-colors text-left
                  ${b.id === boundary.id
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                    : 'text-zinc-400 hover:bg-zinc-800 border border-transparent'}`}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: b.color ?? '#3b82f6' }}/>
                <span className="truncate">{b.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Sec title="Geometry">
          <InfoRow label="Type"   value={boundary?.boundaryType ?? geo?.type ?? '—'}/>
          <InfoRow label="Points" value={pts.length}/>
          {boundary?.area && (
            <InfoRow label="Area" value={boundary.area >= 1e6
              ? `${(boundary.area/1e6).toFixed(3)} km²`
              : `${boundary.area.toFixed(0)} m²`}/>
          )}
        </Sec>
        {bbox && (<>
          <div className="h-px bg-zinc-800"/>
          <Sec title="Bounding Box">
            <InfoRow label="N (max lat)" value={bbox.maxLat.toFixed(6) + '°'}/>
            <InfoRow label="S (min lat)" value={bbox.minLat.toFixed(6) + '°'}/>
            <InfoRow label="E (max lng)" value={bbox.maxLng.toFixed(6) + '°'}/>
            <InfoRow label="W (min lng)" value={bbox.minLng.toFixed(6) + '°'}/>
          </Sec>
        </>)}
        {pts.length > 0 && (<>
          <div className="h-px bg-zinc-800"/>
          <Sec title="Centroid">
            <InfoRow label="Lat" value={c[1].toFixed(6) + '°'}/>
            <InfoRow label="Lng" value={c[0].toFixed(6) + '°'}/>
          </Sec>
        </>)}
        {regions.length > 0 && (<>
          <div className="h-px bg-zinc-800"/>
          <Sec title={`Regions (${regions.length})`}>
            <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
              {regions.map(r => (
                <button key={r.id}
                  onClick={() => onSelectRegion(r.id === activeRegionId ? null : r.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg
                              text-[11px] transition-colors text-left
                    ${r.id === activeRegionId
                      ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-zinc-400 hover:bg-zinc-800 border border-transparent'}`}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="shrink-0">
                    {r.shapeType === 'POLYGON'
                      ? <polygon points="12,3 21,9 18,20 6,20 3,9"/>
                      : <rect x="3" y="3" width="18" height="18" rx="2"/>}
                  </svg>
                  <span className="truncate">{r.name}</span>
                  <span className="ml-auto text-zinc-700 text-[10px] font-mono shrink-0">#{r.id}</span>
                </button>
              ))}
            </div>
          </Sec>
        </>)}
      </div>
    </aside>
  );
}

// ─── SVGWorkspace ─────────────────────────────────────────────────────────────
function SVGWorkspace({ boundary, regions, activeRegionId, onSelectRegion, onRegionSaved,
                        showGrid, showVertices, showLabels }) {
  const containerRef = useRef(null);
  const [view,  setView]  = useState({ scale:1, tx:0, ty:0 });
  const viewRef = useRef({ scale:1, tx:0, ty:0 });
  const [, setTick] = useState(0); // force re-render when statesRef mutates

  const onRepaint = useCallback((viewOverride) => {
    if (viewOverride) {
      const next = { ...viewRef.current, ...viewOverride };
      viewRef.current = next; setView(next);
    } else {
      setTick(n => n + 1);
    }
  }, []);

  const pts = useMemo(() => extractPoints(boundary), [boundary]);
  const transformer = useMemo(() =>
    pts.length ? new CoordinateTransformer(pts, CANVAS_W, CANVAS_H, PAD) : null, [pts]);

  const { svgPath, projectedPts } = useMemo(() => {
    if (!transformer || !pts.length) return { svgPath:'', projectedPts:[] };
    const pp = pts.map(([lng,lat]) => transformer.toSVG(lng,lat));
    const d  = pp.map(([x,y],i) => `${i===0?'M':'L'}${x.toFixed(3)},${y.toFixed(3)}`).join(' ') + ' Z';
    return { svgPath:d, projectedPts:pp };
  }, [transformer, pts]);

  const initials = useMemo(() => {
    if (!projectedPts.length) return {};
    const xs=projectedPts.map(([x])=>x), ys=projectedPts.map(([,y])=>y);
    const bW=Math.max(...xs)-Math.min(...xs)||200, bH=Math.max(...ys)-Math.min(...ys)||200;
    const bx=(Math.min(...xs)+Math.max(...xs))/2, by=(Math.min(...ys)+Math.max(...ys))/2;
    const res={};
    regions.forEach((r,i) => {
      const fw=r.architectureFile?.imageWidth??1000, fh=r.architectureFile?.imageHeight??1000;
      const rw = r.width ?? fw * 0.3;
      const rh = r.height ?? fh * 0.3;
      const maxDim = Math.max(rw, rh);
      const bW2 = bW * 0.4;
      
      let w = (rw / maxDim) * (bW2 * 1.2);
      let h = (rh / maxDim) * (bW2 * 1.2);
      
      if (w < 40) { h = h * (40 / w); w = 40; }
      if (h < 30) { w = w * (30 / h); h = 30; }
      const a=(i/Math.max(regions.length,1))*2*Math.PI;
      const ox=i===0?0:Math.cos(a)*bW*0.15, oy=i===0?0:Math.sin(a)*bH*0.15;
      res[r.id]={ _cx:bx+ox-w/2, _cy:by+oy-h/2, _w:w, _h:h, _rot: r.rotation ?? 0 };
    });
    return res;
  }, [projectedPts, regions]);

  const statesRef = useRegionStates(regions, initials);

  const ix = useInteraction({ regions, statesRef, viewRef, containerRef, onRepaint, onRegionSaved });

  // Sync activeId ↔ parent without loops
  const lastSyncRef = useRef(null);
  useEffect(() => {
    if (ix.activeId !== lastSyncRef.current) {
      lastSyncRef.current = ix.activeId;
      onSelectRegion(ix.activeId);
    }
  }, [ix.activeId, onSelectRegion]);
  useEffect(() => {
    if (activeRegionId !== lastSyncRef.current) {
      lastSyncRef.current = activeRegionId;
      ix.setActiveId(activeRegionId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRegionId]);

  const fitToScreen = useCallback(() => {
    if (!containerRef.current || !projectedPts.length) return;
    const { width,height } = containerRef.current.getBoundingClientRect();
    const xs=projectedPts.map(([x])=>x), ys=projectedPts.map(([,y])=>y);
    const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
    const pW=maxX-minX||1, pH=maxY-minY||1;
    const scale=Math.min(width/(pW+PAD*2),height/(pH+PAD*2))*0.88;
    const next={ scale, tx:width/2-(minX+pW/2)*scale, ty:height/2-(minY+pH/2)*scale };
    viewRef.current=next; setView(next);
  }, [projectedPts]);
  useEffect(() => { fitToScreen(); }, [fitToScreen]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const f=e.deltaY<0?1.1:0.9;
    const rect=containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx=e.clientX-rect.left, my=e.clientY-rect.top;
    const v=viewRef.current;
    const ns=Math.min(50,Math.max(0.05,v.scale*f));
    const next={ scale:ns, tx:mx-(mx-v.tx)*(ns/v.scale), ty:my-(my-v.ty)*(ns/v.scale) };
    viewRef.current=next; setView(next);
  }, []);
  useEffect(() => {
    const el=containerRef.current; if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive:false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const vs          = view.scale;
  const color       = boundary?.color ?? '#3b82f6';
  const hasActive   = ix.activeId !== null;
  const activeState = hasActive ? statesRef.current[ix.activeId] : null;
  const cursor = ix.tool===TOOL.PAN ? 'grab'
    : ix.tool===TOOL.CROP_RECT||ix.tool===TOOL.CROP_POLY ? 'crosshair'
    : 'default';

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0d0d]">

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-zinc-900/80
                      border-b border-zinc-800 select-none flex-wrap">
        <button onClick={fitToScreen}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700
                     text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-[11px] transition-colors">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
          </svg>Fit
        </button>
        <button onClick={() => { const n={scale:1,tx:0,ty:0}; viewRef.current=n; setView(n); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700
                     text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-[11px] transition-colors">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
          </svg>Reset
        </button>
        <button onClick={()=>{ const v=viewRef.current; const n={...v,scale:Math.min(50,v.scale*1.25)}; viewRef.current=n; setView(n); }}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-zinc-700
                     text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-base transition-colors">+</button>
        <button onClick={()=>{ const v=viewRef.current; const n={...v,scale:Math.max(0.05,v.scale*0.8)}; viewRef.current=n; setView(n); }}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-zinc-700
                     text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 text-base transition-colors">−</button>
        <div className="w-px h-4 bg-zinc-700 mx-1"/>
        <span className="text-[10px] text-zinc-600 font-mono">{(vs*100).toFixed(0)}%</span>

        <button onClick={()=>ix.setTool(ix.tool===TOOL.PAN?TOOL.SELECT:TOOL.PAN)}
          title="Pan (hold Space)"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px]
                      font-medium transition-colors
            ${ix.tool===TOOL.PAN
              ? 'bg-zinc-600/30 border-zinc-500/60 text-zinc-200'
              : 'border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500'}`}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0M10 10V6a2 2 0 0 0-4 0"/>
            <path d="M6 14v0a6 6 0 0 0 6 6h2a6 6 0 0 0 6-6v-3"/>
          </svg>Pan
        </button>

        {hasActive && (<>
          <div className="w-px h-4 bg-zinc-700 mx-1"/>
          <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-semibold shrink-0">Tools</span>

          <button onClick={()=>ix.setTool(TOOL.SELECT)}
            title="Select · move · resize · rotate"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px]
                        font-medium transition-colors
              ${ix.tool===TOOL.SELECT
                ? 'bg-emerald-600/20 border-emerald-500/50 text-emerald-300'
                : 'border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500'}`}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 3l14 9-7 1-4 7z"/>
            </svg>Select
          </button>

          <button onClick={()=>ix.setTool(ix.tool===TOOL.CROP_RECT?TOOL.SELECT:TOOL.CROP_RECT)}
            title="Crop — drag rectangle"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px]
                        font-medium transition-colors
              ${ix.tool===TOOL.CROP_RECT
                ? 'bg-amber-500/20 border-amber-500/60 text-amber-300'
                : 'border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500'}`}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="6 2 6 8 2 8"/><polyline points="18 22 18 16 22 16"/>
              <path d="M6 8H22V22"/><path d="M2 8V22H18"/>
            </svg>Crop Rect
          </button>

          <button onClick={()=>ix.setTool(ix.tool===TOOL.CROP_POLY?TOOL.SELECT:TOOL.CROP_POLY)}
            title="Crop — polygon (click · Enter or double-click to finish · Esc cancel)"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px]
                        font-medium transition-colors
              ${ix.tool===TOOL.CROP_POLY
                ? 'bg-violet-500/20 border-violet-500/60 text-violet-300'
                : 'border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500'}`}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polygon points="12,3 21,9 18,20 6,20 3,9" strokeDasharray="3 2"/>
            </svg>Crop Poly
          </button>

          {ix.tool===TOOL.CROP_POLY && (
            <span className="text-[10px] text-violet-400/80 italic ml-0.5">
              Continue placing points. Click the first point to close the polygon, double-click the last point, or press Enter to finish.
            </span>
          )}
          {ix.tool===TOOL.CROP_RECT && (
            <span className="text-[10px] text-amber-500/80 italic ml-0.5">
              Drag to draw · Handles to resize · Drag again to redraw
            </span>
          )}
        </>)}

        <span className="ml-auto text-[10px] text-zinc-700 hidden md:inline">
          {ix.tool===TOOL.PAN ? 'Drag to pan · Scroll to zoom'
            : !hasActive ? 'Click a region to select'
            : ix.tool===TOOL.SELECT ? 'Drag to move · Corners resize · Blue dot rotates' : ''}
        </span>
      </div>

      {/* ── Canvas ──────────────────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 overflow-hidden relative" style={{ cursor }}>
        <svg width="100%" height="100%" style={{ display:'block', userSelect:'none' }}>
          <defs>
            <pattern id="ws-fine" width="20" height="20" patternUnits="userSpaceOnUse"
              patternTransform={`translate(${view.tx%20},${view.ty%20}) scale(${vs})`}>
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1f1f23" strokeWidth={0.5/vs}/>
            </pattern>
            <pattern id="ws-coarse" width="100" height="100" patternUnits="userSpaceOnUse"
              patternTransform={`translate(${view.tx%(100*vs)},${view.ty%(100*vs)}) scale(${vs})`}>
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#27272a" strokeWidth={1/vs}/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="#0d0d0d"/>
          {showGrid && (<>
            <rect width="100%" height="100%" fill="url(#ws-fine)"/>
            <rect width="100%" height="100%" fill="url(#ws-coarse)"/>
          </>)}

          <g transform={`translate(${view.tx},${view.ty}) scale(${vs})`}>
            {svgPath && (
              <path d={svgPath} fill={color} fillOpacity={0.12}
                stroke={color} strokeWidth={2/vs} strokeLinejoin="round"
                style={{ pointerEvents:'none' }}/>
            )}
            {showVertices && projectedPts.map(([x,y],i)=>(
              <circle key={i} cx={x} cy={y} r={4/vs} fill={color}
                stroke="#0a0a0a" strokeWidth={1.5/vs} style={{ pointerEvents:'none' }}/>
            ))}
            {showLabels && pts.map(([lng,lat],i)=>{
              const [x,y]=projectedPts[i]??[0,0];
              return <text key={i} x={x+6/vs} y={y-6/vs} fill="#9ca3af"
                fontSize={10/vs} fontFamily="monospace"
                style={{ userSelect:'none', pointerEvents:'none' }}>
                {lat.toFixed(5)}°, {lng.toFixed(5)}°
              </text>;
            })}

            {/* Regions — all passive */}
            {regions.map(r => {
              const s=statesRef.current[r.id]; if (!s) return null;
              return <RegionRenderer key={r.id} region={r} state={s} vs={vs}/>;
            })}

            {/* Active region overlays */}
            {hasActive && activeState && (<>
              <HandleRenderer state={activeState} vs={vs} tool={ix.tool}/>
              <CropRenderer state={activeState} vs={vs} tool={ix.tool}
                cropPolyPts={ix.cropPolyPts} cropDraft={ix.cropDraft} cursorPt={ix.cursorPt}/>
            </>)}

            {/* Interaction layer — transparent rect on top, captures all events */}
            <rect x={IL_ORIGIN} y={IL_ORIGIN} width={IL_SIZE} height={IL_SIZE}
              fill="transparent" stroke="none"
              style={{ pointerEvents:'all', cursor, touchAction:'none' }}
              onPointerDown={ix.onPointerDown}
              onPointerMove={ix.onPointerMove}
              onPointerUp={ix.onPointerUp}
              onDoubleClick={ix.onDblClick}
              onClick={ix.onClick}/>
          </g>
        </svg>

        {/* Action buttons — HTML div above SVG, never blocked by interaction layer */}
        {hasActive && activeState && (() => {
          const s = activeState;
          const isCropActive = ix.tool===TOOL.CROP_RECT || ix.tool===TOOL.CROP_POLY;
          const showReset = isCropActive && s.crop;
          const showSave  = ix.tool===TOOL.SELECT && s.crop;
          if (!showReset && !showSave) return null;
          const bx = s.x * vs + view.tx;
          const byBelow = (s.y + s.h) * vs + view.ty + 10;
          const byAbove = s.y * vs + view.ty - 36;
          const cH = containerRef.current?.clientHeight ?? 600;
          const cW = containerRef.current?.clientWidth  ?? 800;
          const by = byBelow + 36 > cH ? byAbove : byBelow;
          const left = Math.max(4, Math.min(bx, cW - 180));
          return (
            <div className="absolute flex gap-1.5" style={{ left, top: by, zIndex:10 }}>
              {showReset && (
                <button onClick={()=>ix.resetCrop(ix.activeId)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px]
                             font-semibold bg-red-950 border border-red-700 text-red-300
                             hover:bg-red-900 hover:border-red-500 transition-colors shadow-lg">
                  ✕ Reset Crop
                </button>
              )}
              {showSave && (
                <button onClick={()=>ix.saveCrop(ix.activeId)} disabled={s.saving}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px]
                              font-semibold border transition-colors shadow-lg
                    ${s.saveError
                      ? 'bg-red-950 border-red-700 text-red-300'
                      : s.saved
                        ? 'bg-emerald-950 border-emerald-600 text-emerald-300'
                        : 'bg-blue-950 border-blue-700 text-blue-300 hover:bg-blue-900 hover:border-blue-500'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={s.saveError || undefined}>
                  {s.saving ? 'Saving…' : s.saveError ? '✕ Failed' : s.saved ? '✓ Saved' : '💾 Save'}
                </button>
              )}
            </div>
          );
        })()}

        {!svgPath && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-zinc-600">No geometry for this boundary</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── root export ──────────────────────────────────────────────────────────────
export default function ExplorerMap({ boundaries, projectName, projectId }) {
  const [selectedBoundaryId, setSelectedBoundaryId] = useState(null);
  const [showGrid,     setShowGrid]     = useState(true);
  const [showVertices, setShowVertices] = useState(true);
  const [showLabels,   setShowLabels]   = useState(false);
  const [regions,      setRegions]      = useState([]);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [activeRegionId,  setActiveRegionId]  = useState(null);

  useEffect(() => {
    setSelectedBoundaryId(boundaries.length > 0 ? boundaries[0].id : null);
  }, [boundaries]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoadingRegions(true);
    setRegions([]);
    getRegionsByProject(projectId)
      .then(res => { if (!cancelled) setRegions(Array.isArray(res) ? res : (res?.data ?? [])); })
      .catch(err => console.error('[ExplorerMap]', err.message))
      .finally(() => { if (!cancelled) setLoadingRegions(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  const handleRegionSaved = useCallback((updated) => {
    setRegions(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r));
  }, []);

  const boundary = boundaries.find(b => b.id === selectedBoundaryId) ?? boundaries[0] ?? null;

  if (boundaries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center h-full bg-[#0d0d0d]">
        <div className="text-center space-y-3">
          <svg className="w-14 h-14 text-zinc-800 mx-auto" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 2">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
          </svg>
          <p className="text-sm text-zinc-500 font-medium">No boundaries for {projectName}</p>
          <p className="text-xs text-zinc-700 max-w-xs leading-relaxed">
            Draw land boundaries in the Map Workspace first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <LeftPanel
        boundary={boundary}
        boundaries={boundaries}
        onSelect={setSelectedBoundaryId}
        regions={regions}
        activeRegionId={activeRegionId}
        onSelectRegion={setActiveRegionId}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toggle bar */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-1.5 bg-zinc-950
                        border-b border-zinc-800 select-none">
          {[['Grid',showGrid,setShowGrid],['Vertices',showVertices,setShowVertices],
            ['Labels',showLabels,setShowLabels]].map(([lbl,on,set]) => (
            <button key={lbl} onClick={() => set(!on)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px]
                          font-medium border transition-colors
                ${on
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30'
                  : 'text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${on?'bg-indigo-400':'bg-zinc-700'}`}/>
              {lbl}
            </button>
          ))}
          {loadingRegions && <span className="text-[10px] text-zinc-600">Loading regions…</span>}
          {!loadingRegions && regions.length > 0 && (
            <span className="text-[10px] text-zinc-600">
              {regions.length} region{regions.length!==1?'s':''} from DB
            </span>
          )}
          <span className="ml-auto text-[10px] text-zinc-700">{projectName}</span>
        </div>

        {boundary && (
          <SVGWorkspace
            key={boundary.id}
            boundary={boundary}
            regions={regions}
            activeRegionId={activeRegionId}
            onSelectRegion={setActiveRegionId}
            onRegionSaved={handleRegionSaved}
            showGrid={showGrid}
            showVertices={showVertices}
            showLabels={showLabels}
          />
        )}
      </div>
    </div>
  );
}
