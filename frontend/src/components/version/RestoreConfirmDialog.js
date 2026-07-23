'use client';

import { useEffect, useRef } from 'react';

export default function RestoreConfirmDialog({ version, onConfirm, onCancel, loading }) {
  const cancelRef = useRef(null);
  useEffect(() => { cancelRef.current?.focus(); }, []);
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center p-4"
         onClick={onCancel}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative z-10 bg-zinc-900 border border-zinc-700 rounded-2xl
                      shadow-2xl shadow-black/60 w-full max-w-sm p-6"
           onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-center w-11 h-11 rounded-full
                        bg-indigo-500/10 border border-indigo-500/20 mx-auto mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="#818cf8" strokeWidth="2" strokeLinecap="round">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
          </svg>
        </div>

        <h2 className="text-base font-semibold text-zinc-100 text-center mb-1">
          Restore this version?
        </h2>
        <p className="text-sm text-zinc-400 text-center mb-1">
          <span className="font-medium text-zinc-200">{version?.label}</span>
        </p>
        <p className="text-xs text-zinc-600 text-center mb-6">
          The current workspace will be replaced. A new version will be created before restoring so you can undo this.
        </p>

        <div className="flex gap-3">
          <button ref={cancelRef} onClick={onCancel} disabled={loading}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800
                             text-sm font-medium text-zinc-300 hover:bg-zinc-700 transition-colors
                             disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500
                             text-sm font-semibold text-white transition-colors
                             disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".3" strokeWidth="3"/>
                  <path d="M12 3A9 9 0 0 1 21 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                Restoring…
              </>
            ) : 'Restore'}
          </button>
        </div>
      </div>
    </div>
  );
}
