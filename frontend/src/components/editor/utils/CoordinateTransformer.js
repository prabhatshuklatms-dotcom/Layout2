export default class CoordinateTransformer {
  constructor(points, canvasW, canvasH, padding = 100) {
    const lngs = points.map(([lng]) => lng);
    const lats  = points.map(([, lat]) => lat);
    this.minLng = Math.min(...lngs); this.maxLng = Math.max(...lngs);
    this.minLat = Math.min(...lats); this.maxLat = Math.max(...lats);
    const lngSpan = this.maxLng - this.minLng || 1e-6;
    const latSpan = this.maxLat - this.minLat || 1e-6;
    const midLat  = (this.minLat + this.maxLat) / 2;
    this.cosLat   = Math.cos((midLat * Math.PI) / 180);
    const adjLng  = lngSpan * this.cosLat;
    this.scale    = Math.min((canvasW - padding * 2) / adjLng, (canvasH - padding * 2) / latSpan);
    this.offsetX  = (canvasW - adjLng * this.scale) / 2;
    this.offsetY  = (canvasH - latSpan * this.scale) / 2;
  }
  toSVG(lng, lat) {
    return [
      this.offsetX + (lng - this.minLng) * this.cosLat * this.scale,
      this.offsetY + (this.maxLat - lat) * this.scale,
    ];
  }
}
