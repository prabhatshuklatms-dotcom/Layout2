import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getContrastYIQ } from '@/lib/utils';
import Link from 'next/link';
import { ColorPicker } from 'antd';
import { Plus } from 'lucide-react';

const STROKE_SUPPORTED_TYPES = new Set([
  'line', 'polyline', 'path', 'rect', 'circle', 'ellipse', 'polygon',
]);

const MIN_STROKE = 0.01;
const MAX_STROKE = 20;

export default function CadEditorSidebar({ isMobileOpen, onCloseMobile, projectId, conversion, coords, activeTool, selectedShapes, fillColor, fillOpacity, eraserSize, plots, statuses, masterAmenities = [], projectConfig, onProjectLabelStyleChange, onPlotLabelStyleChange, onLayoutLineColorChange, onFillColorChange, onFillOpacityChange, onStrokeWidthChange, onEraserSizeChange, onAssignPlot }) {
  const [localStroke, setLocalStroke] = useState(2);
  const [localEraser, setLocalEraser] = useState(1);

  // Custom Dropdown State
  const [isPlotDropdownOpen, setIsPlotDropdownOpen] = useState(false);
  const [plotSearch, setPlotSearch] = useState('');
  const [selectedPlotId, setSelectedPlotId] = useState('');

  const [isMobile, setIsMobile] = useState(false);
  const [isMobileAmenitiesOpen, setIsMobileAmenitiesOpen] = useState(false);
  const floatingPanelRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize(); // Init
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const selectedShape = selectedShapes?.[0]; // Use first shape for generic property display

  useEffect(() => {
    if (!isMobile || selectedShapes?.length !== 1 || !selectedShape) return;

    let animationFrameId;

    const updatePosition = () => {
      const el = document.getElementById(selectedShape.id);
      if (el && floatingPanelRef.current) {
        const rect = el.getBoundingClientRect();

        let top = rect.bottom + 10;
        let left = Math.max(10, rect.left);

        const panelWidth = 240;
        if (left + panelWidth > window.innerWidth - 10) {
          left = Math.max(10, window.innerWidth - panelWidth - 10);
        }

        const panelHeight = floatingPanelRef.current.offsetHeight || 150;
        if (top + panelHeight > window.innerHeight - 10) {
          top = rect.top - panelHeight - 10;
        }

        floatingPanelRef.current.style.transform = `translate(${left}px, ${top}px)`;
        floatingPanelRef.current.style.opacity = '1';
        floatingPanelRef.current.style.pointerEvents = 'auto';
      }
      animationFrameId = requestAnimationFrame(updatePosition);
    };

    animationFrameId = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isMobile, selectedShapes?.length, selectedShape?.id]);

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

  const amenitiesListContent = (
    <>
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
            if (isMobile) setIsMobileAmenitiesOpen(false);
          }}
          className="bg-[#1a1c23] border border-zinc-800 rounded p-1 md:p-1.5 flex flex-col items-center justify-center gap-0.5 md:gap-1 cursor-pointer hover:border-indigo-500 transition-colors shadow-sm"
          title="Drag to canvas or click to prepare placement"
        >
          <div className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center bg-black/50 rounded overflow-hidden shrink-0">
            <img src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${am.iconPath}`} alt={am.name} className="max-w-[80%] max-h-[80%] object-contain" />
          </div>
          <div className="text-[7px] md:text-[9px] text-zinc-400 text-center leading-tight truncate w-full">
            {am.name}
          </div>
        </div>
      ))}
      {masterAmenities.length === 0 && (
        <div className="col-span-3 text-[10px] text-zinc-600 text-center py-2">No amenities available.</div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile Amenities Panel */}
      {isMobile && isMobileAmenitiesOpen && (
        <div
          className="absolute top-0 bottom-0 right-0 w-12 bg-[#1a1c23] border-l border-zinc-800 z-40 flex flex-col shadow-2xl md:hidden"
        >
          <div className="flex flex-col items-center justify-center p-1 border-b border-zinc-800 shrink-0 gap-0.5 pb-1.5">
            <button
              onClick={() => setIsMobileAmenitiesOpen(false)}
              className="text-zinc-400 hover:text-white p-0.5 shrink-0 w-full flex justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div className="p-1 overflow-y-auto flex-1 flex flex-col gap-2 content-start items-center pt-2">
            {amenitiesListContent}
          </div>
        </div>
      )}
      <div
        className={`absolute md:relative right-0 top-0 h-full w-64 bg-zinc-950 border-l border-zinc-800 flex flex-col shrink-0 z-30 overflow-y-auto transform transition-transform duration-200 ${isMobileOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
          }`}
      >
        <div className="md:hidden flex justify-between items-center p-4 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-300">Properties</h3>
          <button onClick={onCloseMobile} className="text-zinc-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* ── Actions ───────────────────────────────────────────────────────── */}
        <div className="p-4 border-b border-zinc-800 flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 hidden md:block">Actions</h3>
          <Link
            href={`/cad-conversion/${projectId}/manage-plot${conversion ? `?editorId=${conversion.id}` : ''}`}
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
          <Link
            href={`/cad-conversion/${projectId}/plot-appearance`}
            className="w-full flex items-center justify-center py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded transition-colors"
          >
            Plot Appearance
          </Link>
        </div>

        {/* ── Amenities ─────────────────────────────────────────────────────── */}
        <div className="p-4 border-b border-zinc-800 flex flex-col shrink-0">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Amenities</h3>
            <a
              href="/masters/amenities"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 hover:text-indigo-400 transition-colors"
              title="Add Amenity"
            >
              <Plus size={14} />
            </a>
          </div>

          {!isMobile ? (
            <div className="grid grid-cols-3 gap-2 overflow-y-auto pr-1 max-h-[250px]">
              {amenitiesListContent}
            </div>
          ) : (
            <button
              onClick={() => {
                setIsMobileAmenitiesOpen(true);
                if (onCloseMobile) onCloseMobile();
              }}
              className="w-full flex items-center justify-between px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 text-sm transition-colors"
            >
              <span>Open Amenities Panel</span>
              <span>→</span>
            </button>
          )}
        </div>

        {/* ── Global CAD Line Color ───────────────────────────────────────── */}
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">CAD Line Color</h3>
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
          </div>
        </div>

        {/* ── Properties ──────────────────────────────────────────────────── */}
        {selectedShapes?.length === 1 && (
          (() => {
            const assignPlotContent = (
              <>
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
              </>
            );

            const fillColorContent = (
              <>
                <h4 className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">Fill Color</h4>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <ColorPicker
                      value={selectedShape.attributes?.fill && selectedShape.attributes.fill !== 'none' ? (selectedShape.attributes.fill.startsWith('#') ? selectedShape.attributes.fill : '#ffffff') : '#ffffff'}
                      onChange={(_, hex) => {
                        const currentAttrs = selectedShape.attributes || {};
                        const evt = new CustomEvent('cad-patch-shape', {
                          detail: {
                            id: selectedShape.id,
                            patch: {
                              fill: hex,
                              'data-cad-custom-fill': 'true',
                              'data-original-fill': currentAttrs['data-original-fill'] ?? (currentAttrs.fill !== undefined ? currentAttrs.fill : 'MISSING'),
                              'data-original-fill-opacity': currentAttrs['data-original-fill-opacity'] ?? (currentAttrs['fill-opacity'] !== undefined ? currentAttrs['fill-opacity'] : 'MISSING')
                            }
                          }
                        });
                        window.dispatchEvent(evt);
                      }}
                      showText
                      format="hex"
                      className="w-full"
                    />
                  </div>
                  <button
                    disabled={selectedShape.attributes?.['data-cad-custom-fill'] !== 'true'}
                    className={`px-3 py-1.5 text-xs rounded transition-colors border h-8 ${selectedShape.attributes?.['data-cad-custom-fill'] === 'true'
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
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
                    title="Reset to Default"
                  >
                    Reset
                  </button>
                </div>
              </>
            );

            const combinedContent = (
              <>
                {assignPlotContent}
                <div className="mt-4 pt-4 border-t border-zinc-800">
                  {fillColorContent}
                </div>
              </>
            );

            if (isMobile) {
              return typeof window !== 'undefined' ? createPortal(
                <div
                  ref={floatingPanelRef}
                  className="fixed top-0 left-0 z-50 w-60 bg-[#1a1c23] border border-zinc-700 rounded-lg shadow-2xl p-3 opacity-0 transition-opacity duration-150"
                  onClick={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  {combinedContent}
                </div>,
                document.body
              ) : null;
            }

            return (
              <div className="p-4 border-b border-zinc-800">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Properties</h3>
                <div className="space-y-3">
                  {combinedContent}
                </div>
              </div>
            );
          })()
        )}

        {/* ── Paint Bucket — Fill Color ─────────────────────────────────────── */}
        {activeTool === 'paint_bucket' && (
          <div className="p-4 border-b border-zinc-800">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
              Paint Bucket
            </h3>

            {/* Color swatch + hex input */}
            <div className="mb-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <ColorPicker
                    value={fillColor || '#3b82f6'}
                    onChange={(_, hex) => onFillColorChange?.(hex)}
                    showText
                    format="hex"
                    className="w-full"
                  />
                </div>
                <button
                  onClick={() => onFillColorChange?.('#3b82f6')}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded transition-colors border border-zinc-700 h-8"
                  title="Reset to default fill color"
                >
                  Reset
                </button>
              </div>
            </div>
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



        {/* Placeholder when no shape is selected */}
        {!selectedShape && (
          <div className="p-4 border-b border-zinc-800">
            <div className="text-[10px] text-zinc-600 text-center py-2">
              Select an object to edit its properties
            </div>
          </div>
        )}
      </div>
    </>
  );
}
