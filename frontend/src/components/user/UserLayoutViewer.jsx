'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import UserViewerToolbar from './UserViewerToolbar';
import CompassControl from '@/components/cad-conversion/editor/CompassControl';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const MIN_SCALE = 0.05;
const MAX_SCALE = 50;

const ZOOM_IN_EVENT   = new CustomEvent('editor-zoom-in');
const ZOOM_OUT_EVENT  = new CustomEvent('editor-zoom-out');
const FIT_EVENT       = new CustomEvent('editor-fit-screen');

// ─────────────────────────────────────────────────────────────────────────────
// useRotationGesture
// Handles ONLY the two-finger rotate gesture on the rotation wrapper.
// Pan and zoom are delegated entirely to CadEditorCanvas (which already
// handles them via its own pointer events and responds to the window events
// editor-zoom-in / editor-zoom-out / editor-fit-screen).
// ─────────────────────────────────────────────────────────────────────────────
function useRotationGesture({ wrapperRef, onRotationChange }) {
  const gesture  = useRef({ pointers: new Map(), lastAngle: 0, isPinching: false });
  const rotation = useRef(0);      // degrees, kept as ref to avoid re-render per frame
  const resetRaf = useRef(null);

  // Apply rotation to the wrapper div without going through React render
  const applyRotation = useCallback((deg) => {
    if (wrapperRef.current) {
      wrapperRef.current.style.transform = `rotate(${deg}deg)`;
    }
    onRotationChange(deg);
  }, [wrapperRef, onRotationChange]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const g = gesture.current;

    const onDown = (e) => {
      g.pointers.set(e.pointerId, e);
      if (g.pointers.size === 2) {
        const pts = Array.from(g.pointers.values());
        g.lastAngle  = Math.atan2(
          pts[1].clientY - pts[0].clientY,
          pts[1].clientX - pts[0].clientX
        );
        g.isPinching = true;
      }
    };

    const onMove = (e) => {
      if (!g.pointers.has(e.pointerId)) return;
      g.pointers.set(e.pointerId, e);

      if (g.isPinching && g.pointers.size === 2) {
        const pts   = Array.from(g.pointers.values());
        const angle = Math.atan2(
          pts[1].clientY - pts[0].clientY,
          pts[1].clientX - pts[0].clientX
        );
        const delta = (angle - g.lastAngle) * (180 / Math.PI);
        rotation.current += delta;
        g.lastAngle = angle;
        applyRotation(rotation.current);
      }
    };

    const onUp = (e) => {
      g.pointers.delete(e.pointerId);
      if (g.pointers.size < 2) g.isPinching = false;
    };

    // Capture on the wrapper so two-finger rotate is detected even if fingers
    // start over the canvas content
    el.addEventListener('pointerdown',  onDown, { capture: true, passive: true });
    el.addEventListener('pointermove',  onMove, { capture: true, passive: true });
    el.addEventListener('pointerup',    onUp,   { capture: true, passive: true });
    el.addEventListener('pointercancel', onUp,  { capture: true, passive: true });

    return () => {
      el.removeEventListener('pointerdown',  onDown,  { capture: true });
      el.removeEventListener('pointermove',  onMove,  { capture: true });
      el.removeEventListener('pointerup',    onUp,    { capture: true });
      el.removeEventListener('pointercancel', onUp,   { capture: true });
      if (resetRaf.current) cancelAnimationFrame(resetRaf.current);
    };
  }, [applyRotation]);

  // Smooth ease-out animation back to 0°
  const resetNorth = useCallback(() => {
    if (resetRaf.current) cancelAnimationFrame(resetRaf.current);

    const step = () => {
      // Wrap to [-180, 180] shortest path
      let r = rotation.current % 360;
      if (r >  180) r -= 360;
      if (r < -180) r += 360;

      if (Math.abs(r) < 0.3) {
        rotation.current = 0;
        applyRotation(0);
        return;
      }

      rotation.current -= r * 0.18;   // 18% step → fast-then-ease feel
      applyRotation(rotation.current);
      resetRaf.current = requestAnimationFrame(step);
    };

    resetRaf.current = requestAnimationFrame(step);
  }, [applyRotation]);

  return { resetNorth };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dynamically loaded to avoid SSR issues
