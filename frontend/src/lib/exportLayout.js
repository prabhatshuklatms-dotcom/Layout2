export const exportToSVG = (polygons, width, height) => {
  let svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n`;
  svgContent += `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">\n`;

  polygons.forEach((poly) => {
    if (poly.type === 'polygon' && poly.geometry.length > 0) {
      const points = poly.geometry.map(p => `${p[0]},${p[1]}`).join(' ');
      // Default style as per requirements: fill none, stroke #222222, stroke-width 1
      svgContent += `  <polygon points="${points}" fill="none" stroke="#222222" stroke-width="1" id="${poly.id}" />\n`;
    }
  });

  svgContent += `</svg>`;

  downloadFile(svgContent, 'layout.svg', 'image/svg+xml');
};

export const exportToGeoJSON = (polygons) => {
  const geojson = {
    type: "FeatureCollection",
    features: polygons.map(poly => ({
      type: "Feature",
      id: poly.id,
      properties: {
        layer: poly.layer,
        ...poly.properties
      },
      geometry: {
        type: "Polygon",
        // GeoJSON requires closed rings [ [x, y], [x, y], ..., [x, y] ]
        coordinates: [
          [...poly.geometry, poly.geometry[0]] 
        ]
      }
    }))
  };

  const jsonContent = JSON.stringify(geojson, null, 2);
  downloadFile(jsonContent, 'layout.geojson', 'application/geo+json');
};

export const exportToJSON = (polygons) => {
  const jsonContent = JSON.stringify(polygons, null, 2);
  downloadFile(jsonContent, 'layout.json', 'application/json');
};

const downloadFile = (content, fileName, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
