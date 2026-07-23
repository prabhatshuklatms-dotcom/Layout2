'use client';

import { useState, useRef, useCallback } from 'react';
import { useViewerStore } from '@/store/viewerStore';
import {
  validateFile,
  uploadArchitecture,
  getArchitectureFiles,
} from '@/services/architecture.service';

/**
 * Shared upload hook used by ArchitectureSidebar, DragDropOverlay, and the
 * toolbar upload button. Returns upload state + a handleFiles function.
 */
export function useArchitectureUpload(projectId, { onSuccess, onError } = {}) {
  const setFiles      = useViewerStore((s) => s.setFiles);
  const setActiveFile = useViewerStore((s) => s.setActiveFile);

  const [uploading,   setUploading]   = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [uploadName,  setUploadName]  = useState('');
  const abortRef = useRef(null);

  const handleFiles = useCallback(async (fileList) => {
    const file = fileList[0];
    if (!file) return;

    const err = validateFile(file);
    if (err) { onError?.(err); return; }

    const controller = new AbortController();
    abortRef.current = controller;

    setUploading(true);
    setProgress(0);
    setUploadName(file.name);

    try {
      const res = await uploadArchitecture(
        projectId,
        file,
        setProgress,
        controller.signal,
      );

      // Refresh and auto-select
      const allFiles = await getArchitectureFiles(projectId);
      const list = Array.isArray(allFiles) ? allFiles : [];
      setFiles(list);

      const newFileId = res?.data?.id ?? res?.id;
      const uploaded  = list.find((f) => f.id === newFileId) ?? list[0];
      if (uploaded) setActiveFile(uploaded);

      onSuccess?.(`"${file.name}" uploaded successfully.`);
    } catch (err) {
      if (err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
        onError?.(err.response?.data?.message ?? err.message ?? 'Upload failed.');
      }
    } finally {
      setUploading(false);
      setProgress(0);
      setUploadName('');
      abortRef.current = null;
    }
  }, [projectId, setFiles, setActiveFile, onSuccess, onError]);

  const cancelUpload = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { uploading, progress, uploadName, handleFiles, cancelUpload };
}
