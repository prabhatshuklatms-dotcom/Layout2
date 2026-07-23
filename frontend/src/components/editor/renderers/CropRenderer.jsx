'use client'
import {HANDLE_SZ, TOOL} from '../constants'
export function CropRenderer({ state, vs, tool, cropPolyPts, cropDraft, cursorPt }) {
  const { x,y,w,h,rotation,crop } = state;
  const rcx=x+w/2, rcy=y+h/2;
  const hs = HANDLE_SZ/vs;
  const isCropRect = tool===TOOL.CROP_RECT;
  const isCropPoly = tool===TOOL.CROP_POLY;

  return (
    <g transform={`rotate(${rotation},${rcx},${rcy})`} style={{ pointerEvents:'none' }}>

      {/* CROP_RECT: live draft */}
      {isCropRect && cropDraft && cropDraft.cw>0 && (
        <rect x={x+cropDraft.cx} y={y+cropDraft.cy}
          width={cropDraft.cw} height={cropDraft.ch}
          fill="rgba(245,158,11,0.15)" stroke="#f59e0b"
          strokeWidth={1.5/vs} strokeDasharray={`${4/vs} ${3/vs}`}/>
      )}

      {/* CROP_RECT: committed + handles */}
      {isCropRect && crop?.type==='rect' && !cropDraft && (() => {
        const chx=x+crop.cx, chy=y+crop.cy, chw=crop.cw, chh=crop.ch;
        return (<>
          <rect x={chx} y={chy} width={chw} height={chh}
            fill="rgba(245,158,11,0.08)" stroke="#f59e0b" strokeWidth={2/vs}/>
          {[1/3,2/3].flatMap(f=>[
            <line key={`v${f}`} x1={chx+chw*f} y1={chy} x2={chx+chw*f} y2={chy+chh}
              stroke="#f59e0b" strokeWidth={0.5/vs} opacity={0.35}/>,
            <line key={`h${f}`} x1={chx} y1={chy+chh*f} x2={chx+chw} y2={chy+chh*f}
              stroke="#f59e0b" strokeWidth={0.5/vs} opacity={0.35}/>,
          ])}
          {[['nw',chx,chy],['ne',chx+chw,chy],['se',chx+chw,chy+chh],['sw',chx,chy+chh]].map(([c,hx,hy])=>(
            <rect key={c} x={hx-hs/2} y={hy-hs/2} width={hs} height={hs}
              fill="#0a0a0a" stroke="#f59e0b" strokeWidth={1.5/vs}/>
          ))}
        </>);
      })()}

      {/* CROP_POLY: in-progress preview */}
      {isCropPoly && cropPolyPts.length>0 && (() => {
        const svgPts = cropPolyPts.map(p=>`${x+p.x},${y+p.y}`).join(' ');
        const last   = cropPolyPts[cropPolyPts.length-1];
        return (<>
          {cropPolyPts.length>=3 && (
            <polygon points={svgPts} fill="rgba(245,158,11,0.10)"
              stroke="#f59e0b" strokeWidth={1.5/vs} strokeDasharray={`${4/vs} ${3/vs}`}/>
          )}
          {cropPolyPts.length===2 && (
            <line x1={x+cropPolyPts[0].x} y1={y+cropPolyPts[0].y}
              x2={x+last.x} y2={y+last.y}
              stroke="#f59e0b" strokeWidth={1.5/vs} strokeDasharray={`${4/vs} ${3/vs}`}/>
          )}
          {cursorPt && (
            <line x1={x+last.x} y1={y+last.y} x2={x+cursorPt.x} y2={y+cursorPt.y}
              stroke="#f59e0b" strokeWidth={1/vs} strokeDasharray={`${3/vs} ${2/vs}`}/>
          )}
          {cropPolyPts.map((p,i)=>(
            <circle key={i} cx={x+p.x} cy={y+p.y} r={4/vs}
              fill="#f59e0b" stroke="#fff" strokeWidth={1.5/vs}/>
          ))}
        </>);
      })()}

      {/* CROP_POLY: committed polygon */}
      {isCropPoly && crop?.type==='poly' && cropPolyPts.length===0 && (() => {
        const svgPts = crop.points.map(p=>`${x+p.x},${y+p.y}`).join(' ');
        return (<>
          <polygon points={svgPts} fill="rgba(245,158,11,0.08)"
            stroke="#f59e0b" strokeWidth={2/vs}/>
          {crop.points.map((p,i)=>(
            <circle key={i} cx={x+p.x} cy={y+p.y} r={4/vs}
              fill="#f59e0b" stroke="#fff" strokeWidth={1.5/vs}/>
          ))}
        </>);
      })()}

      {/* SELECT mode: applied crop indicator */}
      {tool===TOOL.SELECT && crop?.type==='rect' && (
        <rect x={x+crop.cx} y={y+crop.cy} width={crop.cw} height={crop.ch}
          fill="none" stroke="#f59e0b" strokeWidth={1.5/vs}
          strokeDasharray={`${4/vs} ${3/vs}`}/>
      )}
      {tool===TOOL.SELECT && crop?.type==='poly' && (
        <polygon points={crop.points.map(p=>`${x+p.x},${y+p.y}`).join(' ')}
          fill="none" stroke="#f59e0b" strokeWidth={1.5/vs}
          strokeDasharray={`${4/vs} ${3/vs}`}/>
      )}
    </g>
  );
}
