import React, { useState, useRef } from 'react';
import { CheckCircle2, Clock, XCircle, Loader2, Edit2, Trash2, Check, X, UploadCloud } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Swal from 'sweetalert2';

export default function ConversionQueue({ conversions, selectedId, onSelect, onDelete, onUpdate, onReupload }) {
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const fileInputRef = useRef(null);
  const [uploadingId, setUploadingId] = useState(null);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'SUCCESS': return <CheckCircle2 size={16} className="text-emerald-500" />;
      case 'FAILED': return <XCircle size={16} className="text-red-500" />;
      case 'PROCESSING': return <Loader2 size={16} className="text-indigo-500 animate-spin" />;
      default: return <Clock size={16} className="text-zinc-500" />;
    }
  };

  const startEdit = (e, conv) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditName(conv.originalFileName);
  };

  const cancelEdit = (e) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const saveEdit = (e, id) => {
    e.stopPropagation();
    if (editName.trim()) {
      onUpdate(id, editName.trim());
    }
    setEditingId(null);
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    Swal.fire({
      title: 'Delete Conversion?',
      text: 'Are you sure you want to delete this conversion?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#ef4444',
      background: '#18181b',
      color: '#fff'
    }).then((result) => {
      if (result.isConfirmed) {
        onDelete(id);
      }
    });
  };

  const handleReuploadClick = (e, id) => {
    e.stopPropagation();
    setUploadingId(id);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && uploadingId) {
      onReupload(uploadingId, file);
    }
    e.target.value = null; // reset input
    setUploadingId(null);
  };

  if (!conversions || conversions.length === 0) {
    return (
      <div className="p-4 text-center text-zinc-500 text-sm">
        No conversions yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <input type="file" ref={fileInputRef} className="hidden" accept=".dwg,.dxf" onChange={handleFileChange} />
      <div className="px-4 py-3 border-b border-zinc-800 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Recent Conversions</h2>
      </div>
      <div className="flex flex-col">
        {conversions.map((conv) => (
          <div
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`group relative flex items-start gap-3 p-4 border-b border-zinc-800/50 text-left transition-colors cursor-pointer hover:bg-zinc-900/50
              ${selectedId === conv.id ? 'bg-zinc-900 border-l-2 border-l-indigo-500 pl-[14px]' : 'border-l-2 border-l-transparent'}`}
          >
            <div className="mt-0.5 shrink-0">
              {getStatusIcon(conv.status)}
            </div>
            <div className="flex-1 min-w-0 pr-12">
              {editingId === conv.id ? (
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-200 outline-none focus:border-indigo-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit(e, conv.id);
                      if (e.key === 'Escape') cancelEdit(e);
                    }}
                  />
                  <button onClick={(e) => saveEdit(e, conv.id)} className="text-emerald-500 hover:text-emerald-400">
                    <Check size={16} />
                  </button>
                  <button onClick={cancelEdit} className="text-red-500 hover:text-red-400">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="text-sm font-medium text-zinc-200 truncate" title={conv.originalFileName}>
                  {conv.originalFileName}
                </div>
              )}
              <div className="text-xs text-zinc-500 mt-1 flex items-center gap-2">
                <span>{formatDistanceToNow(new Date(conv.createdAt), { addSuffix: true })}</span>
                <span>•</span>
                <span className="capitalize">{conv.status.toLowerCase()}</span>
              </div>
            </div>
            {/* Actions overlay */}
            {editingId !== conv.id && (
              <div className="absolute right-3 top-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900/80 backdrop-blur-sm rounded p-1">
                <button
                  onClick={(e) => handleReuploadClick(e, conv.id)}
                  className="text-zinc-400 hover:text-indigo-400 p-1.5 rounded hover:bg-zinc-800 transition-colors"
                  title="Replace File"
                >
                  <UploadCloud size={14} />
                </button>
                <button
                  onClick={(e) => startEdit(e, conv)}
                  className="text-zinc-400 hover:text-white p-1.5 rounded hover:bg-zinc-800 transition-colors"
                  title="Rename"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={(e) => handleDelete(e, conv.id)}
                  className="text-zinc-400 hover:text-red-500 p-1.5 rounded hover:bg-zinc-800 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
