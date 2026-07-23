/**
 * boundary-detection.js
 *
 * Finds the smallest closed SVG shape that contains a given point.
 * Uses the browser-native SVGGeometryElement.isPointInFill() which correctly
 * handles all path types, transforms, viewBox scaling, and coordinate spaces.
 *
 * Accepts screen coordinates (clientX/Y) so coordinate transforms are done
 * once, correctly, using the browser's own matrix arithmetic.
 */

/**
 * Find the smallest closed SVG shape element that contains the screen point
 * (clientX, clientY).
 *
 * @param {SVGSVGElement} svgEl    - The live <svg> DOM element
 * @param {number}        clientX - Mouse clientX (screen pixels)
 * @param {number}        clientY - Mouse clientY (screen pixels)
 * @returns {{ element: SVGElement, area: number } | null}
 */
export function findSmallestContainingShape(svgEl, clientX, clientY) {
  if (!svgEl) return null;

  // Create an SVGPoint in screen (viewport) coordinates
  let screenPt;
  try {
    screenPt = svgEl.createSVGPoint();
    screenPt.x = clientX;
    screenPt.y = clientY;
  } catch (_) {
    return null;
  }

  const CLOSED_TAGS = ['path', 'polygon', 'rect', 'circle', 'ellipse', 'polyline'];
  const containing = [];

  for (const tag of CLOSED_TAGS) {
    svgEl.querySelectorAll(tag).forEach(el => {
      // Skip hatch overlay shapes — they should not become new boundaries
      if (el.getAttribute('data-cad-type') === 'hatch') return;
      if (!isElementClosed(el)) return;

      try {
        // getCTM() returns the matrix from element's user-space to screen viewport.
        // Invert it to map the screen point into the element's local coordinate space.
        const ctm = el.getCTM();
        if (!ctm) return;

        const localPt = screenPt.matrixTransform(ctm.inverse());

        // isPointInFill requires fill to be non-"none".
        // Temporarily set fill to a solid color, test, then restore.
        const origFill = el.getAttribute('fill');
        el.setAttribute('fill', 'black');
        const inside = el.isPointInFill(localPt);
        if (origFill === null) el.removeAttribute('fill');
        else el.setAttribute('fill', origFill);

        if (!inside) return;

        const bb = el.getBBox();
        containing.push({ element: el, area: bb.width * bb.height });
      } catch (_) {
        // isPointInFill / getCTM can throw for invisible or degenerate elements
      }
    });
  }

  if (containing.length === 0) return null;

  // Smallest bounding-box area = innermost / most specific enclosing region
  containing.sort((a, b) => a.area - b.area);
  return containing[0];
}

/**
 * Returns true if the SVG element is a closed region (fillable).
 */
function isElementClosed(el) {
  const tag = el.tagName.toLowerCase();
  if (['rect', 'circle', 'ellipse', 'polygon'].includes(tag)) return true;
  if (tag === 'path') {
    const d = (el.getAttribute('d') || '').trim();
    return /[Zz]\s*$/.test(d);
  }
  if (tag === 'polyline') {
    const pts = (el.getAttribute('points') || '').trim().split(/[\s,]+/).filter(Boolean);
    if (pts.length >= 4) {
      const x1 = parseFloat(pts[0]), y1 = parseFloat(pts[1]);
      const x2 = parseFloat(pts[pts.length - 2]), y2 = parseFloat(pts[pts.length - 1]);
      return Math.abs(x1 - x2) < 0.001 && Math.abs(y1 - y2) < 0.001;
    }
  }
  return false;
}

/**
 * Raster flood-fill fallback — for implicit gaps between open lines.
 * Forces strokes to black so wall detection works regardless of theme color.
 */
const MAX_CANVAS_SIZE = 1500;

