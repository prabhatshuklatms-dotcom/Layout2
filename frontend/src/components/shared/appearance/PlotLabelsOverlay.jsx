import React, { useState, useEffect } from 'react';
import polylabel from 'polylabel';

function pbComputeCentroid(element) {
  try {
    // 1. Try to find the visual center using polylabel
    let pathEl = element;
    
    // If it's a group, try to find a path or polygon inside it
    if (element.tagName.toLowerCase() === 'g') {
      pathEl = element.querySelector('path, polygon, rect') || element;
    }

    if (pathEl && typeof pathEl.getTotalLength === 'function') {
      const length = pathEl.getTotalLength();
      if (length > 0) {
        const points = [];
        const numSamples = 50; // Adequate for most plot shapes
        for (let i = 0; i < numSamples; i++) {
          const pt = pathEl.getPointAtLength((i / numSamples) * length);
          points.push([pt.x, pt.y]);
        }
        
        // 2. Calculate visual center using polylabel
        const center = polylabel([points], 1.0);
        if (!isNaN(center[0]) && !isNaN(center[1])) {
          return { x: center[0], y: center[1] };
        }
      }
    }
  } catch (e) {
    // Ignore and fallback
  }

  // 3. Fallback to bounding box for unsupported elements
  try {
    const bbox = element.getBBox();
    return {
      x: bbox.x + bbox.width / 2,
      y: bbox.y + bbox.height / 2
    };
  } catch (e) {
    return { x: 0, y: 0 };
  }
}

