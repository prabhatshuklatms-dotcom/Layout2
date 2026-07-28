'use client';

import React, { useState, useEffect } from 'react';
import CadEditorTopBar from './CadEditorTopBar';
import CadEditorToolbar from './CadEditorToolbar';
import CadEditorCanvas from './CadEditorCanvas';
import CadEditorSidebar from './CadEditorSidebar';
import { parseSvgStringToState, serializeStateToSvgString } from './SvgDocumentModel';
import { getProjectPlots, getPlotStatuses, getProjectPlotStatuses, getAmenities, getAmenityPlacements } from '@/lib/api';
export default function CadEditorWorkspace({ conversionId, projectId }) {
  const [conversion, setConversion] = useState(null);
  const [svgContent, setSvgContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTool, setActiveTool] = useState('pointer');
  const [isSaving, setIsSaving] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fillColor, setFillColor] = useState('#3b82f6');
  const [fillOpacity, setFillOpacity] = useState(1.0);
  const [eraserSize, setEraserSize] = useState(1);

  // Canvas state synced to TopBar and Sidebar
  const [zoomPercent, setZoomPercent] = useState(100);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  // Selected shape — kept in Workspace so Sidebar can access it
  const [selectedShapeIds, setSelectedShapeIds] = useState([]);
  const [selectedShapes, setSelectedShapes] = useState([]);

  // Plots & Statuses
  const [plots, setPlots] = useState([]);
  const [statuses, setStatuses] = useState([]);

  // Amenities
  const [masterAmenities, setMasterAmenities] = useState([]);
  const [placedAmenities, setPlacedAmenities] = useState([]);

  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const performSave = async (content) => {
    try {
      setIsSaving(true);
      const res = await fetch(`http://localhost:5000/api/cad-conversion/${conversionId}/svg`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ svg: content }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error('Failed to save SVG — status:', res.status, res.statusText, body);
      }
    } catch (err) {
      console.error('Error saving SVG (network/CORS):', err);
    } finally {
      setIsSaving(false);
    }
  };

  const saveSvgContent = async (newSvgString) => {
    console.log('[ERASER Stage 12] saveSvgContent called. SVG length:', newSvgString?.length, '| historyIndex before:', historyIndex);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newSvgString);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setSvgContent(newSvgString);
    console.log('[ERASER Stage 12] setSvgContent called. New history length:', newHistory.length);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setSvgContent(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setSvgContent(history[newIndex]);
    }
  };

  const handleSave = () => {
    if (svgContent) performSave(svgContent);
  };

  // Stroke-width change from Sidebar → canvas via custom event
  const handleShapeStrokeWidthChange = (w) => {
    if (selectedShapeIds.length === 0) return;
    const updateShapes = (shapes) => {
      let changed = false;
      const result = shapes.map(s => {
        if (selectedShapeIds.includes(s.id)) {
          changed = true;
          return { ...s, attributes: { ...s.attributes, 'stroke-width': w } };
        }
        if (s.children) {
          const { newShapes, childChanged } = updateShapes(s.children);
          if (childChanged) {
            changed = true;
            return { ...s, children: newShapes };
          }
        }
        return s;
      });
      return { newShapes: result, childChanged: changed };
    };
    
    setHistoryIndex(prev => prev + 1);
    setHistory(prev => {
      const newHist = prev.slice(0, historyIndex + 1);
      const parsed = parseSvgStringToState(newHist[newHist.length - 1]);
      const { newShapes } = updateShapes(parsed.shapes);
      newHist.push(serializeStateToSvgString(newShapes, parsed.viewBox));
      return newHist;
    });
    setSvgContent(prev => {
      const parsed = parseSvgStringToState(prev);
      const { newShapes } = updateShapes(parsed.shapes);
      return serializeStateToSvgString(newShapes, parsed.viewBox);
    });
    
    // Update selectedShapes state to match new attributes
    setSelectedShapes(prev => prev.map(s => ({ ...s, attributes: { ...s.attributes, 'stroke-width': w } })));
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'z') {
        e.shiftKey ? handleRedo() : handleUndo();
      } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
        handleRedo();
      } else if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        const targetTag = e.target.tagName?.toLowerCase();
        if (targetTag === 'input' || targetTag === 'textarea' || e.target.isContentEditable) return;
        switch (e.key.toLowerCase()) {
          case 'v': setActiveTool('pointer'); break;
          case 'z': setActiveTool('zoom_window'); break;
          case 'e': setActiveTool('eraser'); break;
          case 'x': setActiveTool('partial_delete'); break;
          case 'y': setActiveTool('vector_eraser'); break;
          case 't': setActiveTool('draw_text'); break;
          case 'l': setActiveTool('draw_line'); break;
          case 'r': setActiveTool('draw_arrow'); break;
          case 'c': setActiveTool('draw_circle'); break;
          case 'u': setActiveTool('draw_curve'); break;
          case 'p': setActiveTool('draw_polygon'); break;
          case 'f': setActiveTool('paint_bucket'); break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, historyIndex]);

  useEffect(() => {
    async function loadData() {
      if (!conversionId || conversionId === 'undefined') {
        setError('Invalid conversion ID');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await fetch(`http://localhost:5000/api/cad-conversion/${conversionId}`);
        if (!res.ok) throw new Error('Conversion not found');
        const data = await res.json();
        setConversion(data);
        if (data.status === 'FAILED') throw new Error('Conversion failed');

        const svgRes = await fetch(`http://localhost:5000/api/cad-conversion/${conversionId}/svg`);
        if (!svgRes.ok) throw new Error('SVG not found');
        const svgText = await svgRes.text();
        setSvgContent(svgText);
        setHistory([svgText]);
        setHistoryIndex(0);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
    
    // Load Amenities
    Promise.all([
      getAmenities(),
      getAmenityPlacements(conversionId)
    ])
    .then(([amenities, placements]) => {
      setMasterAmenities(amenities);
      setPlacedAmenities(placements);
    })
    .catch(console.error);

    if (projectId) {
      Promise.all([getProjectPlots(projectId), getProjectPlotStatuses(projectId)])
        .then(([p, s]) => {
          setPlots(p);
          setStatuses(s);
        })
        .catch(console.error);
    }
  }, [conversionId, projectId]);

  if (loading) {
    return (
      <div className="h-screen w-full bg-[#0a0a0a] flex items-center justify-center text-zinc-400 flex-col gap-4">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <div>Loading Editor Workspace...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen w-full bg-[#0a0a0a] flex items-center justify-center text-red-500 flex-col gap-4">
        <div className="text-xl font-medium">{error}</div>
        <button
          onClick={() => window.location.href = '/cad-conversion'}
          className="px-4 py-2 bg-zinc-800 text-zinc-200 rounded hover:bg-zinc-700"
        >
          Back to Conversion Studio
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#0f1115] flex flex-col overflow-hidden text-zinc-300 font-sans select-none">
      <CadEditorTopBar
        zoomPercent={zoomPercent}
        coords={coords}
        conversionName={conversion?.originalFileName}
        projectId={projectId}
        isSaving={isSaving}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSave={handleSave}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        activeTool={activeTool}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={setStrokeWidth}
      />

      <div className="flex-1 flex overflow-hidden relative">
        <CadEditorToolbar 
          activeTool={activeTool} 
          onToolChange={(tool) => {
            console.log('[ERASER Stage 1] Toolbar onToolChange called. New tool:', tool);
            setActiveTool(tool);
          }} 
        />

        <div className="flex-1 relative overflow-hidden bg-[#0a0a0a]">
          <CadEditorCanvas
            svgContent={svgContent}
            activeTool={activeTool}
            strokeWidth={strokeWidth}
            eraserSize={eraserSize}
            fillColor={fillColor}
            fillOpacity={fillOpacity}
            plots={plots}
            statuses={statuses}
            onZoomChange={setZoomPercent}
            onCoordsChange={setCoords}
            onSvgModified={saveSvgContent}
            onToolChange={setActiveTool}
            masterAmenities={masterAmenities}
            placedAmenities={placedAmenities}
            setPlacedAmenities={setPlacedAmenities}
            conversionId={conversionId}
            projectId={projectId}
            onSelectionChange={(ids, shapes) => { setSelectedShapeIds(ids); setSelectedShapes(shapes); }}
            onLabelDragEnd={(id, dx, dy) => {
              const updateShapes = (shapes) => {
                let changed = false;
                const result = shapes.map(s => {
                  if (s.id === id) {
                    changed = true;
                    return { 
                      ...s, 
                      attributes: { 
                        ...s.attributes, 
                        'data-label-dx': dx,
                        'data-label-dy': dy
                      } 
                    };
                  }
                  if (s.children) {
                    const { newShapes, childChanged } = updateShapes(s.children);
                    if (childChanged) {
                      changed = true;
                      return { ...s, children: newShapes };
                    }
                  }
                  return s;
                });
                return { newShapes: result, childChanged: changed };
              };
              
              const parsed = parseSvgStringToState(svgContent);
              const { newShapes, childChanged } = updateShapes(parsed.shapes);
              if (childChanged) {
                const newSvg = serializeStateToSvgString(newShapes, parsed.viewBox);
                saveSvgContent(newSvg);
              }
            }}
          />
        </div>

        <CadEditorSidebar
          projectId={projectId}
          conversion={conversion}
          coords={coords}
          activeTool={activeTool}
          selectedShapes={selectedShapes}
          fillColor={fillColor}
          fillOpacity={fillOpacity}
          eraserSize={eraserSize}
          plots={plots}
          statuses={statuses}
          masterAmenities={masterAmenities}
          onFillColorChange={setFillColor}
          onFillOpacityChange={setFillOpacity}
          onStrokeWidthChange={handleShapeStrokeWidthChange}
          onEraserSizeChange={setEraserSize}
          onAssignPlot={async (plot, status, labelConfig = null) => {
             if (selectedShapeIds.length !== 1) return;
             
             const regionId = selectedShapeIds[0];
             const parsed = parseSvgStringToState(svgContent);
             
             // Find currently assigned plot for this region (if any)
             let currentPlotIdStr = null;
             const findPlotAttr = (shapes) => {
               for (const s of shapes) {
                 if (s.id === regionId) {
                   currentPlotIdStr = s.attributes['data-plot-id'];
                   return true;
                 }
                 if (s.children && findPlotAttr(s.children)) return true;
               }
               return false;
             };
             findPlotAttr(parsed.shapes);
             
             const oldPlotId = currentPlotIdStr ? parseInt(currentPlotIdStr) : null;
             
             // 1. Release old plot if it's changing or being removed
             if (oldPlotId && (!plot || oldPlotId !== plot.id)) {
               try {
                 await fetch(`http://localhost:5000/api/projects/${projectId}/plots/${oldPlotId}`, {
                   method: 'PATCH',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ cadRegionId: null })
                 });
                 setPlots(prev => prev.map(p => p.id === oldPlotId ? { ...p, cadRegionId: null } : p));
               } catch (e) { console.error(e); }
             }
             
             // 2. Assign new plot
             if (plot) {
               try {
                 await fetch(`http://localhost:5000/api/projects/${projectId}/plots/${plot.id}`, {
                   method: 'PATCH',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ cadRegionId: regionId })
                 });
                 setPlots(prev => prev.map(p => p.id === plot.id ? { ...p, cadRegionId: regionId } : p));
               } catch (e) { console.error(e); }
             }

             const updateShapes = (shapes) => {
               let changed = false;
               const result = shapes.map(s => {
                 if (selectedShapeIds.includes(s.id)) {
                   changed = true;
                     const newAttrs = { 
                       ...s.attributes, 
                       'data-plot-id': plot ? plot.id : undefined,
                       ...labelConfig
                     };
                     
                     if (plot && status && status.color) {
                       newAttrs.fill = status.color;
                       newAttrs['fill-opacity'] = '0.75';
                     }
                     
                     // Cleanup undefined attributes if removing assignment
                     if (!plot && !labelConfig) {
                       delete newAttrs['data-plot-id'];
                       delete newAttrs['data-label-dx'];
                       delete newAttrs['data-label-dy'];
                       delete newAttrs['data-label-rotation'];
                       delete newAttrs['data-label-fontsize'];
                       delete newAttrs['data-label-color'];
                       delete newAttrs['data-label-fontfamily'];
                       delete newAttrs['data-label-fontweight'];
                       delete newAttrs['data-label-align'];
                       delete newAttrs['data-label-show-area'];
                       delete newAttrs['data-label-show-width'];
                       delete newAttrs['data-label-show-height'];
                     }

                     return { 
                       ...s, 
                       attributes: newAttrs
                     };
                 }
                 if (s.children) {
                   const { newShapes, childChanged } = updateShapes(s.children);
                   if (childChanged) {
                     changed = true;
                     return { ...s, children: newShapes };
                   }
                 }
                 return s;
               });
               return { newShapes: result, childChanged: changed };
             };
             
             const { newShapes, childChanged } = updateShapes(parsed.shapes);
             if (childChanged) {
               const newSvg = serializeStateToSvgString(newShapes, parsed.viewBox);
               saveSvgContent(newSvg);
             }
          }}
        />
      </div>
    </div>
  );
}
