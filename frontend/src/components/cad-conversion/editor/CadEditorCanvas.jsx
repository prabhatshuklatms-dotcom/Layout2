import React, { useRef, useEffect, useState, useCallback } from 'react';
import TransformControls from './TransformControls';
import ShapeRenderer from './ShapeRenderer';
import { parseSvgStringToState, serializeStateToSvgString } from './SvgDocumentModel';
import { findHitsForShape, applyVectorErase, applyPartialDelete, generateHighlightPaths } from './partialDelete';
import { createAmenityPlacement, updateAmenityPlacement, deleteAmenityPlacement } from '@/lib/api';
import AmenitiesOverlay from './AmenitiesOverlay';
import SelectedPlotGeometryOverlay from './SelectedPlotGeometryOverlay';
import usePlotRevealAnimation from '@/hooks/usePlotRevealAnimation';

const ZOOM_LEVELS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 4, 8, 16, 32, 64];

// ─── Paint Bucket helpers (pure, no React deps) ───────────────────────────────

/**
 * Return true if a DOM element represents a closed SVG plot region.
 *
 * The Plot Detection Engine stamps data-closed="true" on every normalized
 * closed region before the SVG reaches the editor, so this check is a simple
 * attribute read — no geometry inference, no heuristics, no special cases.
 *
 * The fallback to structural checks (path Z, polygon, rect, circle, ellipse)
 * is kept solely as a safety net for in-session shapes drawn by the user with
 * the draw tools, which don't go through the detection pipeline.
 */
function pbIsClosed(el) {
  // Primary: trust the Plot Detection Engine stamp
  if (el.getAttribute('data-closed') === 'true') return true;

  // Fallback for user-drawn shapes created within this editor session
  const tag = el.tagName?.toLowerCase();
  if (['rect', 'circle', 'ellipse', 'polygon'].includes(tag)) return true;
  if (tag === 'path') {
    const d = (el.getAttribute('d') || '').trimEnd();
    return /[Zz]\s*$/.test(d);
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
  } catch (_) { }
  // Fallback
  try { const bb = el.getBBox(); return bb.width * bb.height; } catch (_) { return Infinity; }
}

/**
 * Compute the exact geometric centroid of an SVG element.
 * Uses the Shoelace algorithm for paths and polygons.
 */
function pbComputeCentroid(el) {
  const tag = el.tagName.toLowerCase();
  try {
    if (tag === 'rect') {
      const x = parseFloat(el.getAttribute('x') || 0);
      const y = parseFloat(el.getAttribute('y') || 0);
      const w = parseFloat(el.getAttribute('width') || 0);
      const h = parseFloat(el.getAttribute('height') || 0);
      return { x: x + w / 2, y: y + h / 2 };
    }
    if (tag === 'circle' || tag === 'ellipse') {
      const cx = parseFloat(el.getAttribute('cx') || 0);
      const cy = parseFloat(el.getAttribute('cy') || 0);
      return { x: cx, y: cy };
    }
    if (['path', 'polygon', 'polyline'].includes(tag)) {
      let pts = pbSamplePoints(el);
      if (!pts || pts.length < 3) {
        const bb = el.getBBox();
        return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
      }

      let signedArea = 0;
      let cx = 0;
      let cy = 0;
      const n = pts.length;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const factor = pts[i].x * pts[j].y - pts[j].x * pts[i].y;
        signedArea += factor;
        cx += (pts[i].x + pts[j].x) * factor;
        cy += (pts[i].y + pts[j].y) * factor;
      }
      signedArea *= 0.5;
      if (Math.abs(signedArea) < 1e-4) {
        const bb = el.getBBox();
        return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
      }
      return { x: cx / (6 * signedArea), y: cy / (6 * signedArea) };
    }
  } catch (e) { }

  try {
    const bb = el.getBBox();
    return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
  } catch (e) {
    return { x: 0, y: 0 };
  }
}

/**
 * Robust geometric hit test for arbitrary SVG regions.
 * Handles nested transforms by mapping the click to each element's local space.
 */
function cadHitTestRegion(svgEl, clientX, clientY) {
  const VALID_TAGS = ['path', 'polygon', 'polyline', 'rect', 'circle', 'ellipse', 'line', 'text', 'tspan', 'use'];
  const candidates = [];

  let svgPtRoot;
  try {
    const pt = svgEl.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    svgPtRoot = pt.matrixTransform(svgEl.getScreenCTM().inverse());
  } catch (e) {
    return null;
  }

  for (const tag of VALID_TAGS) {
    svgEl.querySelectorAll(tag).forEach(el => {
      // Ignore overlays, labels, hatches, and background CAD geometry
      if (
        el.getAttribute('data-cad-type') === 'hatch' ||
        el.getAttribute('data-cad-type') === 'background' ||
        el.closest('.cad-overlay') ||
        el.style.pointerEvents === 'none' ||
        el.getAttribute('pointer-events') === 'none'
      ) return;

      try {
        let isHit = false;

        // Strategy 1: native isPointInFill (fastest)
        if (el.isPointInFill && typeof DOMPoint !== 'undefined') {
          const pt = new DOMPoint(clientX, clientY);
          if (el.isPointInFill(pt)) isHit = true;
          if (!isHit && el.isPointInStroke && el.isPointInStroke(pt)) isHit = true;
        }

        // Strategy 2: ray-casting in element-local space.
        // Only attempted for elements flagged as closed — no geometry guessing.
        if (!isHit && pbIsClosed(el)) {
          const sctm = el.getScreenCTM();
          if (sctm) {
            const pt = svgEl.createSVGPoint();
            pt.x = clientX; pt.y = clientY;
            const localPt = pt.matrixTransform(sctm.inverse());
            const pts = pbSamplePoints(el);
            if (pts && pts.length >= 3 && pbPointInPoly(localPt.x, localPt.y, pts)) {
              isHit = true;
            }
          }
        }

        // Strategy 3: fallback bounding box hit testing for newly added tags (text, use)
        if (!isHit) {
          const fill = el.getAttribute('fill');
          const tagLower = el.tagName.toLowerCase();
          if (!fill || fill === 'none' || fill === 'transparent' || ['line', 'text', 'tspan', 'use'].includes(tagLower)) {
            const rect = el.getBoundingClientRect();
            // Add a small 2px padding to make it easier to select thin lines/strokes
            if (clientX >= rect.left - 2 && clientX <= rect.right + 2 && clientY >= rect.top - 2 && clientY <= rect.bottom + 2) {
              isHit = true;
            }
          }
        }

        if (isHit) {
          let area = 0;
          try {
            const sctm = el.getScreenCTM();
            const pts = pbSamplePoints(el);
            if (sctm && pts && pts.length >= 3) {
              let tArea = 0;
              const n = pts.length;
              const transformedPts = pts.map(p => {
                const pt = svgEl.createSVGPoint();
                pt.x = p.x; pt.y = p.y;
                return pt.matrixTransform(sctm);
              });
              for (let i = 0; i < n; i++) {
                const j = (i + 1) % n;
                tArea += transformedPts[i].x * transformedPts[j].y;
                tArea -= transformedPts[j].x * transformedPts[i].y;
              }
              area = Math.abs(tArea / 2);
            } else {
              const rect = el.getBoundingClientRect();
              area = rect.width * rect.height;
            }
          } catch (e) {
            const rect = el.getBoundingClientRect();
            area = rect.width * rect.height;
          }
          candidates.push({ element: el, area });
        }
      } catch (err) { }
    });
  }

  console.log(`[HitTest] Clicked (${clientX}, ${clientY}) - Found ${candidates.length} candidate regions.`);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.area - b.area);

  const best = candidates[0].element;
  console.log('[HitTest] Selected Region:', best.tagName, best.id || '(no id)', '| data-closed:', best.getAttribute('data-closed'));
  if (best.getScreenCTM) {
    const t = best.getScreenCTM();
    console.log(`[HitTest] Transform Matrix: [a:${t.a.toFixed(2)} b:${t.b.toFixed(2)} c:${t.c.toFixed(2)} d:${t.d.toFixed(2)} e:${t.e.toFixed(2)} f:${t.f.toFixed(2)}]`);
  }

  return { element: best, area: candidates[0].area, allCandidates: candidates };
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

  // Query only elements stamped by the Plot Detection Engine.
  // Every closed plot is a normalized <path data-closed="true">, so this is
  // a direct attribute lookup — no geometry inference needed here.
  const closedEls = Array.from(svgEl.querySelectorAll('[data-closed="true"]'));

  // Fallback: also include user-drawn shapes (rect, circle, ellipse, polygon,
  // closed path) that were added in the current session and are not yet stamped.
  const FALLBACK_TAGS = ['path', 'polygon', 'rect', 'circle', 'ellipse'];
  for (const tag of FALLBACK_TAGS) {
    svgEl.querySelectorAll(tag).forEach(el => {
      if (el.getAttribute('data-closed') === 'true') return; // already covered
      if (el.getAttribute('data-cad-type') === 'hatch') return;
      if (!pbIsClosed(el)) return;
      closedEls.push(el);
    });
  }

  const CLOSED_TAGS = ['path', 'polygon', 'polyline', 'rect', 'circle', 'ellipse'];

  // Count total for diagnostics
  let totalInDoc = 0;
  for (const t of CLOSED_TAGS) totalInDoc += svgEl.querySelectorAll(t).length;
  console.log('[PaintBucket:findRegion] svgEl children:', svgEl.childElementCount,
    '| total queried elements:', totalInDoc,
    '| data-closed elements:', closedEls.length,
    '| viewBox attr:', svgEl.getAttribute('viewBox'));

  let totalClosed = closedEls.length;
  const containing = [];

  for (const el of closedEls) {
    try {
      // Sample boundary in SVG user space using getPointAtLength.
      // These points are already in SVG user space — no further transform needed.
      const pts = pbSamplePoints(el);
      if (!pts || pts.length < 3) continue;

      // Quick bounding-box pre-filter (fast rejection)
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of pts) {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      }
      if (svgPt.x < minX || svgPt.x > maxX || svgPt.y < minY || svgPt.y > maxY) continue;

      // Ray-casting point-in-polygon
      if (!pbPointInPoly(svgPt.x, svgPt.y, pts)) continue;

      const bb = el.getBBox();
      const area = pbComputeArea(el);

      containing.push({
        element: el,
        area,
        bbox: { x: bb.x, y: bb.y, w: bb.width, h: bb.height },
      });
    } catch (err) {
      console.warn('[PaintBucket:findRegion] element error:', el.id, err.message);
    }
  }

  if (!containing.length) return null;
  containing.sort((a, b) => a.area - b.area);

  return {
    element: containing[0].element,
    area: containing[0].area,
    bbox: containing[0].bbox,
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
    const r = parseFloat(el.getAttribute('r') || 0);
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
    const elCTM = el.getCTM();
    const svgCTM = svgEl.getCTM();
    if (elCTM && svgCTM) {
      const inv = svgCTM.inverse();
      const m = inv.multiply(elCTM);
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
  } catch (_) { }
  return null;
}

