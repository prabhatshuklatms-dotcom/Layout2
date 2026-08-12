import React from 'react';
import { X, Maximize, Ruler, CircleDollarSign, User, FileText, Compass } from 'lucide-react';

export default function UserPlotDrawer({ isOpen, onClose, plot }) {
  return (
    <div
      className={`
        absolute bottom-0 left-0 right-0 z-50
        bg-zinc-950/95 backdrop-blur-xl
        border-t border-zinc-800 rounded-t-2xl
        shadow-2xl flex flex-col
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-y-0' : 'translate-y-full'}
      `}
      style={{ maxHeight: '50vh' }}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-1 shrink-0">
        <div className="w-10 h-1 rounded-full bg-zinc-700" />
      </div>

      {/* Header */}
      <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <h2 className="text-base font-bold text-white truncate">
            Plot {plot?.plotNumber}
          </h2>
          {plot && (
            <>
              <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full shrink-0">
                {plot.plotType || 'Standard'}
              </span>
              {plot.status && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                  style={{ backgroundColor: plot.status.fillColor || '#4b5563', color: '#fff' }}
                >
                  {plot.status.name}
                </span>
              )}
            </>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="ml-3 shrink-0 p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
        >
          <X size={15} />
        </button>
      </div>

      {/* Scrollable body */}
      {plot && (
        <div className="flex-1 overflow-y-auto overscroll-contain">

          {/* Horizontal chip row — area, facing, each dimension, price */}
          <div
            className="flex gap-3 px-4 py-3 overflow-x-auto"
            style={{ scrollbarWidth: 'none' }}
          >
            {/* Area */}
            <div className="shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 flex flex-col min-w-[108px]">
              <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
                <Maximize size={12} />
                <span className="text-[10px] uppercase tracking-wider font-semibold">Area</span>
              </div>
              <span className="text-sm font-bold text-white leading-tight">
                {plot.area
                  ? `${parseFloat(plot.area).toFixed(2)} ${plot.unit || 'sq.ft'}`
                  : 'N/A'}
              </span>
            </div>

            {/* Facing */}
            <div className="shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 flex flex-col min-w-[96px]">
              <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
                <Compass size={12} />
                <span className="text-[10px] uppercase tracking-wider font-semibold">Facing</span>
              </div>
              <span className="text-sm font-bold text-white leading-tight">
                {plot.facing || 'N/A'}
              </span>
            </div>

            {/* One chip per dimension */}
            {plot.dimensions?.map((dim, idx) => (
              <div
                key={idx}
                className="shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 flex flex-col min-w-[96px]"
              >
                <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
                  <Ruler size={12} />
                  <span className="text-[10px] uppercase tracking-wider font-semibold truncate max-w-[72px]">
                    {dim.label || `Side ${idx + 1}`}
                  </span>
                </div>
                <span className="text-sm font-bold text-white leading-tight">
                  {dim.value} {dim.unit || 'ft'}
                </span>
              </div>
            ))}

            {/* Price */}
            {plot.price && (
              <div className="shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 flex flex-col min-w-[112px]">
                <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
                  <CircleDollarSign size={12} className="text-emerald-500" />
                  <span className="text-[10px] uppercase tracking-wider font-semibold">Price</span>
                </div>
                <span className="text-sm font-bold text-white leading-tight">
                  ₹{plot.price.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Owner / customer row — only when present */}
          {(plot.ownerName || plot.customerName) && (
            <div className="mx-4 mb-3 bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-zinc-800 flex items-center gap-2">
                <User size={12} className="text-indigo-400" />
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Ownership</span>
              </div>
              <div className="flex divide-x divide-zinc-800">
                {plot.ownerName && (
                  <div className="flex-1 px-3 py-2">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Owner</p>
                    <p className="text-sm text-white">{plot.ownerName}</p>
                  </div>
                )}
                {plot.customerName && (
                  <div className="flex-1 px-3 py-2">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Customer</p>
                    <p className="text-sm text-white">{plot.customerName}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Remarks */}
          {(plot.description || plot.remarks) && (
            <div className="mx-4 mb-4 bg-zinc-900 border border-zinc-800 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <FileText size={12} className="text-indigo-400" />
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Remarks</span>
              </div>
              {plot.description && <p className="text-sm text-zinc-300 mb-1">{plot.description}</p>}
              {plot.remarks && <p className="text-xs text-zinc-500 italic">{plot.remarks}</p>}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
