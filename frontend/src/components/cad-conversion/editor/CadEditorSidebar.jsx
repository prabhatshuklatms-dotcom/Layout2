import React, { useState, useEffect } from 'react';
import { getContrastYIQ } from '@/lib/utils';
import Link from 'next/link';
import { ColorPicker } from 'antd';

const STROKE_SUPPORTED_TYPES = new Set([
  'line', 'polyline', 'path', 'rect', 'circle', 'ellipse', 'polygon',
]);

const MIN_STROKE = 0.01;
const MAX_STROKE = 20;

export default function CadEditorSidebar({ projectId, conversion, coords, activeTool, selectedShapes, fillColor, fillOpacity, eraserSize, plots, statuses, masterAmenities = [], projectConfig, onProjectLabelStyleChange, onLayoutLineColorChange, onFillColorChange, onFillOpacityChange, onStrokeWidthChange, onEraserSizeChange, onAssignPlot }) {
  const [localStroke, setLocalStroke] = useState(2);
  const [localEraser, setLocalEraser] = useState(1);
  
  // Custom Dropdown State
  const [isPlotDropdownOpen, setIsPlotDropdownOpen] = useState(false);
  const [plotSearch, setPlotSearch] = useState('');
  const [selectedPlotId, setSelectedPlotId] = useState('');

  const selectedShape = selectedShapes?.[0]; // Use first shape for generic property display

  useEffect(() => {
    if (selectedShape) {
      const raw = selectedShape.attributes?.['stroke-width'];
      const parsed = parseFloat(raw);
      setLocalStroke(!isNaN(parsed) ? parsed : 2);
    }
  }, [selectedShape?.id, selectedShape?.attributes?.['stroke-width']]);

  useEffect(() => {
    if (eraserSize !== undefined) setLocalEraser(eraserSize);
  }, [eraserSize]);

  const canEditStroke =
    selectedShape &&
    STROKE_SUPPORTED_TYPES.has(selectedShape.type) &&
    typeof onStrokeWidthChange === 'function';

  const commitStroke = (val) => {
    const clamped = Math.min(MAX_STROKE, Math.max(MIN_STROKE, val));
    setLocalStroke(clamped);
    onStrokeWidthChange(clamped);
  };

  const handleSlider = (e) => {
    const val = Number(e.target.value);
    setLocalStroke(val);
    onStrokeWidthChange(val);
  };

  const handleInput = (e) => {
    const raw = e.target.value;
    setLocalStroke(raw === '' ? '' : Number(raw));
  };

  const handleInputBlur = (e) => {
    const parsed = parseFloat(e.target.value);
    commitStroke(isNaN(parsed) ? localStroke : parsed);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      const parsed = parseFloat(e.target.value);
      commitStroke(isNaN(parsed) ? localStroke : parsed);
    }
  };

  return (
    <div className="w-64 bg-zinc-950 border-l border-zinc-800 flex flex-col shrink-0 z-10 overflow-y-auto">

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div className="p-4 border-b border-zinc-800 flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Actions</h3>
        <Link 
          href={`/cad-conversion/${projectId}/plots${conversion ? `?editorId=${conversion.id}` : ''}`}
          className="w-full flex items-center justify-center py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded transition-colors"
        >
          Manage Plots
        </Link>
        <Link 
          href={`/cad-conversion/${projectId}/plot-statuses${conversion ? `?editorId=${conversion.id}` : ''}`}
          className="w-full flex items-center justify-center py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded transition-colors"
        >
          Manage Plot Statuses
        </Link>
      </div>

      {/* ── Amenities ─────────────────────────────────────────────────────── */}
      <div className="p-4 border-b border-zinc-800 flex flex-col shrink-0 max-h-[300px]">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 shrink-0">Amenities</h3>
        <div className="grid grid-cols-3 gap-2 overflow-y-auto pr-1">
          {masterAmenities.map(am => (
            <div 
              key={am.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/cad-amenity', JSON.stringify(am));
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={() => {
                window.dispatchEvent(new CustomEvent('cad-amenity-select', { detail: am }));
              }}
              className="bg-[#1a1c23] border border-zinc-800 rounded p-1.5 flex flex-col items-center justify-center gap-1 cursor-grab active:cursor-grabbing hover:border-indigo-500 transition-colors shadow-sm"
              title="Drag to canvas or click to prepare placement"
            >
              <div className="w-8 h-8 flex items-center justify-center bg-black/50 rounded overflow-hidden shrink-0">
                 <img src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${am.iconPath}`} alt={am.name} className="max-w-[80%] max-h-[80%] object-contain" />
              </div>
              <div className="text-[9px] text-zinc-400 text-center leading-tight truncate w-full">
                {am.name}
              </div>
            </div>
          ))}
          {masterAmenities.length === 0 && (
            <div className="col-span-3 text-[10px] text-zinc-600 text-center py-2">No amenities available.</div>
          )}
        </div>
      </div>
      {/* ── Global Label Style ──────────────────────────────────────────── */}
      <div className="p-4 border-b border-zinc-800">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Project Label Style</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Font Size</label>
              <input 
                type="number" 
                min="0.1" step="0.1" max="100"
                value={projectConfig?.labelFontSize ?? 2}
                onChange={(e) => onProjectLabelStyleChange({ labelFontSize: parseFloat(e.target.value) || 2 })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Font Color</label>
              <ColorPicker
                value={projectConfig?.labelFontColor || '#ffffff'}
                onChange={(_, hex) => onProjectLabelStyleChange({ labelFontColor: hex })}
                showText
                format="hex"
                styles={{
                  popup: { zIndex: 9999 }
                }}
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-zinc-400 block mb-1">Font Family</label>
            <select 
              value={projectConfig?.labelFontFamily || 'sans-serif'}
              onChange={(e) => onProjectLabelStyleChange({ labelFontFamily: e.target.value })}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="sans-serif">Sans Serif</option>
              <option value="serif">Serif</option>
              <option value="monospace">Monospace</option>
              <option value="Inter, sans-serif">Inter</option>
              <option value="Roboto, sans-serif">Roboto</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Global CAD Line Color ───────────────────────────────────────── */}
      <div className="p-4 border-b border-zinc-800">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Global CAD Line Color</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <ColorPicker
                value={conversion?.layoutLineColor || '#ffffff'}
                onChange={(_, hex) => onLayoutLineColorChange(hex)}
                showText
                format="hex"
                className="w-full"
                styles={{
                  popup: { zIndex: 9999 }
                }}
              />
            </div>
            <button
              onClick={() => onLayoutLineColorChange(null)}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded transition-colors border border-zinc-700 h-8"
              title="Reset to original CAD colors"
            >
              Reset
            </button>
          </div>
          <p className="text-[10px] text-zinc-500 leading-tight">
            Instantly overrides all layout boundaries, roads, and CAD linework. Does not affect fills or selections.
          </p>
        </div>
      </div>

      {/* ── Properties ──────────────────────────────────────────────────── */}
      <div className="p-4 border-b border-zinc-800">
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Properties</h3>
        <div className="space-y-3">
          <div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Cursor Position</div>
            <div className="font-mono text-xs text-emerald-400 bg-black/50 p-2 rounded border border-zinc-800">
              X: {coords.x.toFixed(4)}<br />
              Y: {coords.y.toFixed(4)}
            </div>
          </div>
          
          {selectedShapes?.length > 0 && (
            <div className="mt-3">
              <div className="bg-[#1a1c23] p-3 rounded-lg border border-zinc-800">
                <div className="text-xs text-zinc-400 mb-1 flex justify-between">
                  <span>Selected</span>
                  {selectedShapes.length > 1 && <span>({selectedShapes.length} objects)</span>}
                </div>
                <div className="text-sm font-medium text-zinc-200 capitalize">
                  {selectedShapes.length === 1 ? selectedShape.type : 'Multiple Objects'}
                </div>
                {selectedShapes.length === 1 && (
                  <div className="text-xs text-zinc-500 font-mono mt-1 truncate">ID: {selectedShape.id}</div>
                )}
              </div>
              
              {/* Fill Color */}
              {selectedShapes.length === 1 && (
                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Fill Color</h4>
                  <div className="bg-[#1a1c23] p-3 rounded-lg border border-zinc-800 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400">Current Color</span>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded-sm border border-zinc-700" 
                          style={{ backgroundColor: selectedShape.attributes?.fill || 'transparent' }}
                        ></div>
                        <span className="text-xs font-mono text-zinc-300">
                          {selectedShape.attributes?.fill || 'none'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <label className="flex-1 text-center py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 rounded cursor-pointer transition-colors border border-zinc-700">
                          Change Color
                          <input 
                            type="color" 
                            className="sr-only" 
                            value={selectedShape.attributes?.fill && selectedShape.attributes.fill !== 'none' ? (selectedShape.attributes.fill.startsWith('#') ? selectedShape.attributes.fill : '#ffffff') : '#ffffff'}
                            onChange={(e) => {
                              const currentAttrs = selectedShape.attributes || {};
                              const evt = new CustomEvent('cad-patch-shape', {
                                detail: {
                                  id: selectedShape.id,
                                  patch: { 
                                    fill: e.target.value,
                                    'data-cad-custom-fill': 'true',
                                    'data-original-fill': currentAttrs['data-original-fill'] ?? (currentAttrs.fill !== undefined ? currentAttrs.fill : 'MISSING'),
                                    'data-original-fill-opacity': currentAttrs['data-original-fill-opacity'] ?? (currentAttrs['fill-opacity'] !== undefined ? currentAttrs['fill-opacity'] : 'MISSING')
                                  }
                                }
                              });
                              window.dispatchEvent(evt);
                            }}
                          />
                        </label>
                      </div>
                      
                      <button
                        disabled={selectedShape.attributes?.['data-cad-custom-fill'] !== 'true'}
                        className={`py-1.5 px-3 text-xs rounded border transition-colors ${
                          selectedShape.attributes?.['data-cad-custom-fill'] === 'true'
                            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                            : 'bg-zinc-800/50 text-zinc-600 border-zinc-800 cursor-not-allowed'
                        }`}
                        onClick={() => {
                          const attrs = selectedShape.attributes || {};
                          const originalFill = attrs['data-original-fill'];
                          const originalFillOpacity = attrs['data-original-fill-opacity'];
                          
                          if (originalFill !== undefined) {
                            const evt = new CustomEvent('cad-patch-shape', {
                              detail: {
                                id: selectedShape.id,
                                patch: {
                                  fill: originalFill === 'MISSING' ? null : originalFill,
                                  'fill-opacity': (originalFillOpacity === undefined || originalFillOpacity === 'MISSING') ? null : originalFillOpacity,
                                  'data-cad-custom-fill': null,
                                  'data-original-fill': null,
                                  'data-original-fill-opacity': null
                                }
                              }
                            });
                            window.dispatchEvent(evt);
                          }
                        }}
                      >
                        Reset to Default
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Plot Assignment */}
              {selectedShapes.length === 1 && (
                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Assign Plot</h4>
                  
                    {(() => {
                      const assignedPlotId = selectedShape.attributes?.['data-plot-id'];
                      const assignedPlot = assignedPlotId ? plots.find(p => p.id === parseInt(assignedPlotId)) : null;
                      
                      if (assignedPlot) {
                        return (
                          <div className="space-y-3">
                            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded flex flex-col gap-2">
                              <div>
                                <span className="text-[10px] text-indigo-400 block uppercase tracking-wider">Assigned Plot</span>
                                <span className="text-sm font-medium text-indigo-100">{assignedPlot.plotNumber}</span>
                              </div>
                              {assignedPlot.status && (
                                <div>
                                  <span className="text-[10px] text-zinc-500 block uppercase tracking-wider mb-0.5">Status</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded inline-block" style={{ backgroundColor: assignedPlot.status.fillColor, color: getContrastYIQ(assignedPlot.status.fillColor) }}>
                                    {assignedPlot.status.name}
                                  </span>
                                </div>
                              )}
                              
                              <div className="flex gap-2 mt-2">
                                <button 
                                  onClick={() => setIsPlotDropdownOpen(!isPlotDropdownOpen)}
                                  className="flex-1 px-2 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 rounded text-[10px] text-indigo-200 transition-colors"
                                >
                                  Change Assignment
                                </button>
                                <button 
                                  onClick={() => {
                                    onAssignPlot(null, null);
                                    setIsPlotDropdownOpen(false);
                                  }}
                                  className="flex-1 px-2 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded text-[10px] text-red-400 transition-colors"
                                >
                                  Remove Assignment
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      
                      return (
                        <button 
                          onClick={() => setIsPlotDropdownOpen(!isPlotDropdownOpen)}
                          className="w-full px-2 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium transition-colors flex justify-between items-center shadow-sm"
                        >
                          <span>Select Plot to Assign...</span>
                          <span>▼</span>
                        </button>
                      );
                    })()}

                    {/* Searchable Dropdown */}
                    {isPlotDropdownOpen && (
                      <div className="mt-2 bg-[#0f1115] border border-zinc-700 rounded-md overflow-hidden shadow-lg animate-in fade-in slide-in-from-top-1 duration-150 relative z-50">
                        <div className="p-2 border-b border-zinc-800">
                          <input 
                            type="text" 
                            placeholder="Search available plots..."
                            value={plotSearch}
                            onChange={e => setPlotSearch(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {plots
                            .filter(p => !p.cadRegionId)
                            .filter(p => {
                              const s = plotSearch.toLowerCase();
                              return p.plotNumber.toLowerCase().includes(s) || (p.status?.name || '').toLowerCase().includes(s);
                            })
                            .sort((a, b) => a.plotNumber.localeCompare(b.plotNumber, undefined, { numeric: true, sensitivity: 'base' }))
                            .map(p => (
                            <button
                              key={p.id}
                              onClick={() => {
                                const status = statuses.find(s => s.id === p.statusId);
                                onAssignPlot(p, status);
                                setIsPlotDropdownOpen(false);
                                setPlotSearch('');
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-indigo-500/20 text-xs text-zinc-300 border-b border-zinc-800/50 last:border-0 flex justify-between items-center"
                            >
                              <span className="font-medium">{p.plotNumber}</span>
                              {p.status && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: p.status.fillColor, color: getContrastYIQ(p.status.fillColor) }}>
                                  {p.status.name}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Removed per-plot label configuration */}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Paint Bucket — Fill Color ─────────────────────────────────────── */}
      {activeTool === 'paint_bucket' && (
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Paint Bucket
          </h3>
          <p className="text-[10px] text-zinc-500 mb-3 leading-relaxed">
            Click inside any closed region to fill it. Click an existing fill to remove it.
          </p>

          {/* Color swatch + hex input */}
          <div className="flex items-center gap-3 mb-3">
            <input
              type="color"
              value={fillColor}
              onChange={e => onFillColorChange?.(e.target.value)}
              className="w-9 h-9 rounded cursor-pointer bg-zinc-900 border border-zinc-700 p-0.5"
              title="Select fill color"
            />
            <div className="flex-1">
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">HEX</div>
              <input
                type="text"
                value={fillColor.toUpperCase()}
                onChange={e => {
                  const v = e.target.value;
                  if (/^#[0-9A-Fa-f]{6}$/.test(v)) onFillColorChange?.(v);
                }}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 font-mono outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Opacity */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Opacity</span>
              <span className="text-xs text-zinc-300 font-mono">{Math.round(fillOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0" max="1" step="0.01"
              value={fillOpacity}
              onChange={e => onFillOpacityChange?.(parseFloat(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>

          {/* Preview swatch */}
          <div
            className="mt-3 h-6 rounded border border-zinc-700"
            style={{ backgroundColor: fillColor, opacity: fillOpacity }}
            aria-hidden="true"
          />
        </div>
      )}

      {/* ── Vector Eraser ──────────────────────────────────────────────── */}
      {activeTool === 'vector_eraser' && (
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Eraser Size
          </h3>
          <p className="text-[10px] text-zinc-500 mb-3 leading-relaxed">
            Drag over geometry to erase segments precisely.
          </p>

          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Radius</span>
            <span className="font-mono text-sm text-red-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
              {localEraser} px
            </span>
          </div>

          <div className="mb-3">
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={localEraser}
              onChange={e => {
                const val = Number(e.target.value);
                setLocalEraser(val);
                onEraserSizeChange?.(val);
              }}
              className="w-full accent-red-500"
            />
            <div className="flex justify-between text-[9px] text-zinc-600 mt-0.5">
              <span>1px</span>
              <span>100px</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const val = Math.max(1, localEraser - 1);
                setLocalEraser(val);
                onEraserSizeChange?.(val);
              }}
              className="w-7 h-7 flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-sm font-bold transition-colors border border-zinc-700 select-none"
            >
              −
            </button>
            <input
              type="number"
              min="1"
              max="100"
              value={localEraser}
              onChange={e => {
                const raw = e.target.value;
                setLocalEraser(raw === '' ? '' : Number(raw));
              }}
              onBlur={e => {
                const parsed = Math.min(100, Math.max(1, parseInt(e.target.value) || 10));
                setLocalEraser(parsed);
                onEraserSizeChange?.(parsed);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const parsed = Math.min(100, Math.max(1, parseInt(e.target.value) || 10));
                  setLocalEraser(parsed);
                  onEraserSizeChange?.(parsed);
                }
              }}
              className="flex-1 h-7 bg-zinc-900 border border-zinc-700 rounded px-2 text-xs text-white text-center focus:outline-none focus:border-red-500 transition-colors font-mono"
            />
            <button
              onClick={() => {
                const val = Math.min(100, localEraser + 1);
                setLocalEraser(val);
                onEraserSizeChange?.(val);
              }}
              className="w-7 h-7 flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-sm font-bold transition-colors border border-zinc-700 select-none"
            >
              +
            </button>
          </div>
          <div className="mt-4 flex gap-1 flex-wrap">
            {[1, 2, 4, 8, 12, 16, 24, 32].map(sz => (
              <button
                key={sz}
                onClick={() => {
                  setLocalEraser(sz);
                  onEraserSizeChange?.(sz);
                }}
                className={`px-1.5 py-1 text-[10px] font-mono rounded border ${localEraser === sz ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'}`}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Stroke Width ─────────────────────────────────────────────────── */}
      {canEditStroke && (
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            Stroke Width
          </h3>

          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider">
              {selectedShape.type.charAt(0).toUpperCase() + selectedShape.type.slice(1)}
            </span>
            <span className="font-mono text-sm text-indigo-300 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700">
              {typeof localStroke === 'number' ? Number(localStroke).toPrecision(4).replace(/(\.\d*?[1-9])0+$|\.0*$/,'$1') : localStroke} px
            </span>
          </div>

          <div className="mb-3">
            <input
              type="range"
              min={MIN_STROKE}
              max={MAX_STROKE}
              step="0.05"
              value={typeof localStroke === 'number' && !isNaN(localStroke) ? localStroke : MIN_STROKE}
              onChange={handleSlider}
              className="w-full accent-indigo-500"
              title={`Stroke width: ${localStroke}px`}
            />
            <div className="flex justify-between text-[9px] text-zinc-600 mt-0.5">
              <span>{MIN_STROKE}px</span>
              <span>{MAX_STROKE}px</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => commitStroke((parseFloat(localStroke) || 1) - 1)}
              className="w-7 h-7 flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-sm font-bold transition-colors border border-zinc-700 select-none"
              title="Decrease stroke width"
              aria-label="Decrease stroke width"
            >
              −
            </button>

            <input
              type="number"
              min={MIN_STROKE}
              max={MAX_STROKE}
              step="0.01"
              value={localStroke}
              onChange={handleInput}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              className="flex-1 h-7 bg-zinc-900 border border-zinc-700 rounded px-2 text-xs text-white text-center focus:outline-none focus:border-indigo-500 transition-colors font-mono"
              title="Stroke width (px)"
              aria-label="Stroke width in pixels"
            />

            <button
              onClick={() => commitStroke((parseFloat(localStroke) || 1) + 1)}
              className="w-7 h-7 flex items-center justify-center rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-sm font-bold transition-colors border border-zinc-700 select-none"
              title="Increase stroke width"
              aria-label="Increase stroke width"
            >
              +
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="text-[9px] text-zinc-600 uppercase tracking-wider shrink-0">Preview</span>
            <div className="flex-1 flex items-center h-6">
              <div
                className="w-full rounded-full bg-white"
                style={{
                  height: `${Math.min(Math.max(typeof localStroke === 'number' ? localStroke : 1, 1), 20)}px`,
                  opacity: 0.85,
                  transition: 'height 0.1s ease',
                }}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      )}

      {/* Placeholder when no shape is selected */}
      {!selectedShape && (
        <div className="p-4 border-b border-zinc-800">
          <div className="text-[10px] text-zinc-600 text-center py-2">
            Select an object to edit its properties
          </div>
        </div>
      )}
    </div>
  );
}