// ─── Offset Shape Attributes by dx,dy ────────────────────────────────────────
function offsetShapeAttrs(shape, dx, dy) {
  const a = { ...shape.attributes };
  const t = shape.type;
  if (t === 'line') {
    a.x1 = parseFloat(a.x1 || 0) + dx; a.y1 = parseFloat(a.y1 || 0) + dy;
    a.x2 = parseFloat(a.x2 || 0) + dx; a.y2 = parseFloat(a.y2 || 0) + dy;
  } else if (t === 'circle' || t === 'ellipse') {
    a.cx = parseFloat(a.cx || 0) + dx; a.cy = parseFloat(a.cy || 0) + dy;
  } else if (t === 'rect') {
    a.x = parseFloat(a.x || 0) + dx; a.y = parseFloat(a.y || 0) + dy;
  } else if (t === 'text') {
    a.x = parseFloat(a.x || 0) + dx; a.y = parseFloat(a.y || 0) + dy;
  } else if (t === 'polyline' || t === 'polygon') {
    const pts = (a.points || '').trim().split(/[\s,]+/);
    const moved = [];
    for (let i = 0; i < pts.length; i += 2) {
      if (pts[i] && pts[i + 1]) {
        moved.push(parseFloat(pts[i]) + dx);
        moved.push(parseFloat(pts[i + 1]) + dy);
      }
    }
    a.points = moved.join(' ');
  } else if (t === 'path') {
    // Offset arrow metadata
    if (a['data-cad-type'] === 'arrow') {
      a['data-start-x'] = parseFloat(a['data-start-x'] || 0) + dx;
      a['data-start-y'] = parseFloat(a['data-start-y'] || 0) + dy;
      a['data-end-x'] = parseFloat(a['data-end-x'] || 0) + dx;
      a['data-end-y'] = parseFloat(a['data-end-y'] || 0) + dy;
    }
    // Offset all coordinate pairs in the d attribute
    const dStr = a.d || '';
    const regex = /([a-zA-Z]+)|([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)/g;
    const tokens = [];
    let match;
    while ((match = regex.exec(dStr)) !== null) tokens.push(match[0]);
    for (let i = 0; i < tokens.length; i++) {
      const cmd = tokens.slice(0, i + 1).filter(t => /^[a-zA-Z]$/.test(t)).pop();
      if (cmd && cmd === cmd.toLowerCase() && cmd !== 'm' && cmd !== 'z') continue; // skip relative commands
      if (!isNaN(tokens[i]) && i + 1 < tokens.length && !isNaN(tokens[i + 1])) {
        tokens[i] = parseFloat(tokens[i]) + dx;
        tokens[i + 1] = parseFloat(tokens[i + 1]) + dy;
        i++;
      }
    }
    a.d = tokens.join(' ');
  }
  return { ...shape, attributes: a };
}

// ─── Multi-Select Overlay ────────────────────────────────────────────────────
function MultiSelectOverlay({ selectedShapeIds, documentState, svgRef, scale }) {
  const [bbox, setBBox] = useState(null);

  useEffect(() => {
    if (!svgRef.current || selectedShapeIds.length < 2) { setBBox(null); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const id of selectedShapeIds) {
      const el = svgRef.current.querySelector(`#${CSS.escape(id)}`);
      if (el) {
        try {
          const b = el.getBBox();
          minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
          maxX = Math.max(maxX, b.x + b.width); maxY = Math.max(maxY, b.y + b.height);
        } catch (_) { }
      }
    }
    if (minX !== Infinity) {
      setBBox({ x: minX, y: minY, width: maxX - minX, height: maxY - minY });
    } else {
      setBBox(null);
    }
  }, [selectedShapeIds, documentState.shapes, svgRef]);

  if (!bbox) return null;

  const svgEl = svgRef.current?.querySelector('svg');
  let actualScale = scale;
  try { actualScale = svgEl?.getScreenCTM()?.a || scale; } catch (_) { }
  const sw = 1.5 / actualScale;

  return (
    <g pointerEvents="none">
      <rect
        x={bbox.x} y={bbox.y} width={bbox.width} height={bbox.height}
        fill="rgba(59,130,246,0.06)" stroke="#3b82f6" strokeWidth={sw}
        strokeDasharray={`${4 / actualScale}`}
      />
    </g>
  );
}

import PlotLabelsOverlay from '../../shared/appearance/PlotLabelsOverlay';



// ─────────────────────────────────────────────────────────────────────────────

export default function CadEditorCanvas({
  readOnly = false,
  svgContent,
  activeTool,
  strokeWidth = 2,
  strokeColor = '#ffffff',
  textFontSize = 2,
  textFontColor = '#ffffff',
  textFontFamily = 'sans-serif',
  eraserSize = 10,
  fillColor = '#3b82f6',
  fillOpacity = 1.0,
  plots,
  statuses,
  showPlotStatus,
  onZoomChange,
  onCoordsChange,
  onSvgModified,
  onToolChange,
  projectId,
  projectConfig,
  onSelectionChange,
  onLabelDragEnd,
  masterAmenities = [],
  placedAmenities = [],
  setPlacedAmenities,
  conversionId,
  appearanceSettings
}) {
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

  // readOnly click-vs-drag detection
  const pointerDownPos = useRef(null);

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
  const [selectedShapeIds, setSelectedShapeIds] = useState([]);
  const [selectedPlacementIds, setSelectedPlacementIds] = useState([]);
  const [clipboard, setClipboard] = useState(null);

  // Partial Delete state
  const [marquee, setMarquee] = useState(null);        // { x1, y1, x2, y2 } in SVG coords
  const [marqueeActive, setMarqueeActive] = useState(false); // true while dragging
  const [pdHits, setPdHits] = useState([]);                 // [{ shapeId, hitIndices, shapeType }]

  // Vector Eraser state
  const [veDragging, setVeDragging] = useState(false);
  const [veCursorCoords, setVeCursorCoords] = useState(null);
  const [veModified, setVeModified] = useState(false);
  const [pendingVeSave, setPendingVeSave] = useState(false);

  // Status Reveal WAAPI Hook
  const layoutRevealKey = projectId && conversionId ? `${projectId}:${conversionId}` : '';
  usePlotRevealAnimation(svgRef, documentState.shapes, layoutRevealKey);

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
      setSelectedShapeIds([]);
    }
    // Clear partial delete state when switching away from the tool
    if (activeTool !== 'partial_delete') {
      setMarquee(null);
      setMarqueeActive(false);
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
    
    const isMobile = window.innerWidth < 768;
    const newScale = isMobile ? 1.5 : 1;
    
    if (newScale === 1) {
      transform.current.scale = 1;
      transform.current.x = 0;
      transform.current.y = 0;
    } else {
      const rect = containerRef.current.getBoundingClientRect();
      transform.current.scale = newScale;
      transform.current.x = (rect.width / 2) - ((rect.width / 2) * newScale);
      transform.current.y = (rect.height / 2) - ((rect.height / 2) * newScale);
    }
    
    requestUpdate();
  }, []);

  useEffect(() => {
    const handleFitScreen = () => fitToScreen();
    const handleZoomIn    = () => setScale(transform.current.scale * 1.25);
    const handleZoomOut   = () => setScale(transform.current.scale / 1.25);
    // Fired by the viewer when the user wants to clear selection (e.g. clicking
    // empty canvas space from UserLayoutViewer context).
    const handleDeselect  = () => setSelectedShapeIds([]);

    window.addEventListener('editor-fit-screen',    handleFitScreen);
    window.addEventListener('editor-zoom-in',       handleZoomIn);
    window.addEventListener('editor-zoom-out',      handleZoomOut);
    window.addEventListener('viewer-deselect-plot', handleDeselect);

    return () => {
      window.removeEventListener('editor-fit-screen',    handleFitScreen);
      window.removeEventListener('editor-zoom-in',       handleZoomIn);
      window.removeEventListener('editor-zoom-out',      handleZoomOut);
      window.removeEventListener('viewer-deselect-plot', handleDeselect);
    };
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
      const shapes = selectedShapeIds.map(id => findShapeDeep(documentState.shapes, id)?.shape).filter(Boolean);
      onSelectionChange(selectedShapeIds, shapes);
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
              Object.keys(patch).forEach(k => {
                if (patch[k] === null) delete newAttrs[k];
              });
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

  const executeBulkPaste = async (payload) => {
    if (!payload) return;
    const shapesToPaste = Array.isArray(payload) ? payload : (payload.shapes || []);
    const amenitiesToPaste = !Array.isArray(payload) && payload.amenities ? payload.amenities : [];
    
    if (shapesToPaste.length === 0 && amenitiesToPaste.length === 0) return;

    const newShapeIds = [];
    const newPlacementIds = [];
    let finalShapes = [...documentState.shapes];
    let shapesChanged = false;

    if (shapesToPaste.length > 0) {
      const replaceIdsDeep = (shape) => {
        shape.id = `cad-shape-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        if (shape.children) {
          shape.children.forEach(child => replaceIdsDeep(child));
        }
      };

      for (const shapeObj of shapesToPaste) {
        const cloned = JSON.parse(JSON.stringify(shapeObj));
        const offsetShape = offsetShapeAttrs(cloned, 20, 20);
        replaceIdsDeep(offsetShape);
        finalShapes.push(offsetShape);
        newShapeIds.push(offsetShape.id);
      }
      shapesChanged = true;
    }

    if (amenitiesToPaste.length > 0) {
      const createdAmenities = [];
      for (const amenity of amenitiesToPaste) {
        try {
          const newPlacement = await createAmenityPlacement({
            amenityId: amenity.amenityId,
            projectId: parseInt(projectId),
            conversionId: parseInt(conversionId),
            x: amenity.x + 20,
            y: amenity.y + 20,
            width: amenity.width,
            height: amenity.height,
            rotation: amenity.rotation || 0,
            layerOrder: amenity.layerOrder || 0
          });
          createdAmenities.push(newPlacement);
          newPlacementIds.push(newPlacement.id);
        } catch (err) {
          console.error('Failed to paste amenity:', err);
        }
      }
      if (createdAmenities.length > 0) {
        setPlacedAmenities(prev => [...prev, ...createdAmenities]);
      }
    }

    if (shapesChanged) {
      setDocumentState(prev => ({ ...prev, shapes: finalShapes }));
      if (onSvgModified) notifySvgModified(serializeStateToSvgString(finalShapes, documentState.viewBox));
    }

    setTimeout(() => {
      onToolChange?.('pointer');
      setSelectedShapeIds(newShapeIds);
      setSelectedPlacementIds(newPlacementIds);
    }, 50);
  };

  const groupSelected = () => {
    if (selectedShapeIds.length < 2) return;
    const groupId = `cad-group-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const children = selectedShapeIds.map(id => findShapeDeep(documentState.shapes, id)?.shape).filter(Boolean);
    let newShapes = [...documentState.shapes];
    for (const id of selectedShapeIds) {
      newShapes = deleteShapeDeep(newShapes, id);
    }
    const groupShape = { id: groupId, type: 'g', attributes: {}, children: JSON.parse(JSON.stringify(children)) };
    newShapes.push(groupShape);
    setDocumentState({ ...documentState, shapes: newShapes });
    if (onSvgModified) notifySvgModified(serializeStateToSvgString(newShapes, documentState.viewBox));
    setSelectedShapeIds([groupId]);
  };

  const ungroupSelected = () => {
    if (selectedShapeIds.length === 0) return;
    let newShapes = [...documentState.shapes];
    const newIds = [];
    for (const id of selectedShapeIds) {
      const shape = findShapeDeep(newShapes, id)?.shape;
      if (shape && shape.type === 'g' && shape.children?.length > 0) {
        newShapes = deleteShapeDeep(newShapes, id);
        for (const child of shape.children) {
          newShapes.push(child);
          newIds.push(child.id);
        }
      } else {
        newIds.push(id);
      }
    }
    setDocumentState({ ...documentState, shapes: newShapes });
    if (onSvgModified) notifySvgModified(serializeStateToSvgString(newShapes, documentState.viewBox));
    setSelectedShapeIds(newIds);
  };


  useEffect(() => {
    const handleKeyDown = (e) => {
      const targetTag = e.target.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea' || e.target.isContentEditable) return;

      if (e.code === 'Space' && !isSpaceDownRef.current) {
        setIsSpaceDown(true);
        isSpaceDownRef.current = true;
      }

      if (e.key === 'Escape') {
        if (activeTool === 'vector_eraser' && veDragging) {
          setVeDragging(false);
          setVeModified(false);
        } else if (activeTool === 'partial_delete' && (marquee || pdHits.length > 0)) {
          setMarquee(null);
          setMarqueeActive(false);
          setPdHits([]);
        } else if (drawStart || drawPoints.length > 0) {
          setDrawStart(null);
          setDrawEnd(null);
          setCurrentDrawCoords(null);
          setDrawStep(0);
          setDrawPoints([]);
        } else if (selectedShapeIds.length > 0) {
          setSelectedShapeIds([]);
        }
      }

      // ── Partial Delete: Delete key commits the deletion ────────────────
      if (activeTool === 'partial_delete' && pdHits.length > 0 &&
        (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        let newShapes = [...documentState.shapes];

        // Process each hit shape
        const hitsByShape = new Map();
        for (const hit of pdHits) {
          if (!hitsByShape.has(hit.shapeId)) {
            hitsByShape.set(hit.shapeId, []);
          }
          hitsByShape.get(hit.shapeId).push(...hit.hitIndices);
        }

        const replaceInTree = (shapes, targetId, replacementNodes) => {
          const result = [];
          for (const s of shapes) {
            if (s.id === targetId) {
              result.push(...replacementNodes);
            } else {
              if (s.children?.length) {
                result.push({ ...s, children: replaceInTree(s.children, targetId, replacementNodes) });
              } else {
                result.push(s);
              }
            }
          }
          return result;
        };

        for (const [shapeId, hitIndices] of hitsByShape) {
          const shapeResult = findShapeDeep(newShapes, shapeId);
          if (!shapeResult) continue;

          const replacements = applyPartialDelete(shapeResult.shape, hitIndices);
          if (!replacements) continue;

          newShapes = replaceInTree(newShapes, shapeId, replacements);
        }

        setDocumentState(prev => ({ ...prev, shapes: newShapes }));
        notifySvgModified(serializeStateToSvgString(newShapes, documentState.viewBox));
        setMarquee(null);
        setMarqueeActive(false);
        setPdHits([]);
        console.log('[PartialDelete] Deleted segments from', hitsByShape.size, 'shape(s)');
      }

      if (activeTool === 'pointer') {
        const hasShapes = selectedShapeIds.length > 0;
        const hasAmenities = selectedPlacementIds.length > 0;

        if (hasShapes || hasAmenities) {
          const getClipboardPayload = () => {
            const shapesToCopy = selectedShapeIds.map(id => findShapeDeep(documentState.shapes, id)?.shape).filter(Boolean);
            const amenitiesToCopy = placedAmenities.filter(p => selectedPlacementIds.includes(p.id));
            return JSON.parse(JSON.stringify({ shapes: shapesToCopy, amenities: amenitiesToCopy }));
          };

          const executeDelete = () => {
            let newShapes = [...documentState.shapes];
            let shapesChanged = false;

            if (hasShapes) {
              for (const id of selectedShapeIds) {
                newShapes = deleteShapeDeep(newShapes, id);
              }
              shapesChanged = true;
            }

            if (hasAmenities) {
              for (const id of selectedPlacementIds) {
                deleteAmenityPlacement(id).then(() => {
                  setPlacedAmenities(prev => prev.filter(p => p.id !== id));
                }).catch(console.error);
              }
            }

            if (shapesChanged) {
              setDocumentState({ ...documentState, shapes: newShapes });
              if (onSvgModified) notifySvgModified(serializeStateToSvgString(newShapes, documentState.viewBox));
            }
            setSelectedShapeIds([]);
            setSelectedPlacementIds([]);
          };

          if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            executeDelete();
          }

          if (e.ctrlKey || e.metaKey) {
            if (e.key === 'c') {
              e.preventDefault();
              setClipboard(getClipboardPayload());
            }
            if (e.key === 'x') {
              e.preventDefault();
              setClipboard(getClipboardPayload());
              executeDelete();
            }
            if (e.key === 'd') {
              e.preventDefault();
              executeBulkPaste(getClipboardPayload());
            }
            if (e.key === 'g' && hasShapes) {
              e.preventDefault();
              if (e.shiftKey) {
                ungroupSelected();
              } else {
                groupSelected();
              }
            }
          }
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard) {
        e.preventDefault();
        executeBulkPaste(clipboard);
      }
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
  }, [documentState, fitToScreen, activeTool, selectedShapeIds, clipboard, marquee, pdHits, veDragging, veCursorCoords]);

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
          const isPlot = shape.attributes?.['data-plot-id'] || shape.attributes?.['plotId'] || shape.attributes?.['data-cad-type'] === 'plot';
          if (isPlot) {
            result.push(shape); // NEVER delete plot polygons
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
    // Deselect placements when clicking on empty canvas
    if (activeTool === 'pointer' && e.button === 0 && selectedPlacementIds.length > 0) {
      setSelectedPlacementIds([]);
    }

    if (activeTool === 'pointer' && e.button === 0 && selectedShapeIds.length > 0) {
      // Only deselect if the click target is the container background (not any SVG element)
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'div') {
        setSelectedShapeIds([]);
      }
    }

    // ── Partial Delete: start marquee ──────────────────────────────────
    if (readOnly) {
      // In read-only mode allow pan via left-drag, middle-click, or space+drag
      if (e.button === 1 || isSpaceDownRef.current || e.button === 0) {
        isDragging.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        pointerDownPos.current = { x: e.clientX, y: e.clientY };
        e.preventDefault();
      }
      return;
    }
    if (activeTool === 'partial_delete' && e.button === 0) {
      const coords = getSvgInternalCoords(e.clientX, e.clientY);
      if (coords) {
        setMarquee({ x1: coords.x, y1: coords.y, x2: coords.x, y2: coords.y });
        setMarqueeActive(true);
        setPdHits([]);
      }
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    // ── Vector Eraser: start erasing ───────────────────────────────────
    if (activeTool === 'vector_eraser' && e.button === 0) {
      // Intercept plot clicks for resetting custom colors
      const plotElement = e.target.closest('[data-plot-id]') || (e.target.getAttribute?.('data-plot-id') ? e.target : null);
      if (plotElement) {
        const shapeId = plotElement.id || resolveShapeId(plotElement);
        if (shapeId) {
          const shapeResult = findShapeDeep(documentState.shapes, shapeId);
          if (shapeResult && shapeResult.shape.attributes?.['data-cad-custom-fill'] === 'true') {
            const originalFill = shapeResult.shape.attributes['data-original-fill'];
            const originalFillOpacity = shapeResult.shape.attributes['data-original-fill-opacity'];
            
            const newShape = { ...shapeResult.shape, attributes: { ...shapeResult.shape.attributes } };
            
            if (originalFill === 'MISSING') delete newShape.attributes['fill'];
            else if (originalFill) newShape.attributes['fill'] = originalFill;
            
            if (originalFillOpacity === 'MISSING') delete newShape.attributes['fill-opacity'];
            else if (originalFillOpacity) newShape.attributes['fill-opacity'] = originalFillOpacity;
            
            delete newShape.attributes['data-cad-custom-fill'];
            delete newShape.attributes['data-original-fill'];
            delete newShape.attributes['data-original-fill-opacity'];
            
            const updatedShapes = updateShapeAtPath(documentState.shapes, shapeResult.path, newShape);
            setDocumentState(prev => ({ ...prev, shapes: updatedShapes }));
            
            if (onSvgModified) {
              const svgString = serializeStateToSvgString(updatedShapes, documentState.viewBox);
              setTimeout(() => {
                internalUpdateRef.current = true;
                onSvgModified(svgString);
              }, 0);
            }
            
            e.stopPropagation();
            e.preventDefault();
            return;
          }
        }
      }

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
        if (selectedShapeIds.length > 0) setSelectedShapeIds([]);
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
      if (selectedShapeIds.length > 0) setSelectedShapeIds([]);
      const internalCoords = getSvgInternalCoords(e.clientX, e.clientY);
      if (internalCoords) {
        if (e.detail === 2) {
          // Finish polygon on double-click
          if (drawPoints.length > 1) {
            commitDrawingPolygon(drawPoints);
            setDrawPoints([]);
            setCurrentDrawCoords(null);
          }
        } else {
          setDrawPoints(prev => {
            // Prevent duplicate points from the first click of a double click or accidental fast clicks
            if (prev.length > 0) {
              const lastPt = prev[prev.length - 1];
              if (Math.abs(lastPt.x - internalCoords.x) < 0.001 && Math.abs(lastPt.y - internalCoords.y) < 0.001) {
                return prev;
              }
            }
            return [...prev, internalCoords];
          });
          setCurrentDrawCoords(internalCoords);
        }
      }
      e.stopPropagation();
      e.preventDefault();
      return;
    }

    if (activeTool === 'draw_text' && e.button === 0) {
      if (selectedShapeIds.length > 0) setSelectedShapeIds([]);
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

  // Recursively find a shape in the tree, returning { shape, parent, path }
  const findShapeDeep = (shapes, id, path = [], parent = null) => {
    for (let i = 0; i < shapes.length; i++) {
      const s = shapes[i];
      if (s.id === id) return { shape: s, parent, path: [...path, i] };
      if (s.children && s.children.length > 0) {
        const found = findShapeDeep(s.children, id, [...path, i, 'children'], s);
        if (found) return found;
      }
    }
    return null;
  };

  // Helper to safely update a nested shape at a given path immutably
  const updateShapeAtPath = (shapes, path, updatedShape) => {
    if (!path || path.length === 0) return shapes;
    const updateRecursive = (currentShapes, currentPath) => {
      if (currentPath.length === 1) {
        const newShapes = [...currentShapes];
        newShapes[currentPath[0]] = updatedShape;
        return newShapes;
      }
      const [idx, childrenKey, ...restPath] = currentPath;
      const newShapes = [...currentShapes];
      const target = { ...newShapes[idx] };
      target[childrenKey] = updateRecursive(target[childrenKey], restPath);
      newShapes[idx] = target;
      return newShapes;
    };
    return updateRecursive(shapes, path);
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

  const resolveShapeId = (targetEl) => {
    if (targetEl.closest('[data-cad-type="background"]')) return null;

    // In readOnly mode (User Viewer), prioritize selecting the parent plot wrapper
    // instead of the physical child geometry so that Plot Appearance colors can propagate.
    if (readOnly) {
      let current = targetEl;
      while (current && current.tagName?.toLowerCase() !== 'svg') {
        if (current.id && (current.id.startsWith('cad-plot-') || current.hasAttribute('data-plot-id')) && findShapeDeep(documentState.shapes, current.id)) {
          return current.id;
        }
        current = current.parentElement;
      }
    }

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

  const handleShapePointerDown = (e, shapeId) => {
    if (activeTool === 'eraser' && e.button === 0) {
      if (readOnly) return;
      e.stopPropagation(); // Stop event from bubbling to parent groups or SVG background
      const newShapes = deleteShapeDeep(documentState.shapes, shapeId);
      setDocumentState(prev => ({ ...prev, shapes: newShapes }));
      notifySvgModified(serializeStateToSvgString(newShapes, documentState.viewBox));
      console.log(`[ERASER] Deleted shape ${shapeId} via React event`);
    }
  };

  const handleSvgPointerDown = (e) => {
    const target = e.target;
    if (!target || !target.tagName) return;
    const tag = target.tagName.toLowerCase();
    const isShape = ['path', 'line', 'circle', 'ellipse', 'rect', 'polygon', 'polyline', 'text', 'tspan', 'use', 'g'].includes(tag);

    if (activeTool === 'paint_bucket' && e.button === 0) {
      if (readOnly) return;
      // ── Paint Bucket ────────────────────────────────────────────────────
      const svgEl = svgRef.current?.querySelector('svg');
      if (!svgEl) { e.stopPropagation(); return; }

      // Always use the main document SVG — NOT the overlay SVG.
      // Verify we have the right element by checking it contains the DWG shapes.
      // If svgEl has no children, it means we somehow got the overlay SVG.

      const clickSvg = getSvgInternalCoords(e.clientX, e.clientY);

      // Log the SVG coordinate system
      try {
        const sCTM = svgEl.getScreenCTM();
      } catch (_) { }

      // Find the smallest closed region containing the click (Shoelace area sort)
      const result = paintBucketFindRegion(svgEl, e.clientX, e.clientY);

      // ── Full debug log ──────────────────────────────────────────────────
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
        e.stopPropagation();
        return;
      }

      const { element: boundaryEl, area, bbox } = result;

      // ── Boundary highlight (350ms flash) ───────────────────────────────
      const prevStroke = boundaryEl.getAttribute('stroke');
      const prevStrokeWidth = boundaryEl.getAttribute('stroke-width');
      const prevStrokeOpacity = boundaryEl.getAttribute('stroke-opacity');
      boundaryEl.setAttribute('stroke', '#facc15');
      boundaryEl.setAttribute('stroke-width', '3');
      boundaryEl.setAttribute('stroke-opacity', '1');
      setTimeout(() => {
        if (prevStroke === null) boundaryEl.removeAttribute('stroke');
        else boundaryEl.setAttribute('stroke', prevStroke);
        if (prevStrokeWidth === null) boundaryEl.removeAttribute('stroke-width');
        else boundaryEl.setAttribute('stroke-width', prevStrokeWidth);
        if (prevStrokeOpacity === null) boundaryEl.removeAttribute('stroke-opacity');
        else boundaryEl.setAttribute('stroke-opacity', prevStrokeOpacity);
      }, 350);

      // ── Extract exact geometry (never approximate) ──────────────────────
      const geometry = paintBucketExtractGeometry(boundaryEl, svgEl);
      if (!geometry) {
        e.stopPropagation();
        return;
      }

      // ── Replace or create hatch ─────────────────────────────────────────
      // Use the boundary element's ID for reliable duplicate detection.
      // After the Plot Detection Engine runs, every closed plot has a stable
      // id ("cad-plot-<N>"), so this is simply boundaryEl.id in the normal case.
      // resolveShapeId is a fallback for user-drawn shapes that went through
      // parseSvgStringToState and have a documentState-tracked id instead.
      const boundaryRef = boundaryEl.id || resolveShapeId(boundaryEl) || '';
        
        // Added logic: Update existing shape directly if it is hit!
        const existingShapeResult = boundaryRef ? findShapeDeep(documentState.shapes, boundaryRef) : null;
        if (existingShapeResult) {
          const currentAttrs = existingShapeResult.shape.attributes;
          const originalFill = currentAttrs['data-original-fill'] ?? (currentAttrs.fill !== undefined ? currentAttrs.fill : 'MISSING');
          const originalFillOpacity = currentAttrs['data-original-fill-opacity'] ?? (currentAttrs['fill-opacity'] !== undefined ? currentAttrs['fill-opacity'] : 'MISSING');
          
          const updatedShapes = updateShapeAtPath(documentState.shapes, existingShapeResult.path, {
            ...existingShapeResult.shape,
            attributes: { 
              ...currentAttrs, 
              fill: fillColor, 
              'fill-opacity': String(fillOpacity), 
              'data-cad-custom-fill': 'true',
              'data-original-fill': originalFill,
              'data-original-fill-opacity': originalFillOpacity
            }
          });
          setDocumentState(prev => ({ ...prev, shapes: updatedShapes }));
          notifySvgModified(serializeStateToSvgString(updatedShapes, documentState.viewBox));
          e.stopPropagation();
          return;
        }

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
        e.stopPropagation();
        return;
      }

      // Prepend new hatch so it renders below all DWG geometry
      const hatchId = `hatch-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      const hatchAttributes = { ...geometry.attributes };
        delete hatchAttributes['data-plot-id'];

        const hatchShape = {
          id: hatchId,
          type: geometry.type,
          attributes: {
            ...hatchAttributes,
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

      e.stopPropagation();
    } else if (e.button === 0) {
      let shapeId = null;

      if (activeTool === 'pointer') {
        const svgEl = svgRef.current?.querySelector('svg');
        if (svgEl) {
          const hit = cadHitTestRegion(svgEl, e.clientX, e.clientY);
          if (hit) {
            const boundaryEl = hit.element;
            shapeId = readOnly ? resolveShapeId(boundaryEl) : (boundaryEl.id || resolveShapeId(boundaryEl));

            if (!readOnly) {
              const prevStroke = boundaryEl.getAttribute('stroke');
              const prevStrokeWidth = boundaryEl.getAttribute('stroke-width');
              const prevStrokeOpacity = boundaryEl.getAttribute('stroke-opacity');
              boundaryEl.setAttribute('stroke', '#facc15');
              boundaryEl.setAttribute('stroke-width', '3');
              boundaryEl.setAttribute('stroke-opacity', '1');
              setTimeout(() => {
                if (prevStroke === null) boundaryEl.removeAttribute('stroke');
                else boundaryEl.setAttribute('stroke', prevStroke);
                if (prevStrokeWidth === null) boundaryEl.removeAttribute('stroke-width');
                else boundaryEl.setAttribute('stroke-width', prevStrokeWidth);
                if (prevStrokeOpacity === null) boundaryEl.removeAttribute('stroke-opacity');
                else boundaryEl.setAttribute('stroke-opacity', prevStrokeOpacity);
              }, 350);
            }
          }
        }

        if (!shapeId && isShape) {
          shapeId = resolveShapeId(target);
        }

        if (shapeId) {
          if (e.shiftKey) {
            setSelectedShapeIds(prev => prev.includes(shapeId) ? prev.filter(id => id !== shapeId) : [...prev, shapeId]);
          } else {
            setSelectedShapeIds([shapeId]);
          }


          // Double click to edit text
          if ((tag === 'text' || tag === 'tspan') && e.detail === 2) {
            if (!readOnly) {
              const shape = findShapeDeep(documentState.shapes, shapeId)?.shape;
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
          }

          e.stopPropagation();
        } else if ((tag === 'svg' || target.closest('[data-cad-type="background"]')) && selectedShapeIds.length > 0) {
          // Clicking empty canvas or background deselects the current object (MS Paint behavior)
          setSelectedShapeIds([]);
        }
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
    if (activeTool === 'partial_delete' && marqueeActive && marquee) {
      const coords = getSvgInternalCoords(e.clientX, e.clientY);
      if (coords) {
        const newMarquee = { ...marquee, x2: coords.x, y2: coords.y };
        setMarquee(newMarquee);

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
      attributes: { stroke: strokeColor, "stroke-width": strokeWidth, fill: "none", "data-custom-color": "true" },
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
    
    setSelectedShapeIds([shapeId]);
  };

  const commitDrawingCurve = (start, control, end) => {
    const shapeId = `cad-shape-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newShape = {
      id: shapeId,
      type: 'path',
      attributes: { d: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`, stroke: strokeColor, "stroke-width": strokeWidth, fill: "none", "data-custom-color": "true" },
      transform: { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1 },
      children: []
    };

    const newShapes = [...documentState.shapes, newShape];
    setDocumentState({ ...documentState, shapes: newShapes });

    if (onSvgModified) {
      notifySvgModified(serializeStateToSvgString(newShapes, documentState.viewBox));
    }
    
    setSelectedShapeIds([shapeId]);
  };

  const commitDrawingPolygon = (points) => {
    if (points.length < 2) return;

    const shapeId = `cad-shape-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');

    const newShape = {
      id: shapeId,
      type: 'polyline',
      attributes: { points: pointsStr, fill: "none", stroke: strokeColor, "stroke-width": strokeWidth, "data-custom-color": "true" },
      transform: { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1 },
      children: []
    };

    const newShapes = [...documentState.shapes, newShape];
    setDocumentState({ ...documentState, shapes: newShapes });
    if (onSvgModified) notifySvgModified(serializeStateToSvgString(newShapes, documentState.viewBox));
    
    setSelectedShapeIds([shapeId]);
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
      attributes: { x: tInput.x, y: tInput.y, "font-size": textFontSize, fill: textFontColor, "font-family": textFontFamily, "data-cad-type": "text" },
      transform: { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1 },
      children: []
    };

    const newShapes = [...documentState.shapes, newShape];
    setDocumentState({ ...documentState, shapes: newShapes });
    if (onSvgModified) notifySvgModified(serializeStateToSvgString(newShapes, documentState.viewBox));

    setTextInput(null);
    setSelectedShapeIds([shapeId]);
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
    if (readOnly) {
      // Detect click vs drag: if pointer barely moved it's a tap/click
      const down = pointerDownPos.current;
      const moved = down
        ? Math.hypot(e.clientX - down.x, e.clientY - down.y)
        : 999;
      pointerDownPos.current = null;
      isDragging.current = false;

      if (moved < 6 && e.button === 0) {
        // Hit-test the SVG for a plot region
        const svgEl = svgRef.current?.tagName?.toLowerCase() === 'svg'
          ? svgRef.current
          : svgRef.current?.querySelector('svg');

        let selectedPlot = null;
        let selectedShapeId = null;

        if (svgEl) {
          const hit = cadHitTestRegion(svgEl, e.clientX, e.clientY);
          if (hit) {
            const hitEl = hit.element || hit;
            // Walk up to find the element with data-plot-id
            let el = hitEl;
            while (el && el !== svgEl) {
              if (el.getAttribute?.('data-plot-id')) break;
              el = el.parentElement;
            }
            const plotIdStr = el?.getAttribute?.('data-plot-id');
            selectedShapeId = el?.id || null;
            if (plotIdStr && plots) {
              selectedPlot = plots.find(p => p.id === parseInt(plotIdStr)) || null;
            }
          }
        }

        // Update internal selection state so SelectedPlotGeometryOverlay fires
        setSelectedShapeIds(selectedShapeId ? [selectedShapeId] : []);

        if (onSelectionChange) {
          if (selectedShapeId) {
            const shape = findShapeDeep(documentState.shapes, selectedShapeId)?.shape;
            onSelectionChange(
              [selectedShapeId],
              shape ? [shape] : []
            );
          } else {
            onSelectionChange([], []);
          }
        }
      }
      return;
    }
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
    if (activeTool === 'partial_delete' && marqueeActive) {
      setMarqueeActive(false);
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeTool === 'pointer' && selectedPlacementIds.length > 0) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          const activeEl = document.activeElement;
          if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
          e.preventDefault();
          for (const id of selectedPlacementIds) {
            deleteAmenityPlacement(id).then(() => {
              setPlacedAmenities(prev => prev.filter(p => p.id !== id));
            }).catch(console.error);
          }
          setSelectedPlacementIds([]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, selectedPlacementIds, setPlacedAmenities]);

  const handleDrop = async (e) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/cad-amenity');
    if (!data) return;
    try {
      const amenity = JSON.parse(data);
      const coords = getSvgInternalCoords(e.clientX, e.clientY);
      if (!coords) return;
      const newPlacement = await createAmenityPlacement({
        amenityId: parseInt(amenity.id),
        projectId: parseInt(projectId),
        conversionId: parseInt(conversionId),
        x: coords.x,
        y: coords.y,
        width: amenity.defaultWidth || 20,
        height: amenity.defaultHeight || 20,
        rotation: amenity.defaultRotation || 0,
        layerOrder: 0
      });
      setPlacedAmenities(prev => [...prev, newPlacement]);
      setSelectedPlacementIds([newPlacement.id]);
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleAmenityTransformEnd = async (id, updates) => {
    setPlacedAmenities(prev => prev.map(p => {
      if (p.id === id) {
        const newP = { ...p, ...updates };
        updateAmenityPlacement(id, updates).catch(console.error);
        return newP;
      }
      return p;
    }));
  };

  useEffect(() => {
    const handleAmenitySelect = async (e) => {
      // Custom event for click-to-place support could be added here
    };
    window.addEventListener('cad-amenity-select', handleAmenitySelect);
    return () => window.removeEventListener('cad-amenity-select', handleAmenitySelect);
  }, []);

  const getCursor = () => {
    if (readOnly) return isDragging.current ? 'grabbing' : 'pointer';
    if (activeTool === 'eraser') return 'crosshair';
    if (activeTool === 'partial_delete') return 'crosshair';
    if (activeTool === 'vector_eraser') return 'none'; // Circle drawn in SVG
    if (activeTool === 'paint_bucket') return 'cell';
    if (activeTool === 'draw_line' || activeTool === 'draw_arrow' || activeTool === 'draw_circle' || activeTool === 'draw_polygon' || activeTool === 'draw_curve') return 'crosshair';
    if (activeTool === 'draw_text') return 'text';
    if (activeTool === 'zoom_window') return 'crosshair';
    return isDragging.current ? 'grabbing' : 'grab';
  };

  // ── Focus Mode ────────────────────────────────────────────────────────────
  // In readOnly mode (the public viewer), selecting one plot dims everything
  // else. We derive this entirely from the existing selectedShapeIds state —
  // no new props, no new state, no ShapeRenderer changes.
  const focusedId = readOnly && selectedShapeIds.length === 1
    ? selectedShapeIds[0]
    : null;

  useEffect(() => {
    let animId;
    if (readOnly && focusedId) {
      const timer = setTimeout(() => {
        const plotEl = document.getElementById(focusedId);
        if (plotEl && containerRef.current) {
          const plotRect = plotEl.getBoundingClientRect();
          const rect = containerRef.current.getBoundingClientRect();
          
          if (plotRect.width === 0 || plotRect.height === 0) return;

          const S = transform.current.scale;
          const X = transform.current.x;
          const Y = transform.current.y;

          const unscaledW = plotRect.width / S;
          const unscaledH = plotRect.height / S;
          const unscaledCx = (plotRect.left + plotRect.width / 2 - rect.left - X) / S;
          const unscaledCy = (plotRect.top + plotRect.height / 2 - rect.top - Y) / S;

          let targetS = 0.65 * Math.min(rect.width / unscaledW, rect.height / unscaledH);
          if (targetS > 15) targetS = 15;
          if (targetS < 0.1) targetS = 0.1;

          const targetX = rect.width / 2 - targetS * unscaledCx;
          const targetY = rect.height / 2 - targetS * unscaledCy;

          const startX = transform.current.x;
          const startY = transform.current.y;
          const startScale = transform.current.scale;
          
          const duration = 400;
          let startTime = null;
          
          const animate = (time) => {
            if (!startTime) startTime = time;
            let elapsed = time - startTime;
            if (elapsed > duration) elapsed = duration;
            
            const t = elapsed / duration;
            // easeInOutCubic
            const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            
            transform.current.x = startX + (targetX - startX) * ease;
            transform.current.y = startY + (targetY - startY) * ease;
            transform.current.scale = startScale + (targetS - startScale) * ease;
            requestUpdate();
            
            if (elapsed < duration) {
              animId = requestAnimationFrame(animate);
            }
          };
          animId = requestAnimationFrame(animate);
        }
      }, 50);
      return () => {
        clearTimeout(timer);
        if (animId) cancelAnimationFrame(animId);
      };
    }
  }, [focusedId, readOnly]);

  // Build the CSS string only when the focused ID changes.
  // Interpolating the ID into the selector is the only way to target a
  // specific SVG element by ID in CSS without touching the React render tree.
  const focusModeCSS = focusedId
    ? `
      /* ── Focus Mode: dim all leaf geometry elements (avoids multiplying opacity through <g>) ── */
      .cad-svg-container.focus-active svg path,
      .cad-svg-container.focus-active svg polygon,
      .cad-svg-container.focus-active svg polyline,
      .cad-svg-container.focus-active svg rect,
      .cad-svg-container.focus-active svg circle,
      .cad-svg-container.focus-active svg ellipse,
      .cad-svg-container.focus-active svg use,
      .cad-svg-container.focus-active svg text {
        opacity: 0.25;
        transition: opacity 200ms ease;
      }

      /* ── Selected plot shape AND its children — full brightness ─────────────────────────── */
      .cad-svg-container.focus-active svg #${CSS.escape(focusedId)},
      .cad-svg-container.focus-active svg #${CSS.escape(focusedId)} * {
        opacity: 1 !important;
        transition: opacity 200ms ease;
      }

      /* ── Label overlay ─────────────────────────────────────────────────── */
      /* Re-brighten only the label elements that belong to the selected plot */
      .cad-svg-container.focus-active svg #plot-labels-overlay g[data-label-for="${CSS.escape(focusedId)}"] * {
        opacity: 1 !important;
        transition: opacity 200ms ease;
      }

      /* ── Dimension / geometry overlay for the selected plot ────────────── */
      /* This overlay only exists while a plot is selected, so re-brighten all its children */
      .cad-svg-container.focus-active svg #selected-plot-geometry-overlay * {
        opacity: 1 !important;
      }
    `
    : `
      /* ── Focus Mode off: restore all elements ── */
      .cad-svg-container svg path,
      .cad-svg-container svg polygon,
      .cad-svg-container svg polyline,
      .cad-svg-container svg rect,
      .cad-svg-container svg circle,
      .cad-svg-container svg ellipse,
      .cad-svg-container svg use,
      .cad-svg-container svg text {
        transition: opacity 200ms ease;
      }
    `;

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
      <style>{focusModeCSS}</style>
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
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div
          ref={contentRef}
          className="absolute inset-0 pointer-events-none flex items-center justify-center origin-top-left"
          style={{ transform: 'translate(0px, 0px) scale(1)', transformOrigin: '0 0' }}
        >
          <div
            ref={svgRef}
            className={`text-white w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full cad-svg-container${focusedId ? ' focus-active' : ''} ${(activeTool === 'pointer' || activeTool === 'eraser' || activeTool === 'paint_bucket' || activeTool === 'partial_delete' || activeTool === 'vector_eraser' || activeTool === 'draw_line' || activeTool === 'draw_arrow' || activeTool === 'draw_circle' || activeTool === 'draw_polygon' || activeTool === 'draw_curve' || activeTool === 'draw_text') ? 'pointer-events-auto' : 'pointer-events-none'}`}
          >
            <svg
              viewBox={documentState.viewBox}
              style={{ shapeRendering: 'geometricPrecision', textRendering: 'geometricPrecision' }}
              onPointerDown={handleSvgPointerDown}
            >
              {documentState.shapes.map((shape, index) => (
                <ShapeRenderer
                  key={`${shape.id}-${index}`}
                  shape={shape}
                  selectedShapeIds={selectedShapeIds}
                  onPointerDown={handleShapePointerDown}
                  plots={plots}
                  statuses={statuses}
                  showPlotStatus={showPlotStatus}
                  readOnly={readOnly}
                  appearanceSettings={appearanceSettings}
                />
              ))}
              <PlotLabelsOverlay
                documentState={documentState}
                svgRef={svgRef}
                scale={transform.current.scale}
                plots={plots}
                onLabelDragEnd={onLabelDragEnd}
                readOnly={readOnly}
                projectConfig={projectConfig}
                selectedShapeIds={selectedShapeIds}
                appearanceSettings={appearanceSettings}
              />
              <AmenitiesOverlay
                placedAmenities={placedAmenities}
                masterAmenities={masterAmenities}
                scale={transform.current.scale}
                svgRef={svgRef}
                onAmenityTransformEnd={handleAmenityTransformEnd}
                selectedPlacementIds={selectedPlacementIds}
                onSelectionChange={setSelectedPlacementIds}
              />
            </svg>
          </div>

          {/* ── Partial Delete Overlay ─────────────────────────────────── */}
          {activeTool === 'partial_delete' && (marquee || pdHits.length > 0) && (
            <div className="absolute inset-0 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full pointer-events-none">
              <svg viewBox={documentState.viewBox} style={{ pointerEvents: 'none' }}>
                {/* Dashed marquee rectangle */}
                {marquee && (() => {
                  const x = Math.min(marquee.x1, marquee.x2);
                  const y = Math.min(marquee.y1, marquee.y2);
                  const w = Math.abs(marquee.x2 - marquee.x1);
                  const h = Math.abs(marquee.y2 - marquee.y1);
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

          {((drawStart && currentDrawCoords) || (drawPoints.length > 0 && currentDrawCoords) || selectedShapeIds.length > 0) && (
            <div className="absolute inset-0 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full"
              style={{ pointerEvents: activeTool === 'paint_bucket' ? 'none' : undefined }}>
              <svg viewBox={documentState.viewBox} style={{ pointerEvents: activeTool === 'paint_bucket' ? 'none' : 'auto' }}
                onPointerDown={(e) => {
                  // If the click landed on the overlay SVG background (not a handle), deselect
                  if (e.target.tagName.toLowerCase() === 'svg' && selectedShapeIds.length > 0 && activeTool === 'pointer') {
                    setSelectedShapeIds([]);
                  }
                }}
              >
                {activeTool === 'draw_line' && drawStart && currentDrawCoords && (
                  <line
                    x1={drawStart.x} y1={drawStart.y}
                    x2={currentDrawCoords.x} y2={currentDrawCoords.y}
                    stroke="#a5b4fc" strokeWidth={strokeWidth} strokeDasharray="4"
                  />
                )}
                {activeTool === 'draw_arrow' && drawStart && currentDrawCoords && (
                  <path
                    d={calculateArrowPath(drawStart, currentDrawCoords, strokeWidth)}
                    fill="none" stroke="#a5b4fc" strokeWidth={strokeWidth} strokeDasharray="4" strokeLinejoin="round" strokeLinecap="round"
                  />
                )}
                {activeTool === 'draw_circle' && drawStart && currentDrawCoords && (
                  <circle
                    cx={drawStart.x} cy={drawStart.y}
                    r={Math.sqrt(Math.pow(currentDrawCoords.x - drawStart.x, 2) + Math.pow(currentDrawCoords.y - drawStart.y, 2))}
                    stroke="#a5b4fc" strokeWidth={strokeWidth} fill="none" strokeDasharray="4"
                  />
                )}
                {activeTool === 'draw_curve' && drawStart && currentDrawCoords && drawStep === 1 && (
                  <line
                    x1={drawStart.x} y1={drawStart.y}
                    x2={currentDrawCoords.x} y2={currentDrawCoords.y}
                    stroke="#a5b4fc" strokeWidth={strokeWidth} strokeDasharray="4"
                  />
                )}
                {activeTool === 'draw_curve' && drawStart && drawEnd && currentDrawCoords && drawStep === 2 && (
                  <path
                    d={`M ${drawStart.x} ${drawStart.y} Q ${((drawStart.x + drawEnd.x) / 2) + (currentDrawCoords.x - drawEnd.x)} ${((drawStart.y + drawEnd.y) / 2) + (currentDrawCoords.y - drawEnd.y)} ${drawEnd.x} ${drawEnd.y}`}
                    fill="none" stroke="#a5b4fc" strokeWidth={strokeWidth} strokeDasharray="4"
                  />
                )}

                {activeTool === 'draw_polygon' && drawPoints.length > 0 && currentDrawCoords && (
                  <polyline
                    points={drawPoints.map(p => `${p.x},${p.y}`).join(' ') + ` ${currentDrawCoords.x},${currentDrawCoords.y}`}
                    fill="none" stroke="#a5b4fc" strokeWidth={strokeWidth} strokeDasharray="4" vectorEffect="non-scaling-stroke"
                  />
                )}

                {!readOnly && selectedShapeIds.length === 1 && (
                  <TransformControls
                    shape={findShapeDeep(documentState.shapes, selectedShapeIds[0])?.shape}
                    shapeId={selectedShapeIds[0]}
                    svgRef={svgRef}
                    scale={transform.current.scale}
                    onTransformCommit={(newTransformStr, newAttributes) => {
                      const updatedShapes = documentState.shapes.map(s => {
                        if (s.id === selectedShapeIds[0]) {
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
                {!readOnly && selectedShapeIds.length > 1 && (
                  <MultiSelectOverlay
                    selectedShapeIds={selectedShapeIds}
                    documentState={documentState}
                    svgRef={svgRef}
                    scale={transform.current.scale}
                  />
                )}
                {readOnly && selectedShapeIds.length === 1 && (
                  <SelectedPlotGeometryOverlay
                    selectedShapeId={selectedShapeIds[0]}
                    svgRef={svgRef}
                    plots={plots}
                    statuses={statuses}
                    showPlotStatus={showPlotStatus}
                    readOnly={readOnly}
                    scale={transform.current.scale}
                    appearanceSettings={appearanceSettings}
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
