/**
 * Coordinate transformation utilities for consistent SVG coordinate handling.
 * This ensures dimensions and labels remain anchored to plot geometry regardless
 * of pan, zoom, or viewport transformations.
 */

/**
 * Converts screen/client coordinates to SVG document coordinates.
 * @param {SVGElement} svgEl - The SVG element
 * @param {number} clientX - Screen X coordinate
 * @param {number} clientY - Screen Y coordinate
 * @returns {Object} {x, y} in SVG document coordinates
 */
export function screenToSvgCoordinates(svgEl, clientX, clientY) {
  if (!svgEl) return { x: 0, y: 0 };
  
  try {
    const rect = svgEl.getBoundingClientRect();
    const viewBox = svgEl.viewBox.baseVal;
    
    // Handle case where viewBox might not be set
    if (!viewBox || viewBox.width === 0 || viewBox.height === 0) {
      // Fallback to using the SVG dimensions
      const svgWidth = svgEl.width.baseVal.value || svgEl.clientWidth;
      const svgHeight = svgEl.height.baseVal.value || svgEl.clientHeight;
      
      const scaleX = svgWidth / rect.width;
      const scaleY = svgHeight / rect.height;
      
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    }
    
    // Normal case with valid viewBox
    const scaleX = viewBox.width / rect.width;
    const scaleY = viewBox.height / rect.height;
    
    return {
      x: ((clientX - rect.left) * scaleX) + viewBox.x,
      y: ((clientY - rect.top) * scaleY) + viewBox.y
    };
  } catch (error) {
    console.error('Error converting screen to SVG coordinates:', error);
    return { x: 0, y: 0 };
  }
}

/**
 * Applies an SVG transform string to a point.
 * @param {SVGElement} svgEl - The SVG element (for creating SVGPoint)
 * @param {Object} point - {x, y} coordinates
 * @param {string} transformStr - SVG transform string
 * @returns {Object} Transformed {x, y} coordinates
 */
export function applyTransformToPoint(svgEl, point, transformStr) {
  if (!transformStr || !svgEl) return point;
  
  try {
    const svgNS = 'http://www.w3.org/2000/svg';
    const pt = document.createElementNS(svgNS, 'svg').createSVGPoint();
    pt.x = point.x;
    pt.y = point.y;
    
    // Parse transform string
    const transformList = svgEl.createSVGTransformList();
    const transform = svgEl.createSVGTransform();
    transform.setMatrix(svgEl.createSVGMatrix());
    
    // Apply transforms in order
    const transforms = transformStr.match(/(\w+\([^)]+\))/g) || [];
    for (const t of transforms) {
      const match = t.match(/(\w+)\(([^)]+)\)/);
      if (!match) continue;
      
      const [_, type, values] = match;
      const nums = values.split(/[,\s]+/).map(parseFloat);
      
      switch(type.toLowerCase()) {
        case 'translate':
          if (nums.length >= 2) {
            transform.setTranslate(nums[0], nums[1]);
            pt.matrixTransform(transform.matrix);
          }
          break;
        case 'scale':
          if (nums.length >= 1) {
            transform.setScale(nums[0], nums.length >= 2 ? nums[1] : nums[0]);
            pt.matrixTransform(transform.matrix);
          }
          break;
        case 'rotate':
          if (nums.length >= 1) {
            const angle = nums[0];
            const cx = nums.length >= 2 ? nums[1] : 0;
            const cy = nums.length >= 3 ? nums[2] : 0;
            transform.setRotate(angle, cx, cy);
            pt.matrixTransform(transform.matrix);
          }
          break;
        case 'matrix':
          if (nums.length >= 6) {
            const m = svgEl.createSVGMatrix();
            m.a = nums[0]; m.b = nums[1];
            m.c = nums[2]; m.d = nums[3];
            m.e = nums[4]; m.f = nums[5];
            transform.setMatrix(m);
            pt.matrixTransform(transform.matrix);
          }
          break;
      }
    }
    
    return { x: pt.x, y: pt.y };
  } catch (error) {
    console.warn('Error applying transform to point:', error);
    return point;
  }
}

/**
 * Extracts geometry from an SVG element in document coordinates.
 * Handles element transformations properly.
 * @param {SVGElement} element - The SVG element to extract geometry from
 * @param {SVGElement} svgEl - The parent SVG element (for coordinate context)
 * @returns {Object} Geometry object with edges, centroid, width, height
 */
