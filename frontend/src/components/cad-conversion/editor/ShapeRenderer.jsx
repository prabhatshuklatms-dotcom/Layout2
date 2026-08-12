import React, { useState, useEffect } from 'react';
import { resolvePlotFill } from '../../shared/appearance/appearanceResolver';

const ShapeRenderer = React.memo(function ShapeRenderer({ shape, isSelected, onPointerDown, plots, statuses, showPlotStatus, readOnly }) {
  if (!shape) return null;
  if (shape.id === 'composite-plot-labels' || shape.id === 'composite-amenities') return null;

  let transformStr = shape.rawTransform || '';

  const children = (shape.children || []).map((child, index) => (
    <ShapeRenderer 
      key={`${child.id}-${index}`} 
      shape={child} 
      isSelected={isSelected} 
      onPointerDown={onPointerDown}
      plots={plots}
      statuses={statuses}
      showPlotStatus={showPlotStatus}
      readOnly={readOnly}
    />
  ));

  const Tag = shape.type;

  const handlePointerDown = (e) => {
    if (onPointerDown) {
      onPointerDown(e, shape.id);
    }
  };

  const reactAttrs = {};
  for (const [key, value] of Object.entries(shape.attributes)) {
    if (key.includes('-') && !key.startsWith('data-') && !key.startsWith('aria-')) {
      const camelKey = key.replace(/-([a-z])/g, g => g[1].toUpperCase());
      reactAttrs[camelKey] = value;
    } else if (key === 'class') {
      reactAttrs.className = value;
    } else {
      reactAttrs[key] = value;
    }
  }

  if (reactAttrs.dataCustomColor === 'true' && reactAttrs.vectorEffect) {
    delete reactAttrs.vectorEffect;
  }

  const resolvedFill = resolvePlotFill(shape, plots, statuses, showPlotStatus);

  if (resolvedFill !== null) {
    reactAttrs.fill = resolvedFill;
  } else if ('fill' in reactAttrs) {
    delete reactAttrs.fill;
  }

  if (shape.id === 'cad-plot-41' || shape.attributes['data-plot-id'] === '41' || shape.attributes['data-plot-id'] === '6') {
    setTimeout(() => {
      const el = document.getElementById(shape.id);
      if (el) {
        console.log("[STATUS TRACE] DOM fill attribute =", el.getAttribute('fill'));
        console.log("[STATUS TRACE] DOM inline fill =", el.style.fill);
        console.log("[STATUS TRACE] DOM computed fill =", getComputedStyle(el).fill);
      }
    }, 50);
  }

  if (isSelected && (Tag === 'path' || Tag === 'polygon' || Tag === 'rect' || Tag === 'circle' || Tag === 'polyline' || Tag === 'line')) {
    reactAttrs.strokeWidth = reactAttrs.strokeWidth ? reactAttrs.strokeWidth : '3';
    reactAttrs.filter = 'drop-shadow(0 0 4px rgba(255,255,255,0.8))';
    reactAttrs.paintOrder = 'stroke fill markers';
  }

  if (Tag === 'g' || Tag === 'defs' || Tag === 'clipPath' || Tag === 'pattern') {
    return (
      <Tag id={shape.id} transform={transformStr} {...reactAttrs} onPointerDown={handlePointerDown}>
        {children}
      </Tag>
    );
  }

  if (Tag === 'text' || Tag === 'tspan') {
    return (
      <Tag id={shape.id} transform={transformStr} {...reactAttrs} onPointerDown={handlePointerDown}>
        {shape.textContent}
        {children}
      </Tag>
    );
  }

  return (
    <Tag 
      id={shape.id} 
      transform={transformStr} 
      {...reactAttrs} 
      onPointerDown={handlePointerDown} 
    />
  );
});

export default ShapeRenderer;
