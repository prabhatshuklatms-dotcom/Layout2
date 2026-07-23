'use client';

import { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Lock, Unlock, Folder, FolderOpen, GripVertical, Image as ImageIcon, Pencil } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function LayerItem({
  item,
  depth = 0,
  isSelected,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onToggleExpand,
  onContextMenu,
  onRename,   // (id, type, newName) => void
}) {
  const [editing, setEditing] = useState(false);
  const [nameVal, setNameVal] = useState('');
  const inputRef = useRef(null);

  const {
    attributes, listeners,
    setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: `${item.type}-${item.id}`, data: { type: item.type, item } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingLeft: `${depth * 16 + 8}px`,
  };

  const isGroup = item.type === 'group';
  const displayName = item.name || (isGroup ? 'Group' : `Layer ${item.id}`);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function startEdit(e) {
    e.stopPropagation();
    setNameVal(displayName);
    setEditing(true);
  }

  function commitEdit() {
    setEditing(false);
    const trimmed = nameVal.trim();
    if (trimmed && trimmed !== displayName) {
      onRename?.(item.id, item.type, trimmed);
    }
  }

  function cancelEdit() {
    setEditing(false);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => { if (!editing) { e.stopPropagation(); onSelect(item.id, item.type); } }}
      onContextMenu={(e) => { if (!editing) onContextMenu(e, item); }}
      className={`
        group flex items-center gap-2 py-1.5 pr-2 border-b border-zinc-800/50 cursor-pointer
        ${isSelected ? 'bg-amber-500/10 text-amber-100' : 'hover:bg-zinc-800/50 text-zinc-300'}
        ${isDragging ? 'opacity-50 bg-zinc-800 z-50' : ''}
      `}
    >
      {/* Drag handle — disabled during edit so input is usable */}
      <div
        {...(editing ? {} : { ...attributes, ...listeners })}
        className="text-zinc-600 hover:text-zinc-400 cursor-grab active:cursor-grabbing p-0.5"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      {/* Icon */}
      {isGroup ? (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleExpand(item.id, !item.expanded); }}
          className="text-zinc-400 hover:text-zinc-200 p-0.5 shrink-0"
        >
          {item.expanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
        </button>
      ) : (
        <div className="w-4 h-4 bg-zinc-800 rounded flex items-center justify-center shrink-0">
          <ImageIcon className="w-3 h-3 text-zinc-500" />
        </div>
      )}

      {/* Name — inline edit or label */}
      {editing ? (
        <input
          ref={inputRef}
          value={nameVal}
          onChange={(e) => setNameVal(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter')  { e.preventDefault(); commitEdit(); }
            if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
            e.stopPropagation(); // don't let DnD capture keys
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-zinc-700 border border-amber-500/60 rounded px-1.5 py-0.5
                     text-xs text-zinc-100 focus:outline-none min-w-0"
        />
      ) : (
        <span
          className={`flex-1 text-xs truncate select-none ${isGroup ? 'font-medium' : ''}`}
          onDoubleClick={startEdit}
          title="Double-click to rename"
        >
          {displayName}
        </span>
      )}

      {/* Action buttons */}
      {!editing && (
        <div className={`flex items-center gap-0.5 transition-opacity
          ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>

          {/* Rename button */}
          <button
            onClick={startEdit}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-200"
            title="Rename (double-click name)"
          >
            <Pencil className="w-3 h-3" />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onToggleVisibility(item.id, item.type, !item.visible); }}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200"
            title={item.visible === false ? 'Show' : 'Hide'}
          >
            {item.visible === false
              ? <EyeOff className="w-3.5 h-3.5" />
              : <Eye    className="w-3.5 h-3.5" />
            }
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onToggleLock(item.id, item.type, !item.locked); }}
            className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200"
            title={item.locked ? 'Unlock' : 'Lock'}
          >
            {item.locked
              ? <Lock   className="w-3.5 h-3.5 text-amber-500" />
              : <Unlock className="w-3.5 h-3.5" />
            }
          </button>
        </div>
      )}
    </div>
  );
}
