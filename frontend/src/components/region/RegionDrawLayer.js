'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useViewerStore } from '@/store/viewerStore';
import { useRegionStore, REGION_TOOL, REGION_SHAPE } from '@/store/regionStore';
import { mapToCanvas, screenToMap } from '@/lib/selectionMath';

// ─── Visual constants ─────────────────────────────────────────────────────────
const RECT_STROKE    = '#10b981';
const RECT_FILL      = 'rgba(16,185,129,0.10)';
const RECT_A_STROKE  = '#34d399';
const RECT_A_FILL    = 'rgba(52,211,153,0.18)';
const POLY_STROKE    = '#f59e0b';
const POLY_FILL      = 'rgba(245,158,11,0.10)';
const POLY_A_STROKE  = '#fbbf24';
const POLY_A_FILL    = 'rgba(251,191,36,0.18)';
const DRAFT_DASH     = '5 3';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function bboxFromPoints(pts) {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return {
    x: Math.min(...xs), y: Math.min(...ys),
    width:  Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

function polygonSvgPoints(pts, cw, ch, zoom, offset) {
  return pts.map((p) => {
    const c = mapToCanvas(p.x, p.y, cw, ch, zoom, offset);
    return `${c.x},${c.y}`;
  }).join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
export default function RegionDrawLayer({ containerRef }) {
  const zoom   = useViewerStore((s) => s.zoom);
  const offset = useViewerStore((s) => s.offset);

  const tool              = useRegionStore((s) => s.tool);
  const regions           = useRegionStore((s) => s.regions);
  const activeRegionId    = useRegionStore((s) => s.activeRegionId);
  const setActiveRegionId = useRegionStore((s) => s.setActiveRegionId);

  // Rect draw state
  const drawRect      = useRegionStore((s) => s.drawRect);
  const setDrawRect   = useRegionStore((s) => s.setDrawRect);
  const clearDrawRect = useRegionStore((s) => s.clearDrawRect);

  // Polygon draw state
  const polygonPoints      = useRegionStore((s) => s.polygonPoints);
  const addPolygonPoint    = useRegionStore((s) => s.addPolygonPoint);
  const clearPolygonPoints = useRegionStore((s) => s.clearPolygonPoints);
  const cursorMapPos       = useRegionStore((s) => s.cursorMapPos);
  const setCursorMapPos    = useRegionStore((s) => s.setCursorMapPos);

  const setPendingRegion = useRegionStore((s) => s.setPendingRegion);

  const svgRef      = useRef(null);
  const startRef    = useRef(null);
  const rectDrawing = useRef(false);

  const getSize = useCallback(() => {
    const el = containerRef.current;
    return el ? { w: el.clientWidth, h: el.clientHeight } : { w: 0, h: 0 };
  }, [containerRef]);

  // ── Rectangle tool events ─────────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || tool !== REGION_TOOL.DRAW_RECT) return;

    function onDown(e) {
      if (e.button !== 0) return;
      if (useViewerStore.getState().spaceHeld) return; // allow pan
      
      e.stopPropagation();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mp = screenToMap(e.clientX, e.clientY, rect, zoom, offset);
      startRef.current = mp;
      rectDrawing.current = true;
      setDrawRect({ x: mp.x, y: mp.y, width: 0, height: 0 });
    }

    function onMove(e) {
      if (!rectDrawing.current || !startRef.current) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mp = screenToMap(e.clientX, e.clientY, rect, zoom, offset);
      const sp = startRef.current;
      setDrawRect({
        x:      Math.min(sp.x, mp.x),
        y:      Math.min(sp.y, mp.y),
        width:  Math.abs(mp.x - sp.x),
        height: Math.abs(mp.y - sp.y),
      });
    }

    function onUp(e) {
      if (!rectDrawing.current || e.button !== 0) return;
      rectDrawing.current = false;
      const r = useRegionStore.getState().drawRect;
      clearDrawRect();
      startRef.current = null;
      if (r && r.width > 5 && r.height > 5) {
        setPendingRegion({ shapeType: REGION_SHAPE.RECTANGLE, ...r });
      }
    }

    svg.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      svg.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [tool, zoom, offset, containerRef, setDrawRect, clearDrawRect, setPendingRegion]);

  // ── Polygon tool events ───────────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || tool !== REGION_TOOL.DRAW_POLYGON) return;

    function onClick(e) {
      if (e.button !== 0) return;
      if (useViewerStore.getState().spaceHeld) return; // allow pan
      
      e.stopPropagation();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mp = screenToMap(e.clientX, e.clientY, rect, zoom, offset);
      addPolygonPoint(mp);
    }

    function onMove(e) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setCursorMapPos(screenToMap(e.clientX, e.clientY, rect, zoom, offset));
    }

    function onDblClick(e) {
      e.stopPropagation();
      const pts = useRegionStore.getState().polygonPoints;
      if (pts.length < 3) return;
      clearPolygonPoints();
      setCursorMapPos(null);
      const bbox = bboxFromPoints(pts);
      setPendingRegion({ shapeType: REGION_SHAPE.POLYGON, points: pts, ...bbox });
    }

    function onKey(e) {
      if (e.key === 'Enter') {
        const pts = useRegionStore.getState().polygonPoints;
        if (pts.length < 3) return;
        clearPolygonPoints();
        setCursorMapPos(null);
        const bbox = bboxFromPoints(pts);
        setPendingRegion({ shapeType: REGION_SHAPE.POLYGON, points: pts, ...bbox });
      }
      if (e.key === 'Escape') {
        clearPolygonPoints();
        setCursorMapPos(null);
      }
    }

    svg.addEventListener('click', onClick);
    svg.addEventListener('dblclick', onDblClick);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('keydown', onKey);
    return () => {
      svg.removeEventListener('click', onClick);
      svg.removeEventListener('dblclick', onDblClick);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('keydown', onKey);
    };
  }, [tool, zoom, offset, containerRef, addPolygonPoint, clearPolygonPoints, setCursorMapPos, setPendingRegion]);

  // ── Render ────────────────────────────────────────────────────────────────
  const { w: cw, h: ch } = getSize();
  const isRectMode = tool === REGION_TOOL.DRAW_RECT;
  const isPolyMode = tool === REGION_TOOL.DRAW_POLYGON;
  const isAnyDrawMode = isRectMode || isPolyMode;

  function mapRectToCanvas(r) {
    const tl = mapToCanvas(r.x, r.y, cw, ch, zoom, offset);
    return { x: tl.x, y: tl.y, w: r.width * zoom, h: r.height * zoom };
  }

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full"
      style={{
        pointerEvents: isAnyDrawMode ? 'all' : 'none',
        cursor: isRectMode ? 'crosshair' : isPolyMode ? 'crosshair' : 'default',
        zIndex: 11,
      }}
      width={cw}
      height={ch}
    >
      {/* ── Saved regions ──────────────────────────────────────────────── */}
      {regions.map((r) => {
        const isAct   = r.id === activeRegionId;
        const isPoly  = r.shapeType === REGION_SHAPE.POLYGON;
        const stroke  = isAct ? (isPoly ? POLY_A_STROKE : RECT_A_STROKE) : (isPoly ? POLY_STROKE : RECT_STROKE);
        const fill    = isAct ? (isPoly ? POLY_A_FILL   : RECT_A_FILL)   : (isPoly ? POLY_FILL   : RECT_FILL);
        const sw      = isAct ? 2 : 1.5;
        const dash    = isAct ? 'none' : DRAFT_DASH;

        return (
          <g
            key={r.id}
            onClick={(e) => { e.stopPropagation(); setActiveRegionId(isAct ? null : r.id); }}
            style={{ cursor: 'pointer', pointerEvents: 'auto' }}
          >
            {isPoly && Array.isArray(r.points) && r.points.length >= 3 ? (
              <polygon
                points={polygonSvgPoints(r.points, cw, ch, zoom, offset)}
                fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash}
              />
            ) : (
              (() => {
                const c = mapRectToCanvas(r);
                return (
                  <rect
                    x={c.x} y={c.y} width={c.w} height={c.h}
                    fill={fill} stroke={stroke} strokeWidth={sw} strokeDasharray={dash}
                  />
                );
              })()
            )}

            {/* Label */}
            {(() => {
              let lx, ly;
              if (isPoly && Array.isArray(r.points) && r.points.length) {
                const c = mapToCanvas(r.points[0].x, r.points[0].y, cw, ch, zoom, offset);
                lx = c.x + 5; ly = c.y - 5;
              } else {
                const c = mapRectToCanvas(r);
                lx = c.x + 6; ly = c.y + 14;
              }
              return (
                <text
                  x={lx} y={ly}
                  fontSize={11} fill={isAct ? stroke : (isPoly ? '#fcd34d' : '#6ee7b7')}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {r.name}
                </text>
              );
            })()}
          </g>
        );
      })}

      {/* ── Live rectangle preview ──────────────────────────────────────── */}
      {drawRect && drawRect.width > 0 && (() => {
        const c = mapRectToCanvas(drawRect);
        return (
          <rect
            x={c.x} y={c.y} width={c.w} height={c.h}
            fill="rgba(16,185,129,0.08)" stroke={RECT_STROKE}
            strokeWidth={1.5} strokeDasharray="6 3"
          />
        );
      })()}

      {/* ── Live polygon preview ────────────────────────────────────────── */}
      {isPolyMode && polygonPoints.length > 0 && (() => {
        const canvasPts = polygonPoints.map((p) => mapToCanvas(p.x, p.y, cw, ch, zoom, offset));
        const ptStr = canvasPts.map((c) => `${c.x},${c.y}`).join(' ');

        // Preview cursor line to next point
        let cursorLine = null;
        if (cursorMapPos && canvasPts.length > 0) {
          const last = canvasPts[canvasPts.length - 1];
          const cur  = mapToCanvas(cursorMapPos.x, cursorMapPos.y, cw, ch, zoom, offset);
          cursorLine = (
            <line
              x1={last.x} y1={last.y} x2={cur.x} y2={cur.y}
              stroke={POLY_STROKE} strokeWidth={1} strokeDasharray="4 3"
            />
          );
        }

        return (
          <>
            {/* Filled preview polygon (if ≥3 points) */}
            {canvasPts.length >= 3 && (
              <polygon
                points={ptStr}
                fill="rgba(245,158,11,0.08)" stroke={POLY_STROKE}
                strokeWidth={1.5} strokeDasharray="5 3"
              />
            )}
            {/* Polyline for points < 3 */}
            {canvasPts.length < 3 && canvasPts.length > 1 && (
              <polyline
                points={ptStr} fill="none"
                stroke={POLY_STROKE} strokeWidth={1.5} strokeDasharray="5 3"
              />
            )}
            {/* Cursor line */}
            {cursorLine}
            {/* Placed point dots */}
            {canvasPts.map((c, i) => (
              <circle
                key={i} cx={c.x} cy={c.y} r={4}
                fill={POLY_STROKE} stroke="#fff" strokeWidth={1.5}
              />
            ))}
          </>
        );
      })()}
    </svg>
  );
}
