import React from 'react';
import Link from 'next/link';
import { ChevronLeft, Undo2, Redo2, Maximize, RefreshCw } from 'lucide-react';
import { ColorPicker } from 'antd';

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
  strokeColor,
  onStrokeColorChange,
  textFontSize,
  onTextFontSizeChange,
  textFontColor,
  onTextFontColorChange,
  textFontFamily,
  onTextFontFamilyChange,
  selectedShapes,
  showPlotStatus,
  onTogglePlotStatus,
  isMobileSidebarOpen,
  onToggleMobileSidebar,
  plots,
  projectConfig,
  onPlotLabelStyleChange
}) {
  const isDrawingTool = activeTool === 'draw_line' || activeTool === 'draw_circle' || activeTool === 'draw_curve' || activeTool === 'draw_polygon' || activeTool === 'draw_text' || activeTool === 'draw_arrow';
  
  const STROKE_SUPPORTED_TYPES = new Set(['line', 'polyline', 'path', 'rect', 'circle', 'ellipse', 'polygon', 'text']);
  const selectedShape = selectedShapes?.[0];
  const canEditStroke = selectedShape && STROKE_SUPPORTED_TYPES.has(selectedShape.type);
  
  const isSingleSelected = selectedShapes?.length === 1;
  const selectedPlot = isSingleSelected ? plots?.find(p => p.cadRegionId === selectedShape?.id) : null;
  const isPlotMode = !!selectedPlot;

  const showStrokeUI = isDrawingTool || canEditStroke;
  
  const isTextTool = activeTool === 'draw_text';
  const canEditText = selectedShape && selectedShape.type === 'text';
  const showTextUI = isTextTool || canEditText;
  
  const selectedShapeSize = selectedShape 
    ? (selectedShape.type === 'text' 
       ? parseFloat(selectedShape.attributes?.['font-size']) 
       : parseFloat(selectedShape.attributes?.['stroke-width'])) 
    : undefined;

  const currentSizeVal = (selectedShapeSize !== undefined && !isNaN(selectedShapeSize)) 
    ? selectedShapeSize 
    : (isPlotMode ? 0.1 : (isTextTool || canEditText ? textFontSize : strokeWidth));
  
  const backUrl = projectId ? `/cad-conversion/${projectId}` : '/cad-conversion';
  
  const isTextMode = activeTool === 'draw_text' || selectedShape?.type === 'text';

  const ToolSettings = () => {
    if (isPlotMode) {
      const pMeta = selectedPlot.metadata || {};
      const lblSize = pMeta.labelFontSize !== undefined && pMeta.labelFontSize !== null ? parseFloat(pMeta.labelFontSize) : (projectConfig?.labelFontSize ?? 2);
      const lblColor = pMeta.labelFontColor || projectConfig?.labelFontColor || '#ffffff';
      const lblFamily = pMeta.labelFontFamily || projectConfig?.labelFontFamily || 'sans-serif';

      return (
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-[11px] font-medium text-zinc-400">Color:</span>
            <ColorPicker
              value={lblColor}
              onChange={(_, hex) => onPlotLabelStyleChange(selectedPlot.id, { labelFontColor: hex })}
              size="small" showText format="hex"
              styles={{ popup: { zIndex: 9999 } }}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-[11px] font-medium text-zinc-400">Font:</span>
            <select
              value={lblFamily}
              onChange={(e) => onPlotLabelStyleChange(selectedPlot.id, { labelFontFamily: e.target.value })}
              className="h-7 bg-zinc-900 border border-zinc-700 rounded px-2 text-[11px] text-white focus:outline-none focus:border-indigo-500 transition-colors"
              title="Font"
            >
              <option value="sans-serif">Sans Serif</option>
              <option value="serif">Serif</option>
              <option value="monospace">Monospace</option>
              <option value="Arial">Arial</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-[11px] font-medium text-zinc-400">Text Size:</span>
            <input 
              type="number" min="0.1" step="0.1" max="100"
              value={lblSize}
              onChange={(e) => onPlotLabelStyleChange(selectedPlot.id, { labelFontSize: parseFloat(e.target.value) || 2 })}
              className="w-14 h-7 bg-zinc-900 border border-zinc-700 rounded px-2 text-[11px] text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono"
              title="Text Size"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-[11px] font-medium text-zinc-400">Stroke Size:</span>
            <input 
              type="number" min="0.01" step="0.1" max="100"
              value={currentSizeVal}
              onChange={(e) => {
                 const raw = e.target.value;
                 onStrokeWidthChange(raw === '' ? '' : parseFloat(raw));
              }}
              onBlur={(e) => {
                 const v = parseFloat(e.target.value);
                 if (isNaN(v) || v < 0.01) onStrokeWidthChange(0.1);
              }}
              className="w-14 h-7 bg-zinc-900 border border-zinc-700 rounded px-2 text-[11px] text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono"
              title="Stroke Size"
            />
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-4 shrink-0">
        {(showStrokeUI || showTextUI) && (
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-[11px] font-medium text-zinc-400">
              {isTextMode ? 'Text Size:' : 'Stroke Size:'}
            </span>
            <input 
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              value={currentSizeVal}
              onChange={(e) => {
                 const raw = e.target.value;
                 if (isTextMode) {
                   onTextFontSizeChange(raw === '' ? '' : parseFloat(raw)); 
                 } else {
                   onStrokeWidthChange(raw === '' ? '' : parseFloat(raw));
                 }
              }}
              onBlur={(e) => {
                 const v = parseFloat(e.target.value);
                 if (isNaN(v) || v < 0.1) {
                   if (isTextMode) {
                     onTextFontSizeChange(2);
                   } else {
                     onStrokeWidthChange(2);
                   }
                 }
              }}
              className="w-14 h-7 bg-zinc-900 border border-zinc-700 rounded px-2 text-[11px] text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono"
              title={isTextMode ? 'Text Size' : 'Stroke Size'}
            />
          </div>
        )}
        
        {showStrokeUI && !isTextMode && (
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-[11px] font-medium text-zinc-400">Color:</span>
            <ColorPicker
              value={selectedShape ? selectedShape.attributes?.stroke : strokeColor}
              onChange={(_, hex) => onStrokeColorChange(hex)}
              size="small"
              showText
              format="hex"
              styles={{ popup: { zIndex: 9999 } }}
            />
          </div>
        )}
        
        {showTextUI && (
          <>
            <div className="flex items-center gap-2">
              <span className="hidden md:inline text-[11px] font-medium text-zinc-400">Color:</span>
              <ColorPicker
                value={selectedShape ? selectedShape.attributes?.fill : textFontColor}
                onChange={(_, hex) => onTextFontColorChange(hex)}
                size="small"
                showText
                format="hex"
                styles={{ popup: { zIndex: 9999 } }}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden md:inline text-[11px] font-medium text-zinc-400">Font:</span>
              <select
                value={selectedShape ? selectedShape.attributes?.['font-family'] : textFontFamily}
                onChange={(e) => onTextFontFamilyChange(e.target.value)}
                className="h-7 bg-zinc-900 border border-zinc-700 rounded px-2 text-[11px] text-white focus:outline-none focus:border-indigo-500 transition-colors"
                title="Font"
              >
                <option value="sans-serif">Sans Serif</option>
                <option value="serif">Serif</option>
                <option value="monospace">Monospace</option>
                <option value="Arial">Arial</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Courier New">Courier New</option>
              </select>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col shrink-0 z-20 shadow-sm border-b border-zinc-800">
      <header className="h-12 bg-zinc-950 flex items-center justify-between px-2 md:px-4">
        <div className="flex items-center gap-2 md:gap-4">
          <Link href={backUrl} className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1 text-sm font-medium">
            <ChevronLeft size={16} />
            <span className="hidden md:inline">Back</span>
          </Link>
          <div className="hidden md:block w-px h-5 bg-zinc-800" />
          <div className="hidden md:flex items-center gap-2">
            <div className="text-sm font-semibold text-zinc-200 truncate max-w-[120px] lg:max-w-xs" title={conversionName}>
              {conversionName || 'Unnamed CAD'}
            </div>
          </div>
          
          <div className="hidden md:flex items-center">
            <div className="w-px h-5 bg-zinc-800 mx-2" />
            {ToolSettings()}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-6">
        <div className="flex items-center gap-2 md:mr-2">
          <span className="hidden md:inline text-xs text-zinc-400 font-medium">Show Plot Status</span>
          <button 
            onClick={onTogglePlotStatus}
            className={`w-8 h-4 rounded-full relative transition-colors shrink-0 ${showPlotStatus ? 'bg-indigo-500' : 'bg-zinc-700'}`}
          >
            <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${showPlotStatus ? 'left-[18px]' : 'left-0.5'}`} />
          </button>
        </div>

        <div className="flex items-center gap-1.5 md:gap-4">
          <div className="flex items-center gap-0.5 md:gap-2 border border-zinc-800 bg-zinc-900 rounded p-0.5 md:p-1">
            <button 
              className="p-1 text-zinc-500 hover:text-white disabled:opacity-50 disabled:hover:text-zinc-500 transition-colors" 
              title="Undo (Ctrl+Z)"
              onClick={onUndo}
              disabled={!canUndo}
            >
              <Undo2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
            <button 
              className="p-1 text-zinc-500 hover:text-white disabled:opacity-50 disabled:hover:text-zinc-500 transition-colors" 
              title="Redo (Ctrl+Y)"
              onClick={onRedo}
              disabled={!canRedo}
            >
              <Redo2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
          </div>
          
          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center min-w-[24px] md:min-w-[32px] h-6 md:h-8 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded transition-colors"
            title="Refresh Page"
          >
            <RefreshCw className="w-3.5 h-3.5 md:w-4 md:h-4" />
          </button>

          <button
            onClick={onSave}
            disabled={isSaving}
            className="flex items-center justify-center min-w-[44px] md:min-w-[72px] h-6 md:h-8 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:text-white/50 text-white rounded text-[10px] md:text-xs font-semibold tracking-wide transition-colors"
          >
            {isSaving ? '...' : 'SAVE'}
          </button>
        </div>

        <div className="hidden md:flex items-center gap-4 text-xs font-mono text-zinc-400">
          <div className="flex gap-2">
            <span>X: {coords.x.toFixed(2)}</span>
            <span>Y: {coords.y.toFixed(2)}</span>
          </div>
          <div className="w-px h-4 bg-zinc-800" />
          <div className="w-12 text-right">{Math.round(zoomPercent)}%</div>
          <button className="p-1 text-zinc-400 hover:text-white transition-colors ml-1 shrink-0" title="Fit to Screen" onClick={() => window.dispatchEvent(new CustomEvent('editor-fit-screen'))}>
            <Maximize size={14} />
          </button>
        </div>
        
        <button 
          onClick={onToggleMobileSidebar}
          className="md:hidden ml-1 p-1.5 shrink-0 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
          title="Toggle Properties"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>
      </div>
      </header>
      
      {/* Mobile Tool Settings Row */}
      {(showStrokeUI || showTextUI || isPlotMode) && (
        <div className={`md:hidden flex items-center h-10 px-2 pb-1 bg-zinc-900 border-t border-zinc-800 overflow-x-auto whitespace-nowrap ${(!isTextMode && !isPlotMode) ? 'justify-center w-full' : ''}`}>
          {ToolSettings()}
        </div>
      )}
    </div>
  );
}