export default function PlotLabelsOverlay({ svgRef, plots, onLabelDragEnd, readOnly, selectedShapeIds, projectConfig }) {
  const [labels, setLabels] = useState([]);
  const [dragState, setDragState] = useState(null);

  useEffect(() => {
    if (!svgRef.current || !plots || plots.length === 0) {
      setLabels([]); return;
    }

    // A short delay helps ensure the SVG has been fully rendered in the DOM
    const timer = setTimeout(() => {
      const svgEl = svgRef.current.tagName.toLowerCase() === 'svg' ? svgRef.current : svgRef.current.querySelector('svg');
      if (!svgEl) return;

      const plotElements = svgRef.current.querySelectorAll('[data-plot-id]');
      if (plotElements.length === 0) {
        setLabels([]); return;
      }

      let globalFallbackFontSize = 14;
      let totalWidth = 0;
      let count = 0;
      
      plotElements.forEach(el => {
        try {
          totalWidth += el.getBBox().width;
          count++;
        } catch (e) { }
      });
      
      if (count > 0) {
        globalFallbackFontSize = Math.max((totalWidth / count) * 0.25, 0.5);
        if (!isFinite(globalFallbackFontSize)) globalFallbackFontSize = 14;
      }

      const newLabels = [];

      plotElements.forEach(el => {
        const plotIdStr = el.getAttribute('data-plot-id');
        const plot = plots.find(p => p.id === parseInt(plotIdStr));
        
        if (plot) {
          try {
            const localC = pbComputeCentroid(el);
            const pt = svgEl.createSVGPoint();
            pt.x = localC.x;
            pt.y = localC.y;

            const elementCTM = el.getCTM();
            const svgCTM = svgEl.getCTM();
            let globalX = localC.x;
            let globalY = localC.y;

            if (elementCTM && svgCTM) {
              const transformMatrix = svgCTM.inverse().multiply(elementCTM);
              const globalPt = pt.matrixTransform(transformMatrix);
              globalX = globalPt.x;
              globalY = globalPt.y;
            }

            const dx = parseFloat(el.getAttribute('data-label-dx') || 0);
            const dy = parseFloat(el.getAttribute('data-label-dy') || 0);

            newLabels.push({
              id: el.id,
              plot,
              attributes: {
                'data-label-dx': el.getAttribute('data-label-dx'),
                'data-label-dy': el.getAttribute('data-label-dy'),
              },
              x: globalX + dx,
              y: globalY + dy,
              baseX: globalX,
              baseY: globalY,
              globalFallbackFontSize
            });
          } catch (err) {
            console.error(`Error calculating centroid for plot ${plotIdStr}:`, err);
          }
        }
      });
      setLabels(newLabels);
    }, 50);

    return () => clearTimeout(timer);
  }, [svgRef, plots]);

  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (e) => {
      if (!svgRef.current) return;
      const svgEl = svgRef.current.tagName.toLowerCase() === 'svg' ? svgRef.current : svgRef.current.querySelector('svg');
      if (!svgEl) return;

      const pt = svgEl.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgP = pt.matrixTransform(svgEl.getScreenCTM().inverse());

      const currentDx = svgP.x - dragState.startX;
      const currentDy = svgP.y - dragState.startY;

      setDragState(prev => ({ ...prev, currentDx, currentDy }));
    };

    const handlePointerUp = () => {
      if (onLabelDragEnd && (dragState.currentDx !== 0 || dragState.currentDy !== 0)) {
        onLabelDragEnd(
          dragState.id,
          dragState.initialDx + dragState.currentDx,
          dragState.initialDy + dragState.currentDy
        );
      }
      setDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, svgRef, onLabelDragEnd]);

  if (labels.length === 0) return null;

  return (
    <g id="plot-labels-overlay">
      {labels.map((label) => {
        const { id, plot, attributes, x, y, baseX, baseY } = label;

        let renderX = x;
        let renderY = y;
        if (dragState && dragState.id === id) {
          renderX = baseX + dragState.initialDx + dragState.currentDx;
          renderY = baseY + dragState.initialDy + dragState.currentDy;
        }

        const isSelected = selectedShapeIds?.includes(id);
        const color = projectConfig?.labelFontColor || '#FFFFFF';
        const fontFamily = projectConfig?.labelFontFamily || 'sans-serif';
        const showArea = isSelected;
        const showWidth = false; // Dimensions are handled by geometry overlay
        const showHeight = false;
        const rotationAttr = 0;
        const alignAttr = 'middle';

        let baseFontSize = projectConfig?.labelFontSize;
        if (!baseFontSize || isNaN(baseFontSize)) baseFontSize = 2;

        let textX = 0;
        let lines = [];
        lines.push({ text: plot.plotNumber || '?', size: baseFontSize * 1.5, color });
        
        if (showArea) {
          if (plot.areaSqFt) lines.push({ text: `${plot.areaSqFt} sq ft`, size: baseFontSize * 0.9, color });
          if (plot.areaSqYard) lines.push({ text: `${plot.areaSqYard} sq yd`, size: baseFontSize * 0.9, color });
          if (plot.areaSqMeter) lines.push({ text: `${plot.areaSqMeter} m²`, size: baseFontSize * 0.9, color });
        }
        if (showWidth && plot.width) {
          lines.push({ text: 'Width', size: baseFontSize * 0.6, color, dy: baseFontSize * 0.4 });
          lines.push({ text: `${plot.width} m`, size: baseFontSize * 0.85, color });
        }
        if (showHeight && plot.height) {
          lines.push({ text: 'Height', size: baseFontSize * 0.6, color, dy: baseFontSize * 0.4 });
          lines.push({ text: `${plot.height} m`, size: baseFontSize * 0.85, color });
        }

        let currentY = 0;
        lines.forEach(l => {
          if (l.dy) currentY += l.dy;
          l.y = currentY;
          currentY += l.size * 1.3;
        });
        const totalHeight = currentY;
        lines.forEach(l => {
          l.y -= (totalHeight / 2) - (l.size * 0.4);
        });

        return (
          <g
            key={`label-${id}`}
            data-label-for={id}
            transform={`translate(${renderX}, ${renderY}) rotate(${rotationAttr})`}
            className={onLabelDragEnd ? "cursor-move" : ""}
            onPointerDown={(e) => {
              if (!onLabelDragEnd) return;
              e.stopPropagation();
              e.preventDefault();
              if (!svgRef.current) return;
              const svgEl = svgRef.current.tagName.toLowerCase() === 'svg' ? svgRef.current : svgRef.current.querySelector('svg');
              const pt = svgEl.createSVGPoint();
              pt.x = e.clientX;
              pt.y = e.clientY;
              const svgP = pt.matrixTransform(svgEl.getScreenCTM().inverse());

              setDragState({
                id,
                startX: svgP.x,
                startY: svgP.y,
                initialDx: parseFloat(attributes['data-label-dx'] || 0),
                initialDy: parseFloat(attributes['data-label-dy'] || 0),
                currentDx: 0,
                currentDy: 0
              });
            }}
          >
            {lines.map((l, i) => (
              <text
                key={i}
                x={textX}
                textAnchor={alignAttr}
                fill={l.color}
                fontSize={l.size}
                fontFamily={fontFamily}
                fontWeight="600"
                dominantBaseline="central"
                textRendering="geometricPrecision"
                y={l.y}
                pointerEvents="none"
                style={{ userSelect: 'none' }}
              >
                {l.text}
              </text>
            ))}
          </g>
        );
      })}
    </g>
  );
}
