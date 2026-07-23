'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getPreviewUrl, getDownloadUrl } from '@/lib/api';
import { formatDate, formatBytes, isPdf } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
      <polyline points="13 2 13 9 20 9"/>
    </svg>
  );
}

// ─── Context menu ─────────────────────────────────────────────────────────────
function ContextMenu({ file, onOpen, onRename, onDownload, onDelete, onClose, anchorRect }) {
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    // Use mousedown with capturing phase to catch clicks before they trigger other things
    document.addEventListener('mousedown', handler, true);
    // Also close on scroll to keep it simple since we're using fixed positioning
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('mousedown', handler, true);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  const Item = ({ label, icon, onClick, danger }) => (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); onClose(); }}
      className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left rounded-lg
                  transition-colors ${danger
                    ? 'text-red-400 hover:bg-red-500/10'
                    : 'text-zinc-300 hover:bg-zinc-700'}`}
    >
      {icon}
      {label}
    </button>
  );

  // Calculate position based on anchorRect
  // Default: below the button and aligned to its right edge
  let top = anchorRect ? anchorRect.bottom + 4 : 0;
  let left = anchorRect ? anchorRect.right - 160 : 0; // 160px is w-40

  // Adjust if it goes off bottom of screen
  if (anchorRect && top + 150 > window.innerHeight) { // 150px approx height of menu
    top = anchorRect.top - 150 - 4;
  }

  const menu = (
    <div ref={ref}
         style={{ top, left }}
         className="fixed z-[99999] w-40 bg-zinc-900 border border-zinc-700
                    rounded-xl shadow-xl shadow-black/50 p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100">
      <Item label="Open" onClick={onOpen}
            icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>} />
      <Item label="Rename" onClick={onRename}
            icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>} />
      <Item label="Download" onClick={onDownload}
            icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>} />
      <div className="h-px bg-zinc-800 my-0.5"/>
      <Item label="Delete" onClick={onDelete} danger
            icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>} />
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(menu, document.body) : null;
}

// ─── Inline rename input ──────────────────────────────────────────────────────
function RenameInput({ value, onSave, onCancel }) {
  const [name, setName] = useState(value);
  const ref = useRef(null);

  useEffect(() => { ref.current?.select(); }, []);

  return (
    <input
      ref={ref}
      value={name}
      onChange={(e) => setName(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSave(name.trim());
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => onSave(name.trim())}
      onClick={(e) => e.stopPropagation()}
      className="w-full bg-zinc-700 border border-indigo-500 rounded px-1.5 py-0.5
                 text-xs text-zinc-100 focus:outline-none"
    />
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────
export default function ArchitectureFileCard({
  file,
  isActive,
  onOpen,
  onRename,
  onDelete,
}) {
  const [menuOpen, setMenuOpen]     = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const [renaming, setRenaming]     = useState(false);

  const isImage = !isPdf(file);

  function handleDownload(e) {
    e?.stopPropagation();
    const a = document.createElement('a');
    a.href = getDownloadUrl(file.id);
    a.download = file.originalName;
    a.click();
  }

  function handleRenameStart() {
    setRenaming(true);
    setMenuOpen(false);
  }

  function handleRenameSave(newName) {
    setRenaming(false);
    if (newName && newName !== file.originalName) {
      onRename(file.id, newName);
    }
  }

  return (
    <div
      onClick={() => !renaming && onOpen(file)}
      className={`
        group relative rounded-lg border cursor-pointer
        transition-all duration-150
        ${isActive
          ? 'border-indigo-500 ring-1 ring-indigo-500/50 bg-zinc-800'
          : 'border-zinc-700/60 hover:border-zinc-500 bg-zinc-800/40 hover:bg-zinc-800'
        }
      `}
    >
      {/* Thumbnail */}
      <div className="relative w-full aspect-[16/9] bg-zinc-900 overflow-hidden rounded-t-lg">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getPreviewUrl(file.id)}
            alt={file.originalName}
            className="w-full h-full object-contain p-1"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
            <div className="w-8 h-10 rounded bg-zinc-700 flex items-center justify-center">
              <span className="text-[9px] font-bold text-red-400 tracking-widest">PDF</span>
            </div>
          </div>
        )}

        {/* Active dot */}
        {isActive && (
          <div className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full bg-indigo-400" />
        )}

      {/* Three-dot menu button */}
      <div className="absolute top-1 right-1">
        <button
          onClick={(e) => { 
            e.stopPropagation(); 
            setAnchorRect(e.currentTarget.getBoundingClientRect());
            setMenuOpen((o) => !o); 
          }}
          className="w-6 h-6 rounded bg-zinc-900/80 border border-zinc-700/60
                     flex items-center justify-center text-zinc-400
                     opacity-60 group-hover:opacity-100 hover:!opacity-100
                     transition-opacity"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5"  r="1.5"/>
            <circle cx="12" cy="12" r="1.5"/>
            <circle cx="12" cy="19" r="1.5"/>
          </svg>
        </button>

        {menuOpen && (
          <ContextMenu
            file={file}
            anchorRect={anchorRect}
            onClose={() => setMenuOpen(false)}
            onOpen={() => onOpen(file)}
            onRename={handleRenameStart}
            onDownload={handleDownload}
            onDelete={() => onDelete(file.id)}
          />
        )}
      </div>
      </div>

      {/* Info */}
      <div className="px-2 py-1.5">
        {renaming ? (
          <RenameInput
            value={file.originalName}
            onSave={handleRenameSave}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <p className="text-[11px] text-zinc-200 font-medium truncate leading-snug">
            {file.originalName}
          </p>
        )}
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-[10px] text-zinc-600">
            {formatDate(file.uploadedAt)}
          </p>
          {file.fileSize && (
            <p className="text-[10px] text-zinc-700">
              {formatBytes(file.fileSize)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
