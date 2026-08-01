import React from 'react';
import Link from 'next/link';
import { ChevronLeft, Undo2, Redo2, Maximize, RefreshCw } from 'lucide-react';

export default function CadEditorTopBar({ 
  zoomPercent, 
  coords, 
  conversionName,
  projectId,
  isSaving, 
  onUndo, 
  onRedo, 
  onSave, 
  canUndo, 
  canRedo,
  activeTool,
  strokeWidth,
  onStrokeWidthChange,
  showPlotStatus,
  onTogglePlotStatus
}) {
  const isDrawingTool = activeTool === 'draw_line' || activeTool === 'draw_circle' || activeTool === 'draw_curve' || activeTool === 'draw_polygon' || activeTool === 'draw_text' || activeTool === 'draw_arrow';
  const backUrl = projectId ? `/cad-conversion/${projectId}` : '/cad-conversion';
  
  return (
    <header className="h-12 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between px-4 shrink-0 shadow-sm z-20">
      <div className="flex items-center gap-4">
        <Link href={backUrl} className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1 text-sm font-medium">
          <ChevronLeft size={16} />
          Back to Conversion
        </Link>
        <div className="w-px h-5 bg-zinc-800" />
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-zinc-200 truncate max-w-xs" title={conversionName}>
            {conversionName || 'Unnamed CAD'}
          </div>
        </div>
        
        {isDrawingTool && (
          <>
            <div className="w-px h-5 bg-zinc-800 mx-2" />
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-400 font-medium">
                {activeTool === 'draw_text' ? 'Text Size:' : 'Stroke Size:'}
              </span>
              <input 
                type="range" 
                min="0.05" 
                max="20" 
                step="0.05"
                value={strokeWidth}
                onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
                className="w-24 accent-indigo-500"
              />
              <input 
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={strokeWidth}
                onChange={(e) => onStrokeWidthChange(Number(e.target.value) || 0.01)}
                className="w-14 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-white text-center focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 mr-2">
          <span className="text-xs text-zinc-400 font-medium">Show Plot Status</span>
          <button 
            onClick={onTogglePlotStatus}
            className={`w-8 h-4 rounded-full relative transition-colors ${showPlotStatus ? 'bg-indigo-500' : 'bg-zinc-700'}`}
          >
            <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${showPlotStatus ? 'left-[18px]' : 'left-0.5'}`} />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 border border-zinc-800 bg-zinc-900 rounded p-1">
            <button 
              className="p-1 text-zinc-500 hover:text-white disabled:opacity-50 disabled:hover:text-zinc-500 transition-colors" 
              title="Undo (Ctrl+Z)"
              onClick={onUndo}
              disabled={!canUndo}
            >
              <Undo2 size={16} />
            </button>
            <button 
              className="p-1 text-zinc-500 hover:text-white disabled:opacity-50 disabled:hover:text-zinc-500 transition-colors" 
              title="Redo (Ctrl+Y)"
              onClick={onRedo}
              disabled={!canRedo}
            >
              <Redo2 size={16} />
            </button>
          </div>
          
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center min-w-[32px] h-8 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded transition-colors"
            title="Refresh Page"
          >
            <RefreshCw size={14} />
          </button>

          <button
            onClick={onSave}
            disabled={isSaving}
            className="flex items-center justify-center min-w-[72px] h-8 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:text-white/50 text-white rounded text-xs font-semibold tracking-wide transition-colors"
          >
            {isSaving ? 'SAVING...' : 'SAVE'}
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-zinc-400">
          <div className="flex gap-2">
            <span>X: {coords.x.toFixed(2)}</span>
            <span>Y: {coords.y.toFixed(2)}</span>
          </div>
          <div className="w-px h-4 bg-zinc-800" />
          <div className="w-12 text-right">{Math.round(zoomPercent)}%</div>
          <button className="p-1 text-zinc-400 hover:text-white transition-colors ml-1" title="Fit to Screen" onClick={() => window.dispatchEvent(new CustomEvent('editor-fit-screen'))}>
            <Maximize size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
