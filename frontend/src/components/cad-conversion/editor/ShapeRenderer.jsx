import React from 'react';

const ShapeRenderer = React.memo(function ShapeRenderer({ shape, isSelected, onPointerDown, plots, statuses }) {
  if (!shape) return null;

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
  const plotId = shape.attributes?.['data-plot-id'];
  if (plotId && plots && statuses) {
    const plot = plots.find(p => p.id === parseInt(plotId));
    if (plot && plot.statusId) {
      const status = statuses.find(s => s.id === plot.statusId);
      if (status && status.fillColor) {
        reactAttrs.fill = status.fillColor;
      }
    }
  }

  if (Tag === 'g') {
    return (
      <g id={shape.id} transform={transformStr} {...reactAttrs} onPointerDown={handlePointerDown}>
        {children}
      </g>
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
