'use client';

import { useState } from 'react';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const FORMATS = [
  {
    id: 'layout', label: 'Layout Package', ext: '.layout',
    desc: 'Complete project archive with all files',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      </svg>
    ),
  },
  {
    id: 'json', label: 'Project JSON', ext: '.json',
    desc: 'Metadata only — no files',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
  {
    id: 'png', label: 'PNG Image', ext: '.png',
    desc: 'Rendered canvas snapshot',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
      </svg>
    ),
  },
  {
    id: 'pdf', label: 'PDF Document', ext: '.pdf',
    desc: 'Export canvas as PDF',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
  },
];

export default function ExportDialog({ isOpen, onClose, projectId, project, onExportPng, onExportPdf }) {
  const [selected,  setSelected]  = useState('layout');
  const [exporting, setExporting] = useState(false);
  const [error,     setError]     = useState('');

  if (!isOpen) return null;

  async function handleExport() {
    setExporting(true);
    setError('');
    try {
      if (selected === 'png') {
        await onExportPng?.();
      } else if (selected === 'pdf') {
        await onExportPdf?.();
      } else {
        // Server-side download
        const endpoint = selected === 'json'
          ? `${BASE_URL}/projects/${projectId}/export/json`
          : `${BASE_URL}/projects/${projectId}/export/package`;

        const res = await fetch(endpoint);
        if (!res.ok) throw new Error(`Export failed: ${res.status}`);

        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        const fmt  = FORMATS.find((f) => f.id === selected);
        a.href     = url;
        a.download = `${project?.name || 'Project'}${fmt?.ext ?? ''}`;
        a.click();
        URL.revokeObjectURL(url);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative z-10 bg-zinc-900 border border-zinc-700 rounded-2xl
                      shadow-2xl shadow-black/60 w-full max-w-md"
           onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-100">Export Project</h2>
          <button onClick={onClose}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Format list */}
        <div className="p-4 space-y-2">
          {FORMATS.map((fmt) => (
            <label
              key={fmt.id}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border
                          transition-all duration-150
                          ${selected === fmt.id
                            ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-300'
                            : 'bg-zinc-800/50 border-zinc-700/60 text-zinc-400 hover:border-zinc-500 hover:bg-zinc-800'
                          }`}
            >
              <input
                type="radio" name="export_fmt" value={fmt.id}
                checked={selected === fmt.id}
                onChange={() => setSelected(fmt.id)}
                className="hidden"
              />
              <span className={selected === fmt.id ? 'text-indigo-400' : 'text-zinc-500'}>
                {fmt.icon}
              </span>
              <div className="flex-1">
                <p className={`text-sm font-medium ${selected === fmt.id ? 'text-indigo-300' : 'text-zinc-200'}`}>
                  {fmt.label}
                </p>
                <p className="text-xs text-zinc-600 mt-0.5">{fmt.desc}</p>
              </div>
              <span className="text-[10px] font-mono text-zinc-600">{fmt.ext}</span>
            </label>
          ))}
        </div>

        {error && (
          <p className="mx-5 mb-2 text-xs text-red-400 bg-red-950/40 border border-red-800/40
                        rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            disabled={exporting}
            className="flex-1 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800
                       text-sm font-medium text-zinc-300 hover:bg-zinc-700
                       transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500
                       text-sm font-semibold text-white transition-colors
                       disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {exporting ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".3" strokeWidth="3"/>
                  <path d="M12 3A9 9 0 0 1 21 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                Exporting…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
