/**
 * GeoJSON / geographic utilities for the boundary module.
 */

const R = 6371008.8; // Earth's mean radius in metres

/**
 * Compute the area of a GeoJSON polygon ring (array of [lng, lat] pairs)
 * using the spherical excess formula.
 * Returns area in m².
 */
export function ringAreaM2(coords) {
  const n = coords.length;
  if (n < 3) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[(i + 1) % n];
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;
    total += Δλ * (2 + Math.sin(φ1) + Math.sin(φ2));
  }
  return Math.abs((total * R * R) / 2);
}

/**
 * Compute area from a GeoJSON Feature or Geometry.
 * Returns area in m², or null if unsupported geometry.
 */
export function geojsonAreaM2(geojson) {
  const geo = geojson?.geometry ?? geojson;
  if (!geo) return null;
  if (geo.type === 'Polygon') {
    const outer = geo.coordinates[0];
    return ringAreaM2(outer);
  }
  if (geo.type === 'MultiPolygon') {
    return geo.coordinates.reduce((sum, poly) => sum + ringAreaM2(poly[0]), 0);
  }
  return null;
}

/**
 * Format area for display:
 *  < 10 000 m²  → "x,xxx m²"
 *  ≥ 10 000 m²  → "x.xx ha"
 *  ≥ 1 000 000  → "x.xx km²"
 */
export function formatArea(m2) {
  if (m2 === null || m2 === undefined) return '—';
  if (m2 >= 1_000_000) return `${(m2 / 1_000_000).toFixed(2)} km²`;
  if (m2 >= 10_000)    return `${(m2 / 10_000).toFixed(2)} ha`;
  return `${Math.round(m2).toLocaleString()} m²`;
}
