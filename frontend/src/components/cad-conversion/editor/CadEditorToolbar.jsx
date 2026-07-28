import React from 'react';
import { MousePointer2, ZoomIn, Layers, Settings2, Eraser, Scissors, Wand, Minus, Circle, Spline, Hexagon, Type, ArrowRight, PaintBucket } from 'lucide-react';

export default function CadEditorToolbar({ activeTool, onToolChange }) {
  const tools = [
    { id: 'pointer',        icon: MousePointer2, label: 'Pointer (V)' },
    { id: 'zoom_window',    icon: ZoomIn,        label: 'Zoom Window (Z)' },
    { id: 'eraser',         icon: Eraser,        label: 'Object Eraser (E)' },
    { id: 'partial_delete', icon: Scissors,      label: 'Partial Delete (X)' },
    { id: 'vector_eraser',  icon: Wand,          label: 'Vector Eraser (Y)' },
    { id: 'paint_bucket',   icon: PaintBucket,   label: 'Paint Bucket (F)' },
    { id: 'draw_text',    icon: Type,          label: 'Add Text (T)' },
    { id: 'draw_line',    icon: Minus,         label: 'Draw Line (L)' },
    { id: 'draw_arrow',   icon: ArrowRight,    label: 'Draw Arrow (R)' },
    { id: 'draw_circle',  icon: Circle,        label: 'Draw Circle (C)' },
    { id: 'draw_curve',   icon: Spline,        label: 'Draw Curve (U)' },
    { id: 'draw_polygon', icon: Hexagon,       label: 'Draw Polygon (P)' },
  ];

  return (
    <div className="flex z-10 h-full">
      <div className="w-12 bg-zinc-950 border-r border-zinc-800 flex flex-col items-center py-4 gap-4 z-20">
      <div className="flex flex-col gap-2 w-full px-2">
        {tools.map(tool => (
          <button
            key={tool.id}
            onClick={() => { console.log('[ERASER Stage 1] Toolbar button clicked. tool.id:', tool.id); onToolChange(tool.id); console.log('[ERASER Stage 1] onToolChange called with:', tool.id); }}
            title={tool.label}
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
              activeTool === tool.id 
                ? 'bg-indigo-600 text-white' 
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            <tool.icon size={16} />
          </button>
        ))}
      </div>
      

      </div>
    </div>
  );
}
