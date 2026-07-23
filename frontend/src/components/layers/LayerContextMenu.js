'use client';

import { useEffect, useRef } from 'react';

export default function LayerContextMenu({
  x, y, item,
  onClose,
  onRename, onDuplicate, onDelete,
  onBringForward, onSendBackward, onBringToFront, onSendToBack,
}) {
  const menuRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handler(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!item) return null;

  const isGroup = item.type === 'group';
  const label   = item.name || (isGroup ? 'Group' : `Layer ${item.id}`);

  function Btn({ children, onClick, danger }) {
    return (
      <button
        onClick={() => { onClick(); onClose(); }}
        className={`w-full text-left px-3 py-1.5 text-xs transition-colors
          ${danger
            ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
            : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
          }`}
      >
        {children}
      </button>
    );
  }

  function Sep() {
    return <div className="h-px bg-zinc-800 my-1" />;
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-zinc-900 border border-zinc-700 rounded-xl
                 shadow-xl py-1.5 w-48"
      style={{ left: x, top: y }}
    >
      {/* Header */}
      <div className="px-3 py-1.5 text-[10px] text-zinc-500 font-semibold truncate
                      border-b border-zinc-800 mb-1">
        {label}
      </div>

      <Btn onClick={() => onRename(item)}>Rename</Btn>
      {!isGroup && (
        <Btn onClick={() => onDuplicate(item)}>Duplicate</Btn>
      )}

      <Sep />

      <Btn onClick={() => onBringForward(item)}>Bring Forward</Btn>
      <Btn onClick={() => onSendBackward(item)}>Send Backward</Btn>
      <Btn onClick={() => onBringToFront(item)}>Bring to Front</Btn>
      <Btn onClick={() => onSendToBack(item)}>Send to Back</Btn>

      <Sep />

      <Btn onClick={() => onDelete(item)} danger>
        Delete {isGroup ? 'Group' : 'Layer'}
      </Btn>
    </div>
  );
}
