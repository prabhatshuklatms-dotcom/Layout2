'use client';

import { useState, useEffect, useRef } from 'react';

const PRESETS = ['Main Layout', 'Ground Floor', 'First Floor', 'Parking', 'Garden', 'Commercial', 'Roof Plan', 'Site Plan'];

export default function SaveRegionDialog({ rect, shapeType = 'RECTANGLE', onSave, onCancel, saving }) {
  const isPolygon = shapeType === 'POLYGON';
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onCancel]);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError('Region name is required.'); return; }
    if (trimmed.length > 100) { setError('Name must be 100 characters or less.'); return; }
    onSave(trimmed);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
         onClick={onCancel}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative z-10 bg-zinc-900 border border-zinc-700 rounded-2xl
                      shadow-2xl shadow-black/60 w-full max-w-md"
           onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-800">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20
                          flex items-center justify-center shrink-0">
            {isPolygon ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                   stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round">
                <polygon points="12,3 21,9 18,20 6,20 3,9" strokeDasharray="3 2"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                   stroke="#10b981" strokeWidth="2.5" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 2"/>
              </svg>
            )}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Name this Region</h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {isPolygon
                ? `Polygon · ${rect?.points?.length ?? 0} points`
                : (rect ? `${rect.width.toFixed(0)} × ${rect.height.toFixed(0)} units` : '')
              }
            </p>
          </div>
          <button onClick={onCancel} className="ml-auto text-zinc-600 hover:text-zinc-300 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">
            {/* Name input */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Region Name <span className="text-red-400">*</span>
              </label>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                placeholder="e.g. Main Layout"
                maxLength={100}
                className={`w-full bg-zinc-800 border rounded-xl px-4 py-2.5
                            text-sm text-zinc-100 placeholder-zinc-600
                            focus:outline-none focus:ring-1 transition-colors
                            ${error
                              ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/20'
                              : 'border-zinc-700 focus:border-emerald-500 focus:ring-emerald-500/20'
                            }`}
              />
              {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
            </div>

            {/* Preset chips */}
            <div>
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Quick presets</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => { setName(p); setError(''); }}
                    className="px-2.5 py-1 rounded-lg text-[11px] border
                               border-zinc-700 text-zinc-400 bg-zinc-800/60
                               hover:border-emerald-500/50 hover:text-emerald-400
                               transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 pb-5">
            <button type="button" onClick={onCancel} disabled={saving}
                    className="flex-1 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800
                               text-sm font-medium text-zinc-300 hover:bg-zinc-700
                               transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={!name.trim() || saving}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500
                               text-sm font-semibold text-white transition-colors
                               disabled:opacity-40 disabled:cursor-not-allowed
                               flex items-center justify-center gap-2">
              {saving ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".3" strokeWidth="3"/>
                    <path d="M12 3A9 9 0 0 1 21 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  Saving…
                </>
              ) : 'Save Region'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
