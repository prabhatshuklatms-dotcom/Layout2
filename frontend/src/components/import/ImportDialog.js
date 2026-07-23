'use client';

import { useState, useRef } from 'react';
import { UploadCloud, X, FileArchive, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function ImportDialog({ isOpen, onClose }) {
  const [file,           setFile]           = useState(null);
  const [importing,      setImporting]      = useState(false);
  const [conflictAction, setConflictAction] = useState('rename');
  const [success,        setSuccess]        = useState(false);
  const [error,          setError]          = useState('');
  const fileInputRef = useRef(null);
  const router       = useRouter();

  if (!isOpen) return null;

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setSuccess(false); setError(''); }
  }

  function handleDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) { setFile(f); setSuccess(false); setError(''); }
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res  = await fetch(`${BASE_URL}/import/project?conflict=${conflictAction}`, {
        method: 'POST',
        body:   formData,
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
          router.push(`/projects/${data.data.id}/viewer`);
        }, 1200);
      } else {
        throw new Error(data.message || 'Import failed.');
      }
    } catch (err) {
      setError(err.message);
      setImporting(false);
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
          <h2 className="text-sm font-semibold text-zinc-100">Import Project</h2>
          <button onClick={onClose} disabled={importing}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center
                        justify-center text-center cursor-pointer transition-colors
                        ${file
                          ? 'border-indigo-500/50 bg-indigo-500/5'
                          : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/40'
                        }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,.json,.layout"
              className="hidden"
              onChange={handleFileChange}
            />
            {file ? (
              <>
                <FileArchive size={30} className="text-indigo-400 mb-2" />
                <p className="text-sm font-medium text-zinc-200">{file.name}</p>
                <p className="text-xs text-zinc-500 mt-1">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </>
            ) : (
              <>
                <UploadCloud size={30} className="text-zinc-600 mb-2" />
                <p className="text-sm font-medium text-zinc-300">
                  Click or drag a file here
                </p>
                <p className="text-xs text-zinc-600 mt-1">
                  Supports .layout · .zip · .json
                </p>
              </>
            )}
          </div>

          {/* Conflict action */}
          <div>
            <p className="text-xs font-medium text-zinc-500 mb-2">
              If project name already exists:
            </p>
            <div className="flex gap-4">
              {[['rename', 'Rename copy'], ['overwrite', 'Overwrite']].map(([val, label]) => (
                <label key={val}
                       className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer hover:text-zinc-200">
                  <input
                    type="radio"
                    name="conflict"
                    checked={conflictAction === val}
                    onChange={() => setConflictAction(val)}
                    className="accent-indigo-500"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-800/40
                          rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            disabled={importing || success}
            className="flex-1 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800
                       text-sm font-medium text-zinc-300 hover:bg-zinc-700
                       transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!file || importing || success}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white
                        transition-colors disabled:opacity-40 flex items-center justify-center gap-2
                        ${success ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-500'}`}
          >
            {importing ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".3" strokeWidth="3"/>
                  <path d="M12 3A9 9 0 0 1 21 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                Importing…
              </>
            ) : success ? (
              <>
                <CheckCircle size={14} />
                Done
              </>
            ) : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
