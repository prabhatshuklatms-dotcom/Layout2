'use client';

import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import DraggableRegionOverlay from './DraggableRegionOverlay';
import LocationSearch from './LocationSearch';

// ─── Tile builders — same as /map-view LeafletMapView ────────────────────────
function buildTiles(Lf, type) {
  if (type === 'satellite') return {
    base: Lf.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      attribution: '© Google', maxZoom: 21, subdomains: ['0', '1', '2', '3'],
    }),
    label: null,
  };
  if (type === 'hybrid') return {
    base: Lf.tileLayer('https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      attribution: '© Google', maxZoom: 21, subdomains: ['0', '1', '2', '3'],
    }),
    label: Lf.tileLayer('https://mt{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', {
      attribution: '© Google', maxZoom: 21, subdomains: ['0', '1', '2', '3'], opacity: 0.9,
    }),
  };
  // street
  return {
    base: Lf.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19,
    }),
    label: null,
  };
}

export default function AlignmentMap({
  alignments, boundaries, activeRegionId,
  setActiveRegionId, onSaveAlignment, onDeleteAlignment, onDropRegion,
}) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const tileRef      = useRef(null);
  const labelRef     = useRef(null);
  const bLayersRef   = useRef([]);

  const [mapType, setMapType] = useState('satellite');
  const [mapReady, setMapReady] = useState(false);

  // ── Init Leaflet map ────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;
    if (containerRef.current?._leaflet_id) containerRef.current._leaflet_id = null;

    // Inject Leaflet CSS once
    const cssId = 'leaflet-css';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId; link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Fix default icon paths
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl:        'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl:      'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const map = L.map(containerRef.current, {
      center: [20.5937, 78.9629],
      zoom: 5,
      zoomControl: true,
    });

    const { base, label } = buildTiles(L, 'satellite');
    tileRef.current = base.addTo(map);
    if (label) labelRef.current = label.addTo(map);

    // Drag-and-drop: drop architecture region onto map
    const container = map.getContainer();
    const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
    const handleDrop = (e) => {
      e.preventDefault();
      try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        if (data.type === 'ARCHITECTURE_REGION') {
          const rect = container.getBoundingClientRect();
          const latLng = map.containerPointToLatLng(
            L.point(e.clientX - rect.left, e.clientY - rect.top)
          );
          onDropRegion(data.region, latLng);
        }
      } catch (err) { console.error('Drop error', err); }
    };
    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('drop', handleDrop);

    mapRef.current = map;
    setMapReady(true);

    return () => {
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('drop', handleDrop);
      map.remove();
      mapRef.current = null;
      if (containerRef.current) delete containerRef.current._leaflet_id;
      setMapReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Swap tile layers when mapType changes ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileRef.current) { map.removeLayer(tileRef.current); tileRef.current = null; }
    if (labelRef.current) { map.removeLayer(labelRef.current); labelRef.current = null; }
    const { base, label } = buildTiles(L, mapType);
    tileRef.current = base.addTo(map);
    if (label) labelRef.current = label.addTo(map);
  }, [mapType]);

  // ── Draw / update boundary polygons ───────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    bLayersRef.current.forEach(l => { try { map.removeLayer(l); } catch {} });
    bLayersRef.current = [];
    if (!boundaries || boundaries.length === 0) return;
    const layers = [];
    boundaries.forEach(b => {
      if (!b.geometry) return;
      try {
        const layer = L.geoJSON(b.geometry, {
          style: {
            color: b.color || '#3b82f6', weight: 2.5,
            fillOpacity: 0.08, fillColor: b.color || '#3b82f6',
          },
          interactive: false,
        }).addTo(map);
        layers.push(layer);
      } catch (err) { console.error('[AlignmentMap] boundary', err.message); }
    });
    bLayersRef.current = layers;
    if (layers.length > 0) {
      const group = L.featureGroup(layers);
      try { map.fitBounds(group.getBounds().pad(0.25), { maxZoom: 17, animate: true }); } catch {}
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundaries, mapReady]);

  // ── Fly to searched location ───────────────────────────────────────────────
  const handleLocationSelect = (center) => {
    mapRef.current?.flyTo([center.lat, center.lng], 16, { duration: 1 });
  };

  return (
    <div className="flex-1 relative bg-zinc-900 h-full w-full">
      <style>{`
        .leaflet-container { background: #1a1a1a !important; font-family: inherit; }
      `}</style>

      {/* Location search */}
      <div className="absolute top-4 left-14 z-[1000]">
        <LocationSearch onLocationSelect={handleLocationSelect} />
      </div>

      {/* Tile type switcher — same style as /map-view */}
      <div className="absolute top-4 right-4 z-[1000] flex gap-1 bg-zinc-950/95 backdrop-blur border border-zinc-700 rounded-lg p-1">
        {['satellite', 'street', 'hybrid'].map(t => (
          <button
            key={t}
            onClick={() => setMapType(t)}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors capitalize
              ${mapType === t
                ? 'bg-emerald-500 text-black'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Leaflet map container */}
      <div ref={containerRef} className="h-full w-full outline-none" />

      {/* Draggable region overlays rendered as portals into the map */}
      {mapReady && mapRef.current && alignments.map(align => (
        <DraggableRegionOverlay
          key={align.id || `temp-${align.architectureRegionId}`}
          alignment={align}
          map={mapRef.current}
          isActive={activeRegionId === align.architectureRegionId}
          onClick={() => setActiveRegionId(align.architectureRegionId)}
          onSave={onSaveAlignment}
          onDelete={() => onDeleteAlignment(align.id)}
        />
      ))}
    </div>
  );
}
