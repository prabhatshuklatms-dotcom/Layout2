'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Line, Circle } from 'react-konva';
import useImage from 'use-image';
import { useMaskEditor } from '@/store/useMaskEditor';
import { getDownloadUrl, getPreviewUrl } from '@/lib/api';
import PolygonEditor from './PolygonEditor';
import { usePolygonDrawing } from '@/hooks/masking/usePolygonDrawing';
import { useSelectionBox } from '@/hooks/masking/useSelectionBox';
import PlotGeneratorDialog from './PlotGeneratorDialog';

export default function MaskWorkspace() {
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [showGenerator, setShowGenerator] = useState(false);
  
  const { 
    activeArchitectureId, architectureFiles, zoom, pan, mode, setMode,
    polygons, selectedIds, selectPolygon, layers,
    imageVisible, imageOpacity
  } = useMaskEditor();

  const activeFile = architectureFiles.find(f => f.id === activeArchitectureId);
  const imageUrl = activeFile ? getPreviewUrl(activeFile.id) : null;
  const [image] = useImage(imageUrl, 'anonymous');

  // Hooks for interactions
  const { activePoints, mousePos, handleStageClick, handleMouseMove } = usePolygonDrawing();
  const { boxRef } = useSelectionBox(stageRef);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (let entry of entries) {
        setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [activeArchitectureId]);

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const scaleBy = 1.1;
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    
    if (newScale < 0.1 || newScale > 20) return;
    
    const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
    const newPos = { x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale };
    
    stage.scale({ x: newScale, y: newScale });
    stage.position(newPos);
    stage.batchDraw();
    
    useMaskEditor.setState({ zoom: newScale, pan: newPos });
  };

  const handleDragEnd = (e) => {
    if (e.target === stageRef.current) {
      useMaskEditor.setState({ pan: { x: e.target.x(), y: e.target.y() } });
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'g' && e.ctrlKey && selectedIds.length === 1) {
        e.preventDefault();
        setShowGenerator(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds]);

  if (!activeArchitectureId) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        Select an architecture from the library to begin masking.
      </div>
    );
  }

  // Filter visible polygons based on layer settings
  const visiblePolygons = polygons.filter(p => {
    const layer = layers.find(l => l.id === p.layer);
    return layer ? layer.visible : true;
  });

  return (
    <div ref={containerRef} className={`w-full h-full bg-zinc-900 ${mode !== 'pointer' ? 'cursor-crosshair' : 'cursor-default'}`}>
      <Stage
        width={dimensions.width} height={dimensions.height}
        ref={stageRef} onWheel={handleWheel} draggable={mode === 'pointer' && selectedIds.length === 0}
        onDragEnd={handleDragEnd}
        onClick={handleStageClick} onTap={handleStageClick}
        onMouseMove={handleMouseMove} onTouchMove={handleMouseMove}
      >
        <Layer>
          {image && (
            <KonvaImage 
              image={image} 
              x={0} 
              y={0} 
              width={image.width} 
              height={image.height} 
              opacity={imageVisible ? imageOpacity : 0}
              listening={false} 
            />
          )}
          
          {visiblePolygons.map(p => (
            <PolygonEditor
              key={p.id}
              polygon={p}
              isSelected={selectedIds.includes(p.id)}
              onSelect={(e) => {
                if (mode !== 'pointer') return;
                e.cancelBubble = true;
                selectPolygon(p.id, e.evt.shiftKey);
              }}
              mode={mode}
              zoom={zoom}
            />
          ))}

          {/* Drawing Preview */}
          {activePoints.length > 0 && (
            <>
              <Line
                points={[...activePoints.flatMap(p => p), ...(mousePos || [])]}
                stroke="#ffffff" strokeWidth={2 / zoom} dash={[5 / zoom, 5 / zoom]}
                listening={false}
              />
              {activePoints.map((p, i) => (
                <Circle key={i} x={p[0]} y={p[1]} radius={4 / zoom} fill="#ffffff" listening={false} />
              ))}
            </>
          )}

          {/* Selection Box */}
          <Rect ref={boxRef} fill="rgba(59, 130, 246, 0.3)" stroke="#3b82f6" strokeWidth={1 / zoom} visible={false} listening={false} />
        </Layer>
      </Stage>
      
      <PlotGeneratorDialog isOpen={showGenerator} onClose={() => setShowGenerator(false)} />
      
      {/* Mini Helper text */}
      {mode !== 'pointer' && (
        <div className="absolute bottom-4 left-4 bg-black/80 px-3 py-1.5 rounded text-xs text-zinc-300 pointer-events-none shadow">
          Click to add vertices. Double click to finish. Press Esc to cancel.
        </div>
      )}
      {mode === 'pointer' && selectedIds.length === 1 && (
        <div className="absolute bottom-4 left-4 bg-black/80 px-3 py-1.5 rounded text-xs text-zinc-300 pointer-events-none shadow">
          Press Ctrl+G for Smart Plot Generator
        </div>
      )}
    </div>
  );
}
