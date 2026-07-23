'use client';

import UploadButton from './UploadButton';

export default function EmptyArchitectureState({ onFiles, uploading }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 gap-4 text-center">
      {/* Blueprint illustration */}
      <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700
                      flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 64 64" fill="none" className="text-zinc-600">
          <rect x="8"  y="8"  width="48" height="48" rx="4"
                stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 4"/>
          <rect x="16" y="16" width="32" height="32" rx="2"
                stroke="currentColor" strokeWidth="1" strokeDasharray="3 3"/>
          <line x1="32" y1="8"  x2="32" y2="56"
                stroke="currentColor" strokeWidth="1" strokeDasharray="3 3"/>
          <line x1="8"  y1="32" x2="56" y2="32"
                stroke="currentColor" strokeWidth="1" strokeDasharray="3 3"/>
          <circle cx="32" cy="32" r="5"
                  stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      </div>

      <div>
        <p className="text-xs font-semibold text-zinc-300">No Architecture Uploaded</p>
        <p className="text-[11px] text-zinc-600 mt-1 leading-relaxed">
          Upload PNG, JPG or PDF to begin.
        </p>
      </div>

      <UploadButton onFiles={onFiles} disabled={uploading} />

      <p className="text-[10px] text-zinc-700 leading-relaxed">
        Or drag a file anywhere on the canvas
      </p>
    </div>
  );
}
