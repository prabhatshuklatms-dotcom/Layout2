'use client';

/**
 * Compact upload progress bar shown inside the sidebar while a file is uploading.
 */
export default function UploadProgress({ filename, progress, onCancel }) {
  const isComplete = progress >= 100;

  return (
    <div className="mx-2 mb-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5">
      {/* Filename + cancel */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[11px] text-zinc-300 font-medium truncate flex-1">
          {filename}
        </p>
        {!isComplete && (
          <button
            onClick={onCancel}
            title="Cancel upload"
            className="text-zinc-500 hover:text-red-400 transition-colors shrink-0"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6"  y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-200
            ${isComplete ? 'bg-emerald-500' : 'bg-indigo-500'}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Percentage / status */}
      <p className={`text-[10px] mt-1.5 font-medium
        ${isComplete ? 'text-emerald-400' : 'text-zinc-500'}`}>
        {isComplete ? '✓ Complete' : `${progress}%`}
      </p>
    </div>
  );
}
