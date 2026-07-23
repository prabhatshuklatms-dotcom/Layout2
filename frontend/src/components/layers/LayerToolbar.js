'use client';

import { useState } from 'react';
import { Search, FolderPlus, Trash2, Filter } from 'lucide-react';
import { useLayerStore } from '@/store/layerStore';

export default function LayerToolbar({ onCreateGroup, onDeleteSelected, selectedCount }) {
  const searchQuery    = useLayerStore((s) => s.searchQuery);
  const setSearchQuery = useLayerStore((s) => s.setSearchQuery);
  const filterVisible  = useLayerStore((s) => s.filterVisible);
  const filterHidden   = useLayerStore((s) => s.filterHidden);
  const filterLocked   = useLayerStore((s) => s.filterLocked);
  const filterUnlocked = useLayerStore((s) => s.filterUnlocked);
  const setFilter      = useLayerStore((s) => s.setFilter);

  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="flex flex-col gap-1.5 px-2 py-2 border-b border-zinc-800 shrink-0">
      {/* Search + actions row */}
      <div className="flex items-center gap-1">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search layers…"
            className="w-full bg-zinc-800 text-[11px] text-zinc-300 rounded pl-6 pr-2 py-1
                       focus:outline-none focus:ring-1 focus:ring-amber-500/40 placeholder-zinc-600"
          />
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`p-1.5 rounded transition-colors
            ${showFilters ? 'bg-zinc-700 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
          title="Toggle filters"
        >
          <Filter className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-zinc-700 mx-0.5" />

        {/* New group */}
        <button
          onClick={onCreateGroup}
          className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded transition-colors"
          title="New group"
        >
          <FolderPlus className="w-4 h-4" />
        </button>

        {/* Delete selected */}
        <button
          onClick={onDeleteSelected}
          disabled={selectedCount === 0}
          className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded
                     transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="Delete selected"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Filter checkboxes */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 px-1">
          {[
            ['filterVisible',  'Visible'],
            ['filterHidden',   'Hidden'],
            ['filterLocked',   'Locked'],
            ['filterUnlocked', 'Unlocked'],
          ].map(([key, label]) => {
            const checked = key === 'filterVisible'  ? filterVisible
                          : key === 'filterHidden'   ? filterHidden
                          : key === 'filterLocked'   ? filterLocked
                          : filterUnlocked;
            return (
              <label key={key}
                     className="flex items-center gap-1 text-[10px] text-zinc-500
                                cursor-pointer hover:text-zinc-300">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setFilter(key, e.target.checked)}
                  className="accent-amber-500"
                />
                {label}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
