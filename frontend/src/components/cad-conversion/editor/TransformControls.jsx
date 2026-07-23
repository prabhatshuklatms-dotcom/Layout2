import React, { useEffect, useState, useRef } from 'react';

const computeTightBBox = (type, attrs) => {
  if (type === 'line') {
    const x1 = parseFloat(attrs.x1), y1 = parseFloat(attrs.y1);
    const x2 = parseFloat(attrs.x2), y2 = parseFloat(attrs.y2);
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1)
    };
  } else if (type === 'polyline') {
    const pts = (attrs.points || '').trim().split(/[\s,]+/);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      if (pts[i] && pts[i+1]) {
        const x = parseFloat(pts[i]), y = parseFloat(pts[i+1]);
        if (!isNaN(x)) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
        if (!isNaN(y)) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      }
    }
    return { x: minX === Infinity ? 0 : minX, y: minY === Infinity ? 0 : minY, width: maxX === -Infinity ? 0 : maxX - minX, height: maxY === -Infinity ? 0 : maxY - minY };
  } else if (type === 'path') {
    const dStr = attrs.d || '';
    const regex = /([a-zA-Z]+)|([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)/g;
    const tokens = [];
    let match;
    while ((match = regex.exec(dStr)) !== null) tokens.push(match[0]);
    
    if (tokens.length >= 8 && tokens[0] === 'M' && (tokens[3] === 'Q' || tokens[3] === 'q')) {
      const p0x = parseFloat(tokens[1]), p0y = parseFloat(tokens[2]);
      const p1x = parseFloat(tokens[4]), p1y = parseFloat(tokens[5]);
      const p2x = parseFloat(tokens[6]), p2y = parseFloat(tokens[7]);
      
      const getExtrema = (p0, p1, p2) => {
        let min = Math.min(p0, p2);
        let max = Math.max(p0, p2);
        const denom = p0 - 2 * p1 + p2;
        if (Math.abs(denom) > 1e-12) {
          const t = (p0 - p1) / denom;
          if (t > 0 && t < 1) {
            const val = (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
            min = Math.min(min, val);
            max = Math.max(max, val);
          }
        }
        return { min, max };
      };
      
      const xExt = getExtrema(p0x, p1x, p2x);
      const yExt = getExtrema(p0y, p1y, p2y);
      return { x: xExt.min, y: yExt.min, width: xExt.max - xExt.min, height: yExt.max - yExt.min };
    } else {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < tokens.length; i++) {
        if (!isNaN(tokens[i]) && i + 1 < tokens.length && !isNaN(tokens[i+1])) {
          const x = parseFloat(tokens[i]), y = parseFloat(tokens[i+1]);
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
          i++;
        }
      }
      return { x: minX === Infinity ? 0 : minX, y: minY === Infinity ? 0 : minY, width: maxX === -Infinity ? 0 : maxX - minX, height: maxY === -Infinity ? 0 : maxY - minY };
    }
  }
  return { x: 0, y: 0, width: 0, height: 0 };
};

const calculateArrowPath = (start, end, strokeW) => {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const dist = Math.hypot(end.x - start.x, end.y - start.y);
  const headLen = Math.min(strokeW * 10, dist * 0.3);
  const angleOffset = Math.PI / 6;
  
  const head1 = {
    x: end.x - headLen * Math.cos(angle - angleOffset),
    y: end.y - headLen * Math.sin(angle - angleOffset)
  };
  const head2 = {
    x: end.x - headLen * Math.cos(angle + angleOffset),
    y: end.y - headLen * Math.sin(angle + angleOffset)
  };
  return `M ${head1.x} ${head1.y} L ${end.x} ${end.y} L ${head2.x} ${head2.y} M ${start.x} ${start.y} L ${end.x} ${end.y}`;
};

