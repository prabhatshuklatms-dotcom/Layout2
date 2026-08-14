import React, { useState, useEffect } from 'react';
import { resolvePlotFill } from '../../shared/appearance/appearanceResolver';

const ShapeRenderer = React.memo(function ShapeRenderer({ 
  shape, 
  selectedShapeIds = [],
  parentIsSelected = false,
  onPointerDown, 
  plots, 
  statuses, 
  showPlotStatus, 
  readOnly, 
  appearanceSettings,
  inheritedPlotIdStr = null
}) {
  if (!shape) return null;
  if (shape.id === 'composite-plot-labels' || shape.id === 'composite-amenities') return null;

  let transformStr = shape.rawTransform || '';

  // Determine the plot identity for this node and its children
  let currentPlotIdStr = shape.attributes?.['data-plot-id'];
  if (!currentPlotIdStr && shape.attributes?.['data-cad-type'] === 'hatch' && shape.attributes?.['data-boundary-ref']?.startsWith('cad-plot-')) {
    currentPlotIdStr = shape.attributes['data-boundary-ref'].replace('cad-plot-', '');
  }
  const activePlotIdStr = currentPlotIdStr || inheritedPlotIdStr;

  const currentIsSelected = parentIsSelected || 
                            selectedShapeIds.includes(shape.id) || 
                            (shape.attributes?.['data-cad-type'] === 'hatch' && selectedShapeIds.includes(shape.attributes?.['data-boundary-ref']));

  const children = (shape.children || []).map((child, index) => (
    <ShapeRenderer 
      key={`${child.id}-${index}`} 
      shape={child} 
      selectedShapeIds={selectedShapeIds}
      parentIsSelected={currentIsSelected}
      onPointerDown={onPointerDown}
      plots={plots}
      statuses={statuses}
      showPlotStatus={showPlotStatus}
      readOnly={readOnly}
      appearanceSettings={appearanceSettings}
      inheritedPlotIdStr={activePlotIdStr}
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

  const resolvedFill = resolvePlotFill(shape, plots, statuses, showPlotStatus, false, appearanceSettings, currentIsSelected, readOnly);

  if (resolvedFill !== null) {
    reactAttrs.fill = resolvedFill;
  } else if ('fill' in reactAttrs) {
    delete reactAttrs.fill;
  }

  // Override fill for actual physical geometry when plot is selected in read-only mode
  const isGeometry = Tag === 'path' || Tag === 'polygon' || Tag === 'rect' || Tag === 'circle' || Tag === 'polyline';
  if (isGeometry && activePlotIdStr && currentIsSelected && readOnly && appearanceSettings?.plotColor) {
    reactAttrs.fill = appearanceSettings.plotColor;
  }

  if (!readOnly && currentIsSelected && (Tag === 'path' || Tag === 'polygon' || Tag === 'rect' || Tag === 'circle' || Tag === 'polyline' || Tag === 'line')) {
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
