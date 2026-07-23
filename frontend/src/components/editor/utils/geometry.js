export function extractPoints(boundary) {
  try {
    const geo  = boundary?.geometry?.geometry ?? boundary?.geometry;
    const ring = geo?.coordinates?.[0];
    return ring?.length ? ring.slice(0, -1) : [];
  } catch { return []; }
}
export function getBBox(pts) {
  let minLng=Infinity, maxLng=-Infinity, minLat=Infinity, maxLat=-Infinity;
  pts.forEach(([lng,lat]) => {
    if (lng<minLng) minLng=lng; if (lng>maxLng) maxLng=lng;
    if (lat<minLat) minLat=lat; if (lat>maxLat) maxLat=lat;
  });
  return { minLng, maxLng, minLat, maxLat };
}
export function polyCentroid(pts) {
  if (!pts.length) return [0,0];
  return [pts.reduce((s,p)=>s+p[0],0)/pts.length, pts.reduce((s,p)=>s+p[1],0)/pts.length];
}
export function polyBBox(pts) {
  const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
  return { x:Math.min(...xs), y:Math.min(...ys), w:Math.max(...xs)-Math.min(...xs), h:Math.max(...ys)-Math.min(...ys) };
}
// screen (page px) → SVG canvas coords
export function s2c(sx, sy, view, rect) {
  const ox = rect ? rect.left : 0;
  const oy = rect ? rect.top  : 0;
  return [(sx - ox - view.tx) / view.scale, (sy - oy - view.ty) / view.scale];
}
export function ptInRect(cx,cy,rx,ry,rw,rh) { return cx>=rx && cx<=rx+rw && cy>=ry && cy<=ry+rh; }
export function ptNear(ax,ay,bx,by,r) { return Math.hypot(ax-bx,ay-by)<=r; }