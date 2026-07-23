'use client';

import { useRef } from 'react';

/**
 * A compact "+ Upload" button that opens the native file picker.
 * Accepts .png, .jpg, .jpeg, .pdf only.
 */
export default function UploadButton({ onFiles, disabled, className = '' }) {
  const inputRef = useRef(null);

  return (
    <>
      <button
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                    bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold
                    transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed
                    ${className}`}
        title="Upload architecture file (PNG, JPG, JPEG, PDF — max 20 MB)"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5"  y1="12" x2="19" y2="12"/>
        </svg>
        Upload
      </button>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
        multiple={false}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFiles([file]);
          // Reset so the same file can be re-selected
          e.target.value = '';
        }}
      />
    </>
  );
}
