'use client';

/**
 * Overlay Studio  ─  /projects/[projectId]/overlay
 *
 * Responsibilities (ONLY):
 *   - Load saved Architecture Regions  (created in Viewer)
 *   - Load saved Land Boundaries       (created in Map Workspace)
 *   - Attach a Region onto a Boundary → POST /projects/:id/map-overlays
 *   - Render the placed overlay on the satellite map
 *   - Move / Resize / Rotate / Opacity / Visibility / Lock / Delete overlays
 *
 * Does NOT:
 *   - Show the full uploaded PDF
 *   - Allow uploading or creating regions / boundaries
 *   - Share state with ViewerPage or MapWorkspace
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useOverlayStore } from '@/store/overlayStore';
import { useRegionStore } from '@/store/regionStore';
import { useBoundaryStore } from '@/store/boundaryStore';
import {
  getProject, getOverlays,
  getRegionsByProject, getBoundaries,
} from '@/lib/api';
import StudioMap from './StudioMap';
import StudioSidebar from './StudioSidebar';
import StudioProperties from './StudioProperties';

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="h-screen flex items-center justify-center bg-[#0d0d0d]">
      <div className="flex flex-col items-center gap-4 text-zinc-500">
        <svg className="animate-spin w-8 h-8" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" />
          <path d="M12 3A9 9 0 0 1 21 12" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <span className="text-sm">Loading Overlay Studio…</span>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OverlayStudioPage({ projectId }) {
  const id = Number(projectId);

  const setOverlays = useOverlayStore((s) => s.setOverlays);
  const activeId = useOverlayStore((s) => s.activeOverlayId);
  const setRegions = useRegionStore((s) => s.setRegions);
  const setB = useBoundaryStore((s) => s.setB);

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id || isNaN(id) || id <= 0) {
      setError('Invalid project ID');
      setLoading(false);
      return;
    }

    async function boot() {
      setLoading(true);
      try {
        const [projRes, overlaysRes, regionsRes, boundariesRes] = await Promise.all([
          getProject(id),
          getOverlays(id),
          getRegionsByProject(id).catch(() => ({ data: [] })),
          getBoundaries(id).catch(() => ({ data: [] })),
        ]);
        setProject(projRes?.data ?? projRes);
        setOverlays(overlaysRes?.data ?? []);
        setRegions(regionsRes?.data ?? []);
        setB(boundariesRes?.data ?? []);
      } catch (e) {
        setError(e.message || 'Failed to load project');
      } finally {
        setLoading(false);
      }
    }
    boot();

    return () => {
      setOverlays([]);
      setRegions([]);
      setB([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <Spinner />;

  if (error) return (
    <div className="h-screen flex items-center justify-center bg-[#0d0d0d]">
      <div className="text-center space-y-3">
        <p className="text-3xl">⚠</p>
        <p className="text-zinc-300 text-sm">{error}</p>
        <Link href="/projects" className="text-amber-400 text-sm hover:underline">
          ← Back to projects
        </Link>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-[#0d0d0d] overflow-hidden">

      {/* Top bar */}
      <header className="flex items-center gap-3 px-4 h-12 bg-zinc-900 border-b border-zinc-800 shrink-0 select-none">
        <Link href={`/projects/${id}/viewer`}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors text-xs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Viewer
        </Link>

        <div className="w-px h-4 bg-zinc-700" />

        <Link href={`/projects/${id}/viewer?map=1`}
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors text-xs"
          title="Go to Viewer and open Map Workspace">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round">
            <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          Map
        </Link>

        <div className="w-px h-4 bg-zinc-700" />

        <span className="text-xs text-zinc-500 truncate max-w-[160px]">
          {project?.name ?? `Project ${id}`}
        </span>

        <div className="w-px h-4 bg-zinc-700" />

        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-sm font-semibold text-zinc-200">Overlay Studio</span>
        </div>

        <div className="ml-auto text-[10px] text-zinc-700 select-none">
          Load Layout → Drag / Rotate / Scale manually → Ctrl+S to save
        </div>
      </header>

      {/* Body: sidebar | map | properties */}
      <div className="flex flex-1 overflow-hidden">
        <StudioSidebar projectId={id} />

        <div className="flex-1 relative overflow-hidden">
          <StudioMap projectId={id} />
        </div>

        {activeId && <StudioProperties />}
      </div>
    </div>
  );
}
