export function parseTransform(str) {
  let tx = 0, ty = 0, rot = 0, sx = 1, sy = 1;
  if (!str) return { tx, ty, rot, sx, sy };
  
  // Find the FIRST translate for base tx, ty
  const tMatch = str.match(/translate\(([-\d.]+)[,\s]+([-\d.]+)\)/);
  if (tMatch) { tx = parseFloat(tMatch[1]); ty = parseFloat(tMatch[2]); }
  
  const rMatch = str.match(/rotate\(([-\d.]+)/);
  if (rMatch) { rot = parseFloat(rMatch[1]); }
  
  const sMatch = str.match(/scale\(([-\d.]+)(?:[,\s]+([-\d.]+))?\)/);
  if (sMatch) { sx = parseFloat(sMatch[1]); sy = sMatch[2] ? parseFloat(sMatch[2]) : sx; }
  
  return { tx, ty, rot, sx, sy };
}

export function serializeTransform(t) {
  if (!t) return '';
  const parts = [];
  if (t.tx !== 0 || t.ty !== 0) parts.push(`translate(${t.tx}, ${t.ty})`);
  // If we have center coordinates we need to rotate around them, but we'll bake that into rot via TransformControls later, 
  // or store cx, cy in transform object if needed. For now, we trust the raw string if we just manipulate sx, sy, tx, ty.
  if (t.rot !== 0) parts.push(`rotate(${t.rot})`);
  if (t.sx !== 1 || t.sy !== 1) parts.push(`scale(${t.sx}, ${t.sy})`);
  return parts.join(' ');
}

function domNodeToShape(node) {
  if (node.nodeType !== 1) return null; // Element nodes only
  
  const shape = {
    id: node.id || `cad-shape-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    type: node.tagName.toLowerCase(),
    attributes: {},
    transform: { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1 },
    children: []
  };

  // Skip definitions and metadata
  if (['defs', 'style', 'title', 'desc', 'metadata'].includes(shape.type)) {
    return null; 
  }

  const attrs = node.attributes;
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i];
    if (attr.name === 'id') continue;
    if (attr.name === 'transform') {
      shape.transform = parseTransform(attr.value);
      shape.rawTransform = attr.value; // Store the exact string for fidelity if we can't fully parse
      continue;
    }
    shape.attributes[attr.name] = attr.value;
  }

  // Text content
  if (shape.type === 'text' || shape.type === 'tspan') {
    shape.textContent = node.textContent;
  }

  // Recursively process children (for groups <g>)
  const childNodes = Array.from(node.childNodes);
  for (const child of childNodes) {
    const childShape = domNodeToShape(child);
    if (childShape) {
      shape.children.push(childShape);
    }
  }

  return shape;
}

export function parseSvgStringToState(svgString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgEl = doc.querySelector('svg');
  
  if (!svgEl) return { viewBox: '0 0 100 100', shapes: [] };

  const viewBox = svgEl.getAttribute('viewBox') || '0 0 100 100';
  
  const shapes = [];
  const children = Array.from(svgEl.childNodes);
  
  for (const child of children) {
    const shape = domNodeToShape(child);
    if (shape) {
      shapes.push(shape);
    }
  }
  
  return { viewBox, shapes };
}

export function serializeStateToSvgString(shapes, viewBox) {
  const renderShape = (shape) => {
    let attrStr = Object.entries(shape.attributes)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');
      
    // Handle transform
    let tStr = '';
    if (shape.rawTransform) {
      tStr = `transform="${shape.rawTransform}"`;
    } else {
      const serialized = serializeTransform(shape.transform);
      if (serialized) tStr = `transform="${serialized}"`;
    }

    if (tStr) attrStr += ` ${tStr}`;

    const innerContent = (shape.children || []).map(renderShape).join('\n');
    const textContent = shape.textContent || '';
    
    // Auto-closing tags for elements without children/text
    if (!innerContent && !textContent && shape.type !== 'g' && shape.type !== 'text') {
      return `<${shape.type} id="${shape.id}" ${attrStr} />`;
    }
    
    return `<${shape.type} id="${shape.id}" ${attrStr}>${textContent}${innerContent}</${shape.type}>`;
  };

  const shapesXml = shapes.map(renderShape).join('\n  ');
  
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" height="100%">
  ${shapesXml}
</svg>`;
}
