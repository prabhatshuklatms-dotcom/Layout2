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
          />
        </div>

        {/* ── Compass (outside rotation wrapper — always upright) ─────── */}
        <CompassControl rotation={rotationDeg} onResetNorth={resetNorth} />

      </div>
    </div>
  );
}
