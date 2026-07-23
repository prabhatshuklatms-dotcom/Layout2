// ─── Partial Delete Tool: Pure utility functions ────────────────────────────
// No React dependencies. All functions are pure (input → output).
// ─────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// 1. SVG Path Parsing
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tokenise an SVG path `d` string into an array of { command, args } objects.
 * Handles all SVG path commands: M, L, H, V, C, S, Q, T, A, Z (and lowercase).
 *
 * Each returned segment carries:
 *   command  – single-char SVG command letter (uppercase = absolute)
 *   args     – array of numbers
 *   startPt  – {x,y} where the pen was before this segment
 *   endPt    – {x,y} where the pen is after this segment
 *   index    – sequential index within the parsed list
 */
export function parseSvgPath(d) {
  if (!d) return [];

  // Split into tokens: commands (single letter) and numbers (including negatives / decimals)
  const tokenRe = /([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  const tokens = [];
  let m;
  while ((m = tokenRe.exec(d)) !== null) {
    if (m[1]) tokens.push(m[1]);       // command letter
    else tokens.push(parseFloat(m[2])); // numeric arg
  }

  // How many numeric args each command expects (per repeat)
  const argCounts = {
    M: 2, m: 2, L: 2, l: 2, H: 1, h: 1, V: 1, v: 1,
    C: 6, c: 6, S: 4, s: 4, Q: 4, q: 4, T: 2, t: 2,
    A: 7, a: 7, Z: 0, z: 0,
  };

  const segments = [];
  let curX = 0, curY = 0;
  let startX = 0, startY = 0; // subpath start (for Z)
  let idx = 0;
  let i = 0;

  while (i < tokens.length) {
    let cmd = tokens[i];
    if (typeof cmd !== 'string') {
      // Implicit repeat of previous command (or L after M)
      cmd = segments.length > 0
        ? (segments[segments.length - 1].command === 'M' ? 'L'
          : segments[segments.length - 1].command === 'm' ? 'l'
          : segments[segments.length - 1].command)
        : 'L';
      // Don't advance i — current token is a number
    } else {
      i++; // advance past the command letter
    }

    const expected = argCounts[cmd] ?? 0;

    // Collect numeric args
    const args = [];
    for (let j = 0; j < expected && i < tokens.length; j++, i++) {
      args.push(typeof tokens[i] === 'number' ? tokens[i] : parseFloat(tokens[i]));
    }

    const sp = { x: curX, y: curY };
    let ep = { x: curX, y: curY };

    const upper = cmd.toUpperCase();
    const rel = cmd !== upper;

    switch (upper) {
      case 'M':
        ep = rel ? { x: curX + args[0], y: curY + args[1] } : { x: args[0], y: args[1] };
        startX = ep.x; startY = ep.y;
        break;
      case 'L':
        ep = rel ? { x: curX + args[0], y: curY + args[1] } : { x: args[0], y: args[1] };
        break;
      case 'H':
        ep = { x: rel ? curX + args[0] : args[0], y: curY };
        break;
      case 'V':
        ep = { x: curX, y: rel ? curY + args[0] : args[0] };
        break;
      case 'C':
        if (rel) ep = { x: curX + args[4], y: curY + args[5] };
        else     ep = { x: args[4], y: args[5] };
        break;
      case 'S':
        if (rel) ep = { x: curX + args[2], y: curY + args[3] };
        else     ep = { x: args[2], y: args[3] };
        break;
      case 'Q':
        if (rel) ep = { x: curX + args[2], y: curY + args[3] };
        else     ep = { x: args[2], y: args[3] };
        break;
      case 'T':
        if (rel) ep = { x: curX + args[0], y: curY + args[1] };
        else     ep = { x: args[0], y: args[1] };
        break;
      case 'A':
        if (rel) ep = { x: curX + args[5], y: curY + args[6] };
        else     ep = { x: args[5], y: args[6] };
        break;
      case 'Z':
        ep = { x: startX, y: startY };
        break;
    }

    segments.push({ command: cmd, args, startPt: sp, endPt: ep, index: idx });
    curX = ep.x;
    curY = ep.y;
    idx++;
  }

  return segments;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Segment → line approximation (for intersection testing only)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Approximate a parsed segment as an array of {x,y} points.
 * Used only for hit-testing — the original segment is never modified.
 */
export function segmentToPoints(seg) {
  if (!seg.command) return [seg.startPt, seg.endPt];
  
  const upper = seg.command.toUpperCase();
  const rel = seg.command !== upper;
  const { x: sx, y: sy } = seg.startPt;

  if (upper === 'M') return [seg.startPt, seg.endPt];
  if (upper === 'Z') return [seg.startPt, seg.endPt];
  if (upper === 'L' || upper === 'H' || upper === 'V') {
    return [seg.startPt, seg.endPt];
  }

  // Cubic Bézier
  if (upper === 'C') {
    const cp1 = rel ? { x: sx + seg.args[0], y: sy + seg.args[1] } : { x: seg.args[0], y: seg.args[1] };
    const cp2 = rel ? { x: sx + seg.args[2], y: sy + seg.args[3] } : { x: seg.args[2], y: seg.args[3] };
    const ep  = seg.endPt;
    return sampleCubic(seg.startPt, cp1, cp2, ep, 16);
  }

  // Shorthand cubic
  if (upper === 'S') {
    // Approximate: treat the reflected control point as the start point (rough but sufficient for hit-testing)
    const cp2 = rel ? { x: sx + seg.args[0], y: sy + seg.args[1] } : { x: seg.args[0], y: seg.args[1] };
    const ep  = seg.endPt;
    return sampleCubic(seg.startPt, seg.startPt, cp2, ep, 16);
  }

  // Quadratic Bézier
  if (upper === 'Q') {
    const cp = rel ? { x: sx + seg.args[0], y: sy + seg.args[1] } : { x: seg.args[0], y: seg.args[1] };
    const ep = seg.endPt;
    return sampleQuadratic(seg.startPt, cp, ep, 16);
  }

  // Shorthand quadratic
  if (upper === 'T') {
    return sampleQuadratic(seg.startPt, seg.startPt, seg.endPt, 16);
  }

  // Arc — sample parametrically
  if (upper === 'A') {
    return sampleArc(seg, 24);
  }

  // Fallback
  return [seg.startPt, seg.endPt];
}

function sampleCubic(p0, p1, p2, p3, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push({
      x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
      y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y,
    });
  }
  return pts;
}

function sampleQuadratic(p0, p1, p2, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push({
      x: u*u*p0.x + 2*u*t*p1.x + t*t*p2.x,
      y: u*u*p0.y + 2*u*t*p1.y + t*t*p2.y,
    });
  }
  return pts;
}

function sampleArc(seg, n) {
  // Simple approximation: linearly interpolate between start and end
  // A proper implementation would convert arc parameters to center form,
  // but for hit-testing this is usually sufficient.
  const pts = [];
  const { startPt, endPt } = seg;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({
      x: startPt.x + t * (endPt.x - startPt.x),
      y: startPt.y + t * (endPt.y - startPt.y),
    });
  }
  return pts;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Intersection tests
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * rect = { x, y, w, h } — axis-aligned rectangle.
 * Returns true if line segment (p1→p2) intersects the rectangle.
 */
export function lineIntersectsRect(p1, p2, rect) {
  // Cohen-Sutherland outcode approach
  const xmin = rect.x, ymin = rect.y;
  const xmax = rect.x + rect.w, ymax = rect.y + rect.h;

  function outcode(px, py) {
    let code = 0;
    if (px < xmin) code |= 1;
    else if (px > xmax) code |= 2;
    if (py < ymin) code |= 4;
    else if (py > ymax) code |= 8;
    return code;
  }

  let x0 = p1.x, y0 = p1.y, x1 = p2.x, y1 = p2.y;
  let code0 = outcode(x0, y0);
  let code1 = outcode(x1, y1);

  for (let iter = 0; iter < 20; iter++) {
    if (!(code0 | code1)) return true;      // both inside
    if (code0 & code1) return false;         // both in same outside region
    const codeOut = code0 || code1;
    let x, y;
    if (codeOut & 8)      { x = x0 + (x1 - x0) * (ymax - y0) / (y1 - y0); y = ymax; }
    else if (codeOut & 4) { x = x0 + (x1 - x0) * (ymin - y0) / (y1 - y0); y = ymin; }
    else if (codeOut & 2) { y = y0 + (y1 - y0) * (xmax - x0) / (x1 - x0); x = xmax; }
    else                  { y = y0 + (y1 - y0) * (xmin - x0) / (x1 - x0); x = xmin; }
    if (codeOut === code0) { x0 = x; y0 = y; code0 = outcode(x0, y0); }
    else                   { x1 = x; y1 = y; code1 = outcode(x1, y1); }
  }
  return false;
}

/**
 * Distance squared from a point p to line segment vw.
 */
function pointToSegmentDistanceSq(p, v, w) {
  const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
  if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
  return (p.x - proj.x) ** 2 + (p.y - proj.y) ** 2;
}

/**
 * circle = { cx, cy, r }
 * Returns true if line segment (p1→p2) intersects the circle.
 */
export function lineIntersectsCircle(p1, p2, circle) {
  const distSq = pointToSegmentDistanceSq({ x: circle.cx, y: circle.cy }, p1, p2);
  return distSq <= circle.r * circle.r;
}

/**
 * Test whether a parsed path segment intersects the selection rectangle.
 * Approximates curves as polylines for the intersection test.
 */
export function segmentIntersectsRect(seg, rect) {
  const upper = seg.command.toUpperCase();
  // M commands are moves, not drawable — skip
  if (upper === 'M') return false;

  const pts = segmentToPoints(seg);
  for (let i = 0; i < pts.length - 1; i++) {
    if (lineIntersectsRect(pts[i], pts[i + 1], rect)) return true;
  }
  return false;
}

/**
 * Test whether a parsed path segment intersects a circle.
 */
export function segmentIntersectsCircle(seg, circle) {
  if (seg.command) {
    const upper = seg.command.toUpperCase();
    if (upper === 'M') return false;
  }

  const pts = segmentToPoints(seg);
  for (let i = 0; i < pts.length - 1; i++) {
    if (lineIntersectsCircle(pts[i], pts[i + 1], circle)) return true;
  }
  return false;
}

/**
 * Test whether a point is fully inside a rect.
 */
function pointInRect(pt, rect) {
  return pt.x >= rect.x && pt.x <= rect.x + rect.w &&
         pt.y >= rect.y && pt.y <= rect.y + rect.h;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Polyline / line helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Parse a polyline/polygon `points` attribute into an array of line segments.
 * Each segment: { index, startPt, endPt }
 */
export function polylineToSegments(pointsAttr) {
  const nums = (pointsAttr || '').trim().split(/[\s,]+/).filter(Boolean).map(Number);
  const pts = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: nums[i], y: nums[i + 1] });
  }
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    segs.push({ index: i, startPt: pts[i], endPt: pts[i + 1] });
  }
  return segs;
}

