'use client'
import {HANDLE_SZ, TOOL} from '../constants'
export function HandleRenderer({ state, vs, tool }) {
  const { x,y,w,h,rotation } = state;
  const rcx=x+w/2, rcy=y+h/2;
  const hs   = HANDLE_SZ/vs;
  const isCrop = tool===TOOL.CROP_RECT || tool===TOOL.CROP_POLY;
  const color  = '#10b981';
  return (
    <g transform={`rotate(${rotation},${rcx},${rcy})`} style={{ pointerEvents:'none' }}>
      <rect x={x} y={y} width={w} height={h} fill="none"
        stroke={isCrop ? '#f59e0b' : color} strokeWidth={2/vs}/>
      {!isCrop && (<>
        {[['nw',x,y],['ne',x+w,y],['se',x+w,y+h],['sw',x,y+h]].map(([c,hx,hy])=>(
          <rect key={c} x={hx-hs/2} y={hy-hs/2} width={hs} height={hs}
            fill="#0a0a0a" stroke={color} strokeWidth={1.5/vs}/>
        ))}
        <line x1={rcx} y1={y} x2={rcx} y2={y-22/vs}
          stroke="#6366f1" strokeWidth={1/vs} strokeDasharray={`${3/vs} ${2/vs}`}/>
        <circle cx={rcx} cy={y-22/vs} r={hs/2}
          fill="#6366f1" stroke="#fff" strokeWidth={1.5/vs}/>
      </>)}
    </g>
  );
}