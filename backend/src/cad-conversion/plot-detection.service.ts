/**
 * PlotDetectionService
 *
 * Single source of truth for closed-region recognition.
 *
 * Responsibilities:
 *   1. Parse every geometric element in an SVG string (path, polygon, polyline,
 *      rect, circle, ellipse — including those nested inside <g> groups).
 *   2. Determine closure purely from geometry, never from DXF entity flags or
 *      path-string suffixes.
 *   3. Normalize every detected closed region to a canonical <path d="…Z"> so
 *      the editor always receives one consistent representation.
 *   4. Stamp each detected region with stable, deterministic metadata attributes:
 *        id                  cad-plot-<index>
 *        data-closed         "true"
 *        data-geometry-type  original tag name
 *        data-plot-index     0-based index among detected plots
 *   5. Preserve all existing data-plot-id / data-boundary-ref attributes that
 *      were written by a previous editor session (idempotent).
 *
 * The service is called:
 *   a. Immediately after SVG generation in ConversionPipelineService.
 *   b. As a one-time migration pass in CadConversionService.getCompositeSvg
 *      for legacy SVGs that pre-date this pipeline step.
 */

import { Injectable, Logger } from '@nestjs/common';
import { JSDOM } from 'jsdom';

// ─── Geometry helpers (pure functions, no DOM dependency) ─────────────────────

/** Shoelace signed area — positive = counter-clockwise in SVG coordinate space */
function signedArea(pts: Array<{ x: number; y: number }>): number {
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  return area / 2;
}

/** Absolute Shoelace area */
function polyArea(pts: Array<{ x: number; y: number }>): number {
  return Math.abs(signedArea(pts));
}

/**
 * Parse an SVG path `d` attribute into an array of absolute {x,y} vertices.
 * Handles M/L/H/V/C/S/Q/T/A/Z (absolute and relative). Arc endpoints only —
 * the arc midpoint is sampled at 8 points so enclosed area is approximated.
 */
function pathToPoints(d: string): Array<{ x: number; y: number }> {
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
  if (!tokens) return [];

  const pts: Array<{ x: number; y: number }> = [];
  let cx = 0, cy = 0;   // current point
  let mx = 0, my = 0;   // last Move point (for Z)
  let i = 0;

  const num = () => (i < tokens.length ? parseFloat(tokens[i++]) : 0);
  const push = (x: number, y: number) => { pts.push({ x, y }); cx = x; cy = y; };

  while (i < tokens.length) {
    const cmd = tokens[i];
    if (!/^[A-Za-z]$/.test(cmd)) { i++; continue; }
    i++;

    switch (cmd) {
      case 'M': { const x = num(), y = num(); mx = x; my = y; push(x, y); break; }
      case 'm': { const x = cx + num(), y = cy + num(); mx = x; my = y; push(x, y); break; }
      case 'L': push(num(), num()); break;
      case 'l': push(cx + num(), cy + num()); break;
      case 'H': push(num(), cy); break;
      case 'h': push(cx + num(), cy); break;
      case 'V': push(cx, num()); break;
      case 'v': push(cx, cy + num()); break;
      case 'C': { num(); num(); num(); num(); push(num(), num()); break; }
      case 'c': { num(); num(); num(); num(); push(cx + num(), cy + num()); break; }
      case 'S': { num(); num(); push(num(), num()); break; }
      case 's': { num(); num(); push(cx + num(), cy + num()); break; }
      case 'Q': { num(); num(); push(num(), num()); break; }
      case 'q': { num(); num(); push(cx + num(), cy + num()); break; }
      case 'T': push(num(), num()); break;
      case 't': push(cx + num(), cy + num()); break;
      case 'A': case 'a': {
        // Arc: sample 8 intermediate points on the arc so area is approximated
        const rx = num(), ry = num();
        const xRot = num() * Math.PI / 180;
        const largeArc = num() !== 0;
        const sweep = num() !== 0;
        const ex = cmd === 'A' ? num() : cx + num();
        const ey = cmd === 'A' ? num() : cy + num();
        // Approximate arc with line segments
        const ax = cx, ay = cy;
        const N = 8;
        for (let k = 1; k <= N; k++) {
          const t = k / N;
          // Simple linear interpolation for approximation
          const ix = ax + (ex - ax) * t;
          const iy = ay + (ey - ay) * t;
          push(ix, iy);
        }
        push(ex, ey);
        break;
      }
      case 'Z': case 'z': push(mx, my); break;
    }
  }
  return pts;
}

