'use client';

import React, { useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize, RotateCcw, Share2, Map as MapIcon, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { getProjectPlotStatuses } from '@/lib/api';

export default function UserViewerToolbar({ 
  project, 
  layoutName, 
  zoomIn, 
  zoomOut, 
  resetTransform, 
  centerView,
  currentZoom = 1,
  isMapView = false,
  showPlotStatus = false,
  onTogglePlotStatus
}) {
  
  const handleShare = async () => {
    const url = window.location.href;
    const title = project?.name || 'Project Layout';
    const text = `Check out the layout for ${title}`;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return; // Success handled by native UI
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Share failed:', err);
        } else {
          return; // User cancelled
        }
      }
    }

    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(url);
      Swal.fire({
        title: 'Success!',
        text: 'Project link copied successfully.',
        icon: 'success',
        confirmButtonColor: '#3b82f6',
        background: '#18181b',
        color: '#e4e4e7'
      });
    } catch (err) {
      Swal.fire({
        title: 'Error',
        text: 'Unable to share project.',
        icon: 'error',
        confirmButtonColor: '#ef4444',
        background: '#18181b',
        color: '#e4e4e7'
      });
    }
  };


  const [plotStatuses, setPlotStatuses] = useState([]);

  useEffect(() => {
    if (project?.id) {
      getProjectPlotStatuses(project.id, { pagination: false })
        .then(data => {
          if (data && Array.isArray(data)) {
            setPlotStatuses(data);
          }
        })
        .catch(err => console.error('Failed to load plot statuses:', err));
    }
  }, [project?.id]);

  const zoomPercent = Math.round(currentZoom * 100);

  return (
    <div className="absolute top-0 left-0 w-full z-[1000] pointer-events-none p-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 max-w-7xl mx-auto">
        
        {/* Left Side: spacer to keep center/right aligned */}
        <div className="flex-1"></div>

        {/* Center: Zoom Controls */}
        <div className="flex items-center gap-1 bg-zinc-900/80 backdrop-blur-md shadow-lg border border-zinc-700/50 rounded-xl p-1.5 pointer-events-auto">
          <button
            onClick={() => zoomOut()}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          
          <div className="w-16 text-center text-xs font-semibold text-zinc-300">
            {zoomPercent}%
          </div>

          <button
            onClick={() => zoomIn()}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="h-5 w-px bg-zinc-700 mx-1"></div>

          <button
            onClick={() => centerView()}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
            title="Fit to Screen"
          >
            <Maximize className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => resetTransform()}
            className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
            title="Reset Zoom"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Right Side: Actions & Status */}
        <div className="flex items-center gap-3 bg-zinc-900/80 backdrop-blur-md shadow-lg border border-zinc-700/50 rounded-xl p-2 pointer-events-auto">
          
          <div className="relative flex items-center gap-2 px-2">
            <span className="text-xs font-medium text-zinc-300 tracking-wide">
              PLOT STATUS
            </span>
            <button 
              onClick={onTogglePlotStatus}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${showPlotStatus ? 'bg-indigo-500' : 'bg-zinc-700'}`}
              aria-label="Toggle plot status"
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${showPlotStatus ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>

            {/* Floating Legend Panel */}
            {showPlotStatus && plotStatuses.length > 0 && (
              <div className="absolute top-full right-0 mt-3 bg-zinc-900/90 backdrop-blur-md shadow-2xl border border-zinc-700/50 rounded-xl p-3 min-w-[160px] max-h-[300px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2.5 px-1">Legend</h3>
                <div className="flex flex-col gap-2.5">
                  {plotStatuses.map(status => (
                    <div key={status.id} className="flex items-center gap-2.5 px-1">
                      <span 
                        className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm" 
                        style={{ backgroundColor: status.fillColor || '#888' }}
                      />
                      <span className="text-xs text-zinc-200 font-medium tracking-wide">{status.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>



          <div className="h-6 w-px bg-zinc-700 mx-1"></div>

          <button
            onClick={handleShare}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
            title="Share Project"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Share</span>
          </button>

          <Link
            href={`/projects/${project?.id}${isMapView ? '' : '/map'}`}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium shadow-md shadow-indigo-900/20"
          >
            {isMapView ? (
              <>
                <ImageIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Layout View</span>
              </>
            ) : (
              <>
                <MapIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Map View</span>
              </>
            )}
          </Link>

        </div>

      </div>
    </div>
  );
}
