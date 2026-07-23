'use client';

import { useCallback } from 'react';
import { useRegionStore, REGION_TOOL, REGION_SHAPE } from '@/store/regionStore';
import { useViewerStore } from '@/store/viewerStore';
import { updateRegion, deleteRegion, createRegion } from '@/lib/api';
import RegionCard from './RegionCard';

export default function RegionSidebar({ projectId }) {
  const regions           = useRegionStore((s) => s.regions);
  const activeRegionId    = useRegionStore((s) => s.activeRegionId);
  const setActiveRegionId = useRegionStore((s) => s.setActiveRegionId);
  const tool              = useRegionStore((s) => s.tool);
  const setTool           = useRegionStore((s) => s.setTool);
  const replaceRegion     = useRegionStore((s) => s.replaceRegion);
  const removeRegion      = useRegionStore((s) => s.removeRegion);
  const addRegion         = useRegionStore((s) => s.addRegion);
  const activeFile        = useViewerStore((s) => s.activeFile);

  const isRect = tool === REGION_TOOL.DRAW_RECT;
  const isPoly = tool === REGION_TOOL.DRAW_POLYGON;

  // Group by architecture file
  const grouped = regions.reduce((acc, r) => {
    const key = r.architectureFileId;
    if (!acc[key]) acc[key] = { file: r.architectureFile, items: [] };
    acc[key].items.push(r);
    return acc;
  }, {});

  const handleRename = useCallback(async (id, name) => {
    try {
      const res = await updateRegion(id, { name });
      replaceRegion(res?.data ?? res);
    } catch (err) { console.error(err); }
  }, [replaceRegion]);

  const handleDelete = useCallback(async (id) => {
    try {
      if (id && String(id) !== 'undefined') {
        await deleteRegion(id);
      }
      removeRegion(id);
    } catch (err) { console.error(err); }
  }, [removeRegion]);

  const handleDuplicate = useCallback(async (region) => {
    try {
      const payload = {
        architectureFileId: region.architectureFileId,
        name:       region.name + ' (copy)',
        shapeType:  region.shapeType,
        pageNumber: region.pageNumber,
        x:          region.x + 20,
        y:          region.y + 20,
        width:      region.width,
        height:     region.height,
        rotation:   region.rotation,
        scale:      region.scale,
      };
      if (region.shapeType === REGION_SHAPE.POLYGON && Array.isArray(region.points)) {
        payload.points = region.points.map((p) => ({ x: p.x + 20, y: p.y + 20 }));
      }
      const res = await createRegion(projectId, payload);
      addRegion(res?.data ?? res);
    } catch (err) { console.error(err); }
  }, [projectId, addRegion]);

  function ToolBtn({ toolMode, title, children }) {
    const active = tool === toolMode;
    return (
      <button
        onClick={() => setTool(active ? REGION_TOOL.NONE : toolMode)}
        title={title}
        className={`flex items-center justify-center w-7 h-7 rounded-lg border
                    transition-colors text-[10px]
                    ${active
                      ? toolMode === REGION_TOOL.DRAW_POLYGON
                        ? 'bg-amber-600 border-amber-500 text-white'
                        : 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
                    }`}
      >
        {children}
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 shrink-0">
        <div>
          <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Regions</h2>
          <p className="text-[10px] text-zinc-700 mt-0.5">{regions.length} saved</p>
        </div>

        {activeFile && (
          <div className="flex items-center gap-1">
            {/* Rectangle tool */}
            <ToolBtn toolMode={REGION_TOOL.DRAW_RECT} title="Draw rectangle region (drag)">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2"/>
              </svg>
            </ToolBtn>
            {/* Polygon tool */}
            <ToolBtn toolMode={REGION_TOOL.DRAW_POLYGON} title="Draw polygon region (click points, Enter/dbl-click to finish)">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polygon points="12,3 21,9 18,20 6,20 3,9" strokeDasharray="3 2"/>
              </svg>
            </ToolBtn>
          </div>
        )}
      </div>

      {/* Draw hints */}
      {isRect && (
        <div className="mx-2 mt-2 px-3 py-2 bg-emerald-950/40 border border-emerald-700/40
                        rounded-lg text-[11px] text-emerald-400 leading-relaxed shrink-0">
          Click and drag on the canvas to draw a rectangle region.
        </div>
      )}
      {isPoly && (
        <div className="mx-2 mt-2 px-3 py-2 bg-amber-950/40 border border-amber-700/40
                        rounded-lg text-[11px] text-amber-400 leading-relaxed shrink-0">
          Click to place points around the area boundary.
          <br/>
          <span className="text-amber-600">Double-click</span> or press <span className="text-amber-600">Enter</span> to finish · <span className="text-amber-600">Esc</span> to cancel
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1 min-h-0">
        {regions.length === 0 ? (
          <div className="text-[11px] text-zinc-700 text-center mt-8 px-3 leading-relaxed">
            {activeFile
              ? 'No regions yet. Use □ to draw a rectangle or ⬟ to draw a polygon.'
              : 'Open an architecture file to create regions.'}
          </div>
        ) : (
          Object.values(grouped).map(({ file, items }) => (
            <div key={file?.id ?? 'unknown'}>
              <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-semibold px-1 py-1 truncate">
                {file?.originalName ?? 'Unknown file'}
              </p>
              <div className="space-y-1">
                {items.map((r) => (
                  <RegionCard
                    key={r.id}
                    region={r}
                    isActive={r.id === activeRegionId}
                    onClick={(reg) => setActiveRegionId(reg.id === activeRegionId ? null : reg.id)}
                    onRename={handleRename}
                    onDuplicate={handleDuplicate}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
