import React from 'react';

export function resolvePlotFill(shape, plots, statuses, showPlotStatus) {
  const attrs = shape.attributes || {};
  
  // 1. Status View (if enabled and plot has an assigned status)
  if (showPlotStatus && attrs['data-plot-id']) {
    const plot = plots?.find(p => p.id === parseInt(attrs['data-plot-id']));
    if (plot && plot.statusId) {
      const status = statuses?.find(s => s.id === plot.statusId);
      if (status && status.fillColor) {
        return status.fillColor; // Return Status Color
      }
    }
  }

  // 2. Manual Custom Fill
  if (attrs['data-cad-custom-fill'] === 'true') {
    return attrs.fill;
  }

  // 3. Original CAD Fill
  const originalFill = attrs['data-original-fill'];
  if (originalFill) {
    return originalFill === 'MISSING' ? null : originalFill;
  }

  // 4. Fallback for untouched shapes
  return attrs.fill || null;
}

const ShapeRenderer = React.memo(function ShapeRenderer({ shape, isSelected, onPointerDown, plots, statuses, showPlotStatus, readOnly, cadLineColor }) {
  if (!shape) return null;
  if (shape.id === 'composite-plot-labels' || shape.id === 'composite-amenities') return null;

  // We must apply the rawTransform if it exists, or serialize the transform object
  let transformStr = shape.rawTransform;

  // Render children if it's a group
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
      cadLineColor={cadLineColor}
    />
  ));

  const Tag = shape.type;

  // Ensure interactive shapes have pointer-events-auto if they are top level, 
  // but we usually handle selection at the CadEditorCanvas level via event delegation,
  // OR we can attach onPointerDown directly here!
  
  const handlePointerDown = (e) => {
    if (onPointerDown) {
      onPointerDown(e, shape.id);
    }
  };

  // Convert kebab-case to camelCase for React rendering
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

  // Dynamic Plot Fill Override
  const resolvedFill = resolvePlotFill(shape, plots, statuses, showPlotStatus);
  if (resolvedFill !== null) {
    reactAttrs.fill = resolvedFill;
  } else if ('fill' in reactAttrs) {
    delete reactAttrs.fill;
  }

  // Selection Highlight
  if (isSelected && (Tag === 'path' || Tag === 'polygon' || Tag === 'rect' || Tag === 'circle' || Tag === 'polyline')) {
    reactAttrs.stroke = 'white';
    reactAttrs.strokeWidth = '3';
    reactAttrs.filter = 'drop-shadow(0 0 4px rgba(255,255,255,0.8))';
    reactAttrs.paintOrder = 'stroke fill markers';
    reactAttrs.vectorEffect = 'non-scaling-stroke'; // Keep the border consistent regardless of zoom
  }

      // Apply CAD Line Color
  if (!isSelected && cadLineColor && cadLineColor !== '#FFFFFF') {
    const isGeometric = ['path', 'polygon', 'rect', 'circle', 'ellipse', 'line', 'polyline'].includes(Tag);
    const isDimension = shape.id && String(shape.id).includes('dim');
    const isLabel = shape.id && String(shape.id).includes('label');
    
    if (isGeometric && !isDimension && !isLabel) {
      if (reactAttrs.stroke && reactAttrs.stroke !== 'none') {
        reactAttrs.stroke = cadLineColor;
      }
    }
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
