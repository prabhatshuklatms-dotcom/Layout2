export function resolvePlotFill(shape, plots, statuses, showPlotStatus, ignoreStatus = false) {
  const attrs = shape.attributes || {};

  // 1. Status View (Highest Priority - Temporary Overlay)
  if (showPlotStatus && !ignoreStatus && attrs['data-plot-id']) {
    const plot = plots?.find(p => p.id === parseInt(attrs['data-plot-id']));
    if (plot && plot.statusId) {
      const status = statuses?.find(s => s.id === plot.statusId);
      if (status && status.fillColor) {
        return status.fillColor; // Return Status Color
      }
    }
  }

  // 2. Manual Custom Fill (Permanent Saved Appearance)
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
