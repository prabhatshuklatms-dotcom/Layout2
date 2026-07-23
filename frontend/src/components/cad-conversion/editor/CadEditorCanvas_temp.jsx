import React, { useRef, useEffect, useState, useCallback } from 'react';
import TransformControls from './TransformControls';
import ShapeRenderer from './ShapeRenderer';
import { parseSvgStringToState, serializeStateToSvgString } from './SvgDocumentModel';
import { findHitsForShape, applyVectorErase, applyPartialDelete, generateHighlightPaths } from './partialDelete';

const ZOOM_LEVELS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 4, 8, 16, 32, 64];

// ─── Paint Bucket helpers (pure, no React deps) ───────────────────────────────

/**
 * Return true if a DOM element is a closed SVG shape.
 * Handles path (Z/z), polygon, rect, circle, ellipse, closed polyline.
 * Rejects open paths, open polylines, lines, and text.
 */
function pbIsClosed(el) {
  const tag = el.tagName?.toLowerCase();
  if (['rect', 'circle', 'ellipse', 'polygon'].includes(tag)) return true;
  if (tag === 'path') {
    const d = (el.getAttribute('d') || '').trimEnd();
    return /[Zz]\s*$/.test(d);
  }
  if (tag === 'polyline') {
    const pts = (el.getAttribute('points') || '').trim().split(/[\s,]+/).filter(Boolean);
    if (pts.length >= 4) {
      const [x1, y1] = [parseFloat(pts[0]), parseFloat(pts[1])];
      const [x2, y2] = [parseFloat(pts[pts.length - 2]), parseFloat(pts[pts.length - 1])];
      return Math.abs(x1 - x2) < 1e-4 && Math.abs(y1 - y2) < 1e-4;
    }
  }
  return false;
}

/**
 * Compute the actual enclosed area of an SVG geometry element using the
 * Shoelace (Gauss) formula on sampled points.
 * Falls back to getBBox() area for unsupported shapes.
 */
function pbComputeArea(el) {
  const tag = el.tagName.toLowerCase();
  try {
    if (tag === 'rect') {
      const w = parseFloat(el.getAttribute('width') || 0);
      const h = parseFloat(el.getAttribute('height') || 0);
      return Math.abs(w * h);
    }
    if (tag === 'circle') {
      const r = parseFloat(el.getAttribute('r') || 0);
      return Math.PI * r * r;
    }
    if (tag === 'ellipse') {
      const rx = parseFloat(el.getAttribute('rx') || 0);
      const ry = parseFloat(el.getAttribute('ry') || 0);
      return Math.PI * rx * ry;
    }
    // For path, polygon, polyline — sample points and apply Shoelace
    if (['path', 'polygon', 'polyline'].includes(tag)) {
      let pts = [];
      if (tag === 'polygon' || tag === 'polyline') {
        const nums = (el.getAttribute('points') || '').trim().split(/[\s,]+/).filter(Boolean);
        for (let i = 0; i + 1 < nums.length; i += 2) {
          pts.push({ x: parseFloat(nums[i]), y: parseFloat(nums[i + 1]) });
        }
      } else {
        // path — use getTotalLength / getPointAtLength
        const len = el.getTotalLength();
        if (len <= 0) return el.getBBox().width * el.getBBox().height;
        const N = Math.min(256, Math.max(32, Math.ceil(len)));
        for (let i = 0; i < N; i++) {
          const p = el.getPointAtLength((i / N) * len);
          pts.push({ x: p.x, y: p.y });
        }
      }
      // Shoelace formula
      let area = 0;
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += pts[i].x * pts[j].y;
        area -= pts[j].x * pts[i].y;
      }
      return Math.abs(area / 2);
    }
  } catch (_) {}
  // Fallback
  try { const bb = el.getBBox(); return bb.width * bb.height; } catch (_) { return Infinity; }
}

/**
 * Find the smallest closed SVG shape containing the click point.
 *
 * Strategy:
 * 1. Convert the screen click (clientX/Y) to SVG user-space once using
 *    svgEl.getScreenCTM().inverse() — this is the ONLY coordinate conversion.
 * 2. For each closed shape, sample its boundary points (already in SVG user
 *    space via getPointAtLength) and run a ray-casting point-in-polygon test.
 *    No getCTM(), no per-element matrix inversion, no isPointInFill.
 * 3. Sort by actual area (Shoelace). Return the smallest containing region.
 *
 * Returns { element, area, bbox, allCandidates, totalClosed } or null.
 */
function paintBucketFindRegion(svgEl, clientX, clientY) {
  // ── Single coordinate conversion: screen → SVG user space ──────────────
  let svgPt;
  try {
    const sctm = svgEl.getScreenCTM();
    if (!sctm) return null;
    const inv = sctm.inverse();
    const pt = svgEl.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const mapped = pt.matrixTransform(inv);
    svgPt = { x: mapped.x, y: mapped.y };
  } catch (_) { return null; }

  console.log('[PaintBucket:findRegion] SVG-space click:', svgPt.x.toFixed(2), svgPt.y.toFixed(2));

  const CLOSED_TAGS = ['path', 'polygon', 'polyline', 'rect', 'circle', 'ellipse'];

  // Count total for diagnostics
  let totalInDoc = 0;
  for (const t of CLOSED_TAGS) totalInDoc += svgEl.querySelectorAll(t).length;
  console.log('[PaintBucket:findRegion] svgEl children:', svgEl.childElementCount,
    '| total queried elements:', totalInDoc,
    '| viewBox attr:', svgEl.getAttribute('viewBox'));

  let totalClosed = 0;
  const containing = [];

  for (const tag of CLOSED_TAGS) {
    svgEl.querySelectorAll(tag).forEach(el => {
      if (el.getAttribute('data-cad-type') === 'hatch') return;
      if (!pbIsClosed(el)) return;
      totalClosed++;

      try {
        // Sample boundary in SVG user space using getPointAtLength.
        // These points are already in SVG user space — no further transform needed.
        const pts = pbSamplePoints(el);
        if (!pts || pts.length < 3) return;

        // Quick bounding-box pre-filter (fast rejection)
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of pts) {
          if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
        }
        if (svgPt.x < minX || svgPt.x > maxX || svgPt.y < minY || svgPt.y > maxY) return;

        // Ray-casting point-in-polygon
        if (!pbPointInPoly(svgPt.x, svgPt.y, pts)) return;

        const bb = el.getBBox();
        const area = pbComputeArea(el);

        // Verbose diagnostic for first 5 closed shapes
        if (totalClosed <= 5) {
          console.log(
            `[PaintBucket:findRegion] #${totalClosed} id=${el.id || '?'} tag=${el.tagName}` +
            ` | bbox: ${bb.x.toFixed(1)},${bb.y.toFixed(1)} ${bb.width.toFixed(1)}x${bb.height.toFixed(1)}` +
            ` | area=${area.toFixed(2)} | CONTAINS CLICK`
          );
        }

        containing.push({
          element: el,
          area,
          bbox: { x: bb.x, y: bb.y, w: bb.width, h: bb.height },
        });
      } catch (err) {
        console.warn('[PaintBucket:findRegion] element error:', el.id, err.message);
      }
    });
  }

  if (!containing.length) return null;
  containing.sort((a, b) => a.area - b.area);

  return {
    element:       containing[0].element,
    area:          containing[0].area,
    bbox:          containing[0].bbox,
    allCandidates: containing,
    totalClosed,
  };
}

/**
 * Sample boundary points of a shape in SVG user space.
 * Uses getPointAtLength for path/polygon/polyline (returns SVG user-space points directly).
 * For rect/circle/ellipse, computes analytically.
 */
