'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { MapPin, ArrowLeft, Save, Trash2, Undo, Redo, Maximize, MousePointer2, Hexagon, Loader2, Edit2, Layers, Eye, EyeOff } from 'lucide-react';
import area from '@turf/area';
import { polygon as turfPolygon } from '@turf/helpers';
import { getProjectBoundaries, createProjectBoundary, updateProjectBoundary, deleteProjectBoundary, getCadConversions, updateCadConversion, getProjectPlots, getCadProject } from '@/lib/api';
import Swal from 'sweetalert2';

const LeafletMap = dynamic(() => import('@/components/map/LeafletMap'), { ssr: false });
import { BOUNDARY_DRAW_MODE } from '@/components/map/constants';

export default function ProjectBoundaryWorkspace({ projectId }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [boundary, setBoundary] = useState(null); // the single boundary object
  const [drawMode, setDrawMode] = useState(BOUNDARY_DRAW_MODE.POINTER);
  const [mapType, setMapType] = useState('hybrid');
  const [boundaryVisible, setBoundaryVisible] = useState(true);
  
  // History for Undo/Redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const mapRef = useRef(null);

  const pushHistory = useCallback((geoJson) => {
    setHistory(prev => {
      // Use the functional state of setHistoryIndex inside the history update
      // by keeping them perfectly in sync without reading the state from closure.
      let currentIndex;
      setHistoryIndex(prevIdx => {
        currentIndex = prevIdx;
        return prevIdx + 1;
      });
      const newHistory = prev.slice(0, currentIndex + 1);
      newHistory.push(geoJson);
      return newHistory;
    });
  }, []);


  const [layouts, setLayouts] = useState([]);
  const [plots, setPlots] = useState([]);
  const [projectConfig, setProjectConfig] = useState(null);
  useEffect(() => {
    if (projectId) {
      // Fetch boundaries and conversions independently so one failure
      // doesn't block the other (Promise.all rejects if either fails).
      getProjectBoundaries(projectId)
        .then((boundaries) => {
          if (boundaries && boundaries.length > 0) {
            const b = boundaries[0];
            if (typeof b.geoJson === 'string') {
              try {
                b.geoJson = JSON.parse(b.geoJson);
              } catch (e) {
                console.error("Failed to parse geoJson", e);
              }
            }
            setBoundary(b);
            pushHistory(b.geoJson);
            setDrawMode(BOUNDARY_DRAW_MODE.EDIT); // default to edit mode if boundary exists
          }
        })
        .catch((err) => console.error("Failed to load boundaries:", err))
        .finally(() => setLoading(false));

      getCadConversions(projectId)
        .then((conversions) => {
          if (conversions) {
            // Only show successfully processed conversions
            setLayouts(conversions.filter(c => c.status === 'SUCCESS'));
          }
        })
        .catch((err) => console.error("Failed to load CAD conversions:", err));
        
      getProjectPlots(projectId, { pagination: false })
        .then((data) => setPlots(data || []))
        .catch((err) => console.error("Failed to load plots:", err));

      getCadProject(projectId)
        .then((data) => setProjectConfig(data || null))
        .catch((err) => console.error("Failed to load project config:", err));
    }
  }, [projectId, pushHistory]);



  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      updateBoundaryGeometry(history[newIndex], false);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      updateBoundaryGeometry(history[newIndex], false);
    }
  };

  const updateBoundaryGeometry = (geoJson, saveToHistory = true) => {
    if (saveToHistory) {
      pushHistory(geoJson);
    }
    setBoundary(prev => {
      const updated = prev ? { ...prev, geoJson } : { 
        name: 'Project Boundary', 
        geoJson, 
        color: '#10b981' // emerald color for land boundary
      };
      return updated;
    });
  };

  const onDrawComplete = (geo, mode) => {
    if (mode === BOUNDARY_DRAW_MODE.POLYGON) {
      updateBoundaryGeometry(geo);
      setDrawMode(BOUNDARY_DRAW_MODE.EDIT); // switch to edit mode immediately
    }
  };

  const onMoveComplete = (id, geoGeoJson) => {
    updateBoundaryGeometry(geoGeoJson);
  };
  const handleLayoutDrop = useCallback(async (layout, latlng) => {
    try {
      const updates = { mapLatitude: latlng.lat, mapLongitude: latlng.lng };
      await updateCadConversion(layout.id, updates);
      setLayouts(prev => prev.map(l => l.id === layout.id ? { ...l, ...updates } : l));
    } catch (err) {
      console.error("Failed to place layout", err);
    }
  }, []);

  const handleLayoutUpdate = useCallback(async (id, updates) => {
    try {
      setLayouts(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
      await updateCadConversion(id, updates);
    } catch (err) {
      console.error("Failed to update layout placement", err);
    }
  }, []);

  const handleRemoveLayout = async (id) => {
    const result = await Swal.fire({
      title: 'Remove Layout?',
      text: 'Remove this layout from the map?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#3f3f46',
      confirmButtonText: 'Yes, Remove',
      background: '#18181b',
      color: '#fff'
    });

    if (result.isConfirmed) {
      try {
        const updates = { mapLatitude: null, mapLongitude: null, mapScale: 1, mapRotation: 0 };
        setLayouts(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
        await updateCadConversion(id, updates);
        Swal.fire({ title: 'Removed!', text: 'Layout has been removed from the map.', icon: 'success', background: '#18181b', color: '#fff', timer: 1500, showConfirmButton: false });
      } catch (err) {
        console.error("Failed to remove layout placement", err);
        Swal.fire({ title: 'Error', text: 'Failed to remove layout placement', icon: 'error', background: '#18181b', color: '#fff' });
      }
    }
  };

  const handleSave = async () => {
    if (!boundary || !boundary.geoJson) return;
    setSaving(true);
    
    // Calculate stats
    const coords = boundary.geoJson.geometry.coordinates[0];
    const pointCount = coords.length - 1; // minus closing point
    let latMin = Infinity, latMax = -Infinity, lngMin = Infinity, lngMax = -Infinity;
    
    coords.forEach(([lng, lat]) => {
      if (lat < latMin) latMin = lat;
      if (lat > latMax) latMax = lat;
      if (lng < lngMin) lngMin = lng;
      if (lng > lngMax) lngMax = lng;
    });

    // Area calculation using turf
    let calculatedArea = 0;
    try {
      const poly = turfPolygon(boundary.geoJson.geometry.coordinates);
      calculatedArea = area(poly);
    } catch(e) {
      console.error("Area calculation failed", e);
    }

    const payload = {
      name: boundary.name || 'Project Boundary',
      geoJson: JSON.stringify(boundary.geoJson),
      area: calculatedArea,
      pointCount,
      latMin, latMax, lngMin, lngMax
    };

    try {
      if (boundary.id) {
        await updateProjectBoundary(boundary.id, payload);
      } else {
        const created = await createProjectBoundary(projectId, payload);
        setBoundary(prev => ({ ...prev, id: created.id }));
      }
    } catch (err) {
      console.error('Failed to save boundary', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (boundary?.id) {
      const result = await Swal.fire({
        title: 'Delete Boundary?',
        text: 'Are you sure you want to delete this boundary?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#3f3f46',
        confirmButtonText: 'Yes, Delete',
        background: '#18181b',
        color: '#fff'
      });
      if (!result.isConfirmed) return;
      
      setSaving(true);
      try {
        await deleteProjectBoundary(boundary.id);
        setBoundary(null);
        setHistory([]);
        setHistoryIndex(-1);
        setDrawMode(BOUNDARY_DRAW_MODE.POINTER);
        Swal.fire({ title: 'Deleted!', text: 'Boundary has been deleted.', icon: 'success', background: '#18181b', color: '#fff', timer: 1500, showConfirmButton: false });
      } catch (err) {
        console.error('Failed to delete boundary', err);
        Swal.fire({ title: 'Error', text: 'Failed to delete boundary', icon: 'error', background: '#18181b', color: '#fff' });
      } finally {
        setSaving(false);
      }
    } else {
      setBoundary(null);
      setHistory([]);
      setHistoryIndex(-1);
      setDrawMode(BOUNDARY_DRAW_MODE.POINTER);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <Loader2 className="animate-spin mr-2" /> Loading workspace...
      </div>
    );
  }

  // Formatting sidebar stats
  let displayArea = '0';
  let pointCount = 0;
  let latRange = '-';
  let lngRange = '-';

  if (boundary && boundary.geoJson) {
    try {
      const poly = turfPolygon(boundary.geoJson.geometry.coordinates);
      const m2 = area(poly);
      if (m2 > 10000) {
        displayArea = (m2 / 10000).toFixed(2) + ' Hectares';
      } else {
        displayArea = m2.toFixed(2) + ' sq m';
      }
    } catch(e) {}

    const coords = boundary.geoJson.geometry.coordinates[0];
    pointCount = coords.length - 1;
    let lats = coords.map(c => c[1]);
    let lngs = coords.map(c => c[0]);
    latRange = `${Math.min(...lats).toFixed(4)} to ${Math.max(...lats).toFixed(4)}`;
    lngRange = `${Math.min(...lngs).toFixed(4)} to ${Math.max(...lngs).toFixed(4)}`;
  }

  // Pass boundaries as array for LeafletMap
  const mapBoundaries = boundary ? [{
    id: boundary.id || 999, // dummy ID if unsaved
    name: boundary.name || 'Boundary',
    color: '#10b981',
    visible: boundaryVisible,
    geometry: boundary.geoJson
  }] : [];

  const activeId = boundary ? (boundary.id || 999) : null;

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden text-zinc-300">
      {/* Top Navbar */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-6 shrink-0 z-50 shadow-md">
        <div className="flex items-center gap-6">
          <Link 
            href={`/cad-conversion/${projectId}`} 
            className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>
          <div className="w-px h-6 bg-zinc-800"/>
          <h1 className="text-sm font-semibold text-zinc-100 uppercase tracking-widest flex items-center gap-2">
            <MapPin size={16} className="text-emerald-400" />
            Project Land Boundary
          </h1>
        </div>

        <div className="flex items-center gap-2 bg-zinc-900 rounded-md p-1 border border-zinc-800">
          <button 
            className={`p-2 rounded ${!boundaryVisible ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
            onClick={() => setBoundaryVisible(!boundaryVisible)}
            title={boundaryVisible ? "Hide Boundary" : "Show Boundary"}
          >
            {boundaryVisible ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <div className="w-px h-4 bg-zinc-700 mx-1" />
          <button 
            className={`p-2 rounded ${drawMode === BOUNDARY_DRAW_MODE.POINTER ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
            onClick={() => setDrawMode(BOUNDARY_DRAW_MODE.POINTER)}
            title="Pointer Tool"
          >
            <MousePointer2 size={16} />
          </button>
          <button 
            className={`p-2 rounded ${drawMode === BOUNDARY_DRAW_MODE.POLYGON ? 'bg-emerald-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
            onClick={async () => {
              if (boundary) {
                const result = await Swal.fire({
                  title: 'Draw New Polygon?',
                  text: 'Drawing a new polygon will discard the current boundary. Continue?',
                  icon: 'warning',
                  showCancelButton: true,
                  confirmButtonColor: '#10b981',
                  cancelButtonColor: '#3f3f46',
                  confirmButtonText: 'Yes, Continue',
                  background: '#18181b',
                  color: '#fff'
                });
                if (result.isConfirmed) {
                  setBoundary(null);
                  setDrawMode(BOUNDARY_DRAW_MODE.POLYGON);
                }
              } else {
                setDrawMode(BOUNDARY_DRAW_MODE.POLYGON);
              }
            }}
            title="Draw Polygon Boundary"
          >
            <Hexagon size={16} />
          </button>
          <button 
            className={`p-2 rounded ${drawMode === BOUNDARY_DRAW_MODE.EDIT ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}
            onClick={() => {
              if (boundary) setDrawMode(BOUNDARY_DRAW_MODE.EDIT);
            }}
            disabled={!boundary}
            title="Edit Boundary Vertices"
          >
            <Edit2 size={16} />
          </button>
          <div className="w-px h-4 bg-zinc-700 mx-1" />
          <button 
            className="p-2 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30"
            onClick={handleUndo} disabled={historyIndex <= 0} title="Undo"
          >
            <Undo size={16} />
          </button>
          <button 
            className="p-2 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30"
            onClick={handleRedo} disabled={historyIndex >= history.length - 1} title="Redo"
          >
            <Redo size={16} />
          </button>
          <div className="w-px h-4 bg-zinc-700 mx-1" />
          <button 
            className="p-2 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
            onClick={() => mapRef.current?.fitToBounds()} title="Fit to Boundary"
          >
            <Maximize size={16} />
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 relative flex">
        
        {/* Sidebar */}
        <div className="w-80 bg-zinc-950 border-r border-zinc-800 flex flex-col z-[1000]">
          <div className="p-5 border-b border-zinc-800 bg-zinc-900/50">
            <h2 className="text-sm font-semibold text-white mb-1">CAD Layouts</h2>
            <p className="text-xs text-zinc-400">Drag a layout onto the map to place it.</p>
          </div>
          
          <div className="p-4 flex-1 flex flex-col gap-3 overflow-y-auto">
            {layouts.length === 0 ? (
              <p className="text-xs text-zinc-500 text-center py-4">No processed CAD files available.</p>
            ) : (
              layouts.map(layout => (
                <div 
                  key={layout.id} 
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify(layout));
                  }}
                  className="bg-zinc-900 border border-zinc-800 p-3 rounded cursor-grab active:cursor-grabbing hover:border-indigo-500/50 transition-colors"
                >
                  <p className="text-sm font-medium text-zinc-200 truncate" title={layout.originalFileName}>
                    {layout.originalFileName}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    {layout.mapLatitude ? (
                      <>
                        <span className="text-[10px] text-emerald-500 uppercase tracking-wider block">Placed on map</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleRemoveLayout(layout.id); }}
                          className="text-[10px] text-zinc-400 hover:text-red-400 uppercase tracking-wider transition-colors"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Not placed</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          
          {boundary && (
            <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex flex-col gap-3">
              <button 
                disabled={saving || historyIndex <= 0}
                onClick={handleSave}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Saving...' : 'Save Boundary'}
              </button>
              
              <button 
                onClick={handleDelete}
                className="w-full py-2 bg-transparent border border-red-900/50 hover:bg-red-950/30 text-red-400 text-sm font-medium rounded transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
                Delete Boundary
              </button>
            </div>
          )}
        </div>

        {/* Map Container */}
        <div className="flex-1 relative z-0 bg-[#0a0a0a]">
          {/* Map Layer Controls */}
          <div className="absolute top-4 right-4 z-[1000]">
            <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-700 rounded-lg shadow-2xl p-2 flex items-center gap-1">
              <Layers size={16} className="text-zinc-500 ml-2 mr-1" />
              <div className="flex bg-zinc-950 rounded-md overflow-hidden p-1 gap-1">
                {['satellite', 'hybrid', 'street'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setMapType(type)}
                    className={`text-xs font-medium px-3 py-1.5 rounded transition-colors capitalize ${
                      mapType === type 
                        ? 'bg-zinc-800 text-white' 
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {!loading ? (
            <LeafletMap
              ref={mapRef}
              mapType={mapType}
              drawMode={drawMode}
              drawingBoundary={drawMode === BOUNDARY_DRAW_MODE.POLYGON || drawMode === BOUNDARY_DRAW_MODE.EDIT}
              boundaries={mapBoundaries}
              activeBoundaryId={activeId}
              currentColor="#10b981"
              onDrawComplete={onDrawComplete}
              onSelectBoundary={() => {}}
              onMoveComplete={onMoveComplete}
              initialBounds={boundary?.latMin ? [[boundary.latMin, boundary.lngMin], [boundary.latMax, boundary.lngMax]] : null}
              layouts={layouts}
              plots={plots}
              projectConfig={projectConfig}
              onLayoutDrop={handleLayoutDrop}
              onLayoutUpdate={handleLayoutUpdate}
              className="w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 bg-zinc-950">
              <Loader2 className="animate-spin mb-4" size={32} />
              <p className="text-sm font-medium">Loading map boundary...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
