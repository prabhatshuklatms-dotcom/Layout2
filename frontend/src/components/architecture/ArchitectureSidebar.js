'use client';

import { useState, useCallback } from 'react';
import { useViewerStore } from '@/store/viewerStore';
import { useToast } from '@/components/ui/Toast';
import {
  getArchitectureFiles,
  renameArchitecture,
  deleteArchitecture,
} from '@/services/architecture.service';
import { useArchitectureUpload } from '@/hooks/useArchitectureUpload';
import UploadButton           from './UploadButton';
import UploadProgress         from './UploadProgress';
import EmptyArchitectureState from './EmptyArchitectureState';
import ArchitectureFileCard   from './ArchitectureFileCard';

export default function ArchitectureSidebar({ projectId }) {
  const files         = useViewerStore((s) => s.files);
  const setFiles      = useViewerStore((s) => s.setFiles);
  const activeFile    = useViewerStore((s) => s.activeFile);
  const setActiveFile = useViewerStore((s) => s.setActiveFile);

  const { toast } = useToast();

  const refreshFiles = useCallback(async () => {
    try {
      const data = await getArchitectureFiles(projectId);
      setFiles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[ArchitectureSidebar] refresh failed:', err.message);
    }
  }, [projectId, setFiles]);

  const { uploading, progress, uploadName, handleFiles, cancelUpload } =
    useArchitectureUpload(projectId, {
      onSuccess: (msg) => toast.success(msg),
      onError:   (msg) => toast.error(msg),
    });

  const [search, setSearch] = useState('');
  const filtered = files.filter((f) =>
    f.originalName.toLowerCase().includes(search.toLowerCase()),
  );

  const handleOpen = useCallback((file) => setActiveFile(file), [setActiveFile]);

  const handleRename = useCallback(async (id, name) => {
    try {
      await renameArchitecture(id, name);
      await refreshFiles();
      toast.success('File renamed.');
    } catch (err) {
      toast.error(err.message ?? 'Rename failed.');
    }
  }, [refreshFiles, toast]);

  const handleDelete = useCallback(async (id) => {
    try {
      await deleteArchitecture(id);
      if (activeFile?.id === id) setActiveFile(null);
      await refreshFiles();
      toast.success('File deleted.');
    } catch (err) {
      toast.error(err.message ?? 'Delete failed.');
    }
  }, [activeFile, setActiveFile, refreshFiles, toast]);

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800 shrink-0">
        <div>
          <h2 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            Architecture
          </h2>
          <p className="text-[10px] text-zinc-700 mt-0.5">
            {files.length} file{files.length !== 1 ? 's' : ''}
          </p>
        </div>
        <UploadButton onFiles={handleFiles} disabled={uploading} />
      </div>

      {/* Upload progress bar */}
      {uploading && (
        <UploadProgress
          filename={uploadName}
          progress={progress}
          onCancel={cancelUpload}
        />
      )}

      {/* Search bar — only visible when there are files */}
      {files.length > 0 && (
        <div className="px-2 pt-2 shrink-0">
          <div className="relative">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"
                 width="11" height="11" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files…"
              className="w-full bg-zinc-800/80 border border-zinc-700 rounded-lg
                         pl-7 pr-3 py-1.5 text-[11px] text-zinc-300 placeholder-zinc-600
                         focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>
      )}

      {/* File list / empty state */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1.5 min-h-0">
        {files.length === 0 && !uploading ? (
          <EmptyArchitectureState onFiles={handleFiles} uploading={uploading} />
        ) : filtered.length === 0 && search ? (
          <p className="text-[11px] text-zinc-600 text-center mt-6 px-3">
            No files match &ldquo;{search}&rdquo;
          </p>
        ) : (
          filtered.map((file) => (
            <ArchitectureFileCard
              key={file.id}
              file={file}
              isActive={activeFile?.id === file.id}
              onOpen={handleOpen}
              onRename={handleRename}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
