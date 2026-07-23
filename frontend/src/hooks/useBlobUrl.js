'use client';

import { useState, useRef, useEffect } from 'react';

export default  function useBlobUrl(src) {
  const [data, setData] = useState({ url: null, width: null, height: null });
  const prev = useRef(null);
  useEffect(() => {
    if (!src) { setData({ url: null, width: null, height: null }); return; }
    let dead = false;
    setData({ url: null, width: null, height: null });
    fetch(src, { credentials:'include' })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
      .then(b => {
        if (dead) return;
        const u = URL.createObjectURL(b);
        if (prev.current) URL.revokeObjectURL(prev.current);
        prev.current = u;
        
        const img = new Image();
        img.onload = () => {
          if (!dead) setData({ url: u, width: img.naturalWidth, height: img.naturalHeight });
        };
        img.src = u;
      })
      .catch(() => {});
    return () => {
      dead = true;
      if (prev.current) { URL.revokeObjectURL(prev.current); prev.current = null; }
    };
  }, [src]);
  return data;
}