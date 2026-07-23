'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useAlignment } from '@/hooks/useAlignment';
import AlignmentSidebar from './AlignmentSidebar';
import { useToast, ToastContainer } from '@/components/ui/Toast';

const AlignmentMap = dynamic(() => import('./AlignmentMap'), { ssr: false });

export default function AlignmentWorkspace() {
  const {
    projects,
    activeProjectId,
    setActiveProjectId,
    regions,
    alignments,
    boundaries,
    loadingProjects,
    loadingData,
    saveAlignment,
    removeAlignment
  } = useAlignment();

  const [activeRegionId, setActiveRegionId] = useState(null);
  const { toasts, removeToast, toast } = useToast();

  const handleDropRegion = (region, latLng) => {
    // Check if it already has an alignment
    const existing = alignments.find(a => a.architectureRegionId === region.id);
    
    if (existing) {
      // Update position of existing alignment
      saveAlignment({ ...existing, latitude: latLng.lat, longitude: latLng.lng })
        .then(() => {
          setActiveRegionId(region.id);
          toast.success('Region position updated.');
        })
        .catch(err => {
          toast.error('Failed to update region: ' + err.message);
        });
      return;
    }

    // Default physical size (e.g. 500 meters width)
    const initialWidth = 500;
    const initialHeight = (region.height / region.width) * initialWidth;

    const newAlignment = {
      architectureRegionId: region.id,
      latitude: latLng.lat,
      longitude: latLng.lng,
      width: initialWidth,
      height: initialHeight,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      architectureRegion: region
    };

    saveAlignment(newAlignment)
      .then(res => {
        setActiveRegionId(region.id);
        toast.success('Region added to map.');
      })
      .catch(err => {
        toast.error('Failed to add region: ' + err.message);
      });
  };

  const handleSaveAlignment = (alignment) => {
    saveAlignment(alignment)
      .then(() => toast.success('Alignment saved!'))
      .catch(err => toast.error('Failed to save alignment'));
  };

  const handleDeleteAlignment = (id) => {
    removeAlignment(id)
      .then(() => {
        setActiveRegionId(null);
        toast.success('Alignment deleted.');
      })
      .catch(err => toast.error('Failed to delete alignment'));
  };

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden">
      {/* Top Navbar */}
      <header className="h-12 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-4 shrink-0 z-50 shadow-md">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-zinc-400 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </Link>
          <div className="w-px h-5 bg-zinc-800"/>
          <h1 className="text-sm font-semibold text-zinc-100 uppercase tracking-widest flex items-center gap-2">
            Architecture Map Alignment
          </h1>
        </div>
        
        {/* Project Tabs */}
        <div className="flex flex-1 mx-8 overflow-x-auto scrollbar-hide gap-1">
          {loadingProjects ? (
            <span className="text-xs text-zinc-500">Loading projects...</span>
          ) : projects.length === 0 ? (
            <span className="text-xs text-zinc-500">No active projects found.</span>
          ) : (
            projects.map(p => (
              <button
                key={p.id}
                onClick={() => setActiveProjectId(p.id)}
                className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap
                  ${activeProjectId === p.id 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-zinc-800/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
              >
                {p.name}
              </button>
            ))
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden relative">
        <AlignmentSidebar 
          regions={regions} 
          alignments={alignments} 
          loading={loadingData}
        />
        
        <div className="flex-1 relative z-10">
          <AlignmentMap 
            alignments={alignments}
            boundaries={boundaries}
            activeRegionId={activeRegionId}
            setActiveRegionId={setActiveRegionId}
            onDropRegion={handleDropRegion}
            onSaveAlignment={handleSaveAlignment}
            onDeleteAlignment={handleDeleteAlignment}
          />
        </div>
      </div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
