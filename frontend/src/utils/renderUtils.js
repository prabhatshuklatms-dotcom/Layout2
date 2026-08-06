/**
 * Determines the final fill color for a given CAD shape based on the strict ownership architecture.
 * CadShape (SVG) owns geometry and manualFillColor.
 * ProjectPlot owns Plot Number and Status mapping.
 * PlotStatus owns Status Name and Status Fill Color.
 * 
 * Toggle OFF: Render CadShape.manualFillColor
 * Toggle ON: If ProjectPlot exists and Status exists -> Render PlotStatus.fillColor. Else -> CadShape.manualFillColor
 * 
 * @param {Object} shape - The shape node from the SVG Document Model.
 * @param {Array} plots - Array of ProjectPlots from the backend.
 * @param {Array} statuses - Array of PlotStatuses from the backend.
 * @param {Boolean} showPlotStatus - The state of the global status toggle.
 * @param {Object} shapeAppearances - Dictionary mapping cadRegionId to CadShapeAppearance.
 * @returns {String|null} The resolved fill color, or null if it should be transparent.
 */
export function getRenderedFill(shape, plots, statuses, showPlotStatus, shapeAppearances) {
  const attrs = shape.attributes || {};
  const shapeId = shape.id || attrs['data-boundary-ref'] || attrs['data-plot-id'];
  
  // 1. Determine Manual Base Appearance from the dedicated backend entity
  let manualFillColor = null;
  if (shapeId && shapeAppearances) {
    const appearance = shapeAppearances[shapeId];
    if (appearance && appearance.fillColor) {
       manualFillColor = appearance.fillColor;
    }
  }

  // Fallback to the original SVG fill ONLY if it hasn't been painted. 
  // We don't read data-cad-custom-fill or data-original-fill anymore.
  if (!manualFillColor && attrs.fill) {
    manualFillColor = attrs.fill;
  }

  // 2. Toggle OFF -> Render CadShapeAppearance.fillColor
  if (!showPlotStatus) {
    return manualFillColor;
  }

  // 3. Toggle ON -> Status Check
  let plot = null;
  if (plots && plots.length > 0 && shapeId) {
    plot = plots.find(p => p.cadRegionId === shapeId);
    if (!plot && attrs['data-plot-id']) {
      plot = plots.find(p => p.id === parseInt(attrs['data-plot-id'], 10));
    }
  }

  if (plot && plot.statusId && statuses) {
    const status = statuses.find(s => s.id === plot.statusId);
    if (status && status.fillColor) {
      return status.fillColor;
    }
  }

  // 4. Fallback if no status applies -> Render CadShapeAppearance.fillColor
  return manualFillColor;
}