/**
 * Convert a <line> element's attributes to a single segment.
 */
export function lineElementToSegment(attrs) {
  return {
    index: 0,
    startPt: { x: parseFloat(attrs.x1 || 0), y: parseFloat(attrs.y1 || 0) },
    endPt:   { x: parseFloat(attrs.x2 || 0), y: parseFloat(attrs.y2 || 0) },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Rebuild after deletion
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Given the full parsed segments and a Set of indices to delete,
 * rebuild the path as one or more `d` strings.
 * Returns an array of `d` strings (each is a contiguous subpath).
 */
export function rebuildPathD(allSegments, deleteIndices) {
  const toDelete = new Set(deleteIndices);

  // Collect surviving segments in order
  const surviving = allSegments.filter(s => !toDelete.has(s.index));
  if (surviving.length === 0) return [];

  // Group into contiguous runs (connected subpaths)
  const subpaths = [];
  let currentRun = [];

  for (const seg of surviving) {
    const upper = seg.command.toUpperCase();
    // An 'M' command always starts a new subpath
    if (upper === 'M') {
      if (currentRun.length > 0) subpaths.push(currentRun);
      currentRun = [seg];
      continue;
    }

    // Check continuity: does this segment connect to the previous one?
    if (currentRun.length > 0) {
      const prevEnd = currentRun[currentRun.length - 1].endPt;
      const curStart = seg.startPt;
      const connected = Math.abs(prevEnd.x - curStart.x) < 1e-4 &&
                         Math.abs(prevEnd.y - curStart.y) < 1e-4;
      if (!connected) {
        // Start a new subpath — insert an implicit M
        if (currentRun.length > 0) subpaths.push(currentRun);
        currentRun = [];
      }
    }
    currentRun.push(seg);
  }
  if (currentRun.length > 0) subpaths.push(currentRun);

  // Serialize each subpath
  return subpaths.map(run => {
    let d = '';
    for (let i = 0; i < run.length; i++) {
      const seg = run[i];
      const upper = seg.command.toUpperCase();

      // If this is the first segment and it's not an M, prepend an M to its startPt
      if (i === 0 && upper !== 'M') {
        d += `M ${seg.startPt.x} ${seg.startPt.y} `;
      }

      d += serializeSegment(seg) + ' ';
    }
    return d.trim();
  }).filter(d => d.length > 0);
}

/**
 * Serialize a single parsed segment back to SVG path `d` notation.
 * Preserves the original command type (relative/absolute, curve type, etc.)
 */
function serializeSegment(seg) {
  const { command, args } = seg;
  if (command.toUpperCase() === 'Z') return 'Z';
  return `${command} ${args.join(' ')}`;
}

/**
 * Given polyline segments and a Set of indices to delete,
 * rebuild as one or more `points` attribute strings.
 */
export function rebuildPolylinePoints(allSegments, deleteIndices) {
  const toDelete = new Set(deleteIndices);
  const surviving = allSegments.filter(s => !toDelete.has(s.index));
  if (surviving.length === 0) return [];

  // Group contiguous segments
  const runs = [];
  let currentRun = [];

  for (const seg of surviving) {
    if (currentRun.length > 0) {
      const prevEnd = currentRun[currentRun.length - 1].endPt;
      const connected = Math.abs(prevEnd.x - seg.startPt.x) < 1e-4 &&
                         Math.abs(prevEnd.y - seg.startPt.y) < 1e-4;
      if (!connected) {
        runs.push(currentRun);
        currentRun = [];
      }
    }
    currentRun.push(seg);
  }
  if (currentRun.length > 0) runs.push(currentRun);

  // Serialize each run as a points string
  return runs.map(run => {
    const pts = [run[0].startPt];
    for (const seg of run) pts.push(seg.endPt);
    return pts.map(p => `${p.x},${p.y}`).join(' ');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. High-level: find intersecting segments for a shape
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Given a shape object from documentState and a selection rect (SVG coords),
 * return { segments, hitIndices, shapeType } or null if not applicable.
 *
 * shapeType: 'path' | 'polyline' | 'polygon' | 'line'
 * segments:  the parsed segment array
 * hitIndices: array of segment indices that intersect the rect
 */
export function findHitsForShape(shape, rect) {
  const type = shape.type?.toLowerCase();

  if (type === 'path') {
    const d = shape.attributes?.d;
    if (!d) return null;
    const segments = parseSvgPath(d);
    const hitIndices = [];
    for (const seg of segments) {
      if (segmentIntersectsRect(seg, rect)) {
        hitIndices.push(seg.index);
      }
    }
    return { segments, hitIndices, shapeType: 'path' };
  }

  if (type === 'polyline' || type === 'polygon') {
    const pts = shape.attributes?.points;
    if (!pts) return null;
    const segments = polylineToSegments(pts);
    const hitIndices = [];
    for (const seg of segments) {
      if (lineIntersectsRect(seg.startPt, seg.endPt, rect)) {
        hitIndices.push(seg.index);
      }
    }
    return { segments, hitIndices, shapeType: type };
  }

  if (type === 'line') {
    const seg = lineElementToSegment(shape.attributes || {});
    const hit = lineIntersectsRect(seg.startPt, seg.endPt, rect);
    return { segments: [seg], hitIndices: hit ? [0] : [], shapeType: 'line' };
  }

  // Not a supported entity for partial delete
  return null;
}

/**
 * Given a shape object and a selection circle (SVG coords),
 * return { segments, hitIndices, shapeType } or null if not applicable.
 */
export function findHitsForShapeCircle(shape, circle) {
  const type = shape.type?.toLowerCase();

  if (type === 'path') {
    const d = shape.attributes?.d;
    if (!d) return null;
    const segments = parseSvgPath(d);
    const hitIndices = [];
    for (const seg of segments) {
      if (segmentIntersectsCircle(seg, circle)) {
        hitIndices.push(seg.index);
      }
    }
    return { segments, hitIndices, shapeType: 'path' };
  }

  if (type === 'polyline' || type === 'polygon') {
    const pts = shape.attributes?.points;
    if (!pts) return null;
    const segments = polylineToSegments(pts);
    const hitIndices = [];
    for (const seg of segments) {
      if (lineIntersectsCircle(seg.startPt, seg.endPt, circle)) {
        hitIndices.push(seg.index);
      }
    }
    return { segments, hitIndices, shapeType: type };
  }

  if (type === 'line') {
    const seg = lineElementToSegment(shape.attributes || {});
    const hit = lineIntersectsCircle(seg.startPt, seg.endPt, circle);
    return { segments: [seg], hitIndices: hit ? [0] : [], shapeType: 'line' };
  }

  return null;
}

/**
 * Apply partial deletion to a shape. Returns an array of replacement shapes
 * (may be 0, 1, or many) or null if the shape is not modified.
 *
 * Preserves all non-geometry attributes (stroke, fill, layer, etc.)
 */
export function applyPartialDelete(shape, hitIndices) {
  if (!hitIndices || hitIndices.length === 0) return null; // nothing to delete

  const type = shape.type?.toLowerCase();
  const baseAttrs = { ...shape.attributes };

  if (type === 'path') {
    const segments = parseSvgPath(baseAttrs.d);
    const rebuilt = rebuildPathD(segments, hitIndices);

    if (rebuilt.length === 0) return []; // entire shape deleted

    return rebuilt.map((d, i) => ({
      id: i === 0 ? shape.id : `${shape.id}-pd-${Date.now()}-${i}`,
      type: 'path',
      attributes: { ...baseAttrs, d },
      transform: shape.transform,
      rawTransform: shape.rawTransform || '',
      children: [],
    }));
  }

  if (type === 'polyline' || type === 'polygon') {
    const segments = polylineToSegments(baseAttrs.points);
    const rebuilt = rebuildPolylinePoints(segments, hitIndices);

    if (rebuilt.length === 0) return [];

    return rebuilt.map((points, i) => ({
      id: i === 0 ? shape.id : `${shape.id}-pd-${Date.now()}-${i}`,
      type: 'polyline', // always polyline after partial delete (polygon may be broken)
      attributes: { ...baseAttrs, points },
      transform: shape.transform,
      rawTransform: shape.rawTransform || '',
      children: [],
    }));
  }

  if (type === 'line') {
    // A <line> has only one segment — deleting it removes the whole element
    return [];
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Vector Eraser: Boolean Subtraction
// ═══════════════════════════════════════════════════════════════════════════════

function getLineCircleIntersections(A, B, C, r) {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const fx = A.x - C.x;
  const fy = A.y - C.y;

  const a = dx * dx + dy * dy;
  if (a === 0) return []; // zero length line

  const b = 2 * (fx * dx + fy * dy);
  const c = (fx * fx + fy * fy) - r * r;

  let discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return [];

  discriminant = Math.sqrt(discriminant);
  const t1 = (-b - discriminant) / (2 * a);
  const t2 = (-b + discriminant) / (2 * a);

  const pts = [];
  if (t1 >= 0 && t1 <= 1) pts.push({ x: A.x + t1 * dx, y: A.y + t1 * dy, t: t1 });
  // Add t2 only if distinct
  if (t2 >= 0 && t2 <= 1 && Math.abs(t1 - t2) > 1e-6) pts.push({ x: A.x + t2 * dx, y: A.y + t2 * dy, t: t2 });

  return pts.sort((p1, p2) => p1.t - p2.t);
}

function distSq(p1, p2) {
  return (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;
}

function subtractCircleFromLine(pA, pB, circle) {
  const r2 = circle.r * circle.r;
  const c = { x: circle.cx, y: circle.cy };
  const d1 = distSq(pA, c);
  const d2 = distSq(pB, c);
  const inA = d1 < r2 - 1e-4; // slightly biased to avoid float precision issues
  const inB = d2 < r2 - 1e-4;

  const inters = getLineCircleIntersections(pA, pB, c, circle.r);

  if (inters.length === 0) {
    return inA ? [] : [{ start: pA, end: pB }];
  }

  if (inters.length === 1) {
    if (!inA && inB) return [{ start: pA, end: inters[0] }];
    if (inA && !inB) return [{ start: inters[0], end: pB }];
    return []; // tangent or endpoint touch, ignore
  }

  if (inters.length === 2) {
    if (!inA && !inB) {
      return [{ start: pA, end: inters[0] }, { start: inters[1], end: pB }];
    }
  }
  
  return []; // Fallback
}

/**
 * Apply vector eraser (boolean subtract) to a shape.
 * Returns an array of replacement shapes, or null if unmodified.
 */
export function applyVectorErase(shape, circle) {
  const type = shape.type?.toLowerCase();
  if (!['path', 'polyline', 'polygon', 'line'].includes(type)) return null;

  // Transform the circle to shape's local space if shape has rawTransform
  // For simplicity, if a shape is translated/scaled, we approximate by
  // using inverse transform on the circle's center, but a proper matrix invert is better.
  // We'll pass the circle directly for now (assuming Canvas passes it transformed or shape has no transform).
  // Currently, we don't handle matrix inversion in JS here, but we will soon if needed.
  
  let segments = [];
  if (type === 'path') {
    const d = shape.attributes?.d;
    if (!d) return null;
    segments = parseSvgPath(d);
  } else if (type === 'polyline' || type === 'polygon') {
    const pts = shape.attributes?.points;
    if (!pts) return null;
    segments = polylineToSegments(pts);
  } else if (type === 'line') {
    segments = [lineElementToSegment(shape.attributes || {})];
  }

  let modified = false;
  const newSubpaths = []; // array of point arrays
  let currentSubpath = [];

  for (const seg of segments) {
    if (seg.command?.toUpperCase() === 'M') {
      if (currentSubpath.length > 0) {
        newSubpaths.push(currentSubpath);
        currentSubpath = [];
      }
      continue;
    }

    if (!segmentIntersectsCircle(seg, circle)) {
      // Entire segment survives. We can just add its start/end to current subpath.
      if (currentSubpath.length === 0) currentSubpath.push(seg.startPt);
      currentSubpath.push(seg.endPt);
      continue;
    }

    // Segment intersects. Break it into points (approximate curve if necessary).
    // Note: for lines, segmentToPoints returns just [startPt, endPt].
    const pts = segmentToPoints(seg);
    let subModified = false;

    for (let i = 0; i < pts.length - 1; i++) {
      const pA = pts[i];
      const pB = pts[i + 1];
      const cutPieces = subtractCircleFromLine(pA, pB, circle);

      if (cutPieces.length === 0) {
        // Line fully erased.
        if (currentSubpath.length > 0) {
          newSubpaths.push(currentSubpath);
          currentSubpath = [];
        }
        subModified = true;
      } else if (cutPieces.length === 1) {
        const piece = cutPieces[0];
        // If piece doesn't start exactly at current pen position, we have a gap.
        if (currentSubpath.length > 0 && distSq(currentSubpath[currentSubpath.length - 1], piece.start) > 1e-4) {
          newSubpaths.push(currentSubpath);
          currentSubpath = [];
        }
        if (currentSubpath.length === 0) currentSubpath.push(piece.start);
        currentSubpath.push(piece.end);
        
        // If it was cut, it's modified
        if (distSq(pA, piece.start) > 1e-4 || distSq(pB, piece.end) > 1e-4) {
          subModified = true;
        }
      } else if (cutPieces.length === 2) {
        // Erased middle
        subModified = true;
        const p1 = cutPieces[0];
        const p2 = cutPieces[1];

        if (currentSubpath.length === 0) currentSubpath.push(p1.start);
        currentSubpath.push(p1.end);
        newSubpaths.push(currentSubpath);
        
        currentSubpath = [p2.start, p2.end];
      }
    }
    
    if (subModified) modified = true;
  }

  if (currentSubpath.length > 0) {
    newSubpaths.push(currentSubpath);
  }

  if (!modified) return null;

  if (newSubpaths.length === 0) return []; // Fully erased

  const baseAttrs = { ...shape.attributes };
  
  return newSubpaths.map((pts, i) => {
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let j = 1; j < pts.length; j++) {
      d += ` L ${pts[j].x},${pts[j].y}`;
    }
    return {
      id: i === 0 ? shape.id : `${shape.id}-ve-${Date.now()}-${i}`,
      type: 'path', // Convert all erased shapes to path for simplicity
      attributes: { ...baseAttrs, d },
      transform: shape.transform,
      rawTransform: shape.rawTransform || '',
      children: [],
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Generate overlay highlight paths for hit segments
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate an array of SVG path `d` strings to highlight hit segments.
 * These are rendered in red in the overlay SVG.
 */
export function generateHighlightPaths(shape, hitIndices) {
  const type = shape.type?.toLowerCase();

  if (type === 'path') {
    const segments = parseSvgPath(shape.attributes?.d || '');
    return hitIndices.map(idx => {
      const seg = segments.find(s => s.index === idx);
      if (!seg) return null;
      const upper = seg.command.toUpperCase();
      if (upper === 'M') return null;
      // Render as M (startPt) + the original segment command (converted to absolute)
      return `M ${seg.startPt.x} ${seg.startPt.y} ${serializeSegmentAbsolute(seg)}`;
    }).filter(Boolean);
  }

  if (type === 'polyline' || type === 'polygon') {
    const segments = polylineToSegments(shape.attributes?.points || '');
    return hitIndices.map(idx => {
      const seg = segments.find(s => s.index === idx);
      if (!seg) return null;
      return `M ${seg.startPt.x} ${seg.startPt.y} L ${seg.endPt.x} ${seg.endPt.y}`;
    }).filter(Boolean);
  }

  if (type === 'line') {
    const seg = lineElementToSegment(shape.attributes || {});
    if (hitIndices.includes(0)) {
      return [`M ${seg.startPt.x} ${seg.startPt.y} L ${seg.endPt.x} ${seg.endPt.y}`];
    }
    return [];
  }

  return [];
}

/**
 * Serialize a segment in absolute coordinates (for highlight overlay).
 */
function serializeSegmentAbsolute(seg) {
  const upper = seg.command.toUpperCase();
  const rel = seg.command !== upper;

  if (upper === 'Z') return 'Z';

  if (upper === 'L') {
    return `L ${seg.endPt.x} ${seg.endPt.y}`;
  }
  if (upper === 'H') {
    return `L ${seg.endPt.x} ${seg.endPt.y}`;
  }
  if (upper === 'V') {
    return `L ${seg.endPt.x} ${seg.endPt.y}`;
  }

  if (upper === 'C') {
    const sx = seg.startPt.x, sy = seg.startPt.y;
    const a = seg.args;
    if (rel) {
      return `C ${sx+a[0]} ${sy+a[1]} ${sx+a[2]} ${sy+a[3]} ${sx+a[4]} ${sy+a[5]}`;
    }
    return `C ${a[0]} ${a[1]} ${a[2]} ${a[3]} ${a[4]} ${a[5]}`;
  }

  if (upper === 'S') {
    const sx = seg.startPt.x, sy = seg.startPt.y;
    const a = seg.args;
    if (rel) {
      return `S ${sx+a[0]} ${sy+a[1]} ${sx+a[2]} ${sy+a[3]}`;
    }
    return `S ${a[0]} ${a[1]} ${a[2]} ${a[3]}`;
  }

  if (upper === 'Q') {
    const sx = seg.startPt.x, sy = seg.startPt.y;
    const a = seg.args;
    if (rel) {
      return `Q ${sx+a[0]} ${sy+a[1]} ${sx+a[2]} ${sy+a[3]}`;
    }
    return `Q ${a[0]} ${a[1]} ${a[2]} ${a[3]}`;
  }

  if (upper === 'T') {
    return `T ${seg.endPt.x} ${seg.endPt.y}`;
  }

  if (upper === 'A') {
    const a = seg.args;
    const sx = seg.startPt.x, sy = seg.startPt.y;
    // rx, ry, rotation, large-arc, sweep, endX, endY
    if (rel) {
      return `A ${a[0]} ${a[1]} ${a[2]} ${a[3]} ${a[4]} ${sx+a[5]} ${sy+a[6]}`;
    }
    return `A ${a[0]} ${a[1]} ${a[2]} ${a[3]} ${a[4]} ${a[5]} ${a[6]}`;
  }

  // Fallback — shouldn't happen
  return `L ${seg.endPt.x} ${seg.endPt.y}`;
}