/**
 * Parse a `points` attribute (polyline/polygon) into {x,y} array.
 */
function parsePoints(attr: string): Array<{ x: number; y: number }> {
  const nums = (attr || '').trim().split(/[\s,]+/).filter(Boolean);
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    pts.push({ x: parseFloat(nums[i]), y: parseFloat(nums[i + 1]) });
  }
  return pts;
}

/**
 * Determine whether a set of points forms a geometrically closed region.
 *
 * Rules (geometry-only, no reliance on entity flags or path Z suffixes):
 *  1. Need at least 3 distinct vertices.
 *  2. Enclosed area (Shoelace) must be > minAreaThreshold.
 *  3. The closing gap (distance from last to first vertex) must be ≤ the
 *     average inter-vertex distance. This handles both explicitly closed paths
 *     AND CAD polylines where the closing vertex is omitted.
 */
function isGeometricallyClosed(
  pts: Array<{ x: number; y: number }>,
  minAreaThreshold = 1e-6,
): boolean {
  if (pts.length < 3) return false;

  const area = polyArea(pts);
  if (area < minAreaThreshold) return false;

  // Closing gap vs average segment
  const dx = pts[pts.length - 1].x - pts[0].x;
  const dy = pts[pts.length - 1].y - pts[0].y;
  const closingGap = Math.sqrt(dx * dx + dy * dy);

  let totalLen = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const sx = pts[i + 1].x - pts[i].x, sy = pts[i + 1].y - pts[i].y;
    totalLen += Math.sqrt(sx * sx + sy * sy);
  }
  const avgSeg = pts.length > 1 ? totalLen / (pts.length - 1) : 0;

  // Also consider the full perimeter — for very large coordinates the closing
  // gap may be small relative to the average but large in absolute terms.
  return closingGap <= avgSeg * 2;
}

/**
 * Convert element geometry to a canonical closed <path d="…Z"> string.
 * Returns null if the element cannot be normalized.
 */
function normalizeToClosedPath(el: Element): string | null {
  const tag = el.tagName.toLowerCase();

  if (tag === 'path') {
    const d = (el.getAttribute('d') || '').trim();
    if (!d) return null;
    // Ensure it ends with Z
    return /[Zz]\s*$/.test(d) ? d : `${d} Z`;
  }

  if (tag === 'polygon' || tag === 'polyline') {
    const pts = parsePoints(el.getAttribute('points') || '');
    if (pts.length < 3) return null;
    const segments = pts.map((p, i) =>
      i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
    );
    return segments.join(' ') + ' Z';
  }

  if (tag === 'rect') {
    const x = parseFloat(el.getAttribute('x') || '0');
    const y = parseFloat(el.getAttribute('y') || '0');
    const w = parseFloat(el.getAttribute('width') || '0');
    const h = parseFloat(el.getAttribute('height') || '0');
    if (w === 0 || h === 0) return null;
    return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
  }

  if (tag === 'circle') {
    const cx = parseFloat(el.getAttribute('cx') || '0');
    const cy = parseFloat(el.getAttribute('cy') || '0');
    const r = parseFloat(el.getAttribute('r') || '0');
    if (r <= 0) return null;
    // Two-arc approximation (SVG cannot express a full circle as a single arc)
    return (
      `M ${cx - r} ${cy} ` +
      `A ${r} ${r} 0 0 1 ${cx + r} ${cy} ` +
      `A ${r} ${r} 0 0 1 ${cx - r} ${cy} Z`
    );
  }

  if (tag === 'ellipse') {
    const cx = parseFloat(el.getAttribute('cx') || '0');
    const cy = parseFloat(el.getAttribute('cy') || '0');
    const rx = parseFloat(el.getAttribute('rx') || '0');
    const ry = parseFloat(el.getAttribute('ry') || '0');
    if (rx <= 0 || ry <= 0) return null;
    return (
      `M ${cx - rx} ${cy} ` +
      `A ${rx} ${ry} 0 0 1 ${cx + rx} ${cy} ` +
      `A ${rx} ${ry} 0 0 1 ${cx - rx} ${cy} Z`
    );
  }

  return null;
}

