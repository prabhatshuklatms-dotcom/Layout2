'use client';

import { useState, useRef } from 'react';
import { REGION_SHAPE } from '@/store/regionStore';

function RenameInput({ value, onSave, onCancel }) {
  const [v, setV] = useState(value);
  return (
    <input
      autoFocus
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter')  onSave(v.trim());
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => onSave(v.trim())}
      onClick={(e) => e.stopPropagation()}
      className="w-full bg-zinc-700 border border-emerald-500 rounded px-1.5 py-0.5
                 text-xs text-zinc-100 focus:outline-none"
    />
  );
}

// Shape icon — rectangle (dashed rect) vs polygon (pentagon)
function ShapeIcon({ shapeType }) {
  if (shapeType === REGION_SHAPE.POLYGON) {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
           stroke="#f59e0b" strokeWidth="2" strokeLinecap="round">
        <polygon points="12,3 21,9 18,20 6,20 3,9" strokeDasharray="3 2"/>
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
         stroke="#34d399" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2"/>
    </svg>
  );
}

export default function RegionCard({ region, isActive, onClick, onRename, onDuplicate, onDelete }) {
  const [renaming, setRenaming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isPoly   = region.shapeType === REGION_SHAPE.POLYGON;
  const iconBg   = isPoly ? 'bg-amber-900/40 border-amber-700/40' : 'bg-emerald-900/40 border-emerald-700/40';
  const subLabel = isPoly
    ? `${Array.isArray(region.points) ? region.points.length : 0} pts · p${region.pageNumber ?? 1}`
    : `${region.width?.toFixed(0)}×${region.height?.toFixed(0)} · p${region.pageNumber ?? 1}`;

  return (
    <div
      onClick={() => !renaming && onClick(region)}
      className={`group relative rounded-lg border cursor-pointer transition-all duration-150 p-2.5
        ${isActive
          ? isPoly
            ? 'border-amber-500/60 bg-amber-500/8'
            : 'border-emerald-500/60 bg-emerald-500/8'
          : 'border-zinc-700/60 hover:border-zinc-500 bg-zinc-800/40 hover:bg-zinc-800'
        }`}
    >
      <div className="flex items-center gap-2">
        {/* Shape icon */}
        <div className={`w-7 h-7 rounded border flex items-center justify-center shrink-0 ${iconBg}`}>
          <ShapeIcon shapeType={region.shapeType} />
        </div>

        {/* Name + sub info */}
        <div className="flex-1 min-w-0">
          {renaming ? (
            <RenameInput
              value={region.name}
              onSave={(n) => { setRenaming(false); if (n && n !== region.name) onRename(region.id, n); }}
              onCancel={() => setRenaming(false)}
            />
          ) : (
            <p className="text-[11px] text-zinc-200 font-medium truncate">{region.name}</p>
          )}
          <p className="text-[10px] text-zinc-600 mt-0.5">{subLabel}</p>
        </div>

        {/* Three-dot menu */}
        <div className="relative shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            className="w-5 h-5 flex items-center justify-center text-zinc-600
                       hover:text-zinc-300 transition-colors opacity-0 group-hover:opacity-100"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5"  r="1.5"/>
              <circle cx="12" cy="12" r="1.5"/>
              <circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-6 z-50 w-36 bg-zinc-900 border border-zinc-700
                          rounded-xl shadow-xl p-1.5 flex flex-col gap-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              {[
                { label: 'Rename',    action: () => { setRenaming(true);   setMenuOpen(false); } },
                { label: 'Duplicate', action: () => { onDuplicate(region); setMenuOpen(false); } },
                { label: 'Delete',    action: () => { onDelete(region.id); setMenuOpen(false); }, danger: true },
              ].map(({ label, action, danger }) => (
                <button
                  key={label}
                  onClick={action}
                  className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors
                    ${danger ? 'text-red-400 hover:bg-red-500/10' : 'text-zinc-300 hover:bg-zinc-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
