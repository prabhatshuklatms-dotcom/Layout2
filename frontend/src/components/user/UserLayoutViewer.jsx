'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import UserViewerToolbar from './UserViewerToolbar';

const CadEditorWorkspace = dynamic(() => import('@/components/cad-conversion/editor/CadEditorWorkspace'), { ssr: false });

export default function UserLayoutViewer({ project, conversion }) {
  const [showPlotStatus, setShowPlotStatus] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const centerView = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('editor-fit-screen'));
    }
  };

  const zoomIn = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('editor-zoom-in'));
    }
  };

  const zoomOut = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('editor-zoom-out'));
    }
  };

  return (
    <div className="flex-1 relative bg-[#0B0B0B] overflow-hidden flex flex-col">
      <div className="z-10 relative">
        <UserViewerToolbar 
          project={project} 
          layoutName={conversion?.originalFileName} 
          zoomIn={zoomIn} 
          zoomOut={zoomOut} 
          resetTransform={centerView} 
          centerView={centerView}
          currentZoom={1}
          isMapView={false}
          showPlotStatus={showPlotStatus}
          onTogglePlotStatus={() => setShowPlotStatus(!showPlotStatus)}
        />
      </div>
      
      <div className="flex-1 relative w-full h-full">
        <div className="absolute inset-0 z-0">
          <CadEditorWorkspace 
            conversionId={conversion.id} 
            projectId={project.id} 
            readOnly={true} 
            showPlotStatus={showPlotStatus}
            onUserViewerSelection={(plot) => {
              setSelectedPlot(plot);
              if (!plot) {
                setIsDrawerOpen(false);
              }
            }}
          />
        </div>

      </div>
    </div>
  );
}
