import { getPreviewUrl } from '@/lib/api';
import useBlobUrl from '@/hooks/useBlobUrl';

export function RegionRenderer({ region, state, vs }) {
  const { x,y,w,h,rotation,crop } = state;
  const rcx=x+w/2, rcy=y+h/2;
  const rawUrl  = region.architectureFileId ? getPreviewUrl(region.architectureFileId) : null;
  const { url: blobUrl, width: natW, height: natH } = useBlobUrl(rawUrl);
  const color   = '#6ee7b7';
  const clipId     = `cr-${region.id}`;
  const cropClipId = `cc-${region.id}`;
  
  const fw = natW || region.architectureFile?.imageWidth || 1000;
  const fh = natH || region.architectureFile?.imageHeight || 1000;
  const rw = region.width || fw;
  const rh = region.height || fh;
  const rx = region.x ?? 0;
  const ry = region.y ?? 0;

  const scaleX = w / rw;
  const scaleY = h / rh;

  const imgX = x - (rx + fw/2) * scaleX;
  const imgY = y - (ry + fh/2) * scaleY;
  const imgW = fw * scaleX;
  const imgH = fh * scaleY;

  const ec = crop?.type === 'rect'
    ? { cx: crop.cx, cy: crop.cy, cw: crop.cw, ch: crop.ch }
    : { cx: 0, cy: 0, cw: w, ch: h };

  let cropPolyStr = null;
  if (crop?.type === 'poly') {
    cropPolyStr = crop.points.map(p => `${x + p.x},${y + p.y}`).join(' ');
  } else if (!crop && region.shapeType === 'POLYGON' && Array.isArray(region.points)) {
    cropPolyStr = region.points.map(p => {
      const cx = x + (p.x - rx) * scaleX;
      const cy = y + (p.y - ry) * scaleY;
      return `${cx},${cy}`;
    }).join(' ');
  }

  return (
    <g transform={`rotate(${rotation},${rcx},${rcy})`} style={{ pointerEvents: 'none' }}>
      <defs>
        <clipPath id={clipId}><rect x={x} y={y} width={w} height={h}/></clipPath>
        <clipPath id={cropClipId}>
          {cropPolyStr
            ? <polygon points={cropPolyStr}/>
            : <rect x={x + ec.cx} y={y + ec.cy} width={ec.cw} height={ec.ch}/>}
        </clipPath>
      </defs>
      {blobUrl && crop && (
        <image href={blobUrl} x={imgX} y={imgY} width={imgW} height={imgH}
          preserveAspectRatio="none" clipPath={`url(#${clipId})`} opacity={0.18}/>
      )}
      {blobUrl
        ? <image href={blobUrl} x={imgX} y={imgY} width={imgW} height={imgH}
            preserveAspectRatio="none" clipPath={`url(#${cropClipId})`}/>
        : <>
            <rect x={x} y={y} width={w} height={h} fill="#1c2333"
              stroke={color} strokeWidth={1/vs} strokeDasharray={`${4/vs} ${3/vs}`}/>
            <text x={rcx} y={rcy} textAnchor="middle" dominantBaseline="middle"
              fill="#4b5563" fontSize={11/vs} fontFamily="monospace"
              style={{ userSelect:'none' }}>
              {rawUrl ? 'Loading…' : 'No image'}
            </text>
          </>
      }
      {cropPolyStr ? (
        <polygon points={cropPolyStr} fill="none"
          stroke={color} strokeWidth={1.5/vs} strokeDasharray={`${5/vs} ${3/vs}`}/>
      ) : (
        <rect x={x} y={y} width={w} height={h} fill="none"
          stroke={color} strokeWidth={1.5/vs} strokeDasharray={`${5/vs} ${3/vs}`}/>
      )}
      <text x={x+3/vs} y={y-5/vs} fill={color} fontSize={11/vs} fontFamily="monospace"
        style={{ userSelect:'none' }}>
        {region.name}{crop ? ' ✂' : ''}
      </text>
    </g>
  );
}