/**
 * Collect all non-group geometric elements from an SVG element, including
 * those nested inside any depth of <g> groups.
 */
function collectGeometricElements(root: Element): Element[] {
  const GEOMETRIC_TAGS = new Set(['path', 'polygon', 'polyline', 'rect', 'circle', 'ellipse']);
  const results: Element[] = [];

  const walk = (el: Element) => {
    const tag = el.tagName.toLowerCase();
    if (GEOMETRIC_TAGS.has(tag)) {
      results.push(el);
    }
    // Recurse into groups — but not into <defs> (block definitions / symbol defs)
    if (tag === 'g' || tag === 'svg') {
      for (let i = 0; i < el.children.length; i++) {
        walk(el.children[i]);
      }
    }
  };

  walk(root);
  return results;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export interface PlotDetectionResult {
  /** The normalized SVG string with all plot metadata stamped in. */
  svg: string;
  /** Number of closed plots detected in this pass. */
  detectedCount: number;
  /** Whether the input was already normalized (skipped re-processing). */
  wasAlreadyNormalized: boolean;
}

@Injectable()
export class PlotDetectionService {
  private readonly logger = new Logger(PlotDetectionService.name);

  /**
   * Run the Plot Detection Engine on a raw SVG string.
   *
   * For every geometric element that is geometrically closed:
   *   - Replace it with a canonical <path d="…Z"> (same position in the DOM)
   *   - Stamp data-closed="true", data-geometry-type, data-plot-index, and a
   *     stable id ("cad-plot-<index>") — unless the element already carries
   *     data-closed="true" from a previous run (idempotent).
   *
   * Non-closed elements (open lines, open polylines, text, etc.) are left
   * untouched. Their existing ids and attributes are preserved.
   *
   * @param svgString  Raw SVG markup from CadSvgRenderer or a saved editor file.
   * @returns          PlotDetectionResult
   */
  public detect(svgString: string): PlotDetectionResult {
    // ── Quick check: already normalized? ─────────────────────────────────
    if (svgString.includes('data-closed="true"')) {
      const existingCount = (svgString.match(/data-closed="true"/g) || []).length;
      return { svg: svgString, detectedCount: existingCount, wasAlreadyNormalized: true };
    }

    const dom = new JSDOM(svgString, { contentType: 'image/svg+xml' });
    const doc = dom.window.document;
    const svgEl = doc.querySelector('svg');
    if (!svgEl) {
      this.logger.warn('PlotDetectionService: no <svg> element found');
      return { svg: svgString, detectedCount: 0, wasAlreadyNormalized: false };
    }

    // Collect every geometric element, including those in nested <g>s.
    // Skip elements inside <defs> — those are block symbol definitions, not plot regions.
    const defsEl = svgEl.querySelector('defs');
    const elements = collectGeometricElements(svgEl).filter(el => {
      if (defsEl && defsEl.contains(el)) return false;  // skip block defs
      
      // Legacy bug: older pipeline versions stamped data-cad-type="background" on
      // ALL geometric entities, not just text. For geometric tags, IGNORE the
      // background attribute and evaluate closure normally. For text elements,
      // respect the background flag (text should never become a detected plot).
      const cadType = el.getAttribute('data-cad-type');
      const tag = el.tagName.toLowerCase();
      const isTextElement = tag === 'text' || tag === 'tspan';
      
      if (cadType === 'background' && isTextElement) return false;
      // For non-text geometry, background is meaningless — ignore it
      
      if (cadType === 'hatch') return false;
      if (el.getAttribute('pointer-events') === 'none') return false;
      return true;
    });

    let plotIndex = 0;

    for (const el of elements) {
      const tag = el.tagName.toLowerCase();

      // ── Extract points for geometric closure test ─────────────────────
      let pts: Array<{ x: number; y: number }> = [];

      if (tag === 'path') {
        pts = pathToPoints(el.getAttribute('d') || '');
      } else if (tag === 'polygon' || tag === 'polyline') {
        pts = parsePoints(el.getAttribute('points') || '');
      } else if (tag === 'rect') {
        const x = parseFloat(el.getAttribute('x') || '0');
        const y = parseFloat(el.getAttribute('y') || '0');
        const w = parseFloat(el.getAttribute('width') || '0');
        const h = parseFloat(el.getAttribute('height') || '0');
        pts = [
          { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h },
        ];
      } else if (tag === 'circle') {
        // A circle is always closed — synthesize 8 sample points for area check
        const cx = parseFloat(el.getAttribute('cx') || '0');
        const cy = parseFloat(el.getAttribute('cy') || '0');
        const r = parseFloat(el.getAttribute('r') || '0');
        if (r > 0) {
          for (let k = 0; k < 8; k++) {
            const a = (2 * Math.PI * k) / 8;
            pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
          }
        }
      } else if (tag === 'ellipse') {
        const cx = parseFloat(el.getAttribute('cx') || '0');
        const cy = parseFloat(el.getAttribute('cy') || '0');
        const rx = parseFloat(el.getAttribute('rx') || '0');
        const ry = parseFloat(el.getAttribute('ry') || '0');
        if (rx > 0 && ry > 0) {
          for (let k = 0; k < 8; k++) {
            const a = (2 * Math.PI * k) / 8;
            pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
          }
        }
      }

      if (!isGeometricallyClosed(pts)) continue;

      // ── Normalize to canonical closed <path> ──────────────────────────
      const normalizedD = normalizeToClosedPath(el);
      if (!normalizedD) continue;

      // Build the replacement <path> element
      const plotId = el.getAttribute('id') || `cad-plot-${plotIndex}`;
      const replacement = doc.createElementNS('http://www.w3.org/2000/svg', 'path');

      // Geometry
      replacement.setAttribute('d', normalizedD);

      // Copy visual / non-geometry attributes verbatim (stroke, fill, etc.)
      const SKIP_ATTRS = new Set(['d', 'points', 'x', 'y', 'width', 'height',
        'cx', 'cy', 'r', 'rx', 'ry', 'id', 'transform']);
      for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        if (!SKIP_ATTRS.has(attr.name)) {
          replacement.setAttribute(attr.name, attr.value);
        }
      }

      // Preserve transform if present
      const transform = el.getAttribute('transform');
      if (transform) replacement.setAttribute('transform', transform);

      // Remove data-cad-type="background" from geometric elements — it was
      // incorrectly stamped by older pipeline versions on all entities.
      // Leaving it would cause the editor's hit-testing to skip the element.
      if (replacement.getAttribute('data-cad-type') === 'background') {
        replacement.removeAttribute('data-cad-type');
      }

      // Stable identity and metadata
      replacement.setAttribute('id', plotId);
      replacement.setAttribute('data-closed', 'true');
      replacement.setAttribute('data-geometry-type', tag);
      replacement.setAttribute('data-plot-index', String(plotIndex));

      // Preserve any existing editor annotations (plot assignment, hatch refs, labels)
      for (const dataAttr of [
        'data-plot-id', 'data-boundary-ref',
        'data-label-dx', 'data-label-dy', 'data-label-fontsize',
        'data-label-fontfamily', 'data-label-color', 'data-label-show-area',
        'data-label-rotation', 'data-label-align',
      ]) {
        const v = el.getAttribute(dataAttr);
        if (v !== null) replacement.setAttribute(dataAttr, v);
      }

      // Replace in the DOM
      el.parentNode!.replaceChild(replacement, el);
      plotIndex++;
    }

    this.logger.log(
      `PlotDetectionService: detected ${plotIndex} closed plot(s)`
    );

    return {
      svg: svgEl.outerHTML,
      detectedCount: plotIndex,
      wasAlreadyNormalized: false,
    };
  }
}