function pbSamplePoints(el) {
  const tag = el.tagName.toLowerCase();
  const pts = [];

  if (tag === 'path' || tag === 'polygon' || tag === 'polyline') {
    if (tag === 'polygon' || tag === 'polyline') {
      const nums = (el.getAttribute('points') || '').trim().split(/[\s,]+/).filter(Boolean);
      for (let i = 0; i + 1 < nums.length; i += 2) {
        pts.push({ x: parseFloat(nums[i]), y: parseFloat(nums[i + 1]) });
      }
      return pts.length >= 3 ? pts : null;
    }
    // path — use getTotalLength/getPointAtLength
    const len = el.getTotalLength();
    if (len <= 0) return null;
    const N = Math.min(256, Math.max(16, Math.ceil(len / 2)));
    for (let i = 0; i < N; i++) {
      const p = el.getPointAtLength((i / N) * len);
      pts.push({ x: p.x, y: p.y });
    }
    return pts.length >= 3 ? pts : null;
  }

  if (tag === 'rect') {
    const x = parseFloat(el.getAttribute('x') || 0);
    const y = parseFloat(el.getAttribute('y') || 0);
    const w = parseFloat(el.getAttribute('width') || 0);
    const h = parseFloat(el.getAttribute('height') || 0);
    return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
  }
  if (tag === 'circle') {
    const cx = parseFloat(el.getAttribute('cx') || 0);
    const cy = parseFloat(el.getAttribute('cy') || 0);
    const r  = parseFloat(el.getAttribute('r') || 0);
    for (let i = 0; i < 64; i++) {
      const a = (2 * Math.PI * i) / 64;
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    return pts;
  }
  if (tag === 'ellipse') {
    const cx = parseFloat(el.getAttribute('cx') || 0);
    const cy = parseFloat(el.getAttribute('cy') || 0);
    const rx = parseFloat(el.getAttribute('rx') || 0);
    const ry = parseFloat(el.getAttribute('ry') || 0);
    for (let i = 0; i < 64; i++) {
      const a = (2 * Math.PI * i) / 64;
      pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
    }
    return pts;
  }
  return null;
}

/**
 * Ray-casting point-in-polygon test.
 * pts must be in the same coordinate space as (px, py).
 */
function pbPointInPoly(px, py, pts) {
  let inside = false;
  const n = pts.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i].x, yi = pts[i].y;
    const xj = pts[j].x, yj = pts[j].y;
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Extract the exact geometry from a boundary element as a native SVG shape
 * descriptor. Never re-samples or approximates — copies the original SVG
 * attributes verbatim so the fill perfectly matches the CAD outline.
 *
 * Returns { type, attributes, transform } or null.
 *   type       – the native SVG tag: 'path' | 'polygon' | 'rect' | 'circle' | 'ellipse'
 *   attributes – exact geometry attrs copied from the source element
 *   transform  – accumulated transform string (element → SVG root user-space)
 */
function paintBucketExtractGeometry(el, svgEl) {
  const tag = el.tagName.toLowerCase();

  // ── Accumulate the full transform chain (element → SVG root) ──────────
  // el.getCTM() gives element-local → SVG-viewport.  svgEl.getCTM()
  // gives SVG-root-userspace → SVG-viewport.  We want element-local →
  // SVG-root-userspace, so we multiply el.getCTM() by svgEl.getCTM()⁻¹.
  let transformStr = '';
  try {
    const elCTM  = el.getCTM();
    const svgCTM = svgEl.getCTM();
    if (elCTM && svgCTM) {
      const inv = svgCTM.inverse();
      const m   = inv.multiply(elCTM);
      // Only emit a matrix() if it's not the identity
      const isIdentity =
        Math.abs(m.a - 1) < 1e-6 && Math.abs(m.b) < 1e-6 &&
        Math.abs(m.c) < 1e-6 && Math.abs(m.d - 1) < 1e-6 &&
        Math.abs(m.e) < 1e-6 && Math.abs(m.f) < 1e-6;
      if (!isIdentity) {
        transformStr = `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`;
      }
    }
  } catch (_) {
    // If getCTM fails (e.g. element not in DOM), fall back to the element's
    // own transform attribute.
    transformStr = el.getAttribute('transform') || '';
  }

  try {
    if (tag === 'path') {
      // Copy the original 'd' attribute verbatim — never re-sample
      const d = el.getAttribute('d');
      if (!d) return null;
      return { type: 'path', attributes: { d }, transform: transformStr };
    }

    if (tag === 'polygon' || tag === 'polyline') {
      // Copy the exact points attribute
      const points = el.getAttribute('points');
      if (!points || !points.trim()) return null;
      return { type: 'polygon', attributes: { points }, transform: transformStr };
    }

    if (tag === 'rect') {
      // Copy all geometry attributes including rx/ry for rounded corners
      const attrs = {};
      for (const attr of ['x', 'y', 'width', 'height', 'rx', 'ry']) {
        const v = el.getAttribute(attr);
        if (v != null && v !== '') attrs[attr] = v;
      }
      if (!attrs.width || !attrs.height) return null;
      return { type: 'rect', attributes: attrs, transform: transformStr };
    }

    if (tag === 'circle') {
      const attrs = {};
      for (const attr of ['cx', 'cy', 'r']) {
        const v = el.getAttribute(attr);
        if (v != null && v !== '') attrs[attr] = v;
      }
      if (!attrs.r) return null;
      return { type: 'circle', attributes: attrs, transform: transformStr };
    }

    if (tag === 'ellipse') {
      const attrs = {};
      for (const attr of ['cx', 'cy', 'rx', 'ry']) {
        const v = el.getAttribute(attr);
        if (v != null && v !== '') attrs[attr] = v;
      }
      if (!attrs.rx || !attrs.ry) return null;
      return { type: 'ellipse', attributes: attrs, transform: transformStr };
    }
  } catch (_) {}
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function CadEditorCanvas({ svgContent, activeTool, strokeWidth = 2, eraserSize = 10, fillColor = '#3b82f6', fillOpacity = 1.0, onZoomChange, onCoordsChange, onSvgModified, onToolChange, onSelectionChange }) {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const svgRef = useRef(null);

  const [documentState, setDocumentState] = useState({ viewBox: "0 0 100 100", shapes: [] });
  const hasInitializedRef = useRef(false);
  const internalUpdateRef = useRef(false);

  // Transformation state
  const transform = useRef({ x: 0, y: 0, scale: 1 });
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const reqFrame = useRef(null);

  // For pointer/space pan
  const [isSpaceDown, setIsSpaceDown] = useState(false);
  const isSpaceDownRef = useRef(false);

  // Drawing state
  const [drawStart, setDrawStart] = useState(null);
  const [currentDrawCoords, setCurrentDrawCoords] = useState(null);
  const [drawStep, setDrawStep] = useState(0);
  const [drawEnd, setDrawEnd] = useState(null);
  const [drawPoints, setDrawPoints] = useState([]);
  const [textInput, setTextInput] = useState(null);
  
  // Selection & Transform state
  const [selectedShapeIdss, setSelectedShapeIds] = useState([]);
  const [clipboard, setClipboard] = useState(null);

  // Partial Delete state
  const [pdMarquee, setPdMarquee] = useState(null);        // { x1, y1, x2, y2 } in SVG coords
  const [pdMarqueeActive, setPdMarqueeActive] = useState(false); // true while dragging
  const [pdHits, setPdHits] = useState([]);                 // [{ shapeId, hitIndices, shapeType }]

  // Vector Eraser state
  const [veDragging, setVeDragging] = useState(false);
  const [veCursorCoords, setVeCursorCoords] = useState(null);
  const [veModified, setVeModified] = useState(false);
  const [pendingVeSave, setPendingVeSave] = useState(false);

  // Sync zoom/coords throttled
  const notifyChanges = () => {
    onZoomChange(transform.current.scale * 100);
  };

  // Wrapper: always mark internal updates so the svgContent sync effect skips re-parsing
  const notifySvgModified = (svgString) => {
    if (onSvgModified) {
      internalUpdateRef.current = true;
      onSvgModified(svgString);
    }
  };

  useEffect(() => {
    if (pendingVeSave) {
      notifySvgModified(serializeStateToSvgString(documentState.shapes, documentState.viewBox));
      setPendingVeSave(false);
    }
  }, [pendingVeSave, documentState.shapes, documentState.viewBox]);

  useEffect(() => {
    if (activeTool !== 'draw_text' && textInput) {
      commitText(textInput);
    }
    // Clear selection when switching away from pointer so the overlay SVG
    // (which only renders when selectedShapeIds is set) doesn't intercept
    // paint_bucket, eraser, or drawing tool clicks.
    if (activeTool !== 'pointer' && selectedShapeIds.length > 0) {
      setSelectedShapeId(null);
    }
    // Clear partial delete state when switching away from the tool
    if (activeTool !== 'partial_delete') {
      setPdMarquee(null);
      setPdMarqueeActive(false);
      setPdHits([]);
    }
    // Clear vector eraser state
    if (activeTool !== 'vector_eraser') {
      setVeDragging(false);
      setVeCursorCoords(null);
      setVeModified(false);
    }
  }, [activeTool]);

  const getPointerCoords = (clientX, clientY) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = (clientX - rect.left - transform.current.x) / transform.current.scale;
    const y = (clientY - rect.top - transform.current.y) / transform.current.scale;
    return { x, y: -y }; 
  };

  const getSvgInternalCoords = (clientX, clientY) => {
    if (!svgRef.current) return null;
    const svgEl = svgRef.current.querySelector('svg');
    if (!svgEl) return null;
    
    const pt = svgEl.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    
    try {
      const ctm = svgEl.getScreenCTM();
      if (!ctm) return null;
      const svgP = pt.matrixTransform(ctm.inverse());
      return { x: svgP.x, y: svgP.y };
    } catch (err) {
      return null;
    }
  };

  const applyTransform = () => {
    if (contentRef.current) {
      contentRef.current.style.transform = `translate(${transform.current.x}px, ${transform.current.y}px) scale(${transform.current.scale})`;
    }
    notifyChanges();
  };

  const requestUpdate = () => {
    if (reqFrame.current) cancelAnimationFrame(reqFrame.current);
    reqFrame.current = requestAnimationFrame(applyTransform);
  };

  const setScale = (newScale, mouseX, mouseY) => {
    const minScale = 0.000001;
    const maxScale = 1000000;
    newScale = Math.max(minScale, Math.min(newScale, maxScale));

    const rect = containerRef.current.getBoundingClientRect();
    const x = mouseX !== undefined ? mouseX : rect.left + rect.width / 2;
    const y = mouseY !== undefined ? mouseY : rect.top + rect.height / 2;

    const px = x - rect.left;
    const py = y - rect.top;

    const deltaScale = newScale / transform.current.scale;

    transform.current.x = px - (px - transform.current.x) * deltaScale;
    transform.current.y = py - (py - transform.current.y) * deltaScale;
    transform.current.scale = newScale;
    
    requestUpdate();
  };

  const fitToScreen = useCallback(() => {
    if (!containerRef.current || !svgRef.current) return;
    transform.current.scale = 1;
    transform.current.x = 0;
    transform.current.y = 0;
    requestUpdate();
  }, []);

  useEffect(() => {
    const handleFitScreen = () => fitToScreen();
    window.addEventListener('editor-fit-screen', handleFitScreen);
    return () => window.removeEventListener('editor-fit-screen', handleFitScreen);
  }, [fitToScreen]);

  useEffect(() => {
    if (svgContent && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      setDocumentState(parseSvgStringToState(svgContent));
      setTimeout(fitToScreen, 100);
    } else if (svgContent && hasInitializedRef.current) {
      // Skip re-parsing if the change originated from within the editor
      if (internalUpdateRef.current) {
        internalUpdateRef.current = false;
        return;
      }
      // Sync state if undo/redo modifies the raw string in the parent
      setDocumentState(parseSvgStringToState(svgContent));
    }
  }, [svgContent, fitToScreen]);

  // Notify parent about selection changes so the sidebar can show shape properties
  useEffect(() => {
    if (onSelectionChange) {
      const shape = selectedShapeIds
        ? findShapeDeep(documentState.shapes, selectedShapeIds) ?? null
        : null;
      onSelectionChange(selectedShapeIds, documentState.shapes.filter(s => selectedShapeIds.includes(s.id)));
    }
  }, [selectedShapeIds, documentState.shapes]);

  // Allow external code (sidebar) to patch a shape's attributes via a custom DOM event.
  // The event is dispatched by CadEditorWorkspace whenever onStrokeWidthChange is called.
  useEffect(() => {
    const handler = (e) => {
      const { id, patch } = e.detail;
      setDocumentState(prev => {
        const patchRecursive = (shapes) => {
          return shapes.map(s => {
            if (s.id === id) {
              const newAttrs = { ...s.attributes, ...patch };
              if (
                s.type === 'path' &&
                s.attributes['data-cad-type'] === 'arrow' &&
                'stroke-width' in patch
              ) {
                const p1 = { x: parseFloat(s.attributes['data-start-x']), y: parseFloat(s.attributes['data-start-y']) };
                const p2 = { x: parseFloat(s.attributes['data-end-x']), y: parseFloat(s.attributes['data-end-y']) };
                const sw = parseFloat(patch['stroke-width']) || 2;
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                const headLen = Math.min(sw * 10, dist * 0.3);
                const ao = Math.PI / 6;
                const h1 = { x: p2.x - headLen * Math.cos(angle - ao), y: p2.y - headLen * Math.sin(angle - ao) };
                const h2 = { x: p2.x - headLen * Math.cos(angle + ao), y: p2.y - headLen * Math.sin(angle + ao) };
                newAttrs.d = `M ${h1.x} ${h1.y} L ${p2.x} ${p2.y} L ${h2.x} ${h2.y} M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
              }
              return { ...s, attributes: newAttrs };
            }
            if (s.children && s.children.length > 0) {
              return { ...s, children: patchRecursive(s.children) };
            }
            return s;
          });
        };
        const updatedShapes = patchRecursive(prev.shapes);

        // Defer the parent notification so it doesn't trigger a setState on
        // CadEditorWorkspace while CadEditorCanvas is still in its own render.
        if (onSvgModified) {
          const svgString = serializeStateToSvgString(updatedShapes, prev.viewBox);
          setTimeout(() => {
            internalUpdateRef.current = true;
            onSvgModified(svgString);
          }, 0);
        }

        return { ...prev, shapes: updatedShapes };
      });
    };
    window.addEventListener('cad-patch-shape', handler);
    return () => window.removeEventListener('cad-patch-shape', handler);
  }, [onSvgModified]);

  const deleteSelectedShape = () => {
    if ((selectedShapeIds.length === 0)) return;
    const newShapes = deleteShapeDeep(documentState.shapes, selectedShapeIds);
    setDocumentState({ ...documentState, shapes: newShapes });
    setSelectedShapeId(null);
    if (onSvgModified) notifySvgModified(serializeStateToSvgString(newShapes, documentState.viewBox));
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !isSpaceDownRef.current) {
        setIsSpaceDown(true);
        isSpaceDownRef.current = true;
      }

      if (e.key === 'Escape') {
        if (activeTool === 'vector_eraser' && veDragging) {
          setVeDragging(false);
          setVeModified(false);
        } else if (activeTool === 'partial_delete' && (pdMarquee || pdHits.length > 0)) {
          setPdMarquee(null);
          setPdMarqueeActive(false);
          setPdHits([]);
        } else if (drawStart || drawPoints.length > 0) {
          setDrawStart(null);
          setDrawEnd(null);
          setCurrentDrawCoords(null);
          setDrawStep(0);
          setDrawPoints([]);
        } else if (selectedShapeIds.length > 0) {
          setSelectedShapeId(null);
        }
      }

      // ── Partial Delete: Delete key commits the deletion ────────────────
      if (activeTool === 'partial_delete' && pdHits.length > 0 &&
          (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        let newShapes = [...documentState.shapes];

        // Process each hit shape (in reverse index order to avoid shifting)
        const hitsByShape = new Map();
        for (const hit of pdHits) {
          if (!hitsByShape.has(hit.shapeId)) {
            hitsByShape.set(hit.shapeId, []);
          }
          hitsByShape.get(hit.shapeId).push(...hit.hitIndices);
        }

        for (const [shapeId, hitIndices] of hitsByShape) {
          const shapeIdx = newShapes.findIndex(s => s.id === shapeId);
          if (shapeIdx === -1) {
            // Try to find in children (nested shapes)
            const findInChildren = (shapes, id) => {
              for (const s of shapes) {
                if (s.id === id) return s;
                if (s.children?.length) {
                  const found = findInChildren(s.children, id);
                  if (found) return found;
                }
              }
              return null;
            };
            const shape = findInChildren(newShapes, shapeId);
            if (!shape) continue;

            const replacements = applyPartialDelete(shape, hitIndices);
            if (!replacements) continue;

            // Replace in the nested tree
            const replaceInTree = (shapes, targetId, replacements) => {
              const result = [];
              for (const s of shapes) {
                if (s.id === targetId) {
                  result.push(...replacements);
                } else {
                  if (s.children?.length) {
                    result.push({ ...s, children: replaceInTree(s.children, targetId, replacements) });
                  } else {
                    result.push(s);
                  }
                }
              }
              return result;
            };
            newShapes = replaceInTree(newShapes, shapeId, replacements);
            continue;
          }

          const shape = newShapes[shapeIdx];
          const replacements = applyPartialDelete(shape, hitIndices);
          if (!replacements) continue;

          // Splice: remove original, insert replacements at same position
          newShapes.splice(shapeIdx, 1, ...replacements);
        }

        setDocumentState(prev => ({ ...prev, shapes: newShapes }));
        notifySvgModified(serializeStateToSvgString(newShapes, documentState.viewBox));
        setPdMarquee(null);
        setPdMarqueeActive(false);
        setPdHits([]);
        console.log('[PartialDelete] Deleted segments from', hitsByShape.size, 'shape(s)');
      }

      if (activeTool === 'pointer' && selectedShapeIds.length > 0) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          deleteSelectedShape();
        }
        
        if (e.ctrlKey || e.metaKey) {
          if (e.key === 'c') {
            const shapeToCopy = documentState.shapes.find(s => s.id === selectedShapeIds);
            if (shapeToCopy) {
              setClipboard(JSON.parse(JSON.stringify(shapeToCopy))); // deep copy
            }
          }
          if (e.key === 'd') {
            e.preventDefault();
            const shapeToCopy = documentState.shapes.find(s => s.id === selectedShapeIds);
            if (shapeToCopy) {
              duplicateShape(JSON.parse(JSON.stringify(shapeToCopy)));
            }
          }
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard) {
        duplicateShape(clipboard);
      }
    };

    const duplicateShape = (shapeObj) => {
      if (!shapeObj) return;
      const newId = `cad-shape-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const newShape = { ...shapeObj, id: newId };
      
      const newShapes = [...documentState.shapes, newShape];
      setDocumentState({ ...documentState, shapes: newShapes });
      if (onSvgModified) notifySvgModified(serializeStateToSvgString(newShapes, documentState.viewBox));
      
      setTimeout(() => {
        onToolChange?.('pointer');
        setSelectedShapeId(newId);
      }, 50);
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setIsSpaceDown(false);
        isSpaceDownRef.current = false;
        isDragging.current = false;
      }
    };
    
    const handlePolygonComplete = (e) => {
      if ((e.key === 'Enter' || e.key === 'Escape') && drawPoints.length > 1) {
        commitDrawingPolygon(drawPoints);
        setDrawPoints([]);
        setCurrentDrawCoords(null);
      } else if (e.key === 'Escape' && drawPoints.length <= 1) {
        setDrawPoints([]);
        setCurrentDrawCoords(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', handlePolygonComplete);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keydown', handlePolygonComplete);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [documentState, fitToScreen, activeTool, selectedShapeIds, clipboard, pdMarquee, pdHits, veDragging, veCursorCoords]);

  const performVectorErase = (coords) => {
    const circle = { cx: coords.x, cy: coords.y, r: eraserSize || 1 };
    
    setDocumentState(prev => {
      const processTree = (shapes) => {
        let treeChanged = false;
        const result = [];
        for (const shape of shapes) {
          if (shape.attributes?.['data-cad-type'] === 'hatch') {
            result.push(shape);
            continue;
          }
          const replacements = applyVectorErase(shape, circle);
          if (replacements !== null) {
            treeChanged = true;
            result.push(...replacements);
          } else if (shape.children?.length) {
            const { newShapes: newChildren, changed: childChanged } = processTree(shape.children);
            if (childChanged) {
              treeChanged = true;
              result.push({ ...shape, children: newChildren });
            } else {
              result.push(shape);
            }
          } else {
            result.push(shape);
          }
        }
        return { newShapes: result, changed: treeChanged };
      };
      
      const { newShapes, changed } = processTree(prev.shapes);
      
      if (changed) {
        setVeModified(true);
        return { ...prev, shapes: newShapes };
      }
      return prev;
    });
  };

  const handlePointerDown = (e) => {
    // Deselect when clicking on empty canvas with pointer tool
    if (activeTool === 'pointer' && e.button === 0 && selectedShapeIds.length > 0) {
      // Only deselect if the click target is the container background (not any SVG element)
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'div') {
        setSelectedShapeId(null);
      }
    }

    // ── Partial Delete: start marquee ──────────────────────────────────
    if (activeTool === 'partial_delete' && e.button === 0) {
      const coords = getSvgInternalCoords(e.clientX, e.clientY);
      if (coords) {
        setPdMarquee({ x1: coords.x, y1: coords.y, x2: coords.x, y2: coords.y });
        setPdMarqueeActive(true);
        setPdHits([]);
      }
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    // ── Vector Eraser: start erasing ───────────────────────────────────
    if (activeTool === 'vector_eraser' && e.button === 0) {
      const coords = getSvgInternalCoords(e.clientX, e.clientY);
      if (coords) {
        setVeCursorCoords(coords);
        setVeDragging(true);
        setVeModified(false);
        performVectorErase(coords);
      }
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    if (activeTool === 'draw_line' || activeTool === 'draw_circle' || activeTool === 'draw_arrow' || activeTool === 'draw_curve') {
      if (e.button === 0) {
        if (selectedShapeIds.length > 0) setSelectedShapeId(null);
        const internalCoords = getSvgInternalCoords(e.clientX, e.clientY);
        if (internalCoords) {
          if (activeTool === 'draw_curve' && drawStart && drawStep === 1) {
            setDrawEnd(internalCoords);
            setCurrentDrawCoords(internalCoords);
            setDrawStep(2);
          } else {
            setDrawStart(internalCoords);
            setCurrentDrawCoords(internalCoords);
            setDrawStep(1);
          }
        }
        e.stopPropagation();
        e.preventDefault();
        return;
      }
    } else if (activeTool === 'draw_polygon' && e.button === 0) {
      if (selectedShapeIds.length > 0) setSelectedShapeId(null);
      const internalCoords = getSvgInternalCoords(e.clientX, e.clientY);
      if (internalCoords) {
        setDrawPoints(prev => [...prev, internalCoords]);
        setCurrentDrawCoords(internalCoords);
      }
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    if (activeTool === 'draw_text' && e.button === 0) {
      if (selectedShapeIds.length > 0) setSelectedShapeId(null);
      if (textInput) {
        commitText(textInput);
      } else {
        const internalCoords = getSvgInternalCoords(e.clientX, e.clientY);
        if (internalCoords) {
          setTextInput({ x: internalCoords.x, y: internalCoords.y, value: '', screenX: e.clientX, screenY: e.clientY - 10 });
        }
      }
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    const isDrawingTool = activeTool === 'draw_line' || activeTool === 'draw_circle' || activeTool === 'draw_polygon' || activeTool === 'draw_text' || activeTool === 'draw_arrow';
    // paint_bucket and eraser handle clicks via handleSvgPointerDown — never pan on left-click
    const isClickTool = activeTool === 'eraser' || activeTool === 'paint_bucket' || activeTool === 'partial_delete' || activeTool === 'vector_eraser';
    if (e.button === 1 || isSpaceDownRef.current || (e.button === 0 && !isDrawingTool && !isClickTool)) {
      if (textInput) commitText(textInput);
      isDragging.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  };

  // Recursively find a shape in the tree
  const findShapeDeep = (shapes, id) => {
    for (const s of shapes) {
      if (s.id === id) return s;
      if (s.children && s.children.length > 0) {
        const found = findShapeDeep(s.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // Recursively delete a shape from the tree
  const deleteShapeDeep = (shapes, targetId) => {
    return shapes.filter(s => s.id !== targetId).map(s => {
      if (s.children && s.children.length > 0) {
        return { ...s, children: deleteShapeDeep(s.children, targetId) };
      }
      return s;
    });
  };

  // Resolve a click target to the best shape ID in documentState.
  // Prefers the most specific (deepest) fillable element over parent groups.
  const resolveShapeId = (targetEl) => {
    const FILLABLE_TAGS = new Set(['path', 'polyline', 'polygon', 'rect', 'circle', 'ellipse', 'line', 'text', 'tspan', 'use']);
    // First pass: walk up looking for a tracked fillable element (not a <g>)
    let el = targetEl;
    while (el && el.tagName?.toLowerCase() !== 'svg') {
      if (FILLABLE_TAGS.has(el.tagName?.toLowerCase()) && el.id && findShapeDeep(documentState.shapes, el.id)) {
        return el.id;
      }
      el = el.parentElement;
    }
    // Second pass: accept a <g> if that's all we have
    el = targetEl;
    while (el && el.tagName?.toLowerCase() !== 'svg') {
      if (el.id && findShapeDeep(documentState.shapes, el.id)) {
        return el.id;
      }
      el = el.parentElement;
    }
    return null;
  };

  // Update a shape deep in the tree
  const updateShapeDeep = (shapes, targetId, updater) => {
    return shapes.map(s => {
      if (s.id === targetId) {
        return updater(s);
      }
      if (s.children && s.children.length > 0) {
        return { ...s, children: updateShapeDeep(s.children, targetId, updater) };
      }
      return s;
    });
  };

  const handleSvgPointerDown = (e) => {
    const target = e.target;
    if (!target || !target.tagName) return;
    const tag = target.tagName.toLowerCase();
    const isShape = ['path', 'line', 'circle', 'ellipse', 'rect', 'polygon', 'polyline', 'text', 'tspan', 'use', 'g'].includes(tag);

    if (activeTool === 'eraser') {
      if (tag !== 'svg' && tag !== 'div') {
        const shapeId = resolveShapeId(target);
        if (shapeId) {
          const newShapes = deleteShapeDeep(documentState.shapes, shapeId);
          setDocumentState({ ...documentState, shapes: newShapes });
          notifySvgModified(serializeStateToSvgString(newShapes, documentState.viewBox));
          e.stopPropagation();
        }
      }

    } else if (activeTool === 'paint_bucket' && e.button === 0) {
      // ── Paint Bucket ────────────────────────────────────────────────────
      const svgEl = svgRef.current?.querySelector('svg');
      if (!svgEl) { e.stopPropagation(); return; }

      // Always use the main document SVG — NOT the overlay SVG.
      // Verify we have the right element by checking it contains the DWG shapes.
      // If svgEl has no children, it means we somehow got the overlay SVG.
      console.log('[PaintBucket] Active');
      console.log('[PaintBucket] SVG element outerHTML (first 120 chars):', svgEl.outerHTML?.slice(0, 120));
      console.log('[PaintBucket] SVG childElementCount:', svgEl.childElementCount);

      const clickSvg = getSvgInternalCoords(e.clientX, e.clientY);
      console.log('[PaintBucket] Clicked Position (SVG):', clickSvg ? `${clickSvg.x.toFixed(2)}, ${clickSvg.y.toFixed(2)}` : '(unknown)');
      console.log('[PaintBucket] Clicked element:', tag, target.id || '(no id)');
      console.log('[PaintBucket] e.clientX:', e.clientX, 'e.clientY:', e.clientY);

      // Log the SVG coordinate system
      try {
        const sCTM = svgEl.getScreenCTM();
        console.log('[PaintBucket] svgEl.getScreenCTM():', sCTM ? `a=${sCTM.a.toFixed(4)} b=${sCTM.b.toFixed(4)} c=${sCTM.c.toFixed(4)} d=${sCTM.d.toFixed(4)} e=${sCTM.e.toFixed(2)} f=${sCTM.f.toFixed(2)}` : 'null');
      } catch (_) {}
      console.log('[PaintBucket] viewBox:', documentState.viewBox);

      // Find the smallest closed region containing the click (Shoelace area sort)
      const result = paintBucketFindRegion(svgEl, e.clientX, e.clientY);

      // ── Full debug log ──────────────────────────────────────────────────
      console.log('[PaintBucket] Total Closed Entities scanned:', result?.totalClosed ?? 0);
      console.log('[PaintBucket] Containing Entities:', result?.allCandidates?.length ?? 0);
      if (result?.allCandidates) {
        result.allCandidates.forEach((c, i) => {
          const el = c.element;
          console.log(
            `  [${i}] Entity ID: ${el.id || '(no id)'}` +
            `  tag: ${el.tagName}` +
            `  Computed Area: ${c.area.toFixed(2)}` +
            `  BBox: ${c.bbox.w.toFixed(1)}×${c.bbox.h.toFixed(1)} @ (${c.bbox.x.toFixed(1)},${c.bbox.y.toFixed(1)})` +
            (i === 0 ? '  ← SELECTED (smallest area)' : '')
          );
        });
      }

      if (!result) {
        console.log('[PaintBucket] FAIL: No closed region contains the clicked point.');
        e.stopPropagation();
        return;
      }

      const { element: boundaryEl, area, bbox } = result;
      console.log('[PaintBucket] Selected Entity:', boundaryEl.id || '(no id)', boundaryEl.tagName);
      console.log('[PaintBucket] Reason for Selection: Smallest actual area =', area.toFixed(2), 'among', result.allCandidates.length, 'containing regions');
      console.log('[PaintBucket] Bounding Box:', `${bbox.w.toFixed(1)}×${bbox.h.toFixed(1)}`);

      // ── Boundary highlight (350ms flash) ───────────────────────────────
      const prevStroke        = boundaryEl.getAttribute('stroke');
      const prevStrokeWidth   = boundaryEl.getAttribute('stroke-width');
      const prevStrokeOpacity = boundaryEl.getAttribute('stroke-opacity');
      boundaryEl.setAttribute('stroke', '#facc15');
      boundaryEl.setAttribute('stroke-width', '3');
      boundaryEl.setAttribute('stroke-opacity', '1');
      setTimeout(() => {
        if (prevStroke === null)        boundaryEl.removeAttribute('stroke');
        else                            boundaryEl.setAttribute('stroke', prevStroke);
        if (prevStrokeWidth === null)   boundaryEl.removeAttribute('stroke-width');
        else                            boundaryEl.setAttribute('stroke-width', prevStrokeWidth);
        if (prevStrokeOpacity === null) boundaryEl.removeAttribute('stroke-opacity');
        else                            boundaryEl.setAttribute('stroke-opacity', prevStrokeOpacity);
      }, 350);

      // ── Extract exact geometry (never approximate) ──────────────────────
      const geometry = paintBucketExtractGeometry(boundaryEl, svgEl);
      if (!geometry) {
        console.log('[PaintBucket] FAIL: Could not extract geometry from', boundaryEl.tagName);
        e.stopPropagation();
        return;
      }

      console.log('[PaintBucket] Extracted geometry: type =', geometry.type,
        ' attrs =', JSON.stringify(geometry.attributes),
        ' transform =', geometry.transform || '(none)');

      // ── Replace or create hatch ─────────────────────────────────────────
      // Use the boundary element's ID for reliable duplicate detection
      // (works for all element types — path, rect, circle, ellipse, polygon)
      const boundaryRef = boundaryEl.id || '';
      const existingIdx = boundaryRef
        ? documentState.shapes.findIndex(
            s => s.attributes?.['data-cad-type'] === 'hatch' &&
                 s.attributes?.['data-boundary-ref'] === boundaryRef
          )
        : -1;

      if (existingIdx !== -1) {
        const updatedShapes = documentState.shapes.map((s, i) =>
          i === existingIdx
            ? { ...s, attributes: { ...s.attributes, fill: fillColor, 'fill-opacity': String(fillOpacity) } }
            : s
        );
        setDocumentState(prev => ({ ...prev, shapes: updatedShapes }));
        notifySvgModified(serializeStateToSvgString(updatedShapes, documentState.viewBox));
        console.log('[PaintBucket] Updated existing hatch color →', fillColor);
        console.log('[PaintBucket] Save: queued via onSvgModified ✓');
        e.stopPropagation();
        return;
      }

      // Prepend new hatch so it renders below all DWG geometry
      const hatchId = `hatch-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      const hatchShape = {
        id: hatchId,
        type: geometry.type,
        attributes: {
          ...geometry.attributes,
          fill: fillColor,
          'fill-opacity': String(fillOpacity),
          stroke: 'none',
          'data-cad-type': 'hatch',
          'data-boundary-ref': boundaryRef,
          'pointer-events': 'none',
        },
        rawTransform: geometry.transform || '',
        children: [],
      };

      const newShapes = [hatchShape, ...documentState.shapes];
      setDocumentState(prev => ({ ...prev, shapes: newShapes }));
      notifySvgModified(serializeStateToSvgString(newShapes, documentState.viewBox));

      console.log('[PaintBucket] Fill applied: ID =', hatchId, ' type =', geometry.type, ' color =', fillColor, ' opacity =', fillOpacity);
      console.log('[PaintBucket] Save: queued via onSvgModified ✓');
      e.stopPropagation();
    } else if (e.button === 0) {
      if (isShape) {
        const shapeId = resolveShapeId(target);
        if (shapeId) {
          setSelectedShapeId(shapeId);
        
          // Double click to edit text
          if ((tag === 'text' || tag === 'tspan') && e.detail === 2) {
            const shape = findShapeDeep(documentState.shapes, shapeId);
            if (shape) {
              const internalCoords = getSvgInternalCoords(e.clientX, e.clientY);
              setTextInput({
                 x: shape.attributes.x || (internalCoords ? internalCoords.x : 0),
                 y: shape.attributes.y || (internalCoords ? internalCoords.y : 0),
                 value: shape.textContent || '',
                 screenX: e.clientX,
                 screenY: e.clientY - 10,
                 editingShapeId: shape.id
              });
            }
          }
        
          e.stopPropagation();
        }
      } else if (tag === 'svg' && selectedShapeIds.length > 0) {
        // Clicking empty canvas deselects the current object (MS Paint behavior)
        setSelectedShapeId(null);
      }
    }
  };

  const handlePointerMove = (e) => {
    onCoordsChange(getPointerCoords(e.clientX, e.clientY));

    if (drawStart && (activeTool === 'draw_line' || activeTool === 'draw_circle' || activeTool === 'draw_arrow' || activeTool === 'draw_curve')) {
      const internalCoords = getSvgInternalCoords(e.clientX, e.clientY);
      if (internalCoords) {
        setCurrentDrawCoords(internalCoords);
      }
    }
    
    if (drawPoints.length > 0 && activeTool === 'draw_polygon') {
      const internalCoords = getSvgInternalCoords(e.clientX, e.clientY);
      if (internalCoords) {
        setCurrentDrawCoords(internalCoords);
      }
    }

    // ── Partial Delete: update marquee and compute hits ──────────────────
    if (activeTool === 'partial_delete' && pdMarqueeActive && pdMarquee) {
      const coords = getSvgInternalCoords(e.clientX, e.clientY);
      if (coords) {
        const newMarquee = { ...pdMarquee, x2: coords.x, y2: coords.y };
        setPdMarquee(newMarquee);

        // Compute selection rect (normalise so x,y is top-left)
        const rect = {
          x: Math.min(newMarquee.x1, newMarquee.x2),
          y: Math.min(newMarquee.y1, newMarquee.y2),
          w: Math.abs(newMarquee.x2 - newMarquee.x1),
          h: Math.abs(newMarquee.y2 - newMarquee.y1),
        };

        // Only test if the marquee has some size
        if (rect.w > 0.5 || rect.h > 0.5) {
          const hits = [];
          const testShapes = (shapes) => {
            for (const shape of shapes) {
              if (shape.attributes?.['data-cad-type'] === 'hatch') continue;
              const result = findHitsForShape(shape, rect);
              if (result && result.hitIndices.length > 0) {
                hits.push({ shapeId: shape.id, hitIndices: result.hitIndices, shapeType: result.shapeType });
              }
              if (shape.children?.length) testShapes(shape.children);
            }
          };
          testShapes(documentState.shapes);
          setPdHits(hits);
        } else {
          setPdHits([]);
        }
      }
    }

    // ── Vector Eraser: track cursor and erase hits ───────────────────────
    if (activeTool === 'vector_eraser') {
      const coords = getSvgInternalCoords(e.clientX, e.clientY);
      if (coords) {
        setVeCursorCoords(coords);
        if (veDragging) {
          performVectorErase(coords);
        }
      }
    }

    if (isDragging.current) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      transform.current.x += dx;
      transform.current.y += dy;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      requestUpdate();
    }
  };

  const commitDrawing = (start, end, control = null) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) return;

    const shapeId = `cad-shape-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newShape = {
      id: shapeId,
      type: '',
      attributes: { stroke: "#ffffff", "stroke-width": strokeWidth, fill: "none", "vector-effect": "non-scaling-stroke" },
      transform: { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1 },
      children: []
    };

    if (activeTool === 'draw_line') {
      newShape.type = 'line';
      Object.assign(newShape.attributes, { x1: start.x, y1: start.y, x2: end.x, y2: end.y });
    } else if (activeTool === 'draw_arrow') {
      newShape.type = 'path';
      newShape.attributes.d = calculateArrowPath(start, end, strokeWidth);
      newShape.attributes["stroke-linejoin"] = "round";
      newShape.attributes["stroke-linecap"] = "round";
      newShape.attributes["data-cad-type"] = "arrow";
      newShape.attributes["data-start-x"] = start.x;
      newShape.attributes["data-start-y"] = start.y;
      newShape.attributes["data-end-x"] = end.x;
      newShape.attributes["data-end-y"] = end.y;
    } else if (activeTool === 'draw_circle') {
      newShape.type = 'circle';
      const dist = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
      Object.assign(newShape.attributes, { cx: start.x, cy: start.y, r: dist });

    }

    const newShapes = [...documentState.shapes, newShape];
    setDocumentState({ ...documentState, shapes: newShapes });
    
    if (onSvgModified) {
      notifySvgModified(serializeStateToSvgString(newShapes, documentState.viewBox));
    }
    setTimeout(() => {
      setSelectedShapeId(shapeId);
    }, 50);
  };

  const commitDrawingCurve = (start, control, end) => {
    const shapeId = `cad-shape-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newShape = {
      id: shapeId,
      type: 'path',
      attributes: { d: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`, stroke: "#ffffff", "stroke-width": strokeWidth, fill: "none", "vector-effect": "non-scaling-stroke" },
      transform: { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1 },
      children: []
    };

    const newShapes = [...documentState.shapes, newShape];
    setDocumentState({ ...documentState, shapes: newShapes });
    
    if (onSvgModified) {
      notifySvgModified(serializeStateToSvgString(newShapes, documentState.viewBox));
    }
    setTimeout(() => {
      setSelectedShapeId(shapeId);
      onToolChange?.('pointer');
    }, 50);
  };

  const commitDrawingPolygon = (points) => {
    if (points.length < 2) return;
    
    const shapeId = `cad-shape-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');
    
    const newShape = {
      id: shapeId,
      type: 'polyline',
      attributes: { points: pointsStr, fill: "none", stroke: "#ffffff", "stroke-width": strokeWidth, "vector-effect": "non-scaling-stroke" },
      transform: { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1 },
      children: []
    };
    
    const newShapes = [...documentState.shapes, newShape];
    setDocumentState({ ...documentState, shapes: newShapes });
    if (onSvgModified) notifySvgModified(serializeStateToSvgString(newShapes, documentState.viewBox));

    setTimeout(() => {
      setSelectedShapeId(shapeId);
    }, 50);
  };

  const commitText = (tInput) => {
    if (!tInput || !tInput.value.trim()) {
      setTextInput(null);
      return;
    }
    
    if (tInput.editingShapeId) {
       const newShapes = documentState.shapes.map(s => {
         if (s.id === tInput.editingShapeId) {
           return { ...s, textContent: tInput.value };
         }
         return s;
       });
       setDocumentState({ ...documentState, shapes: newShapes });
       if (onSvgModified) notifySvgModified(serializeStateToSvgString(newShapes, documentState.viewBox));
       setTextInput(null);
       return;
    }

    const shapeId = `cad-shape-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newShape = {
      id: shapeId,
      type: 'text',
      textContent: tInput.value,
      attributes: { x: tInput.x, y: tInput.y, fill: "#ffffff", "font-size": strokeWidth, "font-family": "sans-serif" },
      transform: { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1 },
      children: []
    };
    
    const newShapes = [...documentState.shapes, newShape];
    setDocumentState({ ...documentState, shapes: newShapes });
    if (onSvgModified) notifySvgModified(serializeStateToSvgString(newShapes, documentState.viewBox));

    setTextInput(null);
    setTimeout(() => {
      setSelectedShapeId(shapeId);
    }, 50);
  };

  const calculateArrowPath = (start, end, strokeW) => {
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const dist = Math.hypot(end.x - start.x, end.y - start.y);
    const headLen = Math.min(strokeW * 10, dist * 0.3);
    const angleOffset = Math.PI / 6;
    
    const head1 = {
      x: end.x - headLen * Math.cos(angle - angleOffset),
      y: end.y - headLen * Math.sin(angle - angleOffset)
    };
    const head2 = {
      x: end.x - headLen * Math.cos(angle + angleOffset),
      y: end.y - headLen * Math.sin(angle + angleOffset)
    };
    return `M ${head1.x} ${head1.y} L ${end.x} ${end.y} L ${head2.x} ${head2.y} M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  };

  const handlePointerUp = (e) => {
    if (activeTool === 'draw_curve' && drawStep === 2 && drawStart && drawEnd) {
      const internalCoords = getSvgInternalCoords(e.clientX, e.clientY) || currentDrawCoords;
      const midX = (drawStart.x + drawEnd.x) / 2;
      const midY = (drawStart.y + drawEnd.y) / 2;
      const dx = internalCoords.x - drawEnd.x;
      const dy = internalCoords.y - drawEnd.y;
      const controlPoint = { x: midX + dx, y: midY + dy };
      
      commitDrawingCurve(drawStart, controlPoint, drawEnd);
      
      setDrawStart(null);
      setDrawEnd(null);
      setCurrentDrawCoords(null);
      setDrawStep(0);
      isDragging.current = false;
      return;
    }

    if (drawStart && currentDrawCoords && activeTool !== 'draw_curve') {
      const endCoords = getSvgInternalCoords(e.clientX, e.clientY) || currentDrawCoords;
      
      commitDrawing(drawStart, endCoords);
      setDrawStart(null);
      setCurrentDrawCoords(null);
    }
    // ── Partial Delete: finalize marquee ────────────────────────────────
    if (activeTool === 'partial_delete' && pdMarqueeActive) {
      setPdMarqueeActive(false);
      // Keep the marquee and hits visible until Delete is pressed or Escape
    }

    // ── Vector Eraser: finalize stroke ──────────────────────────────────
    if (activeTool === 'vector_eraser' && veDragging) {
      setVeDragging(false);
      if (veModified) {
        setPendingVeSave(true);
        setVeModified(false);
      }
    }

    isDragging.current = false;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    if (e.ctrlKey) {
      const zoomFactor = Math.pow(0.99, e.deltaY);
      setScale(transform.current.scale * zoomFactor, e.clientX, e.clientY);
    } else if (!e.shiftKey) {
      const delta = e.deltaY < 0 ? 1 : -1;
      const isTrackpad = Math.abs(e.deltaY) < 50; 
      
      if (isTrackpad) {
        const zoomFactor = Math.pow(0.995, e.deltaY);
        setScale(transform.current.scale * zoomFactor, e.clientX, e.clientY);
      } else {
        const stepAmount = 1.25;
        setScale(delta > 0 ? transform.current.scale * stepAmount : transform.current.scale / stepAmount, e.clientX, e.clientY);
      }
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (el) el.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const getCursor = () => {
    if (activeTool === 'eraser') return 'crosshair';
    if (activeTool === 'partial_delete') return 'crosshair';
    if (activeTool === 'vector_eraser') return 'none'; // Circle drawn in SVG
    if (activeTool === 'paint_bucket') return 'cell';
    if (activeTool === 'draw_line' || activeTool === 'draw_arrow' || activeTool === 'draw_circle' || activeTool === 'draw_polygon' || activeTool === 'draw_curve') return 'crosshair';
    if (activeTool === 'draw_text') return 'text';
    if (activeTool === 'zoom_window') return 'crosshair';
    return isDragging.current ? 'grabbing' : 'grab';
  };

  return (
    <>
      <style>{`
        [data-tool="eraser"] .cad-svg-container svg path,
        [data-tool="eraser"] .cad-svg-container svg line,
        [data-tool="eraser"] .cad-svg-container svg circle,
        [data-tool="eraser"] .cad-svg-container svg ellipse,
        [data-tool="eraser"] .cad-svg-container svg rect,
        [data-tool="eraser"] .cad-svg-container svg polygon,
        [data-tool="eraser"] .cad-svg-container svg polyline,
        [data-tool="eraser"] .cad-svg-container svg text,
        [data-tool="eraser"] .cad-svg-container svg use {
          transition: stroke 0.1s, stroke-width 0.1s, opacity 0.1s;
        }
        [data-tool="eraser"] .cad-svg-container svg path:hover,
        [data-tool="eraser"] .cad-svg-container svg line:hover,
        [data-tool="eraser"] .cad-svg-container svg circle:hover,
        [data-tool="eraser"] .cad-svg-container svg ellipse:hover,
        [data-tool="eraser"] .cad-svg-container svg rect:hover,
        [data-tool="eraser"] .cad-svg-container svg polygon:hover,
        [data-tool="eraser"] .cad-svg-container svg polyline:hover,
        [data-tool="eraser"] .cad-svg-container svg text:hover,
        [data-tool="eraser"] .cad-svg-container svg use:hover {
          stroke: #ef4444 !important;
          stroke-width: 2px !important;
          opacity: 0.8 !important;
          cursor: crosshair !important;
        }
        [data-tool="paint_bucket"] .cad-svg-container svg path:hover,
        [data-tool="paint_bucket"] .cad-svg-container svg circle:hover,
        [data-tool="paint_bucket"] .cad-svg-container svg ellipse:hover,
        [data-tool="paint_bucket"] .cad-svg-container svg rect:hover,
        [data-tool="paint_bucket"] .cad-svg-container svg polygon:hover,
        [data-tool="paint_bucket"] .cad-svg-container svg polyline:hover {
          opacity: 0.7 !important;
          cursor: cell !important;
        }
      `}</style>
      <div 
        ref={containerRef}
        data-tool={activeTool}
        className="w-full h-full relative overflow-hidden"
        style={{
          cursor: getCursor(),
          backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)`,
          backgroundSize: '100px 100px',
          backgroundPosition: `${transform.current.x}px ${transform.current.y}px`
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div 
          ref={contentRef} 
          className="absolute inset-0 pointer-events-none flex items-center justify-center origin-top-left"
          style={{ transform: 'translate(0px, 0px) scale(1)', transformOrigin: '0 0' }}
        >
          <div 
            ref={svgRef}
            className={`text-white w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full cad-svg-container ${(activeTool === 'pointer' || activeTool === 'eraser' || activeTool === 'paint_bucket' || activeTool === 'partial_delete' || activeTool === 'vector_eraser' || activeTool === 'draw_line' || activeTool === 'draw_arrow' || activeTool === 'draw_circle' || activeTool === 'draw_polygon' || activeTool === 'draw_curve' || activeTool === 'draw_text') ? 'pointer-events-auto' : 'pointer-events-none'}`}
          >
             <svg 
               viewBox={documentState.viewBox} 
               style={{ shapeRendering: 'geometricPrecision', textRendering: 'geometricPrecision' }} 
               onPointerDown={handleSvgPointerDown}
             >
               {documentState.shapes.map((shape, index) => (
                 <ShapeRenderer key={`${shape.id}-${index}`} shape={shape} />
               ))}
             </svg>
          </div>
          
          {/* ── Partial Delete Overlay ─────────────────────────────────── */}
          {activeTool === 'partial_delete' && (pdMarquee || pdHits.length > 0) && (
            <div className="absolute inset-0 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full pointer-events-none">
              <svg viewBox={documentState.viewBox} style={{ pointerEvents: 'none' }}>
                {/* Dashed marquee rectangle */}
                {pdMarquee && (() => {
                  const x = Math.min(pdMarquee.x1, pdMarquee.x2);
                  const y = Math.min(pdMarquee.y1, pdMarquee.y2);
                  const w = Math.abs(pdMarquee.x2 - pdMarquee.x1);
                  const h = Math.abs(pdMarquee.y2 - pdMarquee.y1);
                  return (
                    <rect
                      x={x} y={y} width={w} height={h}
                      fill="rgba(239, 68, 68, 0.08)"
                      stroke="#ef4444"
                      strokeWidth="1"
                      strokeDasharray="6 3"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })()}

                {/* Highlighted (hit) segments in red */}
                {pdHits.map((hit, hi) => {
                  const shape = (function findShape(shapes, id) {
                    for (const s of shapes) {
                      if (s.id === id) return s;
                      if (s.children?.length) {
                        const f = findShape(s.children, id);
                        if (f) return f;
                      }
                    }
                    return null;
                  })(documentState.shapes, hit.shapeId);
                  if (!shape) return null;
                  const paths = generateHighlightPaths(shape, hit.hitIndices);
                  return paths.map((d, pi) => (
                    <path
                      key={`pd-hl-${hi}-${pi}`}
                      d={d}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="3"
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                      opacity="0.9"
                      transform={shape.rawTransform || ''}
                    />
                  ));
                })}
              </svg>
            </div>
          )}

          {/* ── Vector Eraser Overlay ──────────────────────────────────── */}
          {activeTool === 'vector_eraser' && veCursorCoords && (
            <div className="absolute inset-0 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full pointer-events-none">
              <svg viewBox={documentState.viewBox} style={{ pointerEvents: 'none' }}>
                <circle 
                  cx={veCursorCoords.x} 
                  cy={veCursorCoords.y} 
                  r={eraserSize || 1} 
                  fill="none"
                  stroke={veDragging ? "#ef4444" : "#ffffff"} 
                  strokeWidth="1.5" 
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
          )}

          {((drawStart && currentDrawCoords) || (drawPoints.length > 0 && currentDrawCoords) || selectedShapeIds) && (
            <div className="absolute inset-0 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full"
              style={{ pointerEvents: activeTool === 'paint_bucket' ? 'none' : undefined }}>
               <svg viewBox={documentState.viewBox} style={{ pointerEvents: activeTool === 'paint_bucket' ? 'none' : 'auto' }}
                 onPointerDown={(e) => {
                   // If the click landed on the overlay SVG background (not a handle), deselect
                   if (e.target.tagName.toLowerCase() === 'svg' && selectedShapeIds.length > 0 && activeTool === 'pointer') {
                     setSelectedShapeId(null);
                   }
                 }}
               >
                 {activeTool === 'draw_line' && drawStart && currentDrawCoords && (
                   <line 
                     x1={drawStart.x} y1={drawStart.y} 
                     x2={currentDrawCoords.x} y2={currentDrawCoords.y} 
                     stroke="#a5b4fc" strokeWidth={strokeWidth} strokeDasharray="4" vectorEffect="non-scaling-stroke" 
                   />
                 )}
                 {activeTool === 'draw_arrow' && drawStart && currentDrawCoords && (
                   <path 
                     d={calculateArrowPath(drawStart, currentDrawCoords, strokeWidth)}
                     fill="none" stroke="#a5b4fc" strokeWidth={strokeWidth} strokeDasharray="4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round"
                   />
                 )}
                 {activeTool === 'draw_circle' && drawStart && currentDrawCoords && (
                   <circle 
                     cx={drawStart.x} cy={drawStart.y} 
                     r={Math.sqrt(Math.pow(currentDrawCoords.x - drawStart.x, 2) + Math.pow(currentDrawCoords.y - drawStart.y, 2))}
                     stroke="#a5b4fc" strokeWidth={strokeWidth} fill="none" strokeDasharray="4" vectorEffect="non-scaling-stroke" 
                   />
                 )}
                 {activeTool === 'draw_curve' && drawStart && currentDrawCoords && drawStep === 1 && (
                   <line 
                     x1={drawStart.x} y1={drawStart.y} 
                     x2={currentDrawCoords.x} y2={currentDrawCoords.y} 
                     stroke="#a5b4fc" strokeWidth={strokeWidth} strokeDasharray="4" vectorEffect="non-scaling-stroke" 
                   />
                 )}
                 {activeTool === 'draw_curve' && drawStart && drawEnd && currentDrawCoords && drawStep === 2 && (
                   <path 
                     d={`M ${drawStart.x} ${drawStart.y} Q ${((drawStart.x + drawEnd.x)/2) + (currentDrawCoords.x - drawEnd.x)} ${((drawStart.y + drawEnd.y)/2) + (currentDrawCoords.y - drawEnd.y)} ${drawEnd.x} ${drawEnd.y}`}
                     fill="none" stroke="#a5b4fc" strokeWidth={strokeWidth} strokeDasharray="4" vectorEffect="non-scaling-stroke" 
                   />
                 )}

                 {activeTool === 'draw_polygon' && drawPoints.length > 0 && currentDrawCoords && (
                   <polyline 
                     points={drawPoints.map(p => `${p.x},${p.y}`).join(' ') + ` ${currentDrawCoords.x},${currentDrawCoords.y}`}
                     fill="none" stroke="#a5b4fc" strokeWidth={strokeWidth} strokeDasharray="4" vectorEffect="non-scaling-stroke" 
                   />
                 )}
                 
                 {selectedShapeIds && (
                   <TransformControls 
                     shape={documentState.shapes.find(s => s.id === selectedShapeIds)}
                     shapeId={selectedShapeIds}
                     svgRef={svgRef}
                     scale={transform.current.scale}
                     onTransformCommit={(newTransformStr, newAttributes) => {
                       // We must update the shape in our state!
                       const updatedShapes = documentState.shapes.map(s => {
                         if (s.id === selectedShapeIds) {
                           return { ...s, rawTransform: newTransformStr, attributes: newAttributes ? { ...s.attributes, ...newAttributes } : s.attributes };
                         }
                         return s;
                       });
                       setDocumentState(prev => ({ ...prev, shapes: updatedShapes }));
                       if (onSvgModified) {
                         notifySvgModified(serializeStateToSvgString(updatedShapes, documentState.viewBox));
                       }
                     }}
                   />
                 )}
               </svg>
            </div>
          )}
        </div>
        
        {/* Floating Text Input */}
        {textInput && (
           <input
             type="text"
             autoFocus
             value={textInput.value}
             onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
             onBlur={() => commitText(textInput)}
             onKeyDown={(e) => {
               if (e.key === 'Enter') commitText(textInput);
               if (e.key === 'Escape') setTextInput(null);
             }}
             className="fixed bg-transparent border border-indigo-500 rounded px-1 outline-none text-white shadow-lg"
             style={{
               left: textInput.screenX,
               top: textInput.screenY,
               fontSize: `${Math.max(12, strokeWidth * (transform.current?.scale || 1))}px`
             }}
             placeholder="Type text..."
           />
        )}
      </div>
    </>
  );
}
