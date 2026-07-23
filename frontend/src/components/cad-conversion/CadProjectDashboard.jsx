'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCadProject, getCadConversions, deleteCadConversion, renameCadConversion } from '@/lib/api';

export default function CadProjectDashboard({ projectId }) {
  const [project, setProject] = useState(null);
  const [conversions, setConversions] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const proj = await getCadProject(projectId);
      setProject(proj);
      
      const convs = await getCadConversions();
      // Filter for this project
      setConversions(convs.filter(c => c.projectId === parseInt(projectId)));
    } catch (err) {
      console.error(err);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);

    try {
      const res = await fetch('http://localhost:5000/api/cad-conversion/upload', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        fetchData();
      } else {
        alert('Upload failed');
      }
    } catch (err) {
      console.error(err);
      alert('Upload error');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this drawing?')) return;
    try {
      await deleteCadConversion(id);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to delete');
    }
  };

  const handleRename = async (id, currentName) => {
    const newName = prompt('Enter new name for drawing:', currentName);
    if (!newName || newName === currentName) return;
    try {
      await renameCadConversion(id, newName);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to rename');
    }
  };

  if (!project) return <div className="p-8 text-white">Loading...</div>;

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-300">
      <header className="h-14 border-b border-zinc-800 bg-zinc-900 flex items-center px-6 shrink-0 z-50">
        <Link href="/cad-conversion" className="text-zinc-400 hover:text-white mr-4">
          &larr; Back
        </Link>
        <h1 className="text-lg font-semibold text-zinc-100">{project.name} Dashboard</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center">
        <div className="w-full max-w-4xl space-y-6">

          {/* Quick Actions Panel */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow flex items-center justify-between">
              <div>
                <h3 className="font-medium text-zinc-100">Project Plots</h3>
                <p className="text-xs text-zinc-400 mt-1">Manage plots and plot numbers for this project.</p>
              </div>
              <Link 
                href={`/cad-conversion/${projectId}/plots`}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded shadow transition-colors"
              >
                Plots
              </Link>
            </div>
            
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow flex items-center justify-between">
              <div>
                <h3 className="font-medium text-zinc-100">Global Amenities</h3>
                <p className="text-xs text-zinc-400 mt-1">Configure amenities available to all projects.</p>
              </div>
              <Link 
                href="/masters/amenities"
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium rounded border border-zinc-700 transition-colors"
              >
                Amenity Master
              </Link>
            </div>
          </div>
          
          {/* Upload Section */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 mb-8 text-center">
            <h2 className="text-xl font-bold text-white mb-4">Upload Drawing</h2>
            <p className="text-zinc-400 mb-6">Upload DWG or DXF files to add drawings to this project.</p>
            <label className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded font-medium cursor-pointer transition-colors inline-block">
              {isUploading ? 'Uploading...' : 'Upload DWG / DXF'}
              <input type="file" accept=".dwg,.dxf" className="hidden" onChange={handleUpload} disabled={isUploading} />
            </label>
          </div>

          {/* Drawings List */}
          <h2 className="text-lg font-bold text-white mb-4">Project Drawings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {conversions.map(conv => (
              <div key={conv.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 flex flex-col relative overflow-hidden group">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-1 truncate pr-8" title={conv.originalFileName}>
                    {conv.originalFileName}
                  </h3>
                  <div className="text-sm text-zinc-400 mb-4">
                    Status: <span className={
                      conv.status === 'SUCCESS' ? 'text-emerald-400' :
                      conv.status === 'FAILED' ? 'text-red-400' : 'text-amber-400'
                    }>{conv.status}</span>
                  </div>
                  {conv.errorMessage && (
                    <div className="text-xs text-red-400 bg-red-400/10 p-2 rounded mb-4">
                      {conv.errorMessage}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2 mt-4">
                  <button 
                    onClick={() => handleRename(conv.id, conv.originalFileName)}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded transition-colors"
                  >
                    Rename
                  </button>
                  <button 
                    onClick={() => handleDelete(conv.id)}
                    className="text-xs bg-red-900/50 hover:bg-red-800 text-white px-3 py-1.5 rounded transition-colors"
                  >
                    Delete
                  </button>
                  <div className="flex-1"></div>
                  {conv.status === 'SUCCESS' && (
                    <Link 
                      href={`/cad-conversion/${projectId}/editor/${conv.id}`}
                      className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded font-medium transition-colors"
                    >
                      Continue Editing
                    </Link>
                  )}
                </div>
              </div>
            ))}
            {conversions.length === 0 && (
              <div className="col-span-full py-12 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
                No drawings uploaded yet.
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
