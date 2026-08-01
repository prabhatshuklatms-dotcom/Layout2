import React, { useState, useEffect } from 'react';

// Extract vertices and centroid from SVG element in global SVG coordinates
function getSvgGeometry(svgEl, shapeId) {
  if (!svgEl) return null;
  const el = svgEl.querySelector(`[id="${CSS.escape(shapeId)}"]`);
  if (!el) return null;
  
  const tag = el.tagName.toLowerCase();
  let edges = [];
  
  let elementCTM = el.getCTM();
  let svgCTM = svgEl.getCTM();
  let transformMatrix = null;
  if (elementCTM && svgCTM) {
    transformMatrix = svgCTM.inverse().multiply(elementCTM);
  }

  const transformPoint = (p) => {
    if (!transformMatrix) return p;
    const pt = svgEl.createSVGPoint();
    pt.x = p.x; pt.y = p.y;
    const gp = pt.matrixTransform(transformMatrix);
    return {x: gp.x, y: gp.y};
  };

  try {
    if (tag === 'rect') {
      const x = parseFloat(el.getAttribute('x') || 0);
      const y = parseFloat(el.getAttribute('y') || 0);
      const w = parseFloat(el.getAttribute('width') || 0);
      const h = parseFloat(el.getAttribute('height') || 0);
      const p1 = transformPoint({x, y});
      const p2 = transformPoint({x: x+w, y});
      const p3 = transformPoint({x: x+w, y: y+h});
      const p4 = transformPoint({x, y: y+h});
      
      const mid1 = {x: (p1.x+p2.x)/2, y: (p1.y+p2.y)/2};
      const mid2 = {x: (p2.x+p3.x)/2, y: (p2.y+p3.y)/2};
      const mid3 = {x: (p3.x+p4.x)/2, y: (p3.y+p4.y)/2};
      const mid4 = {x: (p4.x+p1.x)/2, y: (p4.y+p1.y)/2};

      edges.push({ p1, p2, isCurve: false, midPt: mid1 });
      edges.push({ p1: p2, p2: p3, isCurve: false, midPt: mid2 });
      edges.push({ p1: p3, p2: p4, isCurve: false, midPt: mid3 });
      edges.push({ p1: p4, p2: p1, isCurve: false, midPt: mid4 });
    } else if (tag === 'polygon' || tag === 'polyline') {
      const nums = (el.getAttribute('points')||'').trim().split(/[\s,]+/).filter(Boolean);
      const pts = [];
      for (let i=0; i+1 < nums.length; i+=2) {
        pts.push(transformPoint({x: parseFloat(nums[i]), y: parseFloat(nums[i+1])}));
      }
      for (let i=0; i < pts.length; i++) {
        if (i === pts.length - 1 && tag === 'polyline') break;
        const p1 = pts[i];
        const p2 = pts[(i + 1) % pts.length];
        edges.push({ p1, p2, isCurve: false, midPt: {x: (p1.x+p2.x)/2, y: (p1.y+p2.y)/2} });
      }
    } else if (tag === 'path') {
      const d = el.getAttribute('d') || '';
      const regex = /([a-zA-Z])|([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)/g;
      let tokens = [];
      let match;
      while ((match = regex.exec(d)) !== null) tokens.push(match[0]);
      
      let currentPt = {x: 0, y: 0};
      let startPt = {x: 0, y: 0};
      let activeCmd = 'M';
      let isRelative = false;

      for (let i = 0; i < tokens.length; ) {
        if (/[a-zA-Z]/.test(tokens[i])) {
          activeCmd = tokens[i].toUpperCase();
          isRelative = tokens[i] === tokens[i].toLowerCase();
          i++;
        }
        
        if (activeCmd === 'Z') {
          if (Math.hypot(currentPt.x - startPt.x, currentPt.y - startPt.y) > 0.1) {
            const p1 = transformPoint(currentPt);
            const p2 = transformPoint(startPt);
            edges.push({ p1, p2, isCurve: false, midPt: {x: (p1.x+p2.x)/2, y: (p1.y+p2.y)/2} });
          }
          currentPt = { ...startPt };
          continue;
        }

        const getNum = (offset) => {
          if (i + offset >= tokens.length) return 0;
          return parseFloat(tokens[i + offset]);
        };

        let nextPt = { ...currentPt };
        let isCurve = false;
        let consumed = 0;

        if (activeCmd === 'M' || activeCmd === 'L') {
          nextPt = { x: isRelative ? currentPt.x + getNum(0) : getNum(0), y: isRelative ? currentPt.y + getNum(1) : getNum(1) };
          consumed = 2;
        } else if (activeCmd === 'H') {
          nextPt = { x: isRelative ? currentPt.x + getNum(0) : getNum(0), y: currentPt.y };
          consumed = 1;
        } else if (activeCmd === 'V') {
          nextPt = { x: currentPt.x, y: isRelative ? currentPt.y + getNum(0) : getNum(0) };
          consumed = 1;
        } else if (activeCmd === 'A') {
          nextPt = { x: isRelative ? currentPt.x + getNum(5) : getNum(5), y: isRelative ? currentPt.y + getNum(6) : getNum(6) };
          consumed = 7;
          isCurve = true;
        } else if (activeCmd === 'C') {
          nextPt = { x: isRelative ? currentPt.x + getNum(4) : getNum(4), y: isRelative ? currentPt.y + getNum(5) : getNum(5) };
          consumed = 6;
          isCurve = true;
        } else if (activeCmd === 'Q' || activeCmd === 'S') {
          nextPt = { x: isRelative ? currentPt.x + getNum(2) : getNum(2), y: isRelative ? currentPt.y + getNum(3) : getNum(3) };
          consumed = 4;
          isCurve = true;
        } else if (activeCmd === 'T') {
          nextPt = { x: isRelative ? currentPt.x + getNum(0) : getNum(0), y: isRelative ? currentPt.y + getNum(1) : getNum(1) };
          consumed = 2;
          isCurve = true;
        } else {
          consumed = 1;
        }

        if (activeCmd !== 'M' && consumed > 0) {
          if (Math.hypot(currentPt.x - nextPt.x, currentPt.y - nextPt.y) > 0.1) {
            let midPt = { x: (currentPt.x + nextPt.x)/2, y: (currentPt.y + nextPt.y)/2 };
            let pBefore = currentPt;
            let pAfter = nextPt;
            
            if (isCurve) {
              try {
                const pathStr = `M ${currentPt.x} ${currentPt.y} ${tokens.slice(i, i+consumed).join(' ')}`;
                const tmpPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                tmpPath.setAttribute('d', pathStr);
                const len = tmpPath.getTotalLength();
                if (len > 0) {
                  midPt = tmpPath.getPointAtLength(len/2);
                  pBefore = tmpPath.getPointAtLength(Math.max(0, len/2 - 0.1));
                  pAfter = tmpPath.getPointAtLength(Math.min(len, len/2 + 0.1));
                }
              } catch(e) {}
            }
            
            const tMid = transformPoint(midPt);
            const tBefore = transformPoint(pBefore);
            const tAfter = transformPoint(pAfter);
            const dx = tAfter.x - tBefore.x;
            const dy = tAfter.y - tBefore.y;
            const nlen = Math.hypot(dx, dy);
            let normal = { x: 0, y: 0 };
            if (nlen > 0) {
              normal = { x: -dy/nlen, y: dx/nlen };
            }

            edges.push({ 
              p1: transformPoint(currentPt), 
              p2: transformPoint(nextPt), 
              isCurve, 
              midPt: tMid,
              normal
            });
          }
        }

        if (activeCmd === 'M') {
          startPt = { ...nextPt };
          activeCmd = 'L'; 
        }
        currentPt = nextPt;
        i += consumed;
      }
    }

    const bb = el.getBBox();
    const pt = svgEl.createSVGPoint();
    pt.x = bb.x + bb.width/2;
    pt.y = bb.y + bb.height/2;
    let centroid = transformMatrix ? pt.matrixTransform(transformMatrix) : pt;
    
    return { 
      edges, 
      centroid: { x: centroid.x, y: centroid.y },
      width: bb.width,
      height: bb.height
    };
  } catch (e) {
    return null;
  }
}

export default function SelectedPlotGeometryOverlay({ selectedShapeId, svgRef, plots, statuses, showPlotStatus, scale }) {
  const [geometry, setGeometry] = useState(null);

  useEffect(() => {
    if (!selectedShapeId || !svgRef.current || !plots) {
      setGeometry(null);
      return;
    }

    const timer = setTimeout(() => {
      const svgEl = svgRef.current.tagName.toLowerCase() === 'svg' ? svgRef.current : svgRef.current.querySelector('svg');
      const geo = getSvgGeometry(svgEl, selectedShapeId);
      if (geo) {
        // Simple deduplication of consecutive vertices to clean up markers
        
        setGeometry(geo);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [selectedShapeId, svgRef, plots]);

  if (!selectedShapeId || !geometry) return null;

  const svgEl = svgRef.current?.tagName.toLowerCase() === 'svg' ? svgRef.current : svgRef.current?.querySelector('svg');
  if (!svgEl) return null;
  const el = svgEl.querySelector(`[id="${CSS.escape(selectedShapeId)}"]`);
  if (!el) return null;

  const plotIdStr = el.getAttribute('data-plot-id');
  if (!plotIdStr) return null;

  const plot = plots.find(p => p.id === parseInt(plotIdStr));
  if (!plot) return null;

  const status = statuses?.find(s => s.id === plot.statusId);
  
  // Use native SVG scaling (no screen-space compensation) to match PlotLabelsOverlay
  const plotAvgDim = (geometry.width + geometry.height) / 2;
  const smallFontSize = Math.max(plotAvgDim * 0.08, 0.5); // Fixed SVG unit size relative to plot
  const statusColor = status?.fillColor || '#4b5563';

  // Process Dimensions
  const dbDims = Array.isArray(plot.dimensions) ? plot.dimensions : [];
  const fallbackUnit = dbDims.find(d => d.unit)?.unit || 'm'; // Fallback to 'm' if completely missing to ensure a unit is always appended
  
  
  // Edge-to-Dimension Mapping based on plotType
  const expandedDims = [];
  const type = plot.plotType || 'RECTANGLE';
  const getDimValue = (lbl) => dbDims.find(d => d.label?.toLowerCase() === lbl.toLowerCase());

  let rawEdges = geometry.edges || [];
  const centroid = geometry.centroid;

  const categorizeEdge = (e) => {
    const mid = { x: (e.p1.x + e.p2.x)/2, y: (e.p1.y + e.p2.y)/2 };
    const rx = mid.x - centroid.x;
    const ry = mid.y - centroid.y;
    if (Math.abs(rx) > Math.abs(ry)) {
      return rx > 0 ? 'right' : 'left';
    } else {
      return ry > 0 ? 'bottom' : 'top';
    }
  };

  if (type === 'RECTANGLE' || type === 'TRAPEZIUM' || type === 'SQUARE') {
    const w = type === 'SQUARE' ? (getDimValue('side') || dbDims[0]) : (getDimValue('width') || getDimValue('top') || getDimValue('bottom') || dbDims[0]);
    const h = type === 'SQUARE' ? (getDimValue('side') || dbDims[0]) : (getDimValue('height') || getDimValue('left') || getDimValue('right') || dbDims[1]);
    
    rawEdges.forEach(e => {
      const pos = categorizeEdge(e);
      if (pos === 'top' || pos === 'bottom') {
        if (w) expandedDims.push({ ...w, label: pos.charAt(0).toUpperCase() + pos.slice(1), targetEdge: e });
      } else {
        if (h) expandedDims.push({ ...h, label: pos.charAt(0).toUpperCase() + pos.slice(1), targetEdge: e });
      }
    });
  } else if (type === 'TRIANGLE') {
    rawEdges.slice(0,3).forEach((e, i) => {
      const d = dbDims[i] || dbDims[0];
      if (d) expandedDims.push({ ...d, targetEdge: e });
    });
  } else if (type === 'CURVED') {
    const curveEdge = rawEdges.find(e => e.isCurve);
    const straightEdges = rawEdges.filter(e => !e.isCurve);
    const curveDim = getDimValue('curve length') || getDimValue('arc length') || getDimValue('curve') || getDimValue('arc') || dbDims.find(d => d.label?.toLowerCase().includes('curve'));
    
    if (curveEdge && curveDim) {
      expandedDims.push({ ...curveDim, targetEdge: curveEdge });
    }
    
    let sIdx = 0;
    dbDims.forEach(d => {
      if (d === curveDim) return;
      if (sIdx < straightEdges.length) {
        expandedDims.push({ ...d, targetEdge: straightEdges[sIdx] });
        sIdx++;
      }
    });
  } else {
    // Irregular Polygon
    rawEdges.forEach((e, i) => {
      const d = dbDims[i];
      if (d) expandedDims.push({ ...d, targetEdge: e });
    });
  }

  const dimensionLabels = [];

    const getAngle = (p1, p2) => Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);

  expandedDims.forEach((dim) => {
    if (!dim.targetEdge) return;
    const e = dim.targetEdge;
    
    if (e.isCurve) {
      if (!e.normal) {
        console.warn('CRITICAL: e.normal is undefined for edge!', e, dim);
        e.normal = { x: 0, y: 0 };
      }
      const offset = Math.max(plotAvgDim * 0.05, 1);
      
      let nx = e.normal.x;
      let ny = e.normal.y;
      const rx = e.midPt.x - centroid.x;
      const ry = e.midPt.y - centroid.y;
      if (nx * rx + ny * ry < 0) {
        nx = -nx;
        ny = -ny;
      }

      const x = e.midPt.x + nx * offset;
      const y = e.midPt.y + ny * offset;
      
      let angle = Math.atan2(-nx, ny) * (180 / Math.PI);
      if (angle > 90 || angle < -90) angle += 180;
      
      dimensionLabels.push({
        text: `${dim.value} ${dim.unit || fallbackUnit}`.trim(),
        x, y, angle,
        isCurve: true
      });
    } else {
      const dx = e.p2.x - e.p1.x;
      const dy = e.p2.y - e.p1.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.1) return;

      const offset = Math.max(plotAvgDim * 0.05, 1);
      
      let nx = -dy / len;
      let ny = dx / len;
      const rx = e.midPt.x - centroid.x;
      const ry = e.midPt.y - centroid.y;
      if (nx * rx + ny * ry < 0) {
        nx = -nx;
        ny = -ny;
      }

      const p1_off = { x: e.p1.x + nx * offset, y: e.p1.y + ny * offset };
      const p2_off = { x: e.p2.x + nx * offset, y: e.p2.y + ny * offset };
      
      const x = (p1_off.x + p2_off.x) / 2;
      const y = (p1_off.y + p2_off.y) / 2;
      let angle = getAngle(p1_off, p2_off);
      if (angle > 90 || angle < -90) angle += 180;
      
      dimensionLabels.push({
        text: `${dim.value} ${dim.unit || fallbackUnit}`.trim(),
        x, y, angle,
        p1: p1_off, p2: p2_off,
        nx, ny,
        tickSize: offset * 0.5,
        isCurve: false
      });
    }
  });

  return (
    <g id="selected-plot-geometry-overlay" className="pointer-events-none">
      {/* Dimensions */}
      {dimensionLabels.map((lbl, i) => (
        <g key={`dim-${i}`}>
          {!lbl.isCurve && lbl.p1 && lbl.p2 && (
            (() => {
              const dx = lbl.p2.x - lbl.p1.x;
              const dy = lbl.p2.y - lbl.p1.y;
              const len = Math.hypot(dx, dy);
              const ux = dx / len;
              const uy = dy / len;
              
              // Estimate gap based on text length and font size, plus padding
              const textWidth = lbl.text.length * smallFontSize * 0.6;
              const gap = textWidth + smallFontSize * 1.5;
              const halfGap = gap / 2;

              // Center point
              const cx = (lbl.p1.x + lbl.p2.x) / 2;
              const cy = (lbl.p1.y + lbl.p2.y) / 2;

              const showLines = len > gap;
              const p1_end = { x: cx - ux * halfGap, y: cy - uy * halfGap };
              const p2_start = { x: cx + ux * halfGap, y: cy + uy * halfGap };

              return (
                <>
                  {/* Dashed line left segment */}
                  {showLines && (
                    <line 
                      x1={lbl.p1.x} y1={lbl.p1.y} 
                      x2={p1_end.x} y2={p1_end.y} 
                      stroke="#ffffff" 
                      strokeWidth={smallFontSize * 0.1} 
                      strokeDasharray={`${smallFontSize * 0.4},${smallFontSize * 0.4}`}
                    />
                  )}
                  {/* Dashed line right segment */}
                  {showLines && (
                    <line 
                      x1={p2_start.x} y1={p2_start.y} 
                      x2={lbl.p2.x} y2={lbl.p2.y} 
                      stroke="#ffffff" 
                      strokeWidth={smallFontSize * 0.1} 
                      strokeDasharray={`${smallFontSize * 0.4},${smallFontSize * 0.4}`}
                    />
                  )}
                  {/* End tick 1 */}
                  <line 
                    x1={lbl.p1.x - lbl.nx * lbl.tickSize} y1={lbl.p1.y - lbl.ny * lbl.tickSize} 
                    x2={lbl.p1.x + lbl.nx * lbl.tickSize} y2={lbl.p1.y + lbl.ny * lbl.tickSize} 
                    stroke="#ffffff" 
                    strokeWidth={smallFontSize * 0.1} 
                  />
                  {/* End tick 2 */}
                  <line 
                    x1={lbl.p2.x - lbl.nx * lbl.tickSize} y1={lbl.p2.y - lbl.ny * lbl.tickSize} 
                    x2={lbl.p2.x + lbl.nx * lbl.tickSize} y2={lbl.p2.y + lbl.ny * lbl.tickSize} 
                    stroke="#ffffff" 
                    strokeWidth={smallFontSize * 0.1} 
                  />
                </>
              );
            })()
          )}
          
          <g transform={`translate(${lbl.x}, ${lbl.y}) rotate(${lbl.angle})`}>
            <text 
              x="0" y="0" 
              textAnchor="middle" 
              dominantBaseline="central"
              fill="#ffffff" 
              fontSize={smallFontSize} 
              fontWeight="600"
            >
              {lbl.text}
            </text>
          </g>
        </g>
      ))}
    </g>
  );
}
