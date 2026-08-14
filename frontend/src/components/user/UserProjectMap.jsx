'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { getCadProject, getProjectBoundaries, getCadConversions, getProjectPlots, getProjectPlotStatuses, getProjectAppearanceSettings } from '@/lib/api';
import UserProjectLoading from './UserProjectLoading';
import UserViewerToolbar from './UserViewerToolbar';
import Link from 'next/link';

const LeafletMap = dynamic(() => import('@/components/map/LeafletMap'), { ssr: false });

export default function UserProjectMap({ projectId }) {
  const [project, setProject] = useState(null);
  const [boundaries, setBoundaries] = useState([]);
  const [activeConversion, setActiveConversion] = useState(null);
  const [plots, setPlots] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [appearanceSettings, setAppearanceSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const mapRef = useRef(null);
  const [currentZoom, setCurrentZoom] = useState(1); // Standardized to 1 for toolbar display, Leaflet zoom is handled natively
  const [showPlotStatus, setShowPlotStatus] = useState(false);
  const [selectedPlotId, setSelectedPlotId] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [projectData, boundsData, conversionsData, plotsData, statusesData, appearanceData] = await Promise.all([
          getCadProject(projectId),
          getProjectBoundaries(projectId),
          getCadConversions(projectId),
          getProjectPlots(projectId, { pagination: false }),
          getProjectPlotStatuses(projectId, { pagination: false }),
          getProjectAppearanceSettings(projectId).catch(() => null)
        ]);
        
        setProject(projectData);
        if (plotsData) setPlots(plotsData);
        if (statusesData) setStatuses(statusesData);
        if (appearanceData) setAppearanceSettings(appearanceData);
        
        if (boundsData && boundsData.length > 0) {
          const parsedBounds = boundsData.map(b => {
            let geo = b.geoJson;
            if (typeof geo === 'string') {
              try { geo = JSON.parse(geo); } catch (e) {}
            }
            return { ...b, geometry: geo };
          });
          setBoundaries(parsedBounds);
        }

        if (conversionsData && conversionsData.length > 0) {
          const activeConversion = conversionsData.find(c => c.isActive);
          setActiveConversion(activeConversion || null);
        }
      } catch (err) {
        console.error('Failed to fetch map details:', err);
        setError('Failed to load map details. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    
    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  const zoomIn = () => {
    if (mapRef.current?.map) {
      mapRef.current.map.zoomIn();
    }
  };

  const zoomOut = () => {
    if (mapRef.current?.map) {
      mapRef.current.map.zoomOut();
    }
  };

  const centerView = () => {
    if (mapRef.current?.fitToBounds) {
      mapRef.current.fitToBounds();
    }
  };

  const resetTransform = () => {
    if (mapRef.current?.fitToBounds) {
      mapRef.current.fitToBounds();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <UserProjectLoading />
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] text-slate-200 flex flex-col items-center justify-center p-8">
        <h2 className="text-2xl font-bold mb-4">Project Not Found</h2>
        <p className="text-slate-400 mb-8">{error || "The project you're looking for doesn't exist or is unavailable."}</p>
        <Link href="/projects" className="px-6 py-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors">
          Back to Projects
        </Link>
      </div>
    );
  }

  const layouts = activeConversion ? [activeConversion] : [];

  return (
    <div className="h-screen flex flex-col bg-[#0B0B0B] overflow-hidden relative">
      <UserViewerToolbar 
        project={project} 
        layoutName={activeConversion?.originalFileName} 
        zoomIn={zoomIn} 
        zoomOut={zoomOut} 
        resetTransform={resetTransform} 
        centerView={centerView}
        currentZoom={currentZoom}
        isMapView={true}
        showPlotStatus={showPlotStatus}
        onTogglePlotStatus={() => setShowPlotStatus(!showPlotStatus)}
      />

        <div className="flex-1 w-full h-full">
        {boundaries.length > 0 ? (
          <LeafletMap
            ref={mapRef}
            mapType="hybrid"
            drawMode={null} 
            drawingBoundary={false}
            boundaries={boundaries}
            activeBoundaryId={null}
            initialBounds={boundaries[0]?.latMin ? [[boundaries[0].latMin, boundaries[0].lngMin], [boundaries[0].latMax, boundaries[0].lngMax]] : null}
            staticPreview={true}
            layouts={activeConversion ? [activeConversion] : []}
            plots={plots}
            statuses={statuses}
            showPlotStatus={showPlotStatus}
            projectConfig={project}
            selectedPlotId={selectedPlotId}
            onPlotSelect={setSelectedPlotId}
            appearanceSettings={appearanceSettings}
            className="w-full h-full"
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center h-full">
            <h2 className="text-2xl font-bold text-slate-200 mb-4">No Map Data Available</h2>
            <p className="text-slate-400 max-w-md text-center mb-8">
              This project does not have geographic boundaries set up yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
