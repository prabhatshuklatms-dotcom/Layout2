'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getCadProject } from '@/lib/api';
import UploadPanel from './UploadPanel';
import ConversionQueue from './ConversionQueue';
import SvgPreview from './SvgPreview';
import ConversionConsole from './ConversionConsole';

import ProjectMap from './ProjectMap';

export default function CadConversionStudio({ projectId }) {
  const [project, setProject] = useState(null);
  const [conversions, setConversions] = useState([]);
  const [selectedConversionId, setSelectedConversionId] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (projectId) {
      getCadProject(projectId).then(setProject).catch(console.error);
    }
  }, [projectId]);

  const addLog = useCallback((message, type = 'info') => {
    setLogs(prev => [...prev, { time: new Date(), message, type }]);
  }, []);

  const fetchConversions = useCallback(async () => {
    try {
      const url = projectId ? `http://localhost:5000/api/cad-conversion?projectId=${projectId}` : 'http://localhost:5000/api/cad-conversion';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setConversions(data);
      }
    } catch (error) {
      // Silently ignore fetch errors during polling so Next.js overlay doesn't pop up
    }
  }, []);

  useEffect(() => {
    fetchConversions();
    // Poll for updates if any conversion is pending/processing
    const interval = setInterval(() => {
      fetchConversions();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchConversions]);

  const selectedConversion = conversions.find(c => c.id === selectedConversionId) || null;

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/cad-conversion/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setConversions(prev => prev.filter(c => c.id !== id));
        if (selectedConversionId === id) setSelectedConversionId(null);
        addLog(`Conversion ${id} deleted`, 'info');
      }
    } catch (err) {
      addLog(`Failed to delete: ${err}`, 'error');
    }
  };

  const handleUpdate = async (id, newName) => {
    try {
      const res = await fetch(`http://localhost:5000/api/cad-conversion/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalFileName: newName })
      });
      if (res.ok) {
        const updated = await res.json();
        setConversions(prev => prev.map(c => c.id === id ? { ...c, originalFileName: updated.originalFileName } : c));
        addLog(`Conversion ${id} renamed to ${newName}`, 'info');
      }
    } catch (err) {
      addLog(`Failed to update: ${err}`, 'error');
    }
  };

  const handleReupload = async (id, file) => {
    try {
      addLog(`Uploading new file for conversion ${id}...`, 'info');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`http://localhost:5000/api/cad-conversion/${id}/upload`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        addLog(`File successfully re-uploaded and queued for conversion ${id}`, 'info');
        fetchConversions();
      } else {
        addLog(`Failed to re-upload for conversion ${id}`, 'error');
      }
    } catch (err) {
      addLog(`Error re-uploading: ${err}`, 'error');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden text-zinc-300">
      {/* Top Navbar */}
      <header className="h-12 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-4 shrink-0 z-50 shadow-md">
        <div className="flex items-center gap-4">
          <Link href="/cad-conversion" className="text-zinc-400 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </Link>
          <div className="w-px h-5 bg-zinc-800"/>
          <h1 className="text-sm font-semibold text-zinc-100 uppercase tracking-widest flex items-center gap-2">
            {project ? project.name : 'CAD CONVERSION'}
          </h1>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar */}
        <div className="w-80 bg-zinc-950 border-r border-zinc-800 flex flex-col shrink-0 z-20">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Upload CAD</h2>
            <UploadPanel projectId={projectId} onUploadStart={() => {
              addLog('Upload initiated', 'info');
              fetchConversions();
            }} onUploadError={(err) => {
              addLog(`Upload failed: ${err}`, 'error');
            }} />
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <ConversionQueue 
              conversions={conversions} 
              selectedId={selectedConversionId}
              onSelect={setSelectedConversionId}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
              onReupload={handleReupload}
            />
          </div>
        </div>
        
        {/* Center Workspace */}
        <div className="flex-1 relative bg-zinc-900 flex flex-row min-w-0">
          
          {/* Main Editor Column */}
          <div className="flex-1 flex flex-col p-6 min-w-0 pr-3">
             {/* Canvas Container */}
             <div className="flex-1 relative rounded-xl border border-zinc-800 overflow-hidden bg-[#0f1115] shadow-2xl mb-4">
                <SvgPreview conversion={selectedConversion} />
             </div>
             
             {/* Console Container */}
             <div className="h-32 border border-zinc-800 rounded-lg bg-zinc-950/95 backdrop-blur shadow-2xl shrink-0 overflow-hidden">
               <ConversionConsole logs={logs} selectedConversion={selectedConversion} />
             </div>
          </div>

          {/* Project Map Column */}
          <div className="w-[400px] xl:w-[500px] 2xl:w-[600px] shrink-0 p-6 pl-3 flex flex-col">
            <ProjectMap project={project} onUpdateProject={setProject} />
          </div>
        </div>

      </div>
    </div>
  );
}