export function extractSvgGeometry(element, svgEl) {
  if (!element || !svgEl) return null;
  
  const tag = element.tagName.toLowerCase();
  const elementTransform = element.getAttribute('transform') || '';
  let edges = [];
  
  const transformPoint = (point) => {
    if (!elementTransform) return point;
    return applyTransformToPoint(svgEl, point, elementTransform);
  };
  
  try {
    if (tag === 'rect') {
      const x = parseFloat(element.getAttribute('x') || 0);
      const y = parseFloat(element.getAttribute('y') || 0);
      const w = parseFloat(element.getAttribute('width') || 0);
      const h = parseFloat(element.getAttribute('height') || 0);
      
      const p1 = transformPoint({x, y});
      const p2 = transformPoint({x: x + w, y});
      const p3 = transformPoint({x: x + w, y: y + h});
      const p4 = transformPoint({x, y: y + h});
      
      edges.push({ p1, p2, isCurve: false, midPt: {x: (p1.x + p2.x)/2, y: (p1.y + p2.y)/2} });
      edges.push({ p1: p2, p2: p3, isCurve: false, midPt: {x: (p2.x + p3.x)/2, y: (p2.y + p3.y)/2} });
      edges.push({ p1: p3, p2: p4, isCurve: false, midPt: {x: (p3.x + p4.x)/2, y: (p3.y + p4.y)/2} });
      edges.push({ p1: p4, p2: p1, isCurve: false, midPt: {x: (p4.x + p1.x)/2, y: (p4.y + p1.y)/2} });
      
    } else if (tag === 'polygon' || tag === 'polyline') {
      const nums = (element.getAttribute('points') || '').trim().split(/[\s,]+/).filter(Boolean);
      const pts = [];
      for (let i = 0; i + 1 < nums.length; i += 2) {
        pts.push({x: parseFloat(nums[i]), y: parseFloat(nums[i + 1])});
      }
      for (let i = 0; i < pts.length; i++) {
        if (i === pts.length - 1 && tag === 'polyline') break;
        const p1 = transformPoint(pts[i]);
        const p2 = transformPoint(pts[(i + 1) % pts.length]);
        edges.push({ p1, p2, isCurve: false, midPt: {x: (p1.x + p2.x)/2, y: (p1.y + p2.y)/2} });
      }
      
    } else if (tag === 'circle') {
      const cx = parseFloat(element.getAttribute('cx') || 0);
      const cy = parseFloat(element.getAttribute('cy') || 0);
      const r = parseFloat(element.getAttribute('r') || 0);
      
      // Approximate circle with 8 points
      for (let i = 0; i < 8; i++) {
        const angle1 = (2 * Math.PI * i) / 8;
        const angle2 = (2 * Math.PI * (i + 1)) / 8;
        
        const p1 = transformPoint({x: cx + r * Math.cos(angle1), y: cy + r * Math.sin(angle1)});
        const p2 = transformPoint({x: cx + r * Math.cos(angle2), y: cy + r * Math.sin(angle2)});
        
        edges.push({ 
          p1, p2, 
          isCurve: true, 
          midPt: transformPoint({x: cx + r * Math.cos((angle1 + angle2)/2), y: cy + r * Math.sin((angle1 + angle2)/2)}),
          normal: { x: Math.cos((angle1 + angle2)/2), y: Math.sin((angle1 + angle2)/2) }
        });
      }
      
    } else if (tag === 'ellipse') {
      const cx = parseFloat(element.getAttribute('cx') || 0);
      const cy = parseFloat(element.getAttribute('cy') || 0);
      const rx = parseFloat(element.getAttribute('rx') || 0);
      const ry = parseFloat(element.getAttribute('ry') || 0);
      
      // Approximate ellipse with 8 points
      for (let i = 0; i < 8; i++) {
        const angle1 = (2 * Math.PI * i) / 8;
        const angle2 = (2 * Math.PI * (i + 1)) / 8;
        
        const p1 = transformPoint({x: cx + rx * Math.cos(angle1), y: cy + ry * Math.sin(angle1)});
        const p2 = transformPoint({x: cx + rx * Math.cos(angle2), y: cy + ry * Math.sin(angle2)});
        
        edges.push({ 
          p1, p2, 
          isCurve: true, 
          midPt: transformPoint({x: cx + rx * Math.cos((angle1 + angle2)/2), y: cy + ry * Math.sin((angle1 + angle2)/2)}),
          normal: { x: Math.cos((angle1 + angle2)/2), y: Math.sin((angle1 + angle2)/2) }
        });
      }
    }
    
    // For other shapes (like paths), we would need more complex parsing
    // but this covers the common plot shapes
    
    // Calculate centroid from edges
    let sumX = 0, sumY = 0, count = 0;
    edges.forEach(edge => {
      sumX += edge.p1.x + edge.p2.x;
      sumY += edge.p1.y + edge.p2.y;
      count += 2;
    });
    
    const centroid = count > 0 ? { x: sumX / count, y: sumY / count } : { x: 0, y: 0 };
    
    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    edges.forEach(edge => {
      minX = Math.min(minX, edge.p1.x, edge.p2.x);
      minY = Math.min(minY, edge.p1.y, edge.p2.y);
      maxX = Math.max(maxX, edge.p1.x, edge.p2.x);
      maxY = Math.max(maxY, edge.p1.y, edge.p2.y);
    });
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    return { edges, centroid, width, height };
    
  } catch (error) {
    console.error('Error extracting SVG geometry:', error);
    return null;
  }
}