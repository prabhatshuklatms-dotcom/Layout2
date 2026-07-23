'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { projectService } from '@/services/project.service';
import { uploadArchitecture } from '@/services/architecture.service';

export default function StandaloneCropStudio() {
  const [file, setFile] = useState(null);
  const [imageSrc, setImageSrc] = useState('');
  const [processing, setProcessing] = useState(false);
  
  // Polygon state
  const [points, setPoints] = useState([]); // array of { x, y } percentages
  const [isClosed, setIsClosed] = useState(false);
  const [mousePos, setMousePos] = useState(null);
  
  // Project saving state
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const imgRef = useRef(null);
  const svgRef = useRef(null);
  const { toasts, removeToast, toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    projectService.getProjects()
      .then(data => {
        // Handle array or { data: [...] } format
        const list = Array.isArray(data) ? data : (data?.data ?? []);
        setProjects(list);
        if (list.length > 0) {
          setSelectedProjectId(list[0].id.toString());
        }
      })
      .catch(err => console.error("Failed to fetch projects:", err));
  }, []);

  const onDragOver = (e) => e.preventDefault();
  
  const onDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onFileSelect = (e) => {
    if (e.target.files?.length) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (selectedFile) => {
    if (!selectedFile) return;
    const type = selectedFile.type;
    
    setProcessing(true);
    try {
      if (type === 'application/pdf') {
        const url = URL.createObjectURL(selectedFile);
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
        
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({ canvasContext: ctx, viewport }).promise;
        
        setImageSrc(canvas.toDataURL('image/png'));
        URL.revokeObjectURL(url);
      } else if (type.startsWith('image/')) {
        const url = URL.createObjectURL(selectedFile);
        setImageSrc(url);
      } else {
        throw new Error('Unsupported file type. Please upload PDF, PNG, or JPEG.');
      }
      setFile(selectedFile);
    } catch (err) {
      toast.error(err.message || 'Failed to load file');
    } finally {
      setProcessing(false);
    }
  };

  // --- Drawing logic ---
  const handleSvgClick = (e) => {
    if (isClosed) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Check if clicking near the first point to close
    if (points.length > 2) {
      const first = points[0];
      const dist = Math.sqrt(Math.pow(x - first.x, 2) + Math.pow(y - first.y, 2));
      if (dist < 3) { // 3% tolerance
        setIsClosed(true);
        setMousePos(null);
        return;
      }
    }

    setPoints([...points, { x, y }]);
  };

  const handleMouseMove = (e) => {
    if (isClosed || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos(null);
  };

  const handleUndo = () => {
    if (isClosed) {
      setIsClosed(false);
    } else {
      setPoints(points.slice(0, -1));
    }
  };

  const handleDownload = () => {
    if (!isClosed || points.length < 3) {
      toast.error('Please complete the polygon before cropping.');
      return;
    }
    if (!imgRef.current) return;

    try {
      const image = imgRef.current;
      const nw = image.naturalWidth;
      const nh = image.naturalHeight;

      // Convert percentages to actual pixel coordinates on the natural image
      const pxPoints = points.map(p => ({
        x: (p.x / 100) * nw,
        y: (p.y / 100) * nh
      }));

      // Find bounding box
      const xs = pxPoints.map(p => p.x);
      const ys = pxPoints.map(p => p.y);
      const minX = Math.floor(Math.min(...xs));
      const minY = Math.floor(Math.min(...ys));
      const maxX = Math.ceil(Math.max(...xs));
      const maxY = Math.ceil(Math.max(...ys));
      const cropW = Math.max(1, maxX - minX);
      const cropH = Math.max(1, maxY - minY);

      const canvas = document.createElement('canvas');
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d');

      // 1. Create the clipping path, shifted by (-minX, -minY)
      ctx.beginPath();
      ctx.moveTo(pxPoints[0].x - minX, pxPoints[0].y - minY);
      for (let i = 1; i < pxPoints.length; i++) {
        ctx.lineTo(pxPoints[i].x - minX, pxPoints[i].y - minY);
      }
      ctx.closePath();
      ctx.clip(); // Mask everything outside

      // 2. Draw the image, offset by (-minX, -minY) so the bounding box fits in the canvas
      ctx.drawImage(image, -minX, -minY, nw, nh);

      // Download
      canvas.toBlob((blob) => {
        if (!blob) {
          toast.error('Canvas is empty');
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const originalName = file.name.replace(/\.[^/.]+$/, '');
        a.download = `${originalName}-cropped.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast.success('Polygon cropped and downloaded!');
      }, 'image/png', 1);
    } catch (err) {
      toast.error('Failed to crop and download');
      console.error(err);
    }
  };

  const handleSaveToProject = () => {
    if (!selectedProjectId) {
      toast.error('Please select a project to save to.');
      return;
    }
    if (!isClosed || points.length < 3) {
      toast.error('Please complete the polygon before cropping.');
      return;
    }
    if (!imgRef.current) return;

    try {
      const image = imgRef.current;
      const nw = image.naturalWidth;
      const nh = image.naturalHeight;

      const pxPoints = points.map(p => ({
        x: (p.x / 100) * nw,
        y: (p.y / 100) * nh
      }));

      const xs = pxPoints.map(p => p.x);
      const ys = pxPoints.map(p => p.y);
      const minX = Math.floor(Math.min(...xs));
      const minY = Math.floor(Math.min(...ys));
      const cropW = Math.max(1, Math.ceil(Math.max(...xs)) - minX);
      const cropH = Math.max(1, Math.ceil(Math.max(...ys)) - minY);

      const canvas = document.createElement('canvas');
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d');

      ctx.beginPath();
      ctx.moveTo(pxPoints[0].x - minX, pxPoints[0].y - minY);
      for (let i = 1; i < pxPoints.length; i++) {
        ctx.lineTo(pxPoints[i].x - minX, pxPoints[i].y - minY);
      }
      ctx.closePath();
      ctx.clip(); 

      ctx.drawImage(image, -minX, -minY, nw, nh);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error('Canvas is empty');
          return;
        }
        
        const originalName = file.name.replace(/\.[^/.]+$/, '');
        const filename = `${originalName}-cropped.png`;
        const croppedFile = new File([blob], filename, { type: 'image/png' });

        setUploading(true);
        try {
          await uploadArchitecture(
            selectedProjectId,
            croppedFile,
            (pct) => setUploadProgress(pct),
            new AbortController().signal
          );
          toast.success('Successfully saved to project!');
          router.push(`/projects/${selectedProjectId}/viewer`);
        } catch (err) {
          toast.error(err.message || 'Failed to upload to project');
          setUploading(false);
          setUploadProgress(0);
        }
      }, 'image/png', 1);
    } catch (err) {
      toast.error('Failed to crop and save');
      console.error(err);
    }
  };

  const reset = () => {
    setFile(null);
    setImageSrc('');
    setPoints([]);
    setIsClosed(false);
    setMousePos(null);
  };

  const resetCrop = () => {
    setPoints([]);
    setIsClosed(false);
    setMousePos(null);
  };

  if (processing) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <svg className="animate-spin w-10 h-10 text-indigo-500" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" />
          <path d="M12 3A9 9 0 0 1 21 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <p className="text-zinc-400 animate-pulse">{uploading ? `Uploading to project (${Math.round(uploadProgress)}%)...` : 'Processing file...'}</p>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </div>
    );
  }

  if (imageSrc) {
    const polygonPointsStr = points.map(p => `${p.x},${p.y}`).join(' ');

    return (
      <div className="flex flex-col h-[calc(100vh-80px)] bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 shadow-xl">
        <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Polygon Crop Tool</h2>
            <p className="text-xs text-zinc-400">Click to trace the boundary of the region. Click the first point to close.</p>
          </div>
          <div className="flex gap-3 items-center">
            {projects.length > 0 && (
              <select 
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-sm rounded-lg px-3 py-1.5 text-zinc-200 outline-none focus:border-indigo-500"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
            <button 
              onClick={handleSaveToProject}
              disabled={!isClosed || !selectedProjectId}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              Save to DB
            </button>
            <div className="w-px h-6 bg-zinc-800 mx-1"></div>
            <button 
              onClick={handleDownload}
              disabled={!isClosed}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download
            </button>
          </div>
        </div>
        
        {/* Toolbar below header */}
        <div className="bg-zinc-900 border-b border-zinc-800 p-2 px-4 flex gap-2">
           <button onClick={handleUndo} disabled={points.length === 0} className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded text-zinc-300">
             Undo Point
           </button>
           <button onClick={resetCrop} disabled={points.length === 0} className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded text-zinc-300">
             Clear Polygon
           </button>
        </div>
        
        <div className="flex-1 overflow-auto p-8 flex items-center justify-center bg-[#0d0d0d]">
          <div className="max-w-[80vw] max-h-[70vh] bg-white border border-zinc-700 shadow-2xl relative select-none">
            
            {/* The Image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              ref={imgRef}
              src={imageSrc} 
              alt="Crop preview" 
              className="max-w-full max-h-[70vh] object-contain block pointer-events-none"
            />

            {/* The SVG Overlay for drawing */}
            <svg 
              ref={svgRef}
              onClick={handleSvgClick}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              className={`absolute top-0 left-0 w-full h-full z-10 ${!isClosed ? 'cursor-crosshair' : 'cursor-default'}`}
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              
              {/* We don't need the inline clipPath hack here anymore since we use the mask below */}

              {/* The completed segments */}
              {points.length > 1 && (
                <polyline 
                  points={polygonPointsStr} 
                  fill={isClosed ? 'rgba(79, 70, 229, 0.2)' : 'none'} 
                  stroke="#4f46e5" 
                  strokeWidth="0.4"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              
              {/* The active trailing segment */}
              {!isClosed && points.length > 0 && mousePos && (
                <line 
                  x1={points[points.length - 1].x} 
                  y1={points[points.length - 1].y} 
                  x2={mousePos.x} 
                  y2={mousePos.y} 
                  stroke="#4f46e5" 
                  strokeWidth="0.4"
                  strokeDasharray="1 1"
                  vectorEffect="non-scaling-stroke"
                />
              )}

              {/* The vertices */}
              {points.map((p, i) => {
                const isStart = i === 0;
                // Make the start point slightly larger and distinct when hovering near to close
                const isCloseTarget = isStart && points.length > 2;
                return (
                  <circle 
                    key={i} 
                    cx={p.x} 
                    cy={p.y} 
                    r={isCloseTarget ? "1" : "0.5"} 
                    fill={isStart ? '#10b981' : '#4f46e5'} 
                    vectorEffect="non-scaling-stroke"
                  />
                )
              })}
            </svg>
            
            {/* Visual hack for the mask */}
            {isClosed && (
              <svg width="0" height="0" className="absolute">
                <defs>
                  <mask id="poly-mask">
                    <rect x="0" y="0" width="100%" height="100%" fill="white" />
                    <polygon points={polygonPointsStr.split(' ').map(c => {
                      const [x,y] = c.split(',');
                      return `${x}%,${y}%`;
                    }).join(' ')} fill="black" />
                  </mask>
                </defs>
              </svg>
            )}
            {isClosed && (
              <div 
                className="absolute inset-0 bg-black/60 z-[5] pointer-events-none"
                style={{ mask: 'url(#poly-mask)', WebkitMask: 'url(#poly-mask)' }}
              />
            )}
          </div>
        </div>
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </div>
    );
  }

  return (
    <div 
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={() => document.getElementById('global-file-upload').click()}
      className="mt-8 border-2 border-dashed rounded-xl p-16 transition-colors flex flex-col items-center justify-center gap-4 cursor-pointer border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800/80 hover:border-zinc-600 w-full max-w-2xl mx-auto"
    >
      <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center text-zinc-400">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      </div>
      <div className="text-center">
        <p className="text-lg font-medium text-zinc-200">Click or drag file to upload & polygon crop</p>
        <p className="text-sm text-zinc-500 mt-2">Supports PDF, PNG, JPG, and JPEG. Files are processed entirely on your device.</p>
      </div>
      <input 
        id="global-file-upload" 
        type="file" 
        className="hidden" 
        accept=".png,.jpg,.jpeg,.pdf" 
        onChange={onFileSelect}
      />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
