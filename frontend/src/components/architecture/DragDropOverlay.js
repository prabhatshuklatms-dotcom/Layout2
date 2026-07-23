'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { validateFile } from '@/services/architecture.service';
import { useToast } from '@/components/ui/Toast';

/**
 * Invisible full-canvas drag-drop zone.
 *
 * Renders a visible "Drop to upload" overlay only while a file is being dragged
 * over the canvas. Fires `onFiles([file])` on drop after validation.
 */
export default function DragDropOverlay({ onFiles, disabled }) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0); // track nested dragenter/dragleave pairs
  const { toast } = useToast();

  const onDragEnter = useCallback((e) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);

    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const err = validateFile(file);
    if (err) { toast.error(err); return; }

    onFiles([file]);
  }, [disabled, onFiles, toast]);

  useEffect(() => {
    const el = document.body;
    el.addEventListener('dragenter', onDragEnter);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('dragover',  onDragOver);
    el.addEventListener('drop',      onDrop);
    return () => {
      el.removeEventListener('dragenter', onDragEnter);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('dragover',  onDragOver);
      el.removeEventListener('drop',      onDrop);
    };
  }, [onDragEnter, onDragLeave, onDragOver, onDrop]);

  if (!isDragging) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center
                    bg-black/60 backdrop-blur-sm pointer-events-none">
      <div className="flex flex-col items-center gap-4 text-center">
        {/* Animated drop zone */}
        <div className="w-24 h-24 rounded-3xl border-2 border-dashed border-indigo-400
                        bg-indigo-500/10 flex items-center justify-center
                        animate-pulse">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
               stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <div>
          <p className="text-lg font-semibold text-white">Drop file to upload</p>
          <p className="text-sm text-zinc-400 mt-1">PNG, JPG, JPEG or PDF — max 20 MB</p>
        </div>
      </div>
    </div>
  );
}
