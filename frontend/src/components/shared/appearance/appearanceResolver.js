export function resolvePlotFill(shape, plots, statuses, showPlotStatus, ignoreStatus = false, appearanceSettings = null, isSelected = false, readOnly = false) {
  const attrs = shape.attributes || {};
  let plotIdStr = attrs['data-plot-id'];
  
  if (!plotIdStr && attrs['data-cad-type'] === 'hatch' && attrs['data-boundary-ref']?.startsWith('cad-plot-')) {
    plotIdStr = attrs['data-boundary-ref'].replace('cad-plot-', '');
  }

  let finalFill = null;

  // 1. Project Appearance Settings (Highest visual priority for SELECTED plots in user view)
  if (plotIdStr && isSelected && readOnly && appearanceSettings?.plotColor) {
    return appearanceSettings.plotColor;
  }

  let statusColor = null;

  // 2. Plot Status (Second priority when toggled ON)
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

  // 3. Manual Paint (Third priority, active when status is OFF or missing)
  const isManual = attrs['data-cad-custom-fill'] === 'true';
  if (finalFill === null && isManual) {
    finalFill = attrs.fill;
  }

  // 4. Base CAD Fill (Fallback)
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
