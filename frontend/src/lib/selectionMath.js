/**
 * selectionMath.js
 *
 * All coordinate conversions and geometry helpers for the selection tool.
 *
 * COORDINATE SYSTEMS
 * ──────────────────
 * screen  — raw pixel position relative to the viewport (e.clientX/Y)
 * canvas  — pixel position relative to the canvas container's top-left
 * map     — logical coordinate in the untransformed content space
 *           (what gets stored in the DB; independent of zoom / pan)
 *
 * TRANSFORM MODEL
 * ───────────────
 * The canvas viewer applies:
 *   transform: translate(offsetX px, offsetY px) scale(zoom)
 * with transformOrigin: "center center" of the container.
 *
 * To convert canvas coords → map coords:
 *   mapX = (canvasX - containerWidth/2  - offsetX) / zoom
 *   mapY = (canvasY - containerHeight/2 - offsetY) / zoom
 *
 * To convert map coords → canvas coords (for drawing SVG overlays):
 *   canvasX = mapX * zoom + containerWidth/2  + offsetX
 *   canvasY = mapY * zoom + containerHeight/2 + offsetY
 */

/**
 * Convert a screen position to map-space coordinates.
 * @param {number} screenX
 * @param {number} screenY
 * @param {DOMRect} containerRect  getBoundingClientRect() of the canvas container
 * @param {number} zoom
 * @param {{x:number,y:number}} offset
 * @returns {{x:number,y:number}}
 */
export function screenToMap(screenX, screenY, containerRect, zoom, offset) {
  const canvasX = screenX - containerRect.left;
  const canvasY = screenY - containerRect.top;
  return canvasToMap(canvasX, canvasY, containerRect.width, containerRect.height, zoom, offset);
}

/**
 * Convert a canvas-relative position to map-space coordinates.
 */
export function canvasToMap(canvasX, canvasY, containerW, containerH, zoom, offset) {
  return {
    x: (canvasX - containerW / 2 - offset.x) / zoom,
    y: (canvasY - containerH / 2 - offset.y) / zoom,
  };
}

/**
 * Convert a map-space point back to canvas-relative coordinates (for SVG overlay).
 */
export function mapToCanvas(mapX, mapY, containerW, containerH, zoom, offset) {
  return {
    x: mapX * zoom + containerW / 2 + offset.x,
    y: mapY * zoom + containerH / 2 + offset.y,
  };
}

/**
 * Build the four corners of a rectangle from two diagonal points (map-space).
 * Returns points in clockwise order: TL, TR, BR, BL.
 */
export function buildRectPoints(p1, p2) {
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);
  return [
    { x: minX, y: minY }, // TL
    { x: maxX, y: minY }, // TR
    { x: maxX, y: maxY }, // BR
    { x: minX, y: maxY }, // BL
  ];
}

/**
 * Compute bounding box from an array of points.
 * @returns {{ minX, minY, maxX, maxY, width, height, cx, cy }}
 */
export function getBoundingBox(points) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    minX, minY, maxX, maxY,
    width:  maxX - minX,
    height: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

/**
 * Compute the area of a polygon using the shoelace formula.
 * Returns the absolute area in map units².
 */
export function polygonArea(points) {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Translate all points in an array by (dx, dy).
 */
export function translatePoints(points, dx, dy) {
  return points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

/**
 * Move a single point (by index) in an array.
 */
export function movePoint(points, index, newX, newY) {
  return points.map((p, i) => (i === index ? { x: newX, y: newY } : p));
}

/**
 * Returns the handle positions for a polygon/rectangle (one per vertex).
 * Result is in map-space.
 */
export function getHandles(points) {
  return points.map((p, i) => ({ ...p, index: i }));
}

/**
 * Hit-test: is a map-space point within `radius` map-units of a handle?
 */
export function hitTestHandle(mapX, mapY, handles, radiusMapUnits) {
  for (const h of handles) {
    const dx = mapX - h.x;
    const dy = mapY - h.y;
    if (dx * dx + dy * dy <= radiusMapUnits * radiusMapUnits) {
      return h.index;
    }
  }
  return -1;
}

/**
 * Hit-test: is a map-space point inside a polygon?
 * Uses ray-casting algorithm.
 */
export function pointInPolygon(x, y, points) {
  let inside = false;
  const n = points.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = points[i].x, yi = points[i].y;
    const xj = points[j].x, yj = points[j].y;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Format a map-space area value for display.
 * (Units are abstract map units — just show the number nicely)
 */
export function formatArea(area) {
  if (area === null || area === undefined) return '—';
  if (area >= 1_000_000) return `${(area / 1_000_000).toFixed(2)} M u²`;
  if (area >= 1_000)     return `${(area / 1_000).toFixed(2)} K u²`;
  return `${area.toFixed(2)} u²`;
}