export function detectBoundaryRaster(svgEl, svgX, svgY, svgViewBox) {
  return new Promise((resolve) => {
    try {
      // Clone and force all strokes to black on white background
      const clone = svgEl.cloneNode(true);
      clone.style.cssText = 'background:white;';
      clone.querySelectorAll('*').forEach(el => {
        const s = el.getAttribute('stroke');
        // Replace currentColor / any light color with black
        if (!s || s === 'none') {
          // leave stroke:none elements alone (they won't form walls)
        } else {
          el.setAttribute('stroke', '#000000');
        }
        // Remove fills so only stroke lines are visible as walls
        if (el.getAttribute('fill') !== 'none') {
          el.setAttribute('fill', 'none');
        }
        // Remove stroke="currentColor" which may render white
        if (s === 'currentColor' || !s) {
          el.setAttribute('stroke', '#000000');
        }
      });

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(clone);

      const [vx, vy, vw, vh] = svgViewBox.split(' ').map(Number);
      const scale = Math.min(MAX_CANVAS_SIZE / vw, MAX_CANVAS_SIZE / vh);
      const canvasW = Math.ceil(vw * scale);
      const canvasH = Math.ceil(vh * scale);

      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvasW, canvasH);

      // Fix SVG dimensions for the canvas render
      const modifiedSvg = svgString.replace(/<svg([^>]*)>/, (_, attrs) => {
        let a = attrs;
        if (/width=/.test(a)) { a = a.replace(/width="[^"]*"/, `width="${canvasW}"`); }
        else { a += ` width="${canvasW}"`; }
        if (/height=/.test(a)) { a = a.replace(/height="[^"]*"/, `height="${canvasH}"`); }
        else { a += ` height="${canvasH}"`; }
        return `<svg${a}>`;
      });

      const img = new Image();
      const blob = new Blob([modifiedSvg], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        URL.revokeObjectURL(url);
        ctx.drawImage(img, 0, 0, canvasW, canvasH);

        const pixelX = Math.floor((svgX - vx) * scale);
        const pixelY = Math.floor((svgY - vy) * scale);

        if (pixelX < 0 || pixelX >= canvasW || pixelY < 0 || pixelY >= canvasH) {
          return resolve('open');
        }

        const imageData = ctx.getImageData(0, 0, canvasW, canvasH);
        const data = imageData.data;

        const isWall = (i) => {
          const p = i * 4;
          return data[p] < 200 || data[p + 1] < 200 || data[p + 2] < 200;
        };

        if (isWall(pixelX + pixelY * canvasW)) return resolve(null);

        const visited = new Uint8Array(canvasW * canvasH);
        const queue = [pixelY * canvasW + pixelX];
        visited[pixelY * canvasW + pixelX] = 1;
        let isOpen = false;

        while (queue.length > 0) {
          const cur = queue.pop();
          const cx = cur % canvasW;
          const cy = Math.floor(cur / canvasW);
          if (cx <= 0 || cx >= canvasW - 1 || cy <= 0 || cy >= canvasH - 1) {
            isOpen = true; break;
          }
          for (const n of [cur - canvasW, cur + canvasW, cur - 1, cur + 1]) {
            if (visited[n] === 0) {
              if (!isWall(n)) { visited[n] = 1; queue.push(n); }
              else { visited[n] = 2; }
            }
          }
        }

        if (isOpen) return resolve('open');

        const contour = traceContour(visited, canvasW, canvasH);
        if (!contour || contour.length < 3) return resolve(null);

        const simplified = douglasPeucker(contour, 1.5);
        const svgPoints = simplified.map(p => ({
          x: (p.x / scale) + vx,
          y: (p.y / scale) + vy,
        }));
        resolve(svgPoints);
      };

      img.onerror = () => resolve(null);
      img.src = url;
    } catch (err) {
      console.error('[BoundaryDetection] raster error:', err);
      resolve(null);
    }
  });
}

// ─── Contour tracing ──────────────────────────────────────────────────────────

function traceContour(visited, width, height) {
  let startIdx = -1, tx = 0, ty = 0;
  for (let y = 0; y < height && startIdx === -1; y++) {
    for (let x = 0; x < width; x++) {
      if (visited[y * width + x] === 1) { startIdx = y * width + x; tx = x; ty = y; break; }
    }
  }
  if (startIdx === -1) return null;

  const dirX = [0, 1, 1, 1, 0, -1, -1, -1];
  const dirY = [-1, -1, 0, 1, 1, 1, 0, -1];
  let cx = tx, cy = ty, dir = 6;
  const contour = [];
  const maxIter = width * height;
  let iter = 0;

  do {
    iter++;
    contour.push({ x: cx, y: cy });
    let nd = (dir + 6) % 8, found = false;
    for (let i = 0; i < 8; i++) {
      const d = (nd + i) % 8;
      const nx = cx + dirX[d], ny = cy + dirY[d];
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && visited[ny * width + nx] === 1) {
        cx = nx; cy = ny; dir = d; found = true; break;
      }
    }
    if (!found) break;
  } while ((cx !== tx || cy !== ty) && iter < maxIter);

  return contour;
}

function douglasPeucker(points, epsilon) {
  if (points.length <= 2) return points;
  let dmax = 0, index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const d = ptLineDist(points[i], points[0], points[end]);
    if (d > dmax) { index = i; dmax = d; }
  }
  if (dmax > epsilon) {
    const r1 = douglasPeucker(points.slice(0, index + 1), epsilon);
    const r2 = douglasPeucker(points.slice(index), epsilon);
    return r1.slice(0, r1.length - 1).concat(r2);
  }
  return [points[0], points[end]];
}

function ptLineDist(p, a, b) {
  const num = Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x);
  const den = Math.hypot(b.y - a.y, b.x - a.x);
  return den === 0 ? 0 : num / den;
}
