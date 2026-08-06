'use client';

import React, { useState, useEffect } from 'react';
import CadEditorTopBar from './CadEditorTopBar';
import CadEditorToolbar from './CadEditorToolbar';
import CadEditorCanvas from './CadEditorCanvas';
import CadEditorSidebar from './CadEditorSidebar';
import { parseSvgStringToState, serializeStateToSvgString } from './SvgDocumentModel';
import { getProjectPlots, getPlotStatuses, getProjectPlotStatuses, getAmenities, getAmenityPlacements, updateProjectPlotAssignment, getCadProject, updateCadProject } from '@/lib/api';
import Swal from 'sweetalert2';
export default function CadEditorWorkspace({ conversionId, projectId, readOnly = false, showPlotStatus: showPlotStatusProp, onUserViewerSelection, onZoomChange: onZoomChangeProp }) {
  const [conversion, setConversion] = useState(null);
  const [projectConfig, setProjectConfig] = useState(null);
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
  const [internalShowPlotStatus, setInternalShowPlotStatus] = useState(false);
  const showPlotStatus = showPlotStatusProp !== undefined ? showPlotStatusProp : internalShowPlotStatus;

  // Amenities
  const [masterAmenities, setMasterAmenities] = useState([]);
  const [placedAmenities, setPlacedAmenities] = useState([]);

  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const performSave = async (content) => {
    try {
      setIsSaving(true);

      // Inject labels from DOM into the SVG payload using pure string manipulation
      let finalSvgString = content;
      try {
        const labelsEl = document.getElementById('plot-labels-overlay');
        if (labelsEl) {
          // Grab the raw HTML string
          const labelsString = labelsEl.outerHTML;
          // Swap ID to avoid conflicts in editor but allow map detection
          const injectedLabelsString = labelsString.replace('id="plot-labels-overlay"', 'id="composite-plot-labels"');
          // Safely insert right before the closing </svg> tag
          finalSvgString = content.replace(/<\/svg>\s*$/, injectedLabelsString + '\n</svg>');
        }
      } catch (err) {
        console.error('Failed to inject labels into SVG during save:', err);
      }

      const res = await fetch(`http://localhost:5000/api/cad-conversion/${conversionId}/svg`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ svg: finalSvgString }),
      });
      if (!res.ok) {
        throw new Error('Failed to save SVG');
      }
      if (projectConfig) {
        await updateCadProject(projectId, {
          labelFontSize: projectConfig.labelFontSize,
          labelFontFamily: projectConfig.labelFontFamily,
          labelFontColor: projectConfig.labelFontColor,
        });
      }
      Swal.fire({
          icon: "success",
          title: "Saved!",
          text: "Project saved successfully.",
          timer: 1500,
          showConfirmButton: false
      });
    } catch (err) {
      console.error(err);
      Swal.fire({
          icon: "error",
          title: "Save Failed",
          text: "Unable to save the project. Please try again."
      });
    } finally {
      setIsSaving(false);
    }
  };

  const saveSvgContent = async (newSvgString) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newSvgString);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setSvgContent(newSvgString);
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
      Promise.all([getCadProject(projectId), getProjectPlots(projectId), getProjectPlotStatuses(projectId)])
        .then(([proj, p, s]) => {
          setProjectConfig(proj);
          setPlots(p);
          setStatuses(s);
          
          setSvgContent(currentSvg => {
            if (!currentSvg) return currentSvg;
            const parsed = parseSvgStringToState(currentSvg);
            let changed = false;
            
            const syncShapes = (shapes) => {
              return shapes.map(shape => {
                let sChanged = false;
                let newAttrs = { ...shape.attributes };
                
                // Remove stale plot assignments
                if (newAttrs['data-plot-id']) {
                  const plotId = parseInt(newAttrs['data-plot-id']);
                  const plot = p.find(pl => pl.id === plotId && pl.cadRegionId === shape.id);
                  if (!plot) {
                    delete newAttrs['data-plot-id'];
                    delete newAttrs['fill'];
                    delete newAttrs['fill-opacity'];
                    sChanged = true;
                  }
                }
                
                // Apply DB assignments
                const matchingPlot = p.find(plot => plot.cadRegionId === shape.id);
                if (matchingPlot) {
                  if (newAttrs['data-plot-id'] !== String(matchingPlot.id)) {
                    newAttrs['data-plot-id'] = String(matchingPlot.id);
                    sChanged = true;
                  }
                  const statusColor = s.find(stat => stat.id === matchingPlot.statusId)?.fillColor;
                  
                  if (matchingPlot.metadata && matchingPlot.metadata.transform) {
                     if (newAttrs['transform'] !== matchingPlot.metadata.transform) {
                         newAttrs['transform'] = matchingPlot.metadata.transform;
                         sChanged = true;
                     }
                  }
                }
                
                let newChildren = shape.children;
                if (shape.children) {
                  const { newShapes: syncedChildren, changed: cChanged } = syncShapesDeep(shape.children);
                  if (cChanged) {
                    newChildren = syncedChildren;
                    sChanged = true;
                  }
                }
                
                if (sChanged) changed = true;
                return sChanged ? { ...shape, attributes: newAttrs, children: newChildren } : shape;
              });
            };
            
            const syncShapesDeep = (shapes) => {
               const newShapes = syncShapes(shapes);
               return { newShapes, changed };
            };
            
            const { newShapes, changed: wasChanged } = syncShapesDeep(parsed.shapes);
            if (wasChanged) {
              return serializeStateToSvgString(newShapes, parsed.viewBox);
            }
            return currentSvg;
          });
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

  const handleLayoutLineColorChange = async (color) => {
    if (!conversionId || conversionId === 'undefined') return;
    setConversion(prev => ({ ...prev, layoutLineColor: color }));
    try {
      await fetch(`http://localhost:5000/api/cad-conversion/${conversionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layoutLineColor: color })
      });
    } catch (e) {
      console.error('Failed to update line color', e);
    }
  };

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
    <div className={`${readOnly ? 'h-full' : 'h-screen'} w-full bg-[#0f1115] flex flex-col overflow-hidden text-zinc-300 font-sans select-none`}>
      {!readOnly && (
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
          showPlotStatus={showPlotStatus}
          onTogglePlotStatus={() => setInternalShowPlotStatus(!internalShowPlotStatus)}
        />
      )}

      <div className="flex-1 flex overflow-hidden relative">
        {!readOnly && (
          <CadEditorToolbar 
            activeTool={activeTool} 
            onToolChange={(tool) => {
              setActiveTool(tool);
            }} 
          />
        )}

        <div 
          className="flex-1 relative overflow-hidden bg-[#0a0a0a] cad-viewer-global-styles"
          style={{ '--layout-line-color': conversion?.layoutLineColor || '#ffffff' }}
        >
          <style>{`
            .cad-viewer-global-styles svg path:not([stroke="none"]):not([stroke="transparent"]):not([filter]),
            .cad-viewer-global-styles svg line:not([stroke="none"]):not([stroke="transparent"]):not([filter]),
            .cad-viewer-global-styles svg polyline:not([stroke="none"]):not([stroke="transparent"]):not([filter]),
            .cad-viewer-global-styles svg polygon:not([stroke="none"]):not([stroke="transparent"]):not([filter]),
            .cad-viewer-global-styles svg rect:not([stroke="none"]):not([stroke="transparent"]):not([filter]),
            .cad-viewer-global-styles svg circle:not([stroke="none"]):not([stroke="transparent"]):not([filter]),
            .cad-viewer-global-styles svg ellipse:not([stroke="none"]):not([stroke="transparent"]):not([filter]) {
              stroke: var(--layout-line-color) !important;
            }
          `}</style>
          <CadEditorCanvas
            readOnly={readOnly}
            svgContent={svgContent}
            activeTool={activeTool}
            strokeWidth={strokeWidth}
            eraserSize={eraserSize}
            fillColor={fillColor}
            fillOpacity={fillOpacity}
            plots={plots}
            statuses={statuses}
            showPlotStatus={showPlotStatus}
            onZoomChange={(pct) => { setZoomPercent(pct); if (onZoomChangeProp) onZoomChangeProp(pct); }}
            onCoordsChange={setCoords}
            onSvgModified={saveSvgContent}
            onToolChange={setActiveTool}
            masterAmenities={masterAmenities}
            placedAmenities={placedAmenities}
            setPlacedAmenities={setPlacedAmenities}
            conversionId={conversionId}
            projectId={projectId}
            projectConfig={projectConfig}
            onSelectionChange={(ids, shapes) => { 
              setSelectedShapeIds(ids); 
              setSelectedShapes(shapes); 
              if (onUserViewerSelection) {
                if (ids.length === 1 && shapes.length === 1) {
                  const shape = shapes[0];
                  const plotIdStr = shape.attributes?.['data-plot-id'];
                  if (plotIdStr) {
                    const assignedPlot = plots.find(p => p.id === parseInt(plotIdStr));
                    onUserViewerSelection(assignedPlot || null);
                  } else {
                    onUserViewerSelection(null);
                  }
                } else {
                  onUserViewerSelection(null);
                }
              }
            }}
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

        {!readOnly && (
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
            projectConfig={projectConfig}
            onProjectLabelStyleChange={(newStyles) => setProjectConfig(prev => ({ ...prev, ...newStyles }))}
            onLayoutLineColorChange={handleLayoutLineColorChange}
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
                   await updateProjectPlotAssignment(projectId, oldPlotId, { cadRegionId: null });
                   setPlots(prev => prev.map(p => p.id === oldPlotId ? { ...p, cadRegionId: null, conversionId: null } : p));
                 } catch (e) { console.error(e); }
               }
               
               // 2. Assign new plot
               if (plot) {
                 try {
                   // Try to calculate centroid via DOM
                   const element = document.getElementById(regionId);
                   let x = null, y = null, rotation = 0, scale = 1;
                   const cadObjectType = element ? element.tagName.toLowerCase() : null;
                   
                   if (element && typeof element.getBBox === 'function') {
                     const bbox = element.getBBox();
                     x = bbox.x + bbox.width / 2;
                     y = bbox.y + bbox.height / 2;
                   }
                   
                   let metadata = null;
                   if (element) {
                     const transform = element.getAttribute('transform');
                     if (transform) {
                       metadata = { transform };
                     }
                   }
                   
                   await updateProjectPlotAssignment(projectId, plot.id, { 
                     cadRegionId: regionId,
                     conversionId: conversion?.id || null,
                     cadObjectType,
                     x, y, rotation, scale, metadata
                   });
                   setPlots(prev => prev.map(p => p.id === plot.id ? { ...p, cadRegionId: regionId, conversionId: conversion?.id, x, y, metadata } : p));
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
        )}
      </div>
    </div>
  );
}
