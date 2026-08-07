export function resolvePlotFill(shape, plots, statuses, showPlotStatus, ignoreStatus = false) {
  const attrs = shape.attributes || {};
  const plotIdStr = attrs['data-plot-id'];

  let finalFill = null;
  let statusColor = null;

  // 1. Plot Status (Highest visual priority when toggled ON)
  if (showPlotStatus && !ignoreStatus && plotIdStr) {
    const plot = plots?.find(p => String(p.id) === String(plotIdStr));
    if (plot && plot.statusId) {
      const status = statuses?.find(s => String(s.id) === String(plot.statusId));
      if (status && status.fillColor) {
        statusColor = status.fillColor;
        finalFill = statusColor;
      }
    }
  }

  // 2. Manual Paint (Second priority, active when status is OFF or missing)
  const isManual = attrs['data-cad-custom-fill'] === 'true';
  if (finalFill === null && isManual) {
    finalFill = attrs.fill;
  }

  // 3. Base CAD Fill (Fallback)
  let baseFill = null;
  const originalFill = attrs['data-original-fill'];
  if (originalFill) {
    baseFill = originalFill === 'MISSING' ? null : originalFill;
  } else {
    baseFill = attrs.fill || null;
  }

  if (finalFill === null) {
    finalFill = baseFill;
  }

  return finalFill;
}
