import { useState, useCallback } from 'react';

export function useSvgEditor(initialPolygons = []) {
  const [polygons, setPolygons] = useState(initialPolygons);
  const [history, setHistory] = useState([initialPolygons]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const saveState = useCallback((newPolygons) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newPolygons);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setPolygons(newPolygons);
  }, [history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setPolygons(history[historyIndex - 1]);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setPolygons(history[historyIndex + 1]);
    }
  }, [history, historyIndex]);

  const updatePolygon = useCallback((id, updates) => {
    const newPolygons = polygons.map(p => p.id === id ? { ...p, ...updates } : p);
    saveState(newPolygons);
  }, [polygons, saveState]);

  return {
    polygons,
    setPolygons: saveState,
    updatePolygon,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1
  };
}
