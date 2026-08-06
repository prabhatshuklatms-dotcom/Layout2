import React from 'react';
import { resolvePlotFill } from '../../shared/appearance/appearanceResolver';

const ShapeRenderer = React.memo(function ShapeRenderer({ shape, isSelected, onPointerDown, plots, statuses, showPlotStatus, readOnly }) {
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
  if (isSelected && (Tag === 'path' || Tag === 'polygon' || Tag === 'rect' || Tag === 'circle' || Tag === 'polyline' || Tag === 'line')) {
    reactAttrs.stroke = 'white';
    reactAttrs.strokeWidth = '3';
    reactAttrs.filter = 'drop-shadow(0 0 4px rgba(255,255,255,0.8))';
    reactAttrs.paintOrder = 'stroke fill markers';
    reactAttrs.vectorEffect = 'non-scaling-stroke'; // Keep the border consistent regardless of zoom
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