// ─────────────────────────────────────────────────────────────────────────────
const CadEditorWorkspace = dynamic(
  () => import('@/components/cad-conversion/editor/CadEditorWorkspace'),
  { ssr: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// UserLayoutViewer
// ─────────────────────────────────────────────────────────────────────────────
export default function UserLayoutViewer({ project, conversion }) {
  const [showPlotStatus, setShowPlotStatus] = useState(false);
  const [selectedPlot,   setSelectedPlot]   = useState(null);
  const [isDrawerOpen,   setIsDrawerOpen]   = useState(false);
  const [rotationDeg,    setRotationDeg]    = useState(0);
  const [currentZoom,    setCurrentZoom]    = useState(1);

  const wrapperRef = useRef(null);

  const { resetNorth } = useRotationGesture({
    wrapperRef,
    onRotationChange: setRotationDeg,
  });

  // Toolbar action callbacks — delegate to canvas via window events
  const zoomIn      = useCallback(() => window.dispatchEvent(ZOOM_IN_EVENT),   []);
  const zoomOut     = useCallback(() => window.dispatchEvent(ZOOM_OUT_EVENT),  []);
  const centerView  = useCallback(() => window.dispatchEvent(FIT_EVENT),       []);
  const resetView   = useCallback(() => {
    window.dispatchEvent(FIT_EVENT);
    resetNorth();
  }, [resetNorth]);

  return (
    <div className="flex-1 relative bg-[#0B0B0B] overflow-hidden flex flex-col">

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="z-10 relative">
        <UserViewerToolbar
          project={project}
          layoutName={conversion?.originalFileName}
          zoomIn={zoomIn}
          zoomOut={zoomOut}
          resetTransform={resetView}
          centerView={centerView}
          currentZoom={currentZoom / 100}
          isMapView={false}
          showPlotStatus={showPlotStatus}
          onTogglePlotStatus={() => setShowPlotStatus(v => !v)}
        />
      </div>

      {/* ── Viewport ─────────────────────────────────────────────────────── */}
      {/*
          Layout:
            viewport (static — compass/floating UI anchors here)
              └── wrapperRef  (rotation only — transform: rotate(Ndeg))
                    └── CadEditorWorkspace  (owns its own pan + zoom)
      */}
      <div className="flex-1 relative w-full h-full overflow-hidden bg-[#0a0a0a]"
           style={{
             backgroundImage: `linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
                               linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)`,
             backgroundSize: '80px 80px',
           }}>

        {/* Rotation wrapper — only this element rotates */}
        <div
          ref={wrapperRef}
          className="absolute inset-0 will-change-transform"
          style={{ transformOrigin: '50% 50%' }}
        >
          <CadEditorWorkspace
            conversionId={conversion.id}
            projectId={project.id}
            readOnly={true}
            showPlotStatus={showPlotStatus}
            onZoomChange={(pct) => setCurrentZoom(pct)}
            onUserViewerSelection={(plot) => {
              setSelectedPlot(plot);
              if (!plot) setIsDrawerOpen(false);
            }}
          />
        </div>

        {/* ── Compass (outside rotation wrapper — always upright) ─────── */}
        <CompassControl rotation={rotationDeg} onResetNorth={resetNorth} />

        {/* ── Floating zoom controls (outside rotation wrapper) ────────── */}
        <div className="absolute bottom-6 right-4 z-50 flex flex-col items-center gap-1.5 pointer-events-auto select-none">
          <div className="bg-zinc-900/85 backdrop-blur-md border border-zinc-700/50 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-zinc-300 tabular-nums text-center min-w-[48px]">
            {Math.round(currentZoom)}%
          </div>
          <button
            onClick={zoomIn}
            title="Zoom In"
            aria-label="Zoom in"
            className="w-10 h-10 bg-zinc-900/85 backdrop-blur-md border border-zinc-700/50 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/90 active:scale-95 transition-all shadow-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
          <button
            onClick={zoomOut}
            title="Zoom Out"
            aria-label="Zoom out"
            className="w-10 h-10 bg-zinc-900/85 backdrop-blur-md border border-zinc-700/50 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/90 active:scale-95 transition-all shadow-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          </button>
          <button
            onClick={centerView}
            title="Fit to screen"
            aria-label="Fit to screen"
            className="w-10 h-10 bg-zinc-900/85 backdrop-blur-md border border-zinc-700/50 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/90 active:scale-95 transition-all shadow-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
          </button>
        </div>

      </div>
    </div>
  );
}
