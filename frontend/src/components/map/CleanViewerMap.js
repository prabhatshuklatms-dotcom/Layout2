'use client';
/**
 * LeafletMapView — architecture regions on a real Leaflet satellite map.
 *
 * Editing experience matches /map ExplorerMap exactly:
 *  - SELECT: click to select · drag to move · 8-direction resize handles · rotate handle
 *  - PAN: spacebar or toolbar (map dragging)
 *  - CROP_RECT: drag to draw · corner handles to resize · rule-of-thirds guides
 *  - CROP_POLY: click to add points · Enter/dblclick to finish · Esc to cancel
 *  - ROTATE: drag rotation handle, persists via updateRegion
 *  - Save crop via updateRegion
 *  - Keyboard: Space=pan · Esc=cancel · Enter=finish poly · Delete=clear crop · Ctrl+S=save · Ctrl+0=fit
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { getPreviewUrl } from '@/lib/api';

// ─── constants ────────────────────────────────────────────────────────────────
const HANDLE_R   = 7;          // px radius / half-size of resize handles
const ROTATE_OFF = 30;         // px above top-centre for rotate handle
const MIN_GEO    = 0.000001;   // minimum geo span
const DBLCLICK_MS = 220;
const DRAG_MIN    = 4;         // px threshold before a click becomes a drag

export const TOOL = {
  SELECT:    'SELECT',
  PAN:       'PAN',
  CROP_RECT: 'CROP_RECT',
  CROP_POLY: 'CROP_POLY',
  FIT_BOUNDARY: 'FIT_BOUNDARY',
};

// ─── geo helpers ──────────────────────────────────────────────────────────────
function geoFitRegion(region, boundary) {
  const geo  = boundary?.geometry?.geometry ?? boundary?.geometry;
  const ring = geo?.coordinates?.[0];
  if (!ring || ring.length < 3) return null;
  const lngs = ring.map(([lng]) => lng), lats = ring.map(([,lat]) => lat);
  const bMinX=Math.min(...lngs), bMaxX=Math.max(...lngs);
  const bMinY=Math.min(...lats), bMaxY=Math.max(...lats);
  const bW=bMaxX-bMinX, bH=bMaxY-bMinY;
  if (bW<=0||bH<=0) return null;
  const rW=region.width||200, rH=region.height||200;
  if (rW<=0||rH<=0) return null;
  const scale=Math.min(bW/rW, bH/rH);
  const oW=rW*scale, oH=rH*scale;
  const bCX=(bMinX+bMaxX)/2, bCY=(bMinY+bMaxY)/2;
  return { x:bCX-oW/2, y:bCY-oH/2, w:oW, h:oH, color:boundary.color??'#3b82f6' };
}

function allBounds(Lf, boundaries) {
  const pts=[];
  boundaries.forEach(b=>{
    const geo=b?.geometry?.geometry??b?.geometry;
    const ring=geo?.coordinates?.[0];
    if(ring) ring.forEach(([lng,lat])=>pts.push([lat,lng]));
  });
  if(pts.length<2) return null;
  try { const lb=Lf.latLngBounds(pts); return lb.isValid()?lb:null; } catch { return null; }
}

function getTightBounds(r) {
  const fw = r.architectureFile?.imageWidth || 1000;
  const fh = r.architectureFile?.imageHeight || 1000;
  const raw_rw = r.width || fw;
  const raw_rh = r.height || fh;
  const raw_rx = r.x ?? (-fw/2);
  const raw_ry = r.y ?? (-fh/2);
  
  if (r.shapeType === 'POLYGON' && Array.isArray(r.points) && r.points.length > 0) {
      const px = r.points.map(p => p.x);
      const py = r.points.map(p => p.y);
      const pMinX = Math.min(...px);
      const pMinY = Math.min(...py);
      const pMaxX = Math.max(...px);
      const pMaxY = Math.max(...py);
      return {
          isTight: true,
          fw, fh, raw_rw, raw_rh, raw_rx, raw_ry,
          rw: pMaxX - pMinX,
          rh: pMaxY - pMinY,
          rx: pMinX,
          ry: pMinY,
      };
  }
  
  return {
      isTight: false,
      fw, fh, raw_rw, raw_rh, raw_rx, raw_ry,
      rw: raw_rw, rh: raw_rh, rx: raw_rx, ry: raw_ry
  };
}

function convertTightToRawT(newTightT, tb) {
   if (!tb.isTight) return newTightT;
   const newScaleX = newTightT.w / tb.rw;
   const newScaleY = newTightT.h / tb.rh;
   const newOrigX = newTightT.x - (tb.rx + tb.fw/2) * newScaleX;
   const newOrigNorth = newTightT.y + newTightT.h + (tb.ry + tb.fh/2) * newScaleY;
   const newOrigH = tb.fh * newScaleY;
   const newOrigY = newOrigNorth - newOrigH;
   
   const raw_t_x = newOrigX + (tb.raw_rx + tb.fw/2) * newScaleX;
   const raw_t_w = tb.raw_rw * newScaleX;
   const raw_t_North = newOrigY + newOrigH - (tb.raw_ry + tb.fh/2) * newScaleY;
   const raw_t_h = tb.raw_rh * newScaleY;
   const raw_t_y = raw_t_North - raw_t_h;
   return { x: raw_t_x, y: raw_t_y, w: raw_t_w, h: raw_t_h, rotation: newTightT.rotation };
}

function computeOrigT(t, tb) {
    const scaleX_geo = t.w / tb.raw_rw;
    const scaleY_geo = t.h / tb.raw_rh;
    const origT_x = t.x - (tb.raw_rx + tb.fw/2) * scaleX_geo;
    const origT_w = tb.fw * scaleX_geo;
    const originalGeoNorth = (t.y + t.h) + (tb.raw_ry + tb.fh/2) * scaleY_geo;
    const origT_h = tb.fh * scaleY_geo;
    const origT_y = originalGeoNorth - origT_h;
    return { x: origT_x, y: origT_y, w: origT_w, h: origT_h, rotation: t.rotation };
}

function computeTightT(t, tb, origT) {
    if (!tb.isTight) return { ...t };
    const scaleX_geo = t.w / tb.raw_rw;
    const scaleY_geo = t.h / tb.raw_rh;
    const tight_w = tb.rw * scaleX_geo;
    const tight_h = tb.rh * scaleY_geo;
    const tight_x = origT.x + (tb.rx + tb.fw/2) * scaleX_geo;
    const tightGeoNorth = origT.y + origT.h - (tb.ry + tb.fh/2) * scaleY_geo;
    const tight_y = tightGeoNorth - tight_h;
    return { x: tight_x, y: tight_y, w: tight_w, h: tight_h, rotation: t.rotation };
}

function buildTiles(Lf,type){
  if(type==='satellite') return {
    base: Lf.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      { attribution:'© Google', maxZoom:21, subdomains:['0','1','2','3'] }),
    label: null,
  };
  if(type==='hybrid') return {
    base: Lf.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
      { attribution:'© Google', maxZoom:21, subdomains:['0','1','2','3'] }),
    label: Lf.tileLayer('https://mt{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}',
      { attribution:'© Google', maxZoom:21, subdomains:['0','1','2','3'], opacity:0.9 }),
  };
  return {
    base: Lf.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution:'© OpenStreetMap contributors', maxZoom:19 }),
    label: null,
  };
}

export default function LeafletMapView({
  boundaries, regions,
  activeRegionId, setActiveRegionId,
  hiddenIds,
  tool, setTool,
  crops, setCropForRegion, clearCropForRegion,
  savingId, savedId, onSave,
  // optional: called whenever rotation changes so parent can read it for save
  onLocalStateChange,
}) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const LRef         = useRef(null);
  const tileRef      = useRef(null);
  const labelRef     = useRef(null);
  const bLayersRef   = useRef({});    // boundaryId → Lf.geoJSON layer
  const rLayersRef   = useRef({});    // regionId   → { imageOverlay, outlineRect }
  const handleGrpRef = useRef(null);  // { svgG, _cleanup }
  const localRef     = useRef({});    // regionId   → { x,y,w,h,rotation }
  const readyRef     = useRef(false);
  // Set to true for one tick when a region click fires, so the map click doesn't also deselect
  const regionClickedRef = useRef(false);

  // crop drawing state — using a ref + direct DOM for the live drag rect to avoid re-renders
  const cropDragRef   = useRef(null);
  const cropDraftRef  = useRef(null);  // points to the draft <div> DOM node
  const fitDraftRef   = useRef(null);  // stores {x,y,w,h,rotation} for origT during FIT_BOUNDARY

  // polygon crop — all mutable state stored in refs to avoid re-renders during drawing
  const polyPtsRef   = useRef([]);    // {sx,sy}[] — client coords of placed points
  const cursorPtRef  = useRef(null);  // {sx,sy}   — current mouse position
  const clickTimerRef = useRef(null);
  // A single integer counter drives the "Done (N pts)" button re-render without touching draw()
  const [polyCount, setPolyCount] = useState(0);

  const [mapType, setMapType] = useState('satellite');
  const [, tick] = useState(0);

  // refs that stay in sync with state for use inside closures
  const toolRef       = useRef(tool);   toolRef.current = tool;
  const activeIdRef   = useRef(activeRegionId); activeIdRef.current = activeRegionId;
  const cropsRef      = useRef(crops);   cropsRef.current = crops;
  const prevToolRef   = useRef(TOOL.SELECT);

  // Expose localRef to parent (for reading rotation on save)
  useEffect(() => {
    if (onLocalStateChange) onLocalStateChange(localRef);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Inject Leaflet CSS ────────────────────────────────────────────────────
  useEffect(() => {
    const id = 'leaflet-css';
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id; link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
  }, []);

  // ── Space = temp PAN ─────────────────────────────────────────────────────
  useEffect(() => {
    const dn = (e) => {
      if (e.code!=='Space'||e.repeat) return;
      if (['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
      e.preventDefault();
      if (toolRef.current!==TOOL.PAN) prevToolRef.current=toolRef.current;
      setTool(TOOL.PAN);
    };
    const up = (e) => { if (e.code==='Space') setTool(prevToolRef.current); };
    window.addEventListener('keydown',dn);
    window.addEventListener('keyup',up);
    return ()=>{ window.removeEventListener('keydown',dn); window.removeEventListener('keyup',up); };
  }, [setTool]);

  // ── Keyboard: Enter/Esc/Delete/Ctrl+S/Ctrl+0 ────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const t = toolRef.current;
      const id = activeIdRef.current;
      // Enter → finish polygon
      if (e.key==='Enter' && t===TOOL.CROP_POLY) {
        e.preventDefault();
        if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current=null; }
        finishPolyRef.current(polyPtsRef.current);
      }
      // Esc → cancel poly / crop draft
      if (e.key==='Escape') {
        polyPtsRef.current = [];
        cursorPtRef.current = null;
        setPolyCount(0);
        if (cropDraftRef.current) cropDraftRef.current.style.display = 'none';
        cancelFit();
        requestAnimationFrame(() => handleGrpRef.current?._redraw?.());
      }
      // Delete/Backspace → clear crop for active region
      if ((e.key==='Delete'||e.key==='Backspace') && id!==null && !['INPUT','TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        clearCropForRegion(id);
      }
      // Ctrl+S → save
      if (e.key==='s' && (e.ctrlKey||e.metaKey) && id!==null) {
        e.preventDefault();
        onSave?.();
      }
      // Ctrl+0 → fit view
      if (e.key==='0' && (e.ctrlKey||e.metaKey)) {
        e.preventDefault();
        const lb = allBounds(LRef.current, boundaries);
        if (lb && mapRef.current) mapRef.current.fitBounds(lb.pad(0.25), { maxZoom:17, animate:true });
      }
    };

    // Toolbar zoom button events
    const onZoom = (e) => {
      if (!mapRef.current) return;
      if (e.detail==='in')  mapRef.current.zoomIn();
      if (e.detail==='out') mapRef.current.zoomOut();
    };
    // Toolbar fit / reset events
    const onFit = () => {
      const lb = allBounds(LRef.current, boundaries);
      if (lb && mapRef.current) mapRef.current.fitBounds(lb.pad(0.25), { maxZoom:17, animate:true });
    };
    const onReset = () => {
      if (mapRef.current) mapRef.current.setView([20.5937, 78.9629], 5, { animate:true });
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mv-zoom', onZoom);
    window.addEventListener('mv-fit',  onFit);
    window.addEventListener('mv-reset', onReset);
    return ()=>{
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mv-zoom', onZoom);
      window.removeEventListener('mv-fit',  onFit);
      window.removeEventListener('mv-reset', onReset);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearCropForRegion, onSave, boundaries]);

  // Keep a stable ref to finishPoly so keyboard handler can call it
  const finishPolyRef = useRef(null);

  // ── Clear poly/crop draft when switching tools ────────────────────────────
  useEffect(() => {
    toolRef.current = tool;
    if (tool !== TOOL.CROP_POLY) {
      polyPtsRef.current = [];
      cursorPtRef.current = null;
      setPolyCount(0);
      if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
    }
    if (tool !== TOOL.CROP_RECT) {
      if (cropDraftRef.current) cropDraftRef.current.style.display = 'none';
    }
    // Schedule redraw after React commit — avoids calling DOM mutation during render
    const id = requestAnimationFrame(() => handleGrpRef.current?._redraw?.());
    return () => cancelAnimationFrame(id);
  }, [tool]);

  // ── finishPoly ────────────────────────────────────────────────────────────
  const finishPoly = useCallback((pts) => {
    if (!pts || pts.length < 3) return;
    const id = activeIdRef.current;
    if (id === null) return;
    const map = mapRef.current; if (!map) return;
    const t = localRef.current[id]; if (!t) return;
    const rect = map.getContainer().getBoundingClientRect();
    const localPts = pts.map(({ ll, sx, sy }) => {
      const pLl = ll || map.containerPointToLatLng([sx - rect.left, sy - rect.top]);
      // In geo, t.x is West (left), t.y + t.h is North (top)
      const xOffset = pLl.lng - t.x;
      const yOffset = (t.y + t.h) - pLl.lat;
      return { x: xOffset, y: yOffset };
    });
    setCropForRegion(id, { type: 'poly', points: localPts });
    // Clear drawing state
    polyPtsRef.current = [];
    cursorPtRef.current = null;
    setPolyCount(0);
    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
  }, [setCropForRegion]);

  // Keep finishPolyRef current
  finishPolyRef.current = finishPoly;

  // ── Init Leaflet ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;
    if (containerRef.current?._leaflet_id) containerRef.current._leaflet_id=null;
    import('leaflet').then(mod => {
      if (!containerRef.current||mapRef.current) return;
      const Lf=mod.default; LRef.current=Lf;
      delete Lf.Icon.Default.prototype._getIconUrl;
      Lf.Icon.Default.mergeOptions({
        iconRetinaUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      const map=Lf.map(containerRef.current,{ center:[20.5937,78.9629], zoom:5, zoomControl:false });
      Lf.control.zoom({ position:'bottomright' }).addTo(map);
      const {base,label}=buildTiles(Lf,'satellite');
      tileRef.current=base.addTo(map);
      if(label) labelRef.current=label.addTo(map);
      mapRef.current=map;
      // Map click → deselect, but ONLY if the click didn't originate on a region.
      // We use a flag set by the region click handler to suppress this.
      map.on('click', (e) => {
        if (toolRef.current !== TOOL.SELECT) return;
        if (regionClickedRef.current) { regionClickedRef.current = false; return; }
        setActiveRegionId(null);
      });
      readyRef.current=true;
      tick(n=>n+1);
    });
    return ()=>{
      readyRef.current=false;
      if(mapRef.current){mapRef.current.remove();mapRef.current=null;}
      if(containerRef.current) delete containerRef.current._leaflet_id;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // ── Swap tile layers ──────────────────────────────────────────────────────
  useEffect(()=>{
    const map=mapRef.current,Lf=LRef.current;
    if(!map||!Lf) return;
    if(tileRef.current) map.removeLayer(tileRef.current);
    if(labelRef.current){map.removeLayer(labelRef.current);labelRef.current=null;}
    const {base,label}=buildTiles(Lf,mapType);
    tileRef.current=base.addTo(map);
    if(label) labelRef.current=label.addTo(map);
  },[mapType]);

  // ── Enable/disable map drag ────────────────────────────────────────────────
  useEffect(()=>{
    const map=mapRef.current; if(!map) return;
    if(tool===TOOL.PAN) map.dragging.enable();
    else map.dragging.disable();
  },[tool]);

  // ── Draw boundary polygons ─────────────────────────────────────────────────
  useEffect(()=>{
    const map=mapRef.current,Lf=LRef.current;
    if(!map||!Lf||!readyRef.current) return;
    Object.values(bLayersRef.current).forEach(l=>{try{map.removeLayer(l);}catch{}});
    bLayersRef.current={};
    if(boundaries.length===0) return;
    boundaries.forEach(b=>{
      if(!b.geometry) return;
      try {
        const layer=Lf.geoJSON(b.geometry,{
          style:{color:b.color??'#3b82f6',weight:2.5,fillOpacity:0.08,fillColor:b.color??'#3b82f6'},
          interactive:false,
        }).addTo(map);
        bLayersRef.current[b.id]=layer;
      } catch(err){console.error('[MapView] boundary',b.id,err.message);}
    });
    const lb=allBounds(Lf,boundaries);
    if(lb) map.fitBounds(lb.pad(0.25),{maxZoom:17,animate:true,duration:0.8});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[boundaries,readyRef.current]);

  // ── Draw region image overlays ─────────────────────────────────────────────
  // NOTE: activeRegionId is intentionally NOT in the dep array — selection
  // changes are handled by the separate outline-style-sync effect below.
  useEffect(()=>{
    const map=mapRef.current,Lf=LRef.current;
    if(!map||!Lf||!readyRef.current||boundaries.length===0) return;

    // Remove overlays for deleted/hidden regions
    Object.keys(rLayersRef.current).forEach(sid=>{
      const id=Number(sid);
      if(!regions.find(r=>r.id===id)||hiddenIds.has(id)){
        const l=rLayersRef.current[sid];
        try{map.removeLayer(l.imageOverlay);}catch{}
        try{map.removeLayer(l.outlineRect);}catch{}
        delete rLayersRef.current[sid];
        delete localRef.current[id];
      }
    });

    const boundary=boundaries[0];
    regions.forEach(r=>{
      if(hiddenIds.has(r.id)) return;
      const fit=geoFitRegion(r,boundary);
      if(!fit) return;
      if(!localRef.current[r.id]) {
        localRef.current[r.id]={ x:fit.x, y:fit.y, w:fit.w, h:fit.h, rotation:r.rotation??0 };
      }
      if(rLayersRef.current[r.id]) return; // already created; click handler uses activeIdRef
      try {
        const lt=localRef.current[r.id];
        const bds=[[lt.y,lt.x],[lt.y+lt.h,lt.x+lt.w]];
        
        // Calculate un-cropped original image bounds to prevent squishing
        const fw = r.architectureFile?.imageWidth || 1000;
        const fh = r.architectureFile?.imageHeight || 1000;
        const rw = r.width || fw;
        const rh = r.height || fh;
        const scaleX_geo = lt.w / rw;
        const scaleY_geo = lt.h / rh;
        
        const originalGeoWest = lt.x - ((r.x ?? (-fw/2)) + fw/2) * scaleX_geo;
        const originalGeoEast = originalGeoWest + (fw * scaleX_geo);
        const originalGeoNorth = (lt.y + lt.h) + ((r.y ?? (-fh/2)) + fh/2) * scaleY_geo;
        const originalGeoSouth = originalGeoNorth - (fh * scaleY_geo);
        const imgBds = [[originalGeoSouth, originalGeoWest], [originalGeoNorth, originalGeoEast]];

        const imgUrl=getPreviewUrl(r.architectureFileId);
        
        const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svgElement.setAttribute('overflow', 'visible');
        svgElement.style.overflow = 'visible';
        const imgElement = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        imgElement.setAttribute('href', imgUrl);
        imgElement.setAttribute('width', '100%');
        imgElement.setAttribute('height', '100%');
        imgElement.setAttribute('preserveAspectRatio', 'none');
        svgElement.appendChild(imgElement);

        const imageOverlay=Lf.svgOverlay(svgElement,imgBds,{
          opacity:1,interactive:true,className:`mv-region mv-region-${r.id}`,
        }).addTo(map);
        const outlineRect=Lf.rectangle(bds,{
          color:fit.color,weight:0,fillOpacity:0,dashArray:'6 4',interactive:false,
        }).addTo(map);
        imageOverlay.on('click',e=>{
          e.originalEvent?.stopPropagation();
          if(toolRef.current===TOOL.SELECT){
            regionClickedRef.current=true; // suppress map click deselect
            setActiveRegionId(r.id===activeIdRef.current ? null : r.id);
          }
        });
        rLayersRef.current[r.id]={imageOverlay,outlineRect,fitColor:fit.color};
      } catch(err){console.error('[MapView] region',r.id,err.message);}
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[regions,boundaries,hiddenIds,readyRef.current]);

  // ── Sync outline style when selection changes ──────────────────────────────
  useEffect(()=>{
    if(tool !== TOOL.FIT_BOUNDARY && fitDraftRef.current) {
        fitDraftRef.current = null;
    }

    Object.keys(rLayersRef.current).forEach(sid=>{
      const id=Number(sid);
      const l=rLayersRef.current[sid]; if(!l) return;
      const isActive=id===activeRegionId;
      const r = regions.find(rg => rg.id === id);
      const crop = crops[id];
      const t = localRef.current[id];
      
      const isPolyShape = r?.shapeType === 'POLYGON' || crop?.type === 'poly';
      const isPolyTool = tool === TOOL.CROP_POLY && isActive;
      
      l.outlineRect.setStyle({
        color:isActive?'#10b981':(l.fitColor??'#3b82f6'),
        weight:(isActive && !isPolyShape && !isPolyTool) ? 2.5 : 0,
        dashArray:isActive?'':'6 4',
        fillOpacity:0,
      });

      // Apply clip-path to imageOverlay when INACTIVE to visually "cut" the extra part
      let clipPathStr = 'none';
      
      if (r && t) {
        const tb = getTightBounds(r);
        let origT = computeOrigT(t, tb);
        if (toolRef.current === TOOL.FIT_BOUNDARY && fitDraftRef.current) {
            origT = fitDraftRef.current;
        }
        const origT_x = origT.x;
        const origT_y = origT.y;
        const origT_w = origT.w;
        const origT_h = origT.h;
         
        if (isActive && (tool === TOOL.CROP_POLY || tool === TOOL.CROP_RECT)) {
           clipPathStr = 'none';
        } else {
           const dx = t.x - origT_x;
           const dy = (origT_y + origT_h) - (t.y + t.h);

           if (crop?.type === 'poly' && crop.points) {
              const pts = crop.points.map(p => {
                 const px = (dx + p.x) / origT_w * 100;
                 const py = (dy + p.y) / origT_h * 100;
                 return `${px.toFixed(2)}% ${py.toFixed(2)}%`;
              }).join(', ');
              clipPathStr = `polygon(${pts})`;
           } else if (crop?.type === 'rect') {
              const px1 = (dx + crop.cx) / origT_w * 100;
              const px2 = (dx + crop.cx + crop.cw) / origT_w * 100;
              const py1 = (dy + crop.cy) / origT_h * 100;
              const py2 = (dy + crop.cy + crop.ch) / origT_h * 100;
              clipPathStr = `polygon(${px1.toFixed(2)}% ${py1.toFixed(2)}%, ${px2.toFixed(2)}% ${py1.toFixed(2)}%, ${px2.toFixed(2)}% ${py2.toFixed(2)}%, ${px1.toFixed(2)}% ${py2.toFixed(2)}%)`;
           } else if (!crop && r.shapeType === 'POLYGON' && Array.isArray(r.points)) {
              const pts = r.points.map(p => {
                 const px = (p.x + tb.fw/2) / tb.fw * 100;
                 const py = (p.y + tb.fh/2) / tb.fh * 100;
                 return `${px.toFixed(2)}% ${py.toFixed(2)}%`;
              }).join(', ');
              clipPathStr = `polygon(${pts})`;
           } else if (!crop) {
              const px1 = dx / origT_w * 100;
              const px2 = (dx + t.w) / origT_w * 100;
              const py1 = dy / origT_h * 100;
              const py2 = (dy + t.h) / origT_h * 100;
              clipPathStr = `polygon(${px1.toFixed(2)}% ${py1.toFixed(2)}%, ${px2.toFixed(2)}% ${py1.toFixed(2)}%, ${px2.toFixed(2)}% ${py2.toFixed(2)}%, ${px1.toFixed(2)}% ${py2.toFixed(2)}%)`;
           }
        }
        
        if (l.imageOverlay.getElement()) {
          const imgEl = l.imageOverlay.getElement().querySelector('image');
          if (imgEl) {
            imgEl.style.clipPath = clipPathStr;
            
            // Also apply rotation and transform-origin on load/sync
            const boxT = computeTightT(t, tb, origT);
            const t_center_x = boxT.x + boxT.w / 2;
            const t_center_y = boxT.y + boxT.h / 2;
            const originX_pct = (t_center_x - origT_x) / origT_w * 100;
            const originY_pct = ((origT_y + origT_h) - t_center_y) / origT_h * 100;
            
            imgEl.style.transformOrigin = `${originX_pct}% ${originY_pct}%`;
            imgEl.style.rotate = `${t.rotation || 0}deg`;
          }
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[activeRegionId, regions, crops, tool]);

  // helper: update Leaflet overlay position from localRef
  const syncOverlay = useCallback((id) => {
    const t=localRef.current[id]; if(!t) return;
    const l=rLayersRef.current[id]; if(!l) return;
    const r = regions.find(rg => rg.id === id); if(!r) return;
    
    const tb = getTightBounds(r);
    let origT = computeOrigT(t, tb);
    if (toolRef.current === TOOL.FIT_BOUNDARY && fitDraftRef.current) {
        origT = fitDraftRef.current;
    }
    const origT_x = origT.x;
    const origT_w = origT.w;
    const origT_h = origT.h;
    const origT_y = origT.y;

    const imgBds = [[origT_y, origT_x], [origT_y + origT_h, origT_x + origT_w]];
    const bds = [[t.y, t.x], [t.y + t.h, t.x + t.w]];
    
    l.imageOverlay.setBounds(imgBds);
    if (l.imageOverlay.getElement()) {
       const imgEl = l.imageOverlay.getElement().querySelector('image');
       if (imgEl) {
           const boxT = computeTightT(t, tb, origT);
           const t_center_x = boxT.x + boxT.w / 2;
           const t_center_y = boxT.y + boxT.h / 2;
           const originX_pct = (t_center_x - origT_x) / origT_w * 100;
           const originY_pct = ((origT_y + origT_h) - t_center_y) / origT_h * 100;
    
           imgEl.style.transformOrigin = `${originX_pct}% ${originY_pct}%`;
           imgEl.style.rotate = `${t.rotation || 0}deg`;
       }
    }

    l.outlineRect.setBounds(bds);
    if (l.outlineRect.getElement()) {
       l.outlineRect.getElement().style.transformOrigin = `center`;
       l.outlineRect.getElement().style.transformBox = `fill-box`;
       l.outlineRect.getElement().style.rotate = `${t.rotation || 0}deg`;
    }
  }, [regions]);

  // ── SVG handle layer ──────────────────────────────────────────────────────
  // Rebuilds the SVG group in Leaflet's overlayPane whenever the active region
  // or crop/poly state changes.
  useEffect(()=>{
    const map=mapRef.current,Lf=LRef.current;
    if(!map||!Lf||!readyRef.current) return;
    // Cleanup previous group
    if(handleGrpRef.current){handleGrpRef.current._cleanup?.();handleGrpRef.current=null;}
    if(!activeRegionId) return;
    if(!regions.find(r=>r.id===activeRegionId)||hiddenIds.has(activeRegionId)||boundaries.length===0) return;

    const NS='http://www.w3.org/2000/svg';
    let savedMapDrag=false;
    const lock=()=>{savedMapDrag=map.dragging.enabled();map.dragging.disable();};
    const unlock=()=>{if(savedMapDrag)map.dragging.enable();};

    // Coordinate helpers
    function getT(){return localRef.current[activeRegionId]??{x:0,y:0,w:0.01,h:0.01,rotation:0};}
    // geo → layer pixel point
    function lp(lat,lng){return map.latLngToLayerPoint([lat,lng]);}
    // client XY → geo LatLng
    function cll(cx,cy){
      const r=map.getContainer().getBoundingClientRect();
      return map.containerPointToLatLng([cx-r.left,cy-r.top]);
    }

    const fid=requestAnimationFrame(()=>{
      const pane=map.getPanes().overlayPane; if(!pane) return;
      // Ensure there is an SVG in the overlay pane
      let svgEl=pane.querySelector('svg:not(.mv-region)');
      if(!svgEl){
        const tmp=Lf.rectangle([[0,0],[0.0001,0.0001]],{opacity:0,fillOpacity:0}).addTo(map);
        requestAnimationFrame(()=>{try{map.removeLayer(tmp);}catch{}});
        svgEl=pane.querySelector('svg:not(.mv-region)');
        if(!svgEl) return;
      }
      svgEl.style.pointerEvents='none';
      svgEl.style.zIndex='9999';

      // ── main group (handles + static decorations) ────────────────────
      const g=document.createElementNS(NS,'g');
      g.setAttribute('class','mv-handles');
      g.style.pointerEvents='none';
      svgEl.appendChild(g);


      const polyG=document.createElementNS(NS,'g');
      polyG.style.pointerEvents='none';
      svgEl.appendChild(polyG);

      function mk(tag,attrs){
        const e=document.createElementNS(NS,tag);
        Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));
        return e;
      }
      function mkI(tag,attrs){
        return mk(tag,{...attrs,'pointer-events':'all'});
      }

      // ── drawPoly: redraws only the in-progress polygon preview ───────
      // Called on mousemove/click — never touches g (handles group)
      function drawPoly(){
        while(polyG.firstChild) polyG.removeChild(polyG.firstChild);
        const pts=polyPtsRef.current;
        const cursor=cursorPtRef.current;
        if(pts.length===0 && !cursor) return;
        
        const mapRect = map.getContainer().getBoundingClientRect();
        const lPts = pts.map(p => {
          if (p.ll) return map.latLngToLayerPoint(p.ll);
          const ll = map.containerPointToLatLng([p.sx - mapRect.left, p.sy - mapRect.top]);
          return map.latLngToLayerPoint(ll);
        });

        let cPt = null;
        if(cursor){
           const ll = map.containerPointToLatLng([cursor.sx - mapRect.left, cursor.sy - mapRect.top]);
           cPt = map.latLngToLayerPoint(ll);
        }

        if(pts.length>=3) polyG.appendChild(mk('polygon',{
          points:lPts.map(p=>`${p.x},${p.y}`).join(' '),
          fill:'rgba(245,158,11,0.10)',stroke:'#f59e0b','stroke-width':'1.5','stroke-dasharray':'4 3','pointer-events':'none',
        }));
        else if(pts.length>=2) polyG.appendChild(mk('polyline',{
          points:lPts.map(p=>`${p.x},${p.y}`).join(' '),
          fill:'none',stroke:'#f59e0b','stroke-width':'1.5','stroke-dasharray':'4 3','pointer-events':'none',
        }));
        if(cPt && pts.length>0){
          const last=lPts[lPts.length-1];
          polyG.appendChild(mk('line',{
            x1:last.x, y1:last.y,
            x2:cPt.x, y2:cPt.y,
            stroke:'#f59e0b','stroke-width':'1','stroke-dasharray':'3 2','pointer-events':'none',
          }));
        }
        lPts.forEach(p=>polyG.appendChild(mk('circle',{
          cx:p.x, cy:p.y,
          r:4,fill:'#f59e0b',stroke:'#fff','stroke-width':'1.5','pointer-events':'none',
        })));
      }

      // ── draw ─────────────────────────────────────────────────────────────
      function draw(){
        while(g.firstChild) g.removeChild(g.firstChild);
        const t=getT();
        const r = regions.find(rg => rg.id === activeRegionId);
        
        let tb = { isTight: false, fw: 1000, fh: 1000, raw_rw: 1000, raw_rh: 1000, raw_rx: -500, raw_ry: -500, rw: 1000, rh: 1000, rx: -500, ry: -500 };
        let origT = { ...t };
        if (r) {
          tb = getTightBounds(r);
          origT = computeOrigT(t, tb);

          if (r.shapeType==='POLYGON' && Array.isArray(r.points)) {
            // Draw the polygon outline
            const fitColor = rLayersRef.current[activeRegionId]?.fitColor || '#3b82f6';
            const pts = r.points.map(p => {
              const geoX = origT.x + (p.x + tb.fw/2) * (origT.w / tb.fw);
              const geoY = (origT.y + origT.h) - (p.y + tb.fh/2) * (origT.h / tb.fh);
              return lp(geoY, geoX);
            });
            g.appendChild(mk('polygon',{
              points:pts.map(p=>`${p.x},${p.y}`).join(' '),
              fill:'none',stroke:fitColor,'stroke-width':'1.5','stroke-dasharray':'4 3',
            }));
          }
        }

        let boxT = computeTightT(t, tb, origT);

        function computeTFromOrig(newOrigT) {
           const newScaleX = newOrigT.w / tb.fw;
           const newScaleY = newOrigT.h / tb.fh;
           
           const new_t_x = newOrigT.x + (tb.raw_rx + tb.fw/2) * newScaleX;
           const new_t_w = tb.raw_rw * newScaleX;
           
           const newOrigNorth = newOrigT.y + newOrigT.h;
           const new_t_North = newOrigNorth - (tb.raw_ry + tb.fh/2) * newScaleY;
           const new_t_h = tb.raw_rh * newScaleY;
           const new_t_y = new_t_North - new_t_h;
           
           return { x: new_t_x, y: new_t_y, w: new_t_w, h: new_t_h, rotation: newOrigT.rotation };
        }



        const nw=lp(boxT.y+boxT.h, boxT.x);
        const ne=lp(boxT.y+boxT.h, boxT.x+boxT.w);
        const se=lp(boxT.y,         boxT.x+boxT.w);
        const sw=lp(boxT.y,         boxT.x);
        const midTopX=(nw.x+ne.x)/2, midTopY=(nw.y+ne.y)/2;
        // Edge midpoints for N/S/E/W handles
        const mN={x:midTopX,                        y:midTopY};
        const mS={x:(sw.x+se.x)/2,                  y:(sw.y+se.y)/2};
        const mE={x:(ne.x+se.x)/2,                  y:(ne.y+se.y)/2};
        const mW={x:(nw.x+sw.x)/2,                  y:(nw.y+sw.y)/2};
        // Rotate handle above top edge
        const rotX=midTopX, rotY=midTopY-ROTATE_OFF;

        // Apply rotation to the SVG group so handles rotate visually
        const centerPx = lp(boxT.y + boxT.h/2, boxT.x + boxT.w/2);
        g.setAttribute('transform', `rotate(${t.rotation || 0}, ${centerPx.x}, ${centerPx.y})`);

        const isCrop=toolRef.current===TOOL.CROP_RECT||toolRef.current===TOOL.CROP_POLY;
        const outlineColor=isCrop?'#f59e0b':'#10b981';

        // ── Region outline ───────────────────────────────────────────────
        if (toolRef.current !== TOOL.CROP_POLY) {
          g.appendChild(mk('polygon',{
            points:`${nw.x},${nw.y} ${ne.x},${ne.y} ${se.x},${se.y} ${sw.x},${sw.y}`,
            fill:'none',stroke:outlineColor,'stroke-width':'2',
            'stroke-dasharray':'6 4','pointer-events':'none',
          }));
        }

        if(!isCrop){
          // ── Rotate handle ──────────────────────────────────────────────
          g.appendChild(mk('line',{
            x1:midTopX,y1:midTopY,x2:rotX,y2:rotY,
            stroke:'#6366f1','stroke-width':'1.5','stroke-dasharray':'3 2','pointer-events':'none',
          }));
          const rh=mkI('circle',{cx:rotX,cy:rotY,r:HANDLE_R,fill:'#6366f1',stroke:'#fff','stroke-width':'2',cursor:'crosshair','pointer-events':'all'});
          rh.addEventListener('mousedown',e=>{
            e.stopPropagation();
            e.preventDefault();
            lock();
            const snap={...boxT};
            const centerLat=snap.y+snap.h/2, centerLng=snap.x+snap.w/2;
            const startA=Math.atan2(e.clientY-(lp(centerLat,centerLng).y+map.getPanes().overlayPane.getBoundingClientRect().top),
                                    e.clientX-(lp(centerLat,centerLng).x+map.getPanes().overlayPane.getBoundingClientRect().left));
            const startRot=snap.rotation??0;
            const onMove=ev=>{
              const paneRect=map.getPanes().overlayPane.getBoundingClientRect();
              const cp=lp(centerLat,centerLng);
              const a=Math.atan2(ev.clientY-(cp.y+paneRect.top), ev.clientX-(cp.x+paneRect.left));
              localRef.current[activeRegionId]={...localRef.current[activeRegionId],rotation:startRot+(a-startA)*180/Math.PI};
              syncOverlay(activeRegionId);
              draw();
            };
            const onUp=()=>{window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);unlock();};
            window.addEventListener('mousemove',onMove);
            window.addEventListener('mouseup',onUp);
          });
          g.appendChild(rh);

          // ── 8-direction resize handles ────────────────────────────────
          // corner: nw,ne,se,sw  edge: n,s,e,w
          const handles=[
            { id:'nw', px:nw, cursor:'nwse-resize' },
            { id:'ne', px:ne, cursor:'nesw-resize' },
            { id:'se', px:se, cursor:'nwse-resize' },
            { id:'sw', px:sw, cursor:'nesw-resize' },
            { id:'n',  px:mN, cursor:'ns-resize' },
            { id:'s',  px:mS, cursor:'ns-resize' },
            { id:'e',  px:mE, cursor:'ew-resize' },
            { id:'w',  px:mW, cursor:'ew-resize' },
          ];
          handles.forEach(({id:c,px:hp,cursor})=>{
            const hr=HANDLE_R;
            const hEl=mkI('rect',{
              x:hp.x-hr,y:hp.y-hr,width:hr*2,height:hr*2,
              fill:'#0a0a0a',stroke:'#10b981','stroke-width':'2',rx:'2',cursor,'pointer-events':'all'
            });
            hEl.addEventListener('mousedown',ev=>{
              ev.stopPropagation();
              ev.preventDefault();
              lock();
              const snap={...boxT};
              const sLL=cll(ev.clientX,ev.clientY);
              const onMove=mv=>{
                const rad = -(boxT.rotation || 0) * Math.PI / 180;
                const dx = mv.clientX - ev.clientX;
                const dy = mv.clientY - ev.clientY;
                const local_dx = dx * Math.cos(rad) - dy * Math.sin(rad);
                const local_dy = dx * Math.sin(rad) + dy * Math.cos(rad);
                
                const centerLL = cll(ev.clientX, ev.clientY);
                const movedLL = cll(ev.clientX + local_dx, ev.clientY + local_dy);
                
                const dLng = movedLL.lng - centerLL.lng;
                const dLat = movedLL.lat - centerLL.lat;
                
                const t2={...snap};
                if(c==='ne'){
                  t2.w=Math.max(MIN_GEO,snap.w+dLng);
                  t2.h=Math.max(MIN_GEO,snap.h+dLat);
                }
                else if(c==='nw'){
                  t2.x=snap.x+dLng; t2.w=Math.max(MIN_GEO,snap.w-dLng);
                  t2.h=Math.max(MIN_GEO,snap.h+dLat);
                }
                else if(c==='se'){
                  t2.y=snap.y+dLat; t2.h=Math.max(MIN_GEO,snap.h-dLat);
                  t2.w=Math.max(MIN_GEO,snap.w+dLng);
                }
                else if(c==='sw'){
                  t2.x=snap.x+dLng; t2.w=Math.max(MIN_GEO,snap.w-dLng);
                  t2.y=snap.y+dLat; t2.h=Math.max(MIN_GEO,snap.h-dLat);
                }
                else if(c==='n'){ t2.h=Math.max(MIN_GEO,snap.h+dLat); }
                else if(c==='s'){ t2.y=snap.y+dLat; t2.h=Math.max(MIN_GEO,snap.h-dLat); }
                else if(c==='e'){ t2.w=Math.max(MIN_GEO,snap.w+dLng); }
                else if(c==='w'){ t2.x=snap.x+dLng; t2.w=Math.max(MIN_GEO,snap.w-dLng); }
                
                if (toolRef.current === TOOL.FIT_BOUNDARY) {
                  fitDraftRef.current = convertTightToRawT(t2, tb);
                } else if (r && r.shapeType === 'POLYGON') {
                  localRef.current[activeRegionId]=convertTightToRawT(t2, tb);
                } else {
                  localRef.current[activeRegionId]=computeTFromOrig(t2);
                }
                syncOverlay(activeRegionId);
                draw();
              };
              const onUp=()=>{window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);unlock();};
              window.addEventListener('mousemove',onMove);
              window.addEventListener('mouseup',onUp);
            });
            g.appendChild(hEl);
          });

          // ── Centre drag (move) ────────────────────────────────────────
          const rXmin=Math.min(nw.x,ne.x,se.x,sw.x)+HANDLE_R*2+2;
          const rYmin=Math.min(nw.y,ne.y,se.y,sw.y)+HANDLE_R*2+2;
          const rXmax=Math.max(nw.x,ne.x,se.x,sw.x)-HANDLE_R*2-2;
          const rYmax=Math.max(nw.y,ne.y,se.y,sw.y)-HANDLE_R*2-2;
          if(rXmax>rXmin&&rYmax>rYmin){
            let isDragging=false;
            let startX=0,startY=0;
            const drag=mkI('rect',{x:rXmin,y:rYmin,width:rXmax-rXmin,height:rYmax-rYmin,fill:'transparent',cursor:'move','pointer-events':'all'});
            drag.addEventListener('mousedown',ev=>{
              if(toolRef.current!==TOOL.SELECT && toolRef.current!==TOOL.FIT_BOUNDARY) return;
              ev.stopPropagation(); ev.preventDefault();
              lock();
              isDragging=false;
              startX=ev.clientX; startY=ev.clientY;
              const snap={...boxT};
              const sLL=cll(ev.clientX,ev.clientY);
              const onMove=mv=>{
                if(!isDragging&&Math.hypot(mv.clientX-startX,mv.clientY-startY)>=DRAG_MIN) isDragging=true;
                if(!isDragging) return;
                const ll=cll(mv.clientX,mv.clientY);
                const t2 = {...snap, x:snap.x+(ll.lng-sLL.lng), y:snap.y+(ll.lat-sLL.lat)};
                
                if (toolRef.current === TOOL.FIT_BOUNDARY) {
                  fitDraftRef.current = convertTightToRawT(t2, tb);
                } else if (r && r.shapeType === 'POLYGON') {
                  localRef.current[activeRegionId]=convertTightToRawT(t2, tb);
                } else {
                  localRef.current[activeRegionId]=computeTFromOrig(t2);
                }
                syncOverlay(activeRegionId);
                draw();
              };
              const onUp=()=>{window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);unlock();};
              window.addEventListener('mousemove',onMove);
              window.addEventListener('mouseup',onUp);
            });
            g.appendChild(drag);
          }
        } // end !isCrop

        // ── CROP_RECT ─────────────────────────────────────────────────────
        if(toolRef.current===TOOL.CROP_RECT){
          const hitRect=mkI('rect',{
            x:Math.min(nw.x,se.x),y:Math.min(nw.y,se.y),
            width:Math.abs(se.x-nw.x),height:Math.abs(se.y-nw.y),
            fill:'transparent',cursor:'crosshair',
          });
          hitRect.addEventListener('mousedown',ev=>{
            ev.stopPropagation();
            const mapRect=mapRef.current.getContainer().getBoundingClientRect();
            const startX=ev.clientX,startY=ev.clientY;
            // Show draft rect and set initial position via direct DOM — no React re-render
            const setDraft = (x,y,w,h) => {
              const el = cropDraftRef.current;
              if (!el) return;
              el.style.left   = x+'px';
              el.style.top    = y+'px';
              el.style.width  = w+'px';
              el.style.height = h+'px';
              el.style.display = (w>2&&h>2) ? 'block' : 'none';
            };
            setDraft(startX-mapRect.left, startY-mapRect.top, 0, 0);
            cropDragRef.current={startX,startY};
            const onMove=mv=>{
              setDraft(
                Math.min(startX,mv.clientX)-mapRect.left,
                Math.min(startY,mv.clientY)-mapRect.top,
                Math.abs(mv.clientX-startX),
                Math.abs(mv.clientY-startY),
              );
            };
            const onUp=mv=>{
              window.removeEventListener('mousemove',onMove);
              window.removeEventListener('mouseup',onUp);
              cropDragRef.current=null;
              const el=cropDraftRef.current;
              if(el) el.style.display='none';
              const map2=mapRef.current; if(!map2) return;
              const t2=localRef.current[activeRegionId]; if(!t2) return;
              const r2=map2.getContainer().getBoundingClientRect();
              const ll1=map2.containerPointToLatLng([Math.min(startX,mv.clientX)-r2.left,Math.min(startY,mv.clientY)-r2.top]);
              const ll2=map2.containerPointToLatLng([Math.max(startX,mv.clientX)-r2.left,Math.max(startY,mv.clientY)-r2.top]);
              const minLat=Math.min(ll1.lat,ll2.lat), maxLat=Math.max(ll1.lat,ll2.lat);
              const minLng=Math.min(ll1.lng,ll2.lng), maxLng=Math.max(ll1.lng,ll2.lng);
              const cropX=Math.max(0,Math.min(t2.w,minLng-t2.x));
              const cropY=Math.max(0,Math.min(t2.h,minLat-t2.y));
              const cropW=Math.max(0,Math.min(t2.w-cropX,maxLng-minLng));
              const cropH=Math.max(0,Math.min(t2.h-cropY,maxLat-minLat));
              if(cropW>MIN_GEO&&cropH>MIN_GEO) setCropForRegion(activeRegionId,{type:'rect',cx:cropX,cy:cropY,cw:cropW,ch:cropH});
            };
            window.addEventListener('mousemove',onMove);
            window.addEventListener('mouseup',onUp);
          });
          g.appendChild(hitRect);

          // Draw committed crop rect + rule-of-thirds + resize handles
          const crop=cropsRef.current[activeRegionId];
          if(crop?.type==='rect'){
            // crop.cy = offset from region south edge (t.y), northward
            // crop.ch = height northward from crop's south edge
            // So: crop south lat = t.y + crop.cy
            //     crop north lat = t.y + crop.cy + crop.ch
            const cSwLat = t.y + crop.cy;
            const cNeLat = t.y + crop.cy + crop.ch;
            const cSwLng = t.x + crop.cx;
            const cNeLng = t.x + crop.cx + crop.cw;
            // lp maps (lat, lng) → layer pixel. Higher lat = smaller screen Y.
            const pSW = lp(cSwLat, cSwLng);
            const pNE = lp(cNeLat, cNeLng);
            const crx=Math.min(pSW.x,pNE.x), cry=Math.min(pSW.y,pNE.y);
            const crw=Math.abs(pNE.x-pSW.x),  crh=Math.abs(pNE.y-pSW.y);
            g.appendChild(mk('rect',{x:crx,y:cry,width:crw,height:crh,
              fill:'rgba(245,158,11,0.08)',stroke:'#f59e0b','stroke-width':'2','pointer-events':'none'}));
            // Rule of thirds
            [1/3,2/3].forEach(f=>{
              g.appendChild(mk('line',{x1:crx+crw*f,y1:cry,x2:crx+crw*f,y2:cry+crh,stroke:'#f59e0b','stroke-width':'0.5',opacity:'0.4','pointer-events':'none'}));
              g.appendChild(mk('line',{x1:crx,y1:cry+crh*f,x2:crx+crw,y2:cry+crh*f,stroke:'#f59e0b','stroke-width':'0.5',opacity:'0.4','pointer-events':'none'}));
            });
            // Crop rect corner handles (resizable)
            const cropCorners=[['nw',crx,cry],['ne',crx+crw,cry],['se',crx+crw,cry+crh],['sw',crx,cry+crh]];
            cropCorners.forEach(([cc,hx,hy])=>{
              const hr=HANDLE_R-1;
              const ch2=mkI('rect',{x:hx-hr,y:hy-hr,width:hr*2,height:hr*2,
                fill:'#0a0a0a',stroke:'#f59e0b','stroke-width':'2',rx:'2',cursor:'nwse-resize'});
              ch2.addEventListener('mousedown',ev=>{
                ev.stopPropagation();
                lock();
                const snapCrop={...crop};
                const sLL=cll(ev.clientX,ev.clientY);
                // Local draft so we don't trigger React re-renders every mousemove pixel
                let draftCrop={...snapCrop};
                const onMove=mv=>{
                  const ll=cll(mv.clientX,mv.clientY);
                  const dLng=ll.lng-sLL.lng, dLat=ll.lat-sLL.lat;
                  let {cx:ccx,cy:ccy,cw:ccw,ch:cch}=snapCrop;
                  if(cc==='ne'){
                    ccw=Math.max(MIN_GEO,snapCrop.cw+dLng);
                    cch=Math.max(MIN_GEO,snapCrop.ch+dLat);
                  }
                  else if(cc==='nw'){
                    ccx+=dLng; ccw=Math.max(MIN_GEO,snapCrop.cw-dLng);
                    cch=Math.max(MIN_GEO,snapCrop.ch+dLat);
                  }
                  else if(cc==='se'){
                    ccy+=dLat; cch=Math.max(MIN_GEO,snapCrop.ch-dLat);
                    ccw=Math.max(MIN_GEO,snapCrop.cw+dLng);
                  }
                  else if(cc==='sw'){
                    ccx+=dLng; ccw=Math.max(MIN_GEO,snapCrop.cw-dLng);
                    ccy+=dLat; cch=Math.max(MIN_GEO,snapCrop.ch-dLat);
                  }
                  ccx=Math.max(0,Math.min(ccx, t.w-MIN_GEO));
                  ccy=Math.max(0,Math.min(ccy, t.h-MIN_GEO));
                  ccw=Math.min(Math.max(MIN_GEO,ccw), t.w-ccx);
                  cch=Math.min(Math.max(MIN_GEO,cch), t.h-ccy);
                  draftCrop={type:'rect',cx:ccx,cy:ccy,cw:ccw,ch:cch};
                  // Update cropsRef live so draw() shows the new crop without React re-render
                  cropsRef.current={...cropsRef.current,[activeRegionId]:draftCrop};
                  draw();
                };
                const onUp=()=>{
                  window.removeEventListener('mousemove',onMove);
                  window.removeEventListener('mouseup',onUp);
                  unlock();
                  // Commit to React state only on mouse-up (one re-render per drag, not per pixel)
                  setCropForRegion(activeRegionId,draftCrop);
                };
                window.addEventListener('mousemove',onMove);
                window.addEventListener('mouseup',onUp);
              });
              g.appendChild(ch2);
            });
          }
        } // end CROP_RECT

        // ── CROP_POLY ─────────────────────────────────────────────────────
        if(toolRef.current===TOOL.CROP_POLY){
          // Removed committed polygon drawing because the image is now visually clipped

          // Hit area — stable, never rebuilt by drawPoly
          const hitRect=mkI('rect',{
            x:Math.min(nw.x,se.x),y:Math.min(nw.y,se.y),
            width:Math.abs(se.x-nw.x),height:Math.abs(se.y-nw.y),
            fill:'transparent',cursor:'crosshair',
          });
          hitRect.addEventListener('mousedown', ev => {
            if (ev.button === 0) ev.stopPropagation();
          });
          hitRect.addEventListener('mousemove',ev=>{
            cursorPtRef.current={sx:ev.clientX,sy:ev.clientY};
            drawPoly(); // only redraws polyG — no flicker
          });
          hitRect.addEventListener('mouseleave',()=>{
            cursorPtRef.current=null;
            drawPoly();
          });
          hitRect.addEventListener('click',ev=>{
            ev.stopPropagation();
            const px=ev.clientX,py=ev.clientY;
            const mapRect = map.getContainer().getBoundingClientRect();
            const ll = map.containerPointToLatLng([px - mapRect.left, py - mapRect.top]);
            const prev=polyPtsRef.current;
            if(prev.length>0){
              const last=prev[prev.length-1];
              const lastPx = last.ll ? map.latLngToContainerPoint(last.ll) : { x: last.sx - mapRect.left, y: last.sy - mapRect.top };
              if(Math.hypot(lastPx.x-(px-mapRect.left), lastPx.y-(py-mapRect.top))<4) return;
            }
            polyPtsRef.current=[...prev,{ ll, sx: px, sy: py }];
            setPolyCount(polyPtsRef.current.length);
            drawPoly();
          });
          hitRect.addEventListener('dblclick',ev=>{
            ev.stopPropagation();
            finishPolyRef.current(polyPtsRef.current);
          });
          g.appendChild(hitRect);
          // Draw initial poly state
          drawPoly();
        } // end CROP_POLY

      } // end draw()

      const onMapMove = () => { draw(); drawPoly(); };
      draw();
      map.on('move zoomend viewreset', onMapMove);
      handleGrpRef.current = {
        _cleanup: () => {
          map.off('move zoomend viewreset', onMapMove);
          if (g.parentNode) g.parentNode.removeChild(g);
          if (polyG.parentNode) polyG.parentNode.removeChild(polyG);
        },
        _redraw: () => { draw(); drawPoly(); },
      };
    }); // end requestAnimationFrame

    return()=>{
      cancelAnimationFrame(fid);
      handleGrpRef.current?._cleanup?.();
      handleGrpRef.current=null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[activeRegionId,regions,boundaries,hiddenIds,tool,crops,readyRef.current]);

  const applyFit = useCallback(() => {
     if (!fitDraftRef.current) return;
     const newOrigT = fitDraftRef.current;
     const r = regions.find(rg => rg.id === activeRegionId);
     if (!r) return;
     
     const tb = getTightBounds(r);
     const oldOrigT = computeOrigT(localRef.current[activeRegionId], tb);

     let newPoints = null;
     if (r.shapeType === 'POLYGON' && Array.isArray(r.points)) {
         newPoints = r.points.map(p => {
             const geoX = oldOrigT.x + (p.x + tb.fw/2) * (oldOrigT.w / tb.fw);
             const geoY = (oldOrigT.y + oldOrigT.h) - (p.y + tb.fh/2) * (oldOrigT.h / tb.fh);
             
             const newPx = (geoX - newOrigT.x) * (tb.fw / newOrigT.w) - tb.fw/2;
             const newPy = (newOrigT.y + newOrigT.h - geoY) * (tb.fh / newOrigT.h) - tb.fh/2;
             return { x: newPx, y: newPy };
         });
     }

     const newScaleX = newOrigT.w / tb.fw;
     const newScaleY = newOrigT.h / tb.fh;
     
     const new_t_x = newOrigT.x + (tb.raw_rx + tb.fw/2) * newScaleX;
     const new_t_w = tb.raw_rw * newScaleX;
     
     const newOrigNorth = newOrigT.y + newOrigT.h;
     const new_t_North = newOrigNorth - (tb.raw_ry + tb.fh/2) * newScaleY;
     const new_t_h = tb.raw_rh * newScaleY;
     const new_t_y = new_t_North - new_t_h;
     
     const new_t = { x: new_t_x, y: new_t_y, w: new_t_w, h: new_t_h, rotation: newOrigT.rotation };

     localRef.current[activeRegionId] = new_t;
     
     fitDraftRef.current = null;
     setTool(TOOL.SELECT);
     
     setTimeout(() => {
         onSave(activeRegionId, { bounds: new_t, points: newPoints || r.points });
     }, 10);
  }, [activeRegionId, regions, setTool, onSave]);

  const cancelFit = useCallback(() => {
     fitDraftRef.current = null;
     setTool(TOOL.SELECT);
  }, [setTool]);

  return (
    <div className={`relative w-full h-full ${(tool===TOOL.CROP_POLY||tool===TOOL.CROP_RECT) ? 'mv-cropping' : ''}`}>
      <style>{`
        .leaflet-container { background: #1a1a1a !important; font-family: inherit; user-select: none; -webkit-user-select: none; }
        .mv-region { cursor: pointer; transition: opacity 0.15s, clip-path 0.2s ease-in-out; }
        .mv-region:hover { opacity: 0.88 !important; }
        .leaflet-overlay-pane svg { pointer-events: none; }
        .mv-cropping .leaflet-interactive { cursor: crosshair !important; }
        .mv-cropping .mv-region { pointer-events: none !important; }
      `}</style>

      {/* Tile type switcher */}
      <div className="absolute top-3 right-3 z-[9000] flex gap-1 bg-zinc-950/95 backdrop-blur border border-zinc-700 rounded-lg p-1">
        {tool === TOOL.FIT_BOUNDARY && (
          <>
            <button onClick={applyFit}
              className="px-3 py-1.5 text-xs font-medium rounded transition-colors bg-sky-600 text-white hover:bg-sky-500 mr-2">
              ✓ Apply Fit
            </button>
            <button onClick={cancelFit}
              className="px-3 py-1.5 text-xs font-medium rounded transition-colors bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white mr-4">
              Cancel
            </button>
          </>
        )}

        {['satellite','street','hybrid'].map(t=>(
          <button key={t} onClick={()=>setMapType(t)}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors capitalize
              ${mapType===t?'bg-emerald-500 text-black':'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Screen-space crop draft rect — kept in DOM always, shown/hidden via direct style */}
      <div
        ref={cropDraftRef}
        className="absolute pointer-events-none z-[9500]"
        style={{
          display: 'none',
          border: '2px dashed #f59e0b',
          background: 'rgba(245,158,11,0.1)',
          left: 0, top: 0, width: 0, height: 0,
        }}
      />

      {/* Polygon crop hint */}
      {tool===TOOL.CROP_POLY && activeRegionId && polyCount===0 && !cropsRef.current[activeRegionId] && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[9000] pointer-events-none
                        bg-zinc-950/90 backdrop-blur border border-violet-700/60 rounded-lg px-3 py-1.5 text-[11px] text-violet-300">
          Click to place polygon points · Enter or double-click to finish · Esc to cancel
        </div>
      )}

      {/* Poly finish/cancel buttons */}
      {tool===TOOL.CROP_POLY && polyCount>=3 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[9000] flex gap-2">
          <button onClick={()=>finishPoly(polyPtsRef.current)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-900/80 border border-emerald-600 text-emerald-300 hover:bg-emerald-800 transition-colors backdrop-blur">
            ✓ Done ({polyCount} pts)
          </button>
          <button onClick={()=>{
            polyPtsRef.current=[];
            cursorPtRef.current=null;
            setPolyCount(0);
            handleGrpRef.current?._redraw?.();
          }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900/80 border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition-colors backdrop-blur">
            Cancel
          </button>
        </div>
      )}

      {/* Move/resize hint */}
      {tool===TOOL.SELECT && activeRegionId && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-[9000] pointer-events-none
                        bg-zinc-950/90 backdrop-blur border border-zinc-700 rounded-lg px-3 py-1.5 text-[11px] text-zinc-400">
          Drag to move · Handles to resize · Blue dot to rotate
        </div>
      )}

      {/* Empty state */}
      {regions.length===0 && boundaries.length>0 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[9000] bg-zinc-950/90 backdrop-blur
                        border border-zinc-700/60 rounded-xl px-5 py-3 text-center pointer-events-none">
          <p className="text-sm text-zinc-400">Boundary loaded · no regions yet</p>
          <p className="text-xs text-zinc-600 mt-0.5">Create architecture regions in the Viewer.</p>
        </div>
      )}

      {/* Leaflet map container */}
      <div ref={containerRef} className="w-full h-full"/>
    </div>
  );
}
