'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getCadProject } from '@/lib/api';
import UploadPanel from './UploadPanel';
import ConversionQueue from './ConversionQueue';
import SvgPreview from './SvgPreview';
import ConversionConsole from './ConversionConsole';
import ProjectMap from './ProjectMap';
import { UploadCloud, List, Image, MapPin, ChevronLeft, ChevronRight, X, Menu } from 'lucide-react';

// ── Mobile tab IDs ──────────────────────────────────────────────────────────
const TABS = {
  QUEUE: 'queue',
  PREVIEW: 'preview',
  MAP: 'map',
};

export default function CadConversionStudio({ projectId }) {
  const [project, setProject] = useState(null);
  const [conversions, setConversions] = useState([]);
  const [selectedConversionId, setSelectedConversionId] = useState(null);
  const [logs, setLogs] = useState([]);

  // Responsive state
  const [sidebarOpen, setSidebarOpen] = useState(false);   // mobile drawer
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false); // desktop collapse
  const [activeTab, setActiveTab] = useState(TABS.PREVIEW); // mobile/tablet active tab
  const [showConsole, setShowConsole] = useState(true);

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
      const url = projectId
        ? `http://localhost:5000/api/cad-conversion?projectId=${projectId}`
        : 'http://localhost:5000/api/cad-conversion';
      const res = await fetch(url);
      if (res.ok) setConversions(await res.json());
    } catch (_) {}
  }, [projectId]);

  useEffect(() => {
    fetchConversions();
    const interval = setInterval(fetchConversions, 3000);
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
    } catch (err) { addLog(`Failed to delete: ${err}`, 'error'); }
  };

  const handleUpdate = async (id, newName) => {
    try {
      const res = await fetch(`http://localhost:5000/api/cad-conversion/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalFileName: newName }),
      });
      if (res.ok) {
        const updated = await res.json();
        setConversions(prev => prev.map(c => c.id === id ? { ...c, originalFileName: updated.originalFileName } : c));
        addLog(`Conversion ${id} renamed to ${newName}`, 'info');
      }
    } catch (err) { addLog(`Failed to update: ${err}`, 'error'); }
  };

  const handleReupload = async (id, file) => {
    try {
      addLog(`Uploading new file for conversion ${id}...`, 'info');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`http://localhost:5000/api/cad-conversion/${id}/upload`, {
        method: 'POST', body: formData,
      });
      if (res.ok) {
        addLog(`File successfully re-uploaded and queued for conversion ${id}`, 'info');
        fetchConversions();
      } else {
        addLog(`Failed to re-upload for conversion ${id}`, 'error');
      }
    } catch (err) { addLog(`Error re-uploading: ${err}`, 'error'); }
  };

  // ── Sidebar content (shared between drawer + desktop panel) ────────────────
  const SidebarContent = () => (
    <>
      <div className="p-4 border-b border-zinc-800">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Upload CAD</h2>
        <UploadPanel
          projectId={projectId}
          onUploadStart={() => { addLog('Upload initiated', 'info'); fetchConversions(); }}
          onUploadError={(err) => addLog(`Upload failed: ${err}`, 'error')}
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        <ConversionQueue
          conversions={conversions}
          selectedId={selectedConversionId}
          onSelect={(id) => {
            setSelectedConversionId(id);
            setSidebarOpen(false);    // close drawer on selection (mobile)
            setActiveTab(TABS.PREVIEW); // jump to preview tab (mobile)
          }}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          onReupload={handleReupload}
        />
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden text-zinc-300">

      {/* ── Top Navbar ──────────────────────────────────────────────────────── */}
      <header className="h-12 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-4 shrink-0 z-50 shadow-md">
        <div className="flex items-center gap-3">
          {/* Hamburger — visible on mobile/tablet only */}
          <button
            className="xl:hidden text-zinc-400 hover:text-white p-1 -ml-1 rounded"
            onClick={() => setSidebarOpen(v => !v)}
            aria-label="Toggle sidebar"
          >
            <Menu size={20} />
          </button>

          <Link href="/cad-conversion" className="text-zinc-400 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </Link>
          <div className="w-px h-5 bg-zinc-800"/>
          <h1 className="text-sm font-semibold text-zinc-100 uppercase tracking-widest truncate max-w-[180px] sm:max-w-xs">
            {project ? project.name : 'CAD CONVERSION'}
          </h1>
        </div>

        {/* Selected file name pill — tablet+ */}
        {selectedConversion && (
          <span className="hidden sm:inline-block text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1 truncate max-w-[220px]">
            {selectedConversion.originalFileName}
          </span>
        )}
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* ── Mobile/Tablet Drawer Overlay ─────────────────────────────────── */}
        {sidebarOpen && (
          <div
            className="xl:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
        {/* On mobile/tablet: slide-in drawer. On desktop: static panel (collapsible). */}
        <aside
          className={`
            flex flex-col bg-zinc-950 border-r border-zinc-800 z-50 shrink-0
            transition-all duration-300 ease-in-out
            /* mobile/tablet: fixed drawer */
            fixed inset-y-0 left-0 top-12
            w-[280px] sm:w-80
            xl:static xl:top-auto xl:inset-y-auto
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            xl:translate-x-0
            ${sidebarCollapsed ? 'xl:w-12' : 'xl:w-80'}
          `}
        >
          {/* Collapse toggle — desktop only */}
          <button
            className="hidden xl:flex absolute -right-3 top-4 w-6 h-6 items-center justify-center bg-zinc-800 border border-zinc-700 rounded-full text-zinc-400 hover:text-white z-10 transition-colors"
            onClick={() => setSidebarCollapsed(v => !v)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>

          {/* Mobile close button */}
          <button
            className="xl:hidden absolute top-2 right-2 text-zinc-400 hover:text-white p-1 rounded"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>

          {/* Content — hide when desktop-collapsed */}
          <div className={`flex flex-col flex-1 overflow-hidden ${sidebarCollapsed ? 'xl:hidden' : ''}`}>
            <SidebarContent />
          </div>

          {/* Collapsed icons — desktop only */}
          {sidebarCollapsed && (
            <div className="hidden xl:flex flex-col items-center gap-4 pt-4">
              <button
                className="text-zinc-400 hover:text-white p-2 rounded hover:bg-zinc-800"
                title="Uploads &amp; Queue"
                onClick={() => setSidebarCollapsed(false)}
              >
                <UploadCloud size={18} />
              </button>
              <button
                className="text-zinc-400 hover:text-white p-2 rounded hover:bg-zinc-800"
                title="Conversions"
                onClick={() => setSidebarCollapsed(false)}
              >
                <List size={18} />
              </button>
            </div>
          )}
        </aside>

        {/* ── Center + Right: tab-driven on mobile/tablet, split on desktop ── */}
        <div className="flex-1 flex flex-col xl:flex-row overflow-hidden min-w-0">

          {/* Mobile Tab Bar */}
          <div className="xl:hidden flex border-b border-zinc-800 bg-zinc-950 shrink-0">
            {[
              { id: TABS.PREVIEW, icon: <Image size={15} />, label: 'Preview' },
              { id: TABS.MAP,     icon: <MapPin size={15} />, label: 'Map' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors
                  ${activeTab === tab.id
                    ? 'text-indigo-400 border-b-2 border-indigo-500 bg-zinc-900'
                    : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Main Editor Column ──────────────────────────────────────────── */}
          <div
            className={`
              flex-1 flex flex-col min-w-0 overflow-hidden
              ${activeTab !== TABS.PREVIEW ? 'hidden xl:flex' : 'flex'}
            `}
          >
            {/* Canvas */}
            <div className="flex-1 relative overflow-hidden bg-[#0f1115]
              xl:m-6 xl:mb-3 xl:rounded-xl xl:border xl:border-zinc-800 xl:shadow-2xl
              m-0 rounded-none border-0
            ">
              <SvgPreview
                conversion={selectedConversion}
                conversions={conversions}
                projectId={projectId}
              />
            </div>

            {/* Console — collapsible on mobile */}
            <div className={`
              shrink-0 border-t border-zinc-800 xl:border xl:rounded-lg
              xl:mx-6 xl:mb-6 xl:mt-0 xl:border-zinc-800
              bg-zinc-950/95 backdrop-blur shadow-2xl overflow-hidden
              transition-all duration-200
              ${showConsole ? 'h-28 sm:h-32' : 'h-8'}
            `}>
              {/* Console toggle header */}
              <button
                className="xl:hidden w-full h-8 flex items-center px-4 gap-2 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-400 hover:text-zinc-200"
                onClick={() => setShowConsole(v => !v)}
              >
                <span className={`transition-transform ${showConsole ? 'rotate-180' : ''}`}>▲</span>
                Console
              </button>
              {showConsole && (
                <ConversionConsole logs={logs} selectedConversion={selectedConversion} />
              )}
            </div>
          </div>

          {/* ── Project Map Column ──────────────────────────────────────────── */}
          <div
            className={`
              xl:w-[380px] 2xl:w-[460px] shrink-0 overflow-y-auto
              xl:p-6 p-4
              ${activeTab !== TABS.MAP ? 'hidden xl:block' : 'block flex-1'}
            `}
          >
            <ProjectMap project={project} onUpdateProject={setProject} />
          </div>
        </div>
      </div>
    </div>
  );
}
