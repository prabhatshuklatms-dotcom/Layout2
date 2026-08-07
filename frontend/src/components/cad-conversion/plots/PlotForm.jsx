'use client';
import { useState, useEffect } from 'react';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { PLOT_TYPE_CONFIG } from '@/lib/plotTypeConfig';
import { getProjectPlotStatuses, createProjectPlotsBulk, updateProjectPlot } from '@/lib/api';
import Swal from 'sweetalert2';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const DimensionRow = ({ dim, dIdx, plotType, updateDimensions, dimensions, onRemove }) => {
  const isCustomLabel = PLOT_TYPE_CONFIG[plotType]?.customLabels;
  const hideLabels = PLOT_TYPE_CONFIG[plotType]?.hideLabels;
  const isDynamic = PLOT_TYPE_CONFIG[plotType]?.isDynamic;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-center bg-zinc-950/40 p-3 rounded-lg border border-zinc-800/60 transition-all hover:border-zinc-700/80">
      {isCustomLabel ? (
        <input 
          type="text" 
          value={dim.label} 
          onChange={e => {
            const newDims = [...dimensions];
            newDims[dIdx].label = e.target.value;
            updateDimensions(newDims);
          }}
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-sm text-zinc-300 focus:outline-none focus:border-indigo-500 transition-colors" 
          placeholder="Label (e.g. North)" 
        />
      ) : !hideLabels ? (
        <div className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-sm text-zinc-400 font-medium flex items-center shadow-inner">
          {dim.label}
        </div>
      ) : (
        <div className="hidden xl:block"></div>
      )}

      <input 
        type="number" step="0.01" 
        value={dim.value} 
        onChange={e => {
          const newDims = [...dimensions];
          newDims[dIdx].value = e.target.value;
          updateDimensions(newDims);
        }}
        className={`w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-sm focus:outline-none focus:border-indigo-500 transition-colors ${hideLabels ? 'xl:col-span-2' : ''}`}
        placeholder="Value (e.g. 10.5)" 
      />

      <input 
        type="text" 
        value={dim.unit !== undefined ? dim.unit : (dim.defaultUnit || 'm')} 
        onChange={e => {
          const newDims = [...dimensions];
          newDims[dIdx].unit = e.target.value;
          updateDimensions(newDims);
        }}
        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-md text-sm text-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors" 
        placeholder="Unit (m, ft)"
      />

      {isDynamic ? (
        <button 
          type="button" 
          onClick={onRemove} 
          className="flex items-center justify-center w-full px-3 py-2 text-zinc-400 hover:text-red-400 bg-zinc-900/50 hover:bg-red-500/10 rounded-md transition-colors border border-zinc-800 hover:border-red-500/30"
        >
          <Trash2 size={16} className="mr-2 xl:mr-0 xl:hidden" />
          <span className="xl:hidden">Remove</span>
          <Trash2 size={16} className="hidden xl:block" />
        </button>
      ) : (
        <div className="hidden xl:block"></div>
      )}
    </div>
  );
};

