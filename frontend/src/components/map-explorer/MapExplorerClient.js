'use client';

/**
 * MapExplorerClient  —  /map
 *
 * Shows all active projects as tabs. Selecting a tab fetches that project's
 * land boundaries and renders them on a Leaflet satellite map using the
 * lat/lng coordinates stored in each boundary's GeoJSON geometry.
 */

import { useEffect, useState } from 'react';
import Link    from 'next/link';
import dynamic from 'next/dynamic';
import { getAllProjects, getBoundaries } from '@/lib/api';

// Load the boundary canvas (no map tiles — client only for consistency)
const ExplorerMap = dynamic(() => import('./ExplorerMap'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center w-full h-full">
      <div className="flex flex-col items-center gap-3 text-zinc-500">
        <svg className="animate-spin w-7 h-7" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3"/>
          <path d="M12 3A9 9 0 0 1 21 12" stroke="#6366f1" strokeWidth="3" strokeLinecap="round"/>
        </svg>
        <span className="text-sm">Loading…</span>
      </div>
    </div>
  ),
});

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ text }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-zinc-500 w-full h-full">
      <svg className="animate-spin w-7 h-7" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3"/>
        <path d="M12 3A9 9 0 0 1 21 12" stroke="#6366f1" strokeWidth="3" strokeLinecap="round"/>
      </svg>
      <span className="text-sm">{text}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MapExplorerClient() {
  const [projects,     setProjects]     = useState([]);
  const [activeId,     setActiveId]     = useState(null);
  const [boundaries,   setBoundaries]   = useState([]);
  const [loadingProjs, setLoadingProjs] = useState(true);
  const [loadingBnds,  setLoadingBnds]  = useState(false);
  const [projError,    setProjError]    = useState(null);

  // ── Load all active projects ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoadingProjs(true);
      setProjError(null);
      try {
        const res  = await getAllProjects();
        const list = Array.isArray(res) ? res : (res?.data ?? []);
        const active = list.filter((p) => p.status === 'ACTIVE');
        setProjects(active);
        if (active.length > 0) setActiveId(active[0].id);
      } catch (err) {
        setProjError(err.message || 'Failed to load projects');
      } finally {
        setLoadingProjs(false);
      }
    })();
  }, []);

  // ── Load boundaries when active project changes ──────────────────────────
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setLoadingBnds(true);
    setBoundaries([]);

    getBoundaries(activeId)
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : (res?.data ?? []);
        setBoundaries(list.filter((b) => b.visible !== false));
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[MapExplorer] boundaries fetch failed:', err.message);
        setBoundaries([]);
      })
      .finally(() => { if (!cancelled) setLoadingBnds(false); });

    return () => { cancelled = true; };
  }, [activeId]);

  const activeProject = projects.find((p) => p.id === activeId);

  return (
    <div className="h-screen flex flex-col bg-[#0d0d0d] text-zinc-100 overflow-hidden">

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <header className="shrink-0 bg-zinc-950 border-b border-zinc-800/80 z-10">
        <div className="px-5 h-14 flex items-center gap-4">

          {/* Logo */}
          <Link href="/projects" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-700
                            flex items-center justify-center shadow-md shadow-indigo-500/20
                            group-hover:from-indigo-500 transition-all">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                <rect x="1" y="1" width="8" height="8" rx="1.5" fill="white"/>
                <rect x="11" y="1" width="8" height="8" rx="1.5" fill="white" opacity=".65"/>
                <rect x="1" y="11" width="8" height="8" rx="1.5" fill="white" opacity=".65"/>
                <rect x="11" y="11" width="8" height="8" rx="1.5" fill="white" opacity=".35"/>
              </svg>
            </div>
            <div>
              <span className="text-[10px] text-indigo-400 font-semibold uppercase tracking-widest block leading-none">
                SVG Editor
              </span>
              <span className="text-sm font-bold text-zinc-100 leading-tight">
                Township Layout Editor
              </span>
            </div>
          </Link>

          <div className="w-px h-6 bg-zinc-800 shrink-0" />

          {/* Project tabs */}
          {loadingProjs ? (
            <div className="flex items-center gap-2 text-zinc-600 text-sm">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3"/>
                <path d="M12 3A9 9 0 0 1 21 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              Loading…
            </div>
          ) : (
            <nav className="flex items-center gap-1.5 overflow-x-auto flex-1 min-w-0">
              {projects.map((proj) => (
                <button
                  key={proj.id}
                  onClick={() => setActiveId(proj.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap
                               transition-all duration-150 shrink-0
                    ${activeId === proj.id
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                      : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 border border-zinc-700/60'
                    }`}
                >
                  {proj.name}
                </button>
              ))}

              {projects.length === 0 && (
                <span className="text-xs text-zinc-600 italic">No active projects</span>
              )}
            </nav>
          )}

          {/* Back to projects */}
          <Link href="/projects"
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors
                       text-xs shrink-0 ml-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.5" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Projects
          </Link>
        </div>
      </header>

      {/* ── Map area ──────────────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">

        {/* Boundary loading overlay */}
        {loadingBnds && (
          <div className="absolute inset-0 z-[9800] flex items-center justify-center
                          bg-zinc-950/50 backdrop-blur-sm pointer-events-none">
            <div className="flex items-center gap-2.5 bg-zinc-900/95 border border-zinc-700
                            rounded-xl px-5 py-3 text-sm text-zinc-300 shadow-xl">
              <svg className="animate-spin w-4 h-4 text-indigo-400 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3"/>
                <path d="M12 3A9 9 0 0 1 21 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              Fetching boundaries for <strong className="text-zinc-100">{activeProject?.name ?? '…'}</strong>
            </div>
          </div>
        )}

        {/* Error */}
        {projError && (
          <div className="absolute inset-0 z-[9800] flex items-center justify-center">
            <div className="text-center space-y-3">
              <p className="text-4xl">⚠</p>
              <p className="text-zinc-300 text-sm">{projError}</p>
              <Link href="/projects" className="text-indigo-400 text-sm hover:underline">
                ← Back to Projects
              </Link>
            </div>
          </div>
        )}

        {/* Map — remount keyed by project so map re-initialises cleanly */}
        {!projError && (
          loadingProjs
            ? <Spinner text="Loading projects…" />
            : <ExplorerMap
                key={activeId}
                boundaries={boundaries}
                projectName={activeProject?.name ?? ''}
                projectId={activeId}
              />
        )}

        {/* Boundary count badge */}
        {!loadingBnds && boundaries.length > 0 && (
          <div className="absolute top-4 right-4 z-[9000] bg-zinc-950/90 backdrop-blur
                          border border-zinc-700 rounded-xl px-3.5 py-2 text-xs pointer-events-none
                          select-none">
            <span className="text-zinc-500">Boundaries </span>
            <span className="text-zinc-200 font-semibold tabular-nums">{boundaries.length}</span>
            {activeProject && (
              <span className="text-zinc-600 ml-1.5">· {activeProject.name}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
