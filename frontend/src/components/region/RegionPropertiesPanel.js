'use client';

import { useState } from 'react';
import { useRegionStore, REGION_SHAPE } from '@/store/regionStore';
import { updateRegion } from '@/lib/api';
import { formatDate } from '@/lib/utils';

// ─── Reusable sub-components ─────────────────────────────────────────────────

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-[10px] text-zinc-500 shrink-0">{label}</span>
      <span className="text-[11px] text-zinc-200 font-mono text-right break-all">{value ?? '—'}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-semibold">{title}</p>
      {children}
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyPanel() {
  return (
    <aside className="w-56 shrink-0 bg-zinc-900 border-l border-zinc-800 flex flex-col">
      <div className="px-3 py-2.5 border-b border-zinc-800">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Region</h2>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-700 text-xs text-center px-4 gap-2">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
        </svg>
        <p className="leading-relaxed">Click a region to view its properties</p>
      </div>
    </aside>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
export default function RegionPropertiesPanel() {
  const regions        = useRegionStore((s) => s.regions);
  const activeRegionId = useRegionStore((s) => s.activeRegionId);
  const replaceRegion  = useRegionStore((s) => s.replaceRegion);

  const region = regions.find((r) => r.id === activeRegionId) ?? null;

  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal]         = useState('');

  if (!region) return <EmptyPanel />;

  const isPoly    = region.shapeType === REGION_SHAPE.POLYGON;
  const pts       = Array.isArray(region.points) ? region.points : [];
  const accentColor = isPoly ? 'bg-amber-400' : 'bg-emerald-400';

  async function saveName(newName) {
    setEditingName(false);
    if (!newName.trim() || newName === region.name) return;
    try {
      const res = await updateRegion(region.id, { name: newName.trim() });
      replaceRegion(res);
    } catch (err) { console.error(err); }
  }

  return (
    <aside className="w-56 shrink-0 bg-zinc-900 border-l border-zinc-800 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-3 py-2.5 border-b border-zinc-800 flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full shrink-0 ${accentColor}`} />
        <div className="flex-1 min-w-0">
          {editingName ? (
            <input
              autoFocus
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onBlur={() => saveName(nameVal)}
              onKeyDown={(e) => {
                if (e.key === 'Enter')  saveName(nameVal);
                if (e.key === 'Escape') setEditingName(false);
              }}
              className="w-full bg-zinc-800 border border-emerald-500 rounded px-1.5 py-0.5
                         text-xs text-zinc-100 focus:outline-none"
            />
          ) : (
            <button
              onClick={() => { setNameVal(region.name); setEditingName(true); }}
              className="w-full text-left text-xs font-semibold text-zinc-200
                         hover:text-white transition-colors truncate"
              title="Click to rename"
            >
              {region.name}
            </button>
          )}
        </div>
        <span className="text-[10px] text-zinc-600 font-mono shrink-0">#{region.id}</span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-5">

        {/* Shape type */}
        <Section title="Shape">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded flex items-center justify-center
                             ${isPoly ? 'bg-amber-900/40 border border-amber-700/40'
                                      : 'bg-emerald-900/40 border border-emerald-700/40'}`}>
              {isPoly
                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"><polygon points="12,3 21,9 18,20 6,20 3,9" strokeDasharray="3 2"/></svg>
                : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2"/></svg>
              }
            </div>
            <span className="text-xs text-zinc-300 font-medium">
              {isPoly ? 'Polygon' : 'Rectangle'}
            </span>
            {isPoly && (
              <span className="text-[10px] text-zinc-600 ml-auto">{pts.length} pts</span>
            )}
          </div>
        </Section>

        <div className="h-px bg-zinc-800"/>

        {/* Geometry */}
        <Section title="Geometry">
          <Row label="X"      value={region.x?.toFixed(2)} />
          <Row label="Y"      value={region.y?.toFixed(2)} />
          <Row label="Width"  value={`${region.width?.toFixed(2)} u`} />
          <Row label="Height" value={`${region.height?.toFixed(2)} u`} />
          {isPoly && (
            <Row label="Area" value={`${computePolygonArea(pts).toFixed(0)} u²`} />
          )}
        </Section>

        <div className="h-px bg-zinc-800"/>

        {/* Transform */}
        <Section title="Transform">
          <Row label="Rotation" value={`${region.rotation?.toFixed(1)}°`} />
          <Row label="Scale"    value={`${region.scale?.toFixed(2)}×`} />
          <Row label="Page"     value={region.pageNumber ?? 1} />
        </Section>

        {/* Polygon point list */}
        {isPoly && pts.length > 0 && (
          <>
            <div className="h-px bg-zinc-800"/>
            <Section title={`Points (${pts.length})`}>
              <div className="max-h-32 overflow-y-auto scrollbar-thin space-y-0.5">
                {pts.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="text-zinc-600 w-4 shrink-0">{i}</span>
                    <span className="text-zinc-400">({p.x.toFixed(1)}, {p.y.toFixed(1)})</span>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}

        <div className="h-px bg-zinc-800"/>

        {/* Meta */}
        <Section title="Info">
          <Row label="Region ID" value={`#${region.id}`} />
          <Row label="File ID"   value={`#${region.architectureFileId}`} />
          <Row label="Created"   value={formatDate(region.createdAt)} />
          <Row label="Updated"   value={formatDate(region.updatedAt)} />
        </Section>

      </div>
    </aside>
  );
}

// Shoelace formula for polygon area
function computePolygonArea(pts) {
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}