export default function PlotForm({ projectId, plotId, initialData }) {
  const router = useRouter();
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(false);
  const isEditing = !!plotId;
  
  const emptyForm = { 
    plotNumber: '', 
    plotType: 'RECTANGLE',
    dimensions: PLOT_TYPE_CONFIG['RECTANGLE'].dimensions.map(d => ({ ...d, value: '' })),
    areaSqFt: '', 
    statusId: '' 
  };
  
  const [formList, setFormList] = useState([emptyForm]);

  useEffect(() => {
    getProjectPlotStatuses(projectId, { pagination: false }).then(setStatuses).catch(console.error);
    
    if (initialData) {
      setFormList([{
        plotNumber: initialData.plotNumber,
        plotType: initialData.plotType || 'RECTANGLE',
        dimensions: (initialData.dimensions && initialData.dimensions.length > 0) 
          ? initialData.dimensions 
          : PLOT_TYPE_CONFIG[initialData.plotType || 'RECTANGLE']?.dimensions.map(d => ({ ...d, value: '' })) || [],
        areaSqFt: initialData.areaSqFt || '',
        statusId: initialData.statusId || ''
      }]);
    } else {
      getProjectPlotStatuses(projectId, { pagination: false }).then(stats => {
        if (stats.length > 0) {
          setFormList([{ ...emptyForm, statusId: stats[0].id }]);
        }
      });
    }
  }, [projectId, initialData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isEditing) {
        const formData = formList[0];
        const payload = {
          ...formData,
          dimensions: formData.dimensions.map(d => ({ ...d, value: d.value ? parseFloat(d.value) : null })),
          areaSqFt: formData.areaSqFt ? parseFloat(formData.areaSqFt) : null,
          statusId: formData.statusId ? parseInt(formData.statusId) : null
        };
        delete payload.width;
        delete payload.height;
        await updateProjectPlot(projectId, plotId, payload);
      } else {
        const payloads = formList.map(formData => {
          const p = {
            ...formData,
            dimensions: formData.dimensions.map(d => ({ ...d, value: d.value ? parseFloat(d.value) : null })),
            areaSqFt: formData.areaSqFt ? parseFloat(formData.areaSqFt) : null,
            statusId: formData.statusId ? parseInt(formData.statusId) : null
          };
          delete p.width;
          delete p.height;
          return p;
        });
        await createProjectPlotsBulk(projectId, payloads);
      }
      router.push(`/cad-conversion/${projectId}/manage-plot`);
    } catch (err) {
      if (err.response?.failedPlots && err.response.failedPlots.length > 0) {
        const plotListHtml = err.response.failedPlots
          .map(p => `<li><strong>${p.plotNumber}</strong>: ${p.reason}</li>`)
          .join('');
        Swal.fire({
          icon: 'error',
          title: 'Failed to Save Plots',
          html: `<p>${err.response.reason || err.message}</p><ul>${plotListHtml}</ul>`,
          customClass: { htmlContainer: 'text-left' }
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.response?.reason || err.message || 'Failed to save plot(s)'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/cad-conversion/${projectId}/manage-plot`} className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-lg transition-colors border border-zinc-800">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{isEditing ? 'Edit Plot' : 'Add Plot'}</h1>
            <p className="text-zinc-400 mt-1">{isEditing ? 'Modify plot details' : 'Create new plots for this project'}</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {formList.map((formData, index) => {
            const updateField = (field, value) => {
              const newList = [...formList];
              newList[index] = { ...newList[index], [field]: value };
              setFormList(newList);
            };

            return (
              <div key={index} className="relative border border-zinc-800 p-6 rounded-xl bg-zinc-900/50 shadow-lg">
                {formList.length > 1 && (
                  <button type="button" onClick={() => {
                    const newList = [...formList];
                    newList.splice(index, 1);
                    setFormList(newList);
                  }} className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-red-400 bg-zinc-950 rounded transition-colors">
                    <Trash2 size={16} />
                  </button>
                )}
                {formList.length > 1 && (
                  <div className="mb-6 text-sm font-semibold text-zinc-500 uppercase tracking-wider">Plot {index + 1}</div>
                )}
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Plot Number *</label>
                    <input required type="text" value={formData.plotNumber} onChange={e => updateField('plotNumber', e.target.value)} className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-indigo-500 transition-colors" placeholder="e.g. A-101" />
                  </div>
                  
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Plot Type *</label>
                    <select 
                      value={formData.plotType} 
                      onChange={(e) => {
                        const newType = e.target.value;
                        const config = PLOT_TYPE_CONFIG[newType];
                        const newList = [...formList];
                        newList[index] = { 
                          ...newList[index], 
                          plotType: newType,
                          dimensions: config ? config.dimensions.map(d => ({ ...d, value: '' })) : []
                        };
                        setFormList(newList);
                      }}
                      className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
                    >
                      {Object.entries(PLOT_TYPE_CONFIG).map(([key, config]) => (
                        <option key={key} value={key}>{config.displayName}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2 space-y-4">
                    <label className="block text-sm font-medium text-zinc-400">Dimensions</label>
                    <div className="flex flex-col gap-3">
                      {formData.dimensions.map((dim, dIdx) => (
                        <DimensionRow 
                          key={dim.id || dIdx}
                          dim={dim}
                          dIdx={dIdx}
                          plotType={formData.plotType}
                          dimensions={formData.dimensions}
                          updateDimensions={(newDims) => updateField('dimensions', newDims)}
                          onRemove={() => {
                            const newDims = [...formData.dimensions];
                            newDims.splice(dIdx, 1);
                            updateField('dimensions', newDims);
                          }}
                        />
                      ))}
                    </div>
                    {PLOT_TYPE_CONFIG[formData.plotType]?.isDynamic && (
                      <button 
                        type="button" 
                        onClick={() => {
                          const newId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
                          const newDims = [...formData.dimensions, { id: newId, label: `Side ${formData.dimensions.length + 1}`, value: '', unit: 'm' }];
                          updateField('dimensions', newDims);
                        }}
                        className="text-sm text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1 mt-2"
                      >
                        <Plus size={16} /> Add Dimension
                      </button>
                    )}
                  </div>

                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Area (Sq. Ft.)</label>
                    <input type="number" step="0.01" value={formData.areaSqFt} onChange={e => updateField('areaSqFt', e.target.value)} className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-indigo-500 transition-colors" placeholder="0.00" />
                  </div>

                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm font-medium text-zinc-400 mb-2">Status</label>
                    <select value={formData.statusId} onChange={e => updateField('statusId', e.target.value)} className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer">
                      <option value="">Select Status</option>
                      {statuses.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}

          {!isEditing && (
            <button 
              type="button" 
              onClick={() => setFormList([...formList, { ...emptyForm, statusId: statuses.length > 0 ? statuses[0].id : '' }])} 
              className="w-full py-4 mt-4 border-2 border-dashed border-indigo-500/30 rounded-xl text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500 flex justify-center items-center gap-2 transition-all font-medium text-sm"
            >
              <Plus size={18} /> Add More Plots
            </button>
          )}

          <div className="pt-8 flex justify-end gap-4 border-t border-zinc-800/50 mt-8">
            <Link href={`/cad-conversion/${projectId}/manage-plot`} className="px-6 py-2.5 text-sm font-medium text-zinc-400 hover:text-white transition-colors bg-zinc-900 rounded-lg">Cancel</Link>
            <button disabled={loading} type="submit" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg shadow-lg transition-all">
              {loading ? 'Saving...' : (isEditing ? 'Save Changes' : (formList.length > 1 ? `Create ${formList.length} Plots` : 'Create Plot'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
