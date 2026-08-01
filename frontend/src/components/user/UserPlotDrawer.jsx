import React from 'react';
import { X, Maximize, Ruler, CircleDollarSign, User, FileText, Compass } from 'lucide-react';

export default function UserPlotDrawer({ isOpen, onClose, plot }) {
  if (!isOpen || !plot) return null;

  return (
    <div className={`absolute right-0 top-0 bottom-0 w-96 bg-zinc-950/95 backdrop-blur-xl border-l border-zinc-800 z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      
      {/* Header */}
      <div className="p-5 border-b border-zinc-800 flex items-start justify-between bg-zinc-900/50">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Plot {plot.plotNumber}</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">{plot.type || 'Standard'}</span>
            <span 
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: plot.status?.fillColor || '#4b5563',
                color: plot.status ? '#ffffff' : '#e5e7eb'
              }}
            >
              {plot.status?.name || 'Unknown Status'}
            </span>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
        
        {/* Core Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-col">
            <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
              <Maximize size={14} />
              <span className="text-xs uppercase tracking-wider font-semibold">Total Area</span>
            </div>
            <span className="text-lg font-bold text-white">
              {plot.area ? `${parseFloat(plot.area).toFixed(2)} ${plot.unit || 'sq.ft'}` : 'N/A'}
            </span>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex flex-col">
            <div className="flex items-center gap-1.5 text-zinc-500 mb-1">
              <Compass size={14} />
              <span className="text-xs uppercase tracking-wider font-semibold">Facing</span>
            </div>
            <span className="text-lg font-bold text-white">
              {plot.facing || 'N/A'}
            </span>
          </div>
        </div>

        {/* Dimensions */}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
            <Ruler size={16} className="text-indigo-400" />
            Dimensions
          </h3>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            {plot.dimensions && plot.dimensions.length > 0 ? (
              <table className="w-full text-sm text-left">
                <tbody>
                  {plot.dimensions.map((dim, idx) => (
                    <tr key={idx} className="border-b border-zinc-800/50 last:border-0">
                      <td className="py-2.5 px-4 font-medium text-zinc-400 w-1/2">{dim.label}</td>
                      <td className="py-2.5 px-4 text-white text-right w-1/2">{dim.value} {dim.unit || 'ft'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-4 text-center text-zinc-500 text-sm">
                No dimension data available
              </div>
            )}
          </div>
        </div>

        {/* Financial / Ownership */}
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
            <User size={16} className="text-indigo-400" />
            Ownership & Financial
          </h3>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
            <div className="p-3 border-b border-zinc-800 flex justify-between items-center">
              <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Price</span>
              <span className="text-sm font-bold text-white flex items-center gap-1">
                <CircleDollarSign size={14} className="text-emerald-500" />
                {plot.price ? `₹${plot.price.toLocaleString()}` : 'N/A'}
              </span>
            </div>
            <div className="p-3 border-b border-zinc-800 flex justify-between items-center">
              <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Owner</span>
              <span className="text-sm text-white">{plot.ownerName || 'N/A'}</span>
            </div>
            <div className="p-3 flex justify-between items-center">
              <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Customer</span>
              <span className="text-sm text-white">{plot.customerName || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Remarks */}
        {(plot.description || plot.remarks) && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
              <FileText size={16} className="text-indigo-400" />
              Remarks
            </h3>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              {plot.description && <p className="text-sm text-zinc-300 mb-2">{plot.description}</p>}
              {plot.remarks && <p className="text-xs text-zinc-500 italic">{plot.remarks}</p>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
