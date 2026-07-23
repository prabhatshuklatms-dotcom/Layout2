'use client';

import { useEffect } from 'react';
import { useMaskEditor } from '@/store/useMaskEditor';

export default function KeyboardShortcuts() {
  const { setMode, undo, redo, deleteSelected, mode } = useMaskEditor();

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const key = e.key.toLowerCase();
      
      if (e.ctrlKey || e.metaKey) {
        if (key === 'z') {
          e.preventDefault();
          undo();
        } else if (key === 'y') {
          e.preventDefault();
          redo();
        }
        return;
      }

      switch (key) {
        case 'delete':
        case 'backspace':
          e.preventDefault();
          deleteSelected();
          break;
        case 'p':
          setMode('plot');
          break;
        case 'r':
          setMode('road');
          break;
        case 'a':
          setMode('amenity');
          break;
        case 'c':
          setMode('commercial');
          break;
        case 'b':
          setMode('boundary');
          break;
        case 'l':
          setMode('landscape');
          break;
        case 'escape':
          setMode('pointer');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setMode, undo, redo, deleteSelected, mode]);

  return null;
}
