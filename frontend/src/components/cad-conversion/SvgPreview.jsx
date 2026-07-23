import React, { useState, useEffect, useRef } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut, Maximize, RotateCcw, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

// ─── Geometric Utils ────────────────────────────────────────────────────────
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
    const r  = parseFloat(el.getAttribute('r') || 0);
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
  } catch(e) {}
  
  try {
    const bb = el.getBBox();
    return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
  } catch(e) {
    return { x: 0, y: 0 };
  }
}
// ────────────────────────────────────────────────────────────────────────────

export default function SvgPreview({ conversion }) {
  const router = useRouter();
  const containerRef = useRef(null);
  const [svgContent, setSvgContent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [viewBox, setViewBox] = useState('0 0 100 100');
  
  // Data State
  const [plots, setPlots] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [amenities, setAmenities] = useState([]);
  const [placements, setPlacements] = useState([]);
  const [labels, setLabels] = useState([]);

  useEffect(() => {
    if (!conversion) {
      setSvgContent(null);
      return;
    }

    if (conversion.status === 'SUCCESS') {
      setLoading(true);
      setError(null);
      
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const projectId = conversion.projectId;

      Promise.all([
        fetch(`${API_URL}/api/cad-conversion/${conversion.id}/svg`).then(r => r.ok ? r.text() : Promise.reject('SVG failed')),
        fetch(`${API_URL}/api/projects/${projectId}/plots`).then(r => r.ok ? r.json() : []),
        fetch(`${API_URL}/api/plot-statuses/project/${projectId}`).then(r => r.ok ? r.json() : []),
        fetch(`${API_URL}/api/amenities`).then(r => r.ok ? r.json() : []),
        fetch(`${API_URL}/api/amenity-placement?conversionId=${conversion.id}`).then(r => r.ok ? r.json() : [])
      ]).then(([svgText, fetchedPlots, fetchedStatuses, fetchedAmenities, fetchedPlacements]) => {
        // Extract viewBox from svgText
        const match = svgText.match(/viewBox=["']([^"']+)["']/i);
        if (match && match[1]) {
          setViewBox(match[1]);
        }
        
        setSvgContent(svgText);
        setPlots(fetchedPlots);
        setStatuses(fetchedStatuses);
        setAmenities(fetchedAmenities);
        setPlacements(fetchedPlacements);
        setLoading(false);
      }).catch(err => {
        console.error(err);
        setError('Could not load CAD data.');
        setLoading(false);
      });
    } else {
      setSvgContent(null);
      setError(null);
    }
  }, [conversion]);

  // Apply Plot Colors & Compute Labels once SVG is rendered
  useEffect(() => {
    if (!svgContent || !containerRef.current) return;
    
    // We delay slightly to ensure dangerouslySetInnerHTML has rendered the DOM nodes
    const timer = setTimeout(() => {
      const computedLabels = [];
      const svgNodes = containerRef.current.querySelectorAll('[data-plot-id]');
      
      const fontSizes = [];

      svgNodes.forEach(node => {
        const plotIdStr = node.getAttribute('data-plot-id');
        const plotId = parseInt(plotIdStr, 10);
        const plot = plots.find(p => p.id === plotId);
        
        if (plot) {
          // Colorize Plot
          if (plot.statusId) {
            const status = statuses.find(s => s.id === plot.statusId);
            if (status && status.fillColor) {
              // Apply to the node itself
              node.style.fill = status.fillColor;
              node.setAttribute('fill', status.fillColor);
              node.setAttribute('fill-opacity', '0.7');

              // If it's a group, the children might have hardcoded fill="none" which blocks inheritance
              if (node.tagName.toLowerCase() === 'g') {
                const innerShapes = node.querySelectorAll('path, polyline, polygon, rect');
                innerShapes.forEach(child => {
                  child.style.fill = status.fillColor;
                  child.setAttribute('fill', status.fillColor);
                  child.setAttribute('fill-opacity', '0.7');
                });
              }
            }
          }
          
          // Compute Centroid for Label
          try {
            const c = pbComputeCentroid(node);
            const dx = parseFloat(node.getAttribute('data-label-dx') || 0);
            const dy = parseFloat(node.getAttribute('data-label-dy') || 0);
            
            // Compute dynamic font size based strictly on the bounding box of the plot!
            let idealSize = 14;
            try {
              const bb = node.getBBox();
              if (bb.width && bb.height) {
                 idealSize = Math.min(bb.width, bb.height) * 0.35;
                 idealSize = Math.max(0.1, Math.min(idealSize, bb.width * 0.8));
              }
            } catch(_) {}

            fontSizes.push(idealSize);

            const fontFam = node.getAttribute('data-label-fontfamily') || 'sans-serif';
            const color = node.getAttribute('data-label-color') || '#ffffff';
            
            computedLabels.push({
              plotId: plot.id,
              plotName: plot.plotNumber,
              x: c.x + dx,
              y: c.y + dy,
              idealSize, // temporary
              fontFamily: fontFam,
              color: color
            });
          } catch(e) {
            console.error('Label computation failed for plot', plot.id, e);
          }
        }
      });
      
      // Calculate median font size so all plots look uniform
      fontSizes.sort((a, b) => a - b);
      let uniformFontSize = 14;
      if (fontSizes.length > 0) {
        const mid = Math.floor(fontSizes.length / 2);
        uniformFontSize = fontSizes[mid];
      }

      // Apply uniform font size
      const finalLabels = computedLabels.map(lbl => ({
        ...lbl,
        fontSize: uniformFontSize
      }));

      setLabels(finalLabels);
    }, 50); // slight delay
    
    return () => clearTimeout(timer);
  }, [svgContent, plots, statuses]);

  // Pan & Zoom State
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const setScale = (newScale, cx, cy) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = cx - rect.left;
    const y = cy - rect.top;

    newScale = Math.max(0.1, Math.min(newScale, 50));
    const ratio = newScale / transformRef.current.scale;

    const newX = x - (x - transformRef.current.x) * ratio;
    const newY = y - (y - transformRef.current.y) * ratio;

    transformRef.current = { x: newX, y: newY, scale: newScale };
    setTransform(transformRef.current);
  };

  const centerView = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    transformRef.current = { x: 0, y: 0, scale: 1 };
    setTransform(transformRef.current);
  };

  const zoomIn = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setScale(transformRef.current.scale * 1.25, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  const zoomOut = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setScale(transformRef.current.scale / 1.25, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e) => {
      e.preventDefault();
      if (e.ctrlKey) {
        const zoomFactor = Math.pow(0.99, e.deltaY);
        setScale(transformRef.current.scale * zoomFactor, e.clientX, e.clientY);
      } else if (!e.shiftKey) {
        const delta = e.deltaY < 0 ? 1 : -1;
        const isTrackpad = Math.abs(e.deltaY) < 50; 
        
        if (isTrackpad) {
          const zoomFactor = Math.pow(0.995, e.deltaY);
          setScale(transformRef.current.scale * zoomFactor, e.clientX, e.clientY);
        } else {
          const stepAmount = 1.25;
          setScale(delta > 0 ? transformRef.current.scale * stepAmount : transformRef.current.scale / stepAmount, e.clientX, e.clientY);
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [svgContent, loading]);

  const handlePointerDown = (e) => {
    if (e.button === 0 || e.button === 1 || e.button === 2) {
      isDragging.current = true;
      dragStart.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y };
      containerRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e) => {
    if (isDragging.current) {
      transformRef.current = {
        ...transformRef.current,
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      };
      setTransform(transformRef.current);
    }
  };

  const handlePointerUp = (e) => {
    isDragging.current = false;
    containerRef.current.releasePointerCapture(e.pointerId);
  };

  if (!conversion) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 bg-[#0A0A0A]">
        <ImageIcon size={48} className="mb-4 opacity-50" />
        <p>No conversion selected</p>
      </div>
    );
  }

  if (conversion.status === 'PROCESSING') {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 bg-[#0A0A0A]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4"></div>
        <p>Converting {conversion.originalFileName}...</p>
      </div>
    );
  }

  if (conversion.status === 'FAILED') {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 bg-[#0A0A0A]">
        <AlertCircle size={48} className="mb-4 opacity-50" />
        <p>Conversion Failed</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 bg-[#0A0A0A]">
        <AlertCircle size={48} className="mb-4 opacity-50" />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-[#0f1115]" style={{
      backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
      backgroundSize: '20px 20px'
    }}>
      <div 
        ref={containerRef}
        className="w-full h-full relative overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ cursor: isDragging.current ? 'grabbing' : 'grab' }}
      >
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          <ToolbarButton icon={<ZoomIn size={14} />} onClick={zoomIn} title="Zoom In" />
          <ToolbarButton icon={<ZoomOut size={14} />} onClick={zoomOut} title="Zoom Out" />
          <ToolbarButton icon={<Maximize size={14} />} onClick={centerView} title="Fit to Screen" />
          <ToolbarButton icon={<RotateCcw size={14} />} onClick={centerView} title="Reset View" />
        </div>
        
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-indigo-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        ) : (
          <div 
            className="w-full h-full absolute inset-0 transform-gpu"
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              transformOrigin: '0 0'
            }}
          >
            {svgContent && (
              <div 
                className="w-full h-full text-white flex items-center justify-center pointer-events-none [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-full [&>svg]:max-h-full"
                style={{ color: 'white' }} 
                dangerouslySetInnerHTML={{ __html: svgContent }} 
              />
            )}
            
            {/* Secondary SVG overlay for Plots and Amenities (sharing the exact viewBox) */}
            {svgContent && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <svg 
                  viewBox={viewBox} 
                  className="w-full h-full max-w-full max-h-full"
                  style={{ overflow: 'visible' }}
                >
                  {/* Plot Labels */}
                  {labels.map((lbl) => (
                     <text
                       key={`lbl-${lbl.plotId}`}
                       x={lbl.x}
                       y={lbl.y}
                       textAnchor="middle"
                       dominantBaseline="middle"
                       fill={lbl.color}
                       style={{
                         fontSize: `${lbl.fontSize}px`,
                         fontFamily: lbl.fontFamily,
                         pointerEvents: 'none',
                         textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'
                       }}
                     >
                       {lbl.plotName}
                     </text>
                  ))}

                  {/* Placed Amenities */}
                  {placements.map(placement => {
                    const master = amenities.find(a => a.id === placement.amenityId);
                    if (!master) return null;
                    
                    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
                    const w = parseFloat(placement.width);
                    const h = parseFloat(placement.height);
                    const r = parseFloat(placement.rotation || 0);
                    const cx = parseFloat(placement.x);
                    const cy = parseFloat(placement.y);
                    
                    return (
                      <g 
                        key={`am-${placement.id}`} 
                        transform={`translate(${cx}, ${cy}) rotate(${r})`}
                      >
                        <image 
                          href={`${API_URL}${master.iconPath}`} 
                          x={-w/2} 
                          y={-h/2} 
                          width={w} 
                          height={h} 
                          preserveAspectRatio="none"
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>
        )}

        {/* Continue Editing Overlay */}
        {conversion.status === 'SUCCESS' && !loading && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
            <button
              onClick={() => router.push(`/cad-conversion/${conversion.projectId}/editor/${conversion.id}`)}
              className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-full shadow-lg transition-all hover:scale-105 hover:shadow-indigo-500/25 flex items-center gap-1.5"
            >
              Continue Editing
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({ icon, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-6 h-6 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded shadow-lg transition-colors border border-zinc-700"
    >
      {icon}
    </button>
  );
}
