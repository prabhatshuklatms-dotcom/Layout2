'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCadProjects, createCadProject } from '@/lib/api';

export default function CadProjectList() {
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const router = useRouter();

  const fetchProjects = useCallback(async () => {
    try {
      const data = await getCadProjects();
      setProjects(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      const project = await createCadProject({ name: newProjectName });
      setIsCreating(false);
      setNewProjectName('');
      router.push(`/cad-conversion/${project.id}`);
    } catch (err) {
      console.error(err);
      alert('Failed to create project. ' + err.message);
    }
  };

  const filteredProjects = projects.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-300">
      <header className="h-14 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between px-6 shrink-0 z-50">
        <h1 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
          CAD Conversion Projects
        </h1>
        <button 
          onClick={() => setIsCreating(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
        >
          Create Project
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto">
          {isCreating && (
            <form onSubmit={handleCreate} className="mb-8 bg-zinc-900 p-6 rounded-lg border border-zinc-800 flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Project Name</label>
                <input 
                  autoFocus
                  type="text" 
                  value={newProjectName} 
                  onChange={e => setNewProjectName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                  placeholder="e.g. Phase 1 Architecture"
                />
              </div>
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded font-medium transition-colors">
                Create
              </button>
              <button type="button" onClick={() => setIsCreating(false)} className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded font-medium transition-colors">
                Cancel
              </button>
            </form>
          )}

          <div className="mb-6">
            <input 
              type="text" 
              placeholder="Search projects..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded px-4 py-2 text-white focus:outline-none focus:border-zinc-700"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map(project => (
              <Link 
                href={`/cad-conversion/${project.id}`} 
                key={project.id}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 hover:border-indigo-500 hover:bg-zinc-800/50 transition-all group block"
              >
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-indigo-400">{project.name}</h3>
                <div className="flex justify-between items-center text-sm text-zinc-500 mt-4">
                  <span>{project._count?.conversions || 0} Drawings</span>
                  <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
            {filteredProjects.length === 0 && (
              <div className="col-span-full py-12 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
                No projects found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