export default function TransformControls({ shape, shapeId, svgRef, scale, onTransformCommit }) {
  const [bbox, setBBox] = useState(null);
  const [liveTransformStr, setLiveTransformStr] = useState(null);
  const liveAttributesRef = useRef(null);
  
  const isDragging = useRef(false);
  const dragType = useRef(null);
  const startPos = useRef({ x: 0, y: 0 });
  const startTransformStr = useRef('');
  const startAttributes = useRef(null);
  const reqFrame = useRef(null);

  const isGeometryType = shape && ['line', 'polyline', 'path'].includes(shape.type);

  const applyMatrixToAttributes = (attrs, type, matrix) => {
    const transformPt = (x, y) => {
      return {
        x: matrix.a * x + matrix.c * y + matrix.e,
        y: matrix.b * x + matrix.d * y + matrix.f
      };
    };

    const newAttrs = { ...attrs };
    if (type === 'line') {
      const p1 = transformPt(parseFloat(attrs.x1), parseFloat(attrs.y1));
      const p2 = transformPt(parseFloat(attrs.x2), parseFloat(attrs.y2));
      newAttrs.x1 = p1.x; newAttrs.y1 = p1.y;
      newAttrs.x2 = p2.x; newAttrs.y2 = p2.y;
    } else if (type === 'polyline') {
      const pts = (attrs.points || '').trim().split(/[\s,]+/);
      for (let i = 0; i < pts.length; i += 2) {
        if (pts[i] && pts[i+1]) {
          const p = transformPt(parseFloat(pts[i]), parseFloat(pts[i+1]));
          pts[i] = p.x; pts[i+1] = p.y;
        }
      }
      newAttrs.points = pts.join(' ');
    } else if (type === 'path') {
      const dStr = attrs.d || '';
      const regex = /([a-zA-Z]+)|([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)/g;
      const tokens = [];
      let match;
      while ((match = regex.exec(dStr)) !== null) tokens.push(match[0]);
      
      for (let i = 0; i < tokens.length; i++) {
        if (!isNaN(tokens[i]) && i + 1 < tokens.length && !isNaN(tokens[i+1])) {
          const p = transformPt(parseFloat(tokens[i]), parseFloat(tokens[i+1]));
          tokens[i] = p.x;
          tokens[i+1] = p.y;
          i++;
        }
      }
      newAttrs.d = tokens.join(' ');
    }
    return newAttrs;
  };

  useEffect(() => {
    if (!svgRef.current || !shapeId || !isGeometryType) return;
    const el = svgRef.current.querySelector(`#${shapeId}`);
    if (el) {
      const transformStr = el.getAttribute('transform');
      if (transformStr && transformStr.trim() !== '') {
        const matrix = el.transform?.baseVal?.consolidate()?.matrix;
        if (matrix && (matrix.a !== 1 || matrix.b !== 0 || matrix.c !== 0 || matrix.d !== 1 || matrix.e !== 0 || matrix.f !== 0)) {
          const bakedAttrs = applyMatrixToAttributes(shape.attributes, shape.type, matrix);
          if (onTransformCommit) {
            onTransformCommit('', bakedAttrs);
          }
        }
      }
    }
  }, [shapeId, shape?.rawTransform, isGeometryType]);

  const updateBBox = () => {
    if (!svgRef.current || !shapeId) return;
    if (isDragging.current) return;
    
    const el = svgRef.current.querySelector(`#${shapeId}`);
    if (!el) {
      setBBox(null);
      return;
    }

    try {
      if (isGeometryType) {
        startTransformStr.current = el.getAttribute('transform') || '';
        startAttributes.current = { ...shape.attributes };
        const tightBox = computeTightBBox(shape.type, shape.attributes);
        setBBox(tightBox);
        setLiveTransformStr(null);
        liveAttributesRef.current = null;
      } else {
        const box = el.getBBox();
        if (box.width === 0 && box.height === 0 && !isGeometryType) return;
        setBBox({
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height
        });
        startTransformStr.current = el.getAttribute('transform') || '';
        setLiveTransformStr(null);
        liveAttributesRef.current = null;
      }
    } catch (e) {}
  };

  useEffect(() => {
    updateBBox();
    const interval = setInterval(updateBBox, 100);
    return () => clearInterval(interval);
  }, [shapeId, svgRef, shape]);

  if (!bbox) return null;

  const parseTransform = (str) => {
    let tx = 0, ty = 0, rot = 0, sx = 1, sy = 1;
    if (str) {
      const tMatch = str.match(/translate\(([^,]+)[, ]+([^)]+)\)/);
      if (tMatch) { tx = parseFloat(tMatch[1]); ty = parseFloat(tMatch[2]); }
      const rMatch = str.match(/rotate\(([^,)]+)/);
      if (rMatch) { rot = parseFloat(rMatch[1]); }
      const sMatch = str.match(/scale\(([^,]+)(?:[, ]+([^)]+))?\)/);
      if (sMatch) { sx = parseFloat(sMatch[1]); sy = sMatch[2] ? parseFloat(sMatch[2]) : sx; }
    }
    return { tx, ty, rot, sx, sy };
  };

  const getSvgPoint = (clientX, clientY) => {
    const svgEl = svgRef.current?.querySelector('svg');
    if (!svgEl) return { x: clientX, y: clientY };
    const pt = svgEl.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    try {
      const ctm = svgEl.getScreenCTM();
      return pt.matrixTransform(ctm.inverse());
    } catch(e) {
      return { x: clientX, y: clientY };
    }
  };

  const getSvgScale = () => {
    const svgEl = svgRef.current?.querySelector('svg');
    if (!svgEl) return scale;
    try {
      return svgEl.getScreenCTM().a;
    } catch(e) {
      return scale;
    }
  };

  const rotatePoint = (x, y, cx, cy, angleDeg) => {
    const rad = angleDeg * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const nx = cx + (x - cx) * cos - (y - cy) * sin;
    const ny = cy + (x - cx) * sin + (y - cy) * cos;
    return { x: nx, y: ny };
  };



  const handlePointerDown = (e, type) => {
    e.stopPropagation();
    isDragging.current = true;
    dragType.current = type;
    startPos.current = { x: e.clientX, y: e.clientY };
    
    const el = svgRef.current.querySelector(`#${shapeId}`);
    if (el) {
      startTransformStr.current = el.getAttribute('transform') || '';
      const rect = el.getBoundingClientRect();
      startPos.current.centerX = rect.left + rect.width / 2;
      startPos.current.centerY = rect.top + rect.height / 2;
      

    }
    
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const applyGeometryScale = (attrs, type, pivotX, pivotY, sx, sy) => {
    const newAttrs = { ...attrs };
    const transformPt = (x, y) => {
      return {
        x: pivotX + (x - pivotX) * sx,
        y: pivotY + (y - pivotY) * sy
      };
    };

    if (type === 'line') {
      const p1 = transformPt(parseFloat(attrs.x1), parseFloat(attrs.y1));
      const p2 = transformPt(parseFloat(attrs.x2), parseFloat(attrs.y2));
      newAttrs.x1 = p1.x; newAttrs.y1 = p1.y;
      newAttrs.x2 = p2.x; newAttrs.y2 = p2.y;
    } else if (type === 'polyline') {
      const pts = (attrs.points || '').trim().split(/[\s,]+/);
      for (let i = 0; i < pts.length; i += 2) {
        if (pts[i] && pts[i+1]) {
          const p = transformPt(parseFloat(pts[i]), parseFloat(pts[i+1]));
          pts[i] = p.x; pts[i+1] = p.y;
        }
      }
      newAttrs.points = pts.join(' ');
    } else if (type === 'path') {
      const dStr = attrs.d || '';
      const regex = /([a-zA-Z]+)|([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)/g;
      const tokens = [];
      let match;
      while ((match = regex.exec(dStr)) !== null) tokens.push(match[0]);
      
      for (let i = 0; i < tokens.length; i++) {
        if (!isNaN(tokens[i]) && i + 1 < tokens.length && !isNaN(tokens[i+1])) {
          const p = transformPt(parseFloat(tokens[i]), parseFloat(tokens[i+1]));
          tokens[i] = p.x;
          tokens[i+1] = p.y;
          i++;
        }
      }
      newAttrs.d = tokens.join(' ');
    }
    return newAttrs;
  };

  const applyGeometryDelta = (attrs, type, dx, dy, rotDelta, rotCx, rotCy) => {
    const newAttrs = { ...attrs };
    
    const transformPt = (x, y) => {
      let nx = x + dx;
      let ny = y + dy;
      if (rotDelta !== 0) {
        const rotated = rotatePoint(nx, ny, rotCx, rotCy, rotDelta);
        nx = rotated.x;
        ny = rotated.y;
      }
      return { x: nx, y: ny };
    };

    if (type === 'line') {
      const p1 = transformPt(parseFloat(attrs.x1), parseFloat(attrs.y1));
      const p2 = transformPt(parseFloat(attrs.x2), parseFloat(attrs.y2));
      newAttrs.x1 = p1.x; newAttrs.y1 = p1.y;
      newAttrs.x2 = p2.x; newAttrs.y2 = p2.y;
    } else if (type === 'polyline') {
      const pts = (attrs.points || '').trim().split(/[\s,]+/);
      for (let i = 0; i < pts.length; i += 2) {
        if (pts[i] && pts[i+1]) {
          const p = transformPt(parseFloat(pts[i]), parseFloat(pts[i+1]));
          pts[i] = p.x; pts[i+1] = p.y;
        }
      }
      newAttrs.points = pts.join(' ');
    } else if (type === 'path') {
      if (attrs['data-cad-type'] === 'arrow') {
        const p1 = transformPt(parseFloat(attrs['data-start-x']), parseFloat(attrs['data-start-y']));
        const p2 = transformPt(parseFloat(attrs['data-end-x']), parseFloat(attrs['data-end-y']));
        newAttrs['data-start-x'] = p1.x; newAttrs['data-start-y'] = p1.y;
        newAttrs['data-end-x'] = p2.x; newAttrs['data-end-y'] = p2.y;
        newAttrs.d = calculateArrowPath(p1, p2, parseFloat(attrs['stroke-width'] || 2));
      } else {
        const dStr = attrs.d || '';
        const regex = /([a-zA-Z]+)|([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)/g;
        const tokens = [];
        let match;
        while ((match = regex.exec(dStr)) !== null) tokens.push(match[0]);
        
        for (let i = 0; i < tokens.length; i++) {
          if (!isNaN(tokens[i]) && i + 1 < tokens.length && !isNaN(tokens[i+1])) {
            const p = transformPt(parseFloat(tokens[i]), parseFloat(tokens[i+1]));
            tokens[i] = p.x;
            tokens[i+1] = p.y;
            i++;
          }
        }
        newAttrs.d = tokens.join(' ');
      }
    }
    return newAttrs;
  };

  const handlePointerMove = (e) => {
    if (!isDragging.current) return;
    if (reqFrame.current) cancelAnimationFrame(reqFrame.current);
    
    reqFrame.current = requestAnimationFrame(() => {
      const el = svgRef.current.querySelector(`#${shapeId}`);
      if (!el) return;

      const startSvg = getSvgPoint(startPos.current.x, startPos.current.y);
      const currentSvg = getSvgPoint(e.clientX, e.clientY);
      const dx = currentSvg.x - startSvg.x;
      const dy = currentSvg.y - startSvg.y;

      // GEOMETRY BAKING LOGIC
      if (isGeometryType) {
        let attrs = { ...startAttributes.current };
        
        if (dragType.current === 'move') {
          attrs = applyGeometryDelta(attrs, shape.type, dx, dy, 0, 0, 0);
        } else if (dragType.current === 'rotate') {
          const centerScreenX = startPos.current.centerX;
          const centerScreenY = startPos.current.centerY;
          const startAngle = Math.atan2(startPos.current.y - centerScreenY, startPos.current.x - centerScreenX);
          const currentAngle = Math.atan2(e.clientY - centerScreenY, e.clientX - centerScreenX);
          let rotDelta = (currentAngle - startAngle) * (180 / Math.PI);
          if (e.shiftKey) rotDelta = Math.round(rotDelta / 15) * 15;
          
          const startBbox = computeTightBBox(shape.type, startAttributes.current);
          const rotCx = startBbox.x + startBbox.width / 2;
          const rotCy = startBbox.y + startBbox.height / 2;
          attrs = applyGeometryDelta(attrs, shape.type, 0, 0, rotDelta, rotCx, rotCy);
        } else if (dragType.current.startsWith('resize')) {
          const startBbox = computeTightBBox(shape.type, startAttributes.current);
          const w = startBbox.width || 1;
          const h = startBbox.height || 1;
          
          let sx = 1, sy = 1;
          let pivotX = startBbox.x;
          let pivotY = startBbox.y;
          
          if (dragType.current.includes('e')) {
            sx = (w + dx) / w;
            pivotX = startBbox.x;
          } else if (dragType.current.includes('w')) {
            sx = (w - dx) / w;
            pivotX = startBbox.x + w;
          }
          
          if (dragType.current.includes('s')) {
            sy = (h + dy) / h;
            pivotY = startBbox.y;
          } else if (dragType.current.includes('n')) {
            sy = (h - dy) / h;
            pivotY = startBbox.y + h;
          }
          
          if (e.shiftKey) {
             const maxS = Math.max(Math.abs(sx), Math.abs(sy));
             sx = sx < 0 ? -maxS : maxS;
             sy = sy < 0 ? -maxS : maxS;
          }
          
          if (Math.abs(sx) < 0.01) sx = sx < 0 ? -0.01 : 0.01;
          if (Math.abs(sy) < 0.01) sy = sy < 0 ? -0.01 : 0.01;
          
          attrs = applyGeometryScale(attrs, shape.type, pivotX, pivotY, sx, sy);
        } else if (dragType.current.startsWith('point-')) {
          // Point Editing logic (Identity Transform Space)
          const localPt = currentSvg; // Since Geometry has no transforms, svg point == local point
          
          if (shape.type === 'line') {
            if (dragType.current === 'point-start') {
              attrs.x1 = localPt.x; attrs.y1 = localPt.y;
            } else if (dragType.current === 'point-end') {
              attrs.x2 = localPt.x; attrs.y2 = localPt.y;
            }
          } else if (shape.type === 'polyline') {
            const ptIndex = parseInt(dragType.current.split('-')[1]);
            const pts = (startAttributes.current.points || '').trim().split(/[\s,]+/);
            if (ptIndex * 2 + 1 < pts.length) {
              pts[ptIndex * 2] = localPt.x; pts[ptIndex * 2 + 1] = localPt.y;
              attrs.points = pts.join(' ');
            }
          } else if (shape.type === 'path') {
            if (attrs['data-cad-type'] === 'arrow') {
              if (dragType.current === 'point-arrow-start') {
                attrs['data-start-x'] = localPt.x; attrs['data-start-y'] = localPt.y;
              } else if (dragType.current === 'point-arrow-end') {
                attrs['data-end-x'] = localPt.x; attrs['data-end-y'] = localPt.y;
              }
              const p1 = { x: parseFloat(attrs['data-start-x']), y: parseFloat(attrs['data-start-y']) };
              const p2 = { x: parseFloat(attrs['data-end-x']), y: parseFloat(attrs['data-end-y']) };
              attrs.d = calculateArrowPath(p1, p2, parseFloat(attrs['stroke-width'] || 2));
            } else {
              const dStr = startAttributes.current.d || '';
              const regex = /([a-zA-Z]+)|([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)/g;
              const tokens = [];
              let match;
              while ((match = regex.exec(dStr)) !== null) tokens.push(match[0]);
              
              const ptId = dragType.current.replace('point-path-', '');
              const pairIndex = parseInt(ptId);
              
              // Generic path / arrow editing
              let pairCount = 0;
              for (let i = 0; i < tokens.length; i++) {
                if (!isNaN(tokens[i]) && i + 1 < tokens.length && !isNaN(tokens[i+1])) {
                  if (pairCount === pairIndex) {
                    tokens[i] = localPt.x;
                    tokens[i+1] = localPt.y;
                    break;
                  }
                  pairCount++;
                  i++;
                }
              }
              attrs.d = tokens.join(' ');
            }
          }
        }

        // Apply raw attributes instantly to the DOM node for visual feedback
        if (shape.type === 'line') {
          el.setAttribute('x1', attrs.x1); el.setAttribute('y1', attrs.y1);
          el.setAttribute('x2', attrs.x2); el.setAttribute('y2', attrs.y2);
        } else if (shape.type === 'polyline') {
          el.setAttribute('points', attrs.points);
        } else if (shape.type === 'path') {
          el.setAttribute('d', attrs.d);
        }
        
        // Geometry has no CSS transform
        el.setAttribute('transform', '');
        setLiveTransformStr('');
        liveAttributesRef.current = attrs;
        return;
      }

      // STANDARD BOX TRANSFORM LOGIC
      let { tx, ty, rot, sx, sy } = parseTransform(startTransformStr.current);
      const cx = bbox.x + bbox.width / 2;
      const cy = bbox.y + bbox.height / 2;

      if (dragType.current === 'move') {
        tx += dx;
        ty += dy;
      } else if (dragType.current === 'rotate') {
        const centerScreenX = startPos.current.centerX;
        const centerScreenY = startPos.current.centerY;
        const startAngle = Math.atan2(startPos.current.y - centerScreenY, startPos.current.x - centerScreenX);
        const currentAngle = Math.atan2(e.clientY - centerScreenY, e.clientX - centerScreenX);
        rot += (currentAngle - startAngle) * (180 / Math.PI);
        if (e.shiftKey) rot = Math.round(rot / 15) * 15;
      } else if (dragType.current.startsWith('resize')) {
        const isUniform = e.shiftKey;
        const w = bbox.width || 1;
        const h = bbox.height || 1;
        const scaleX = (w + (dragType.current.includes('e') ? dx : dragType.current.includes('w') ? -dx : 0)) / w;
        const scaleY = (h + (dragType.current.includes('s') ? dy : dragType.current.includes('n') ? -dy : 0)) / h;
        sx *= isUniform ? Math.max(scaleX, scaleY) : scaleX;
        sy *= isUniform ? Math.max(scaleX, scaleY) : scaleY;
        
        if (Math.abs(sx) < 0.01) sx = sx < 0 ? -0.01 : 0.01;
        if (Math.abs(sy) < 0.01) sy = sy < 0 ? -0.01 : 0.01;
      }

      const transformStr = `translate(${tx}, ${ty}) translate(${cx}, ${cy}) rotate(${rot}) scale(${sx}, ${sy}) translate(${-cx}, ${-cy})`;
      el.setAttribute('transform', transformStr);
      setLiveTransformStr(transformStr);
    });
  };

  const handlePointerUp = () => {
    isDragging.current = false;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    if (onTransformCommit) {
      const el = svgRef.current?.querySelector(`#${shapeId}`);
      if (el) {
        if (isGeometryType) {
          onTransformCommit('', liveAttributesRef.current);
          liveAttributesRef.current = null;
        } else {
          onTransformCommit(el.getAttribute('transform'), liveAttributesRef.current);
          liveAttributesRef.current = null;
        }
      }
    }
  };

  let actualScale = getSvgScale();
  if (!actualScale || isNaN(actualScale) || actualScale === 0) actualScale = scale || 1;
  const handleSize = 10 / actualScale;
  const strokeW = 2 / actualScale;
  const rotLineLen = 25 / actualScale;

  const currentTransform = liveTransformStr !== null ? liveTransformStr : startTransformStr.current;
  const currentAttrs = liveAttributesRef.current || startAttributes.current || {};

  const renderMoveHandle = (cx, cy) => {
    const size = 12 / actualScale;
    const stroke = 1.5 / actualScale;
    return (
      <g transform={`translate(${cx}, ${cy})`} cursor="move" pointerEvents="all" onPointerDown={(e) => handlePointerDown(e, 'move')}>
        <circle cx={0} cy={0} r={size} fill="rgba(255,255,255,0.9)" stroke="#3b82f6" strokeWidth={stroke} />
        <path d={`M ${-size*0.6} 0 L ${size*0.6} 0 M 0 ${-size*0.6} L 0 ${size*0.6}`} stroke="#3b82f6" strokeWidth={stroke} />
        <path d={`M ${-size*0.6} 0 L ${-size*0.3} ${-size*0.3} M ${-size*0.6} 0 L ${-size*0.3} ${size*0.3}`} stroke="#3b82f6" strokeWidth={stroke} fill="none" />
        <path d={`M ${size*0.6} 0 L ${size*0.3} ${-size*0.3} M ${size*0.6} 0 L ${size*0.3} ${size*0.3}`} stroke="#3b82f6" strokeWidth={stroke} fill="none" />
        <path d={`M 0 ${-size*0.6} L ${-size*0.3} ${-size*0.3} M 0 ${-size*0.6} L ${size*0.3} ${-size*0.3}`} stroke="#3b82f6" strokeWidth={stroke} fill="none" />
        <path d={`M 0 ${size*0.6} L ${-size*0.3} ${size*0.3} M 0 ${size*0.6} L ${size*0.3} ${size*0.3}`} stroke="#3b82f6" strokeWidth={stroke} fill="none" />
      </g>
    );
  };

  const renderGeometryControls = () => {
    const points = [];
    const dynBbox = computeTightBBox(shape.type, currentAttrs);
    
    if (shape.type === 'line') {
      points.push({ id: 'start', x: parseFloat(currentAttrs.x1 ?? shape.attributes.x1), y: parseFloat(currentAttrs.y1 ?? shape.attributes.y1) });
      points.push({ id: 'end', x: parseFloat(currentAttrs.x2 ?? shape.attributes.x2), y: parseFloat(currentAttrs.y2 ?? shape.attributes.y2) });
    } else if (shape.type === 'polyline') {
      const ptsStr = currentAttrs.points ?? shape.attributes.points ?? '';
      const pts = ptsStr.trim().split(/[\s,]+/);
      for (let i = 0; i < pts.length; i += 2) {
        if (pts[i] && pts[i+1]) {
          points.push({ id: `${i/2}`, x: parseFloat(pts[i]), y: parseFloat(pts[i+1]) });
        }
      }
    } else if (shape.type === 'path') {
      if (currentAttrs['data-cad-type'] === 'arrow' || shape.attributes['data-cad-type'] === 'arrow') {
        const ax1 = parseFloat(currentAttrs['data-start-x'] ?? shape.attributes['data-start-x']);
        const ay1 = parseFloat(currentAttrs['data-start-y'] ?? shape.attributes['data-start-y']);
        const ax2 = parseFloat(currentAttrs['data-end-x'] ?? shape.attributes['data-end-x']);
        const ay2 = parseFloat(currentAttrs['data-end-y'] ?? shape.attributes['data-end-y']);
        points.push({ id: 'arrow-start', x: ax1, y: ay1 });
        points.push({ id: 'arrow-end', x: ax2, y: ay2 });
      } else {
        const dStr = currentAttrs.d ?? shape.attributes.d ?? '';
        const regex = /([a-zA-Z]+)|([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)/g;
        const tokens = [];
        let match;
        while ((match = regex.exec(dStr)) !== null) tokens.push(match[0]);
        
        let pairCount = 0;
        for (let i = 0; i < tokens.length; i++) {
          if (!isNaN(tokens[i]) && i + 1 < tokens.length && !isNaN(tokens[i+1])) {
            points.push({ id: `path-${pairCount}`, x: parseFloat(tokens[i]), y: parseFloat(tokens[i+1]) });
            pairCount++;
            i++; 
          }
        }
      }
    }

    // Geometry is always in global space now (transform="").
    return (
      <g pointerEvents="all">


        {/* Ghost stroke for dragging the whole geometry intuitively without blocking clicks */}
        {shape.type === 'line' && (
           <line x1={points[0]?.x} y1={points[0]?.y} x2={points[1]?.x} y2={points[1]?.y} stroke="transparent" strokeWidth={20 / actualScale} cursor="move" pointerEvents="stroke" onPointerDown={(e) => handlePointerDown(e, 'move')} />
        )}
        {shape.type === 'polyline' && (
           <polyline points={currentAttrs.points ?? shape.attributes.points} stroke="transparent" strokeWidth={20 / actualScale} fill="none" cursor="move" pointerEvents="stroke" onPointerDown={(e) => handlePointerDown(e, 'move')} />
        )}
        {shape.type === 'path' && (
           <path d={currentAttrs.d ?? shape.attributes.d} stroke="transparent" strokeWidth={20 / actualScale} fill="none" cursor="move" pointerEvents="stroke" onPointerDown={(e) => handlePointerDown(e, 'move')} />
        )}
        
        {/* Rotation Handle (centered above bounding box top edge) */}
        <line 
          x1={dynBbox.x + dynBbox.width/2} y1={dynBbox.y} x2={dynBbox.x + dynBbox.width/2} y2={dynBbox.y - rotLineLen} 
          stroke="#3b82f6" strokeWidth={strokeW} pointerEvents="none" 
        />
        <circle 
          cx={dynBbox.x + dynBbox.width/2} cy={dynBbox.y - rotLineLen} r={handleSize} 
          fill="#ffffff" stroke="#3b82f6" strokeWidth={strokeW}
          cursor="crosshair" pointerEvents="all"
          onPointerDown={(e) => handlePointerDown(e, 'rotate')}
        />

        {/* Anchor Points */}
        {points.map((pt, index) => (
          <circle 
            key={index}
            cx={pt.x} cy={pt.y} 
            r={handleSize / 1.2} 
            fill="#ffffff" stroke="#3b82f6" strokeWidth={strokeW}
            cursor="crosshair" pointerEvents="all"
            onPointerDown={(e) => handlePointerDown(e, `point-${pt.id}`)}
          />
        ))}

      </g>
    );
  };

  const renderBoxControls = () => {
    return (
      <g transform={currentTransform} pointerEvents="all">
        <rect 
          x={bbox.x} y={bbox.y} width={bbox.width} height={bbox.height} 
          fill="rgba(59, 130, 246, 0.1)" stroke="#3b82f6" strokeWidth={strokeW}
          cursor="move" pointerEvents="all"
          onPointerDown={(e) => handlePointerDown(e, 'move')}
        />

        {/* Central Move Handle */}
        {renderMoveHandle(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2)}
        <line 
          x1={bbox.x + bbox.width/2} y1={bbox.y} x2={bbox.x + bbox.width/2} y2={bbox.y - rotLineLen} 
          stroke="#3b82f6" strokeWidth={strokeW} pointerEvents="none" 
        />
        <circle 
          cx={bbox.x + bbox.width/2} cy={bbox.y - rotLineLen} r={handleSize} 
          fill="#ffffff" stroke="#3b82f6" strokeWidth={strokeW}
          cursor="crosshair" pointerEvents="all"
          onPointerDown={(e) => handlePointerDown(e, 'rotate')}
        />
        {[
          { x: bbox.x, y: bbox.y, cursor: 'nwse-resize', type: 'resize-nw' },
          { x: bbox.x + bbox.width/2, y: bbox.y, cursor: 'ns-resize', type: 'resize-n' },
          { x: bbox.x + bbox.width, y: bbox.y, cursor: 'nesw-resize', type: 'resize-ne' },
          { x: bbox.x + bbox.width, y: bbox.y + bbox.height/2, cursor: 'ew-resize', type: 'resize-e' },
          { x: bbox.x + bbox.width, y: bbox.y + bbox.height, cursor: 'nwse-resize', type: 'resize-se' },
          { x: bbox.x + bbox.width/2, y: bbox.y + bbox.height, cursor: 'ns-resize', type: 'resize-s' },
          { x: bbox.x, y: bbox.y + bbox.height, cursor: 'nesw-resize', type: 'resize-sw' },
          { x: bbox.x, y: bbox.y + bbox.height/2, cursor: 'ew-resize', type: 'resize-w' }
        ].map((pos, index) => (
          <rect 
            key={index}
            x={pos.x - handleSize/2} y={pos.y - handleSize/2} 
            width={handleSize} height={handleSize} 
            fill="#ffffff" stroke="#3b82f6" strokeWidth={strokeW}
            cursor={pos.cursor} pointerEvents="all"
            onPointerDown={(e) => handlePointerDown(e, pos.type)}
          />
        ))}
      </g>
    );
  };

  return isGeometryType ? renderGeometryControls() : renderBoxControls();
}
