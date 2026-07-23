'use client';
import { useState, useEffect } from 'react';
import { getProjectPlots, createProjectPlot, updateProjectPlot, deleteProjectPlot, getProjectPlotStatuses, getCadProject } from '@/lib/api';
import { Plus, Edit2, Trash2, Search, Filter, ArrowLeft } from 'lucide-react';
import { getContrastYIQ } from '@/lib/utils';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { use } from 'react';

export default function ProjectPlotsPage({ params }) {
  const unwrappedParams = use(params);
  const projectId = unwrappedParams.projectId;
  
  const searchParams = useSearchParams();
  const editorId = searchParams.get('editorId');
  
  const [plots, setPlots] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAssignment, setFilterAssignment] = useState('');
  
  const [sortConfig, setSortConfig] = useState({ key: 'plotNumber', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const emptyForm = { plotNumber: '', width: '', height: '', areaSqFt: '', statusId: '', description: '' };
  const [formList, setFormList] = useState([emptyForm]);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [plotsData, statusesData, projectData] = await Promise.all([
        getProjectPlots(projectId),
        getProjectPlotStatuses(projectId),
        getCadProject(projectId)
      ]);
      setPlots(plotsData);
      setStatuses(statusesData);
      setProject(projectData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        const formData = formList[0];
        const payload = {
          ...formData,
          width: formData.width ? parseFloat(formData.width) : null,
          height: formData.height ? parseFloat(formData.height) : null,
          areaSqFt: formData.areaSqFt ? parseFloat(formData.areaSqFt) : null,
          statusId: formData.statusId ? parseInt(formData.statusId) : null
        };
        await updateProjectPlot(projectId, editingId, payload);
      } else {
        const promises = formList.map(formData => {
          const payload = {
            ...formData,
            width: formData.width ? parseFloat(formData.width) : null,
            height: formData.height ? parseFloat(formData.height) : null,
            areaSqFt: formData.areaSqFt ? parseFloat(formData.areaSqFt) : null,
            statusId: formData.statusId ? parseInt(formData.statusId) : null
          };
          return createProjectPlot(projectId, payload);
        });
        await Promise.all(promises);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      alert('Failed to save plot(s)');
    }
  };

  const openModal = (plot = null) => {
    if (plot) {
      setEditingId(plot.id);
      setFormList([{
        plotNumber: plot.plotNumber,
        width: plot.width || '',
        height: plot.height || '',
        areaSqFt: plot.areaSqFt || '',
        statusId: plot.statusId || '',
        description: plot.description || ''
      }]);
    } else {
      setEditingId(null);
      setFormList([{
        ...emptyForm,
        statusId: statuses.length > 0 ? statuses[0].id : ''
      }]);
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this plot?')) {
      try {
        await deleteProjectPlot(projectId, id);
        fetchData();
      } catch (err) {
        alert('Failed to delete plot');
      }
    }
  };

  const filteredPlots = plots.filter(plot => {
    const matchesSearch = plot.plotNumber.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus ? plot.statusId === parseInt(filterStatus) : true;
    let matchesAssignment = true;
    if (filterAssignment === 'available') matchesAssignment = !plot.cadRegionId;
    if (filterAssignment === 'assigned') matchesAssignment = !!plot.cadRegionId;
    return matchesSearch && matchesStatus && matchesAssignment;
  });

  const sortedPlots = [...filteredPlots].sort((a, b) => {
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];
    
    if (sortConfig.key === 'status') {
      aVal = a.status ? a.status.name : '';
      bVal = b.status ? b.status.name : '';
    } else if (sortConfig.key === 'cadRegionId') {
      aVal = a.cadRegionId ? 1 : 0;
      bVal = b.cadRegionId ? 1 : 0;
    }

    if (aVal === null || aVal === undefined) aVal = '';
    if (bVal === null || bVal === undefined) bVal = '';

    // Natural numeric sort
    if (sortConfig.key === 'plotNumber') {
      return sortConfig.direction === 'asc' 
        ? aVal.toString().localeCompare(bVal.toString(), undefined, { numeric: true, sensitivity: 'base' })
        : bVal.toString().localeCompare(aVal.toString(), undefined, { numeric: true, sensitivity: 'base' });
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedPlots.length / pageSize);
  const paginatedPlots = sortedPlots.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100 flex flex-col">
      <div className="max-w-7xl mx-auto w-full space-y-6 flex-1 flex flex-col">
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href={editorId ? `/cad-conversion/${projectId}/editor/${editorId}` : `/cad-conversion/${projectId}`} 
              className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{project ? `${project.name} Plots` : 'Project Plots'}</h1>
              <p className="text-zinc-400 mt-1">Manage plots for {project ? project.name : `Project #${projectId}`}</p>
            </div>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => openModal()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-md shadow flex items-center gap-2 transition-colors"
            >
              <Plus size={16} /> Add Plot
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex gap-4 items-center bg-zinc-900 p-4 rounded-xl border border-zinc-800">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input 
              type="text" 
              placeholder="Search by plot number..." 
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <select 
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              className="pl-9 pr-8 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm appearance-none focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
            >
              <option value="">All Statuses</option>
              {statuses.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <select 
              value={filterAssignment}
              onChange={e => { setFilterAssignment(e.target.value); setCurrentPage(1); }}
              className="pl-9 pr-8 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm appearance-none focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
            >
              <option value="">All Assignments</option>
              <option value="available">Available</option>
              <option value="assigned">Assigned</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex-1 flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-zinc-950/50 border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-4 font-medium text-zinc-400 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('plotNumber')}>Plot Number {sortConfig.key === 'plotNumber' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="px-6 py-4 font-medium text-zinc-400 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('width')}>Width {sortConfig.key === 'width' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="px-6 py-4 font-medium text-zinc-400 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('height')}>Height / Depth {sortConfig.key === 'height' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="px-6 py-4 font-medium text-zinc-400 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('areaSqFt')}>Area (Sq. Ft.) {sortConfig.key === 'areaSqFt' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="px-6 py-4 font-medium text-zinc-400 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('status')}>Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="px-6 py-4 font-medium text-zinc-400 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('cadRegionId')}>Assignment {sortConfig.key === 'cadRegionId' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="px-6 py-4 font-medium text-zinc-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {loading ? (
                  <tr><td colSpan="7" className="px-6 py-8 text-center text-zinc-500">Loading plots...</td></tr>
                ) : paginatedPlots.length === 0 ? (
                  <tr><td colSpan="7" className="px-6 py-8 text-center text-zinc-500">No plots found.</td></tr>
                ) : (
                  paginatedPlots.map(plot => (
                    <tr key={plot.id} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-zinc-200">{plot.plotNumber}</td>
                      <td className="px-6 py-4 text-zinc-400">{plot.width || '-'}</td>
                      <td className="px-6 py-4 text-zinc-400">{plot.height || '-'}</td>
                      <td className="px-6 py-4 text-zinc-400">{plot.areaSqFt || '-'}</td>
                      <td className="px-6 py-4">
                        {plot.status ? (
                            <span 
                              className="px-2.5 py-1 text-xs font-semibold rounded-full border border-black/10 shadow-sm"
                              style={{ 
                                backgroundColor: plot.status.fillColor, 
                                color: getContrastYIQ(plot.status.fillColor)
                              }}
                            >
                            {plot.status.name}
                          </span>
                        ) : (
                          <span className="text-zinc-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {plot.cadRegionId ? (
                           <span className="text-blue-400 font-medium text-xs">🔵 Assigned</span>
                        ) : (
                           <span className="text-green-400 font-medium text-xs">🟢 Available</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => openModal(plot)} className="p-2 text-zinc-400 hover:text-indigo-400 bg-zinc-950 hover:bg-zinc-800 rounded transition-colors">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDelete(plot.id)} className="p-2 text-zinc-400 hover:text-red-400 bg-zinc-950 hover:bg-zinc-800 rounded transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-800 bg-zinc-900">
              <div className="text-sm text-zinc-400">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, sortedPlots.length)} of {sortedPlots.length} plots
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 bg-zinc-950 border border-zinc-800 rounded text-sm text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors"
                >
                  Previous
                </button>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 bg-zinc-950 border border-zinc-800 rounded text-sm text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-zinc-800">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit Plot' : 'Add Plot'}</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              
              {formList.map((formData, index) => {
                const updateField = (field, value) => {
                  const newList = [...formList];
                  newList[index] = { ...newList[index], [field]: value };
                  setFormList(newList);
                };

                return (
                  <div key={index} className="relative border border-zinc-800 p-5 rounded-lg bg-zinc-950/50">
                    {formList.length > 1 && (
                      <button type="button" onClick={() => {
                        const newList = [...formList];
                        newList.splice(index, 1);
                        setFormList(newList);
                      }} className="absolute top-3 right-3 p-1.5 text-zinc-500 hover:text-red-400 bg-zinc-900 rounded transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                    {formList.length > 1 && (
                      <div className="mb-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Plot {index + 1}</div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-zinc-400 mb-1.5">Plot Number *</label>
                        <input required type="text" value={formData.plotNumber} onChange={e => updateField('plotNumber', e.target.value)} className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-sm focus:outline-none focus:border-indigo-500 transition-colors" placeholder="e.g. A-101" />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1.5">Width</label>
                        <input type="number" step="0.01" value={formData.width} onChange={e => updateField('width', e.target.value)} className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-sm focus:outline-none focus:border-indigo-500 transition-colors" placeholder="0.00" />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1.5">Height / Depth</label>
                        <input type="number" step="0.01" value={formData.height} onChange={e => updateField('height', e.target.value)} className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-sm focus:outline-none focus:border-indigo-500 transition-colors" placeholder="0.00" />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1.5">Area (Sq. Ft.)</label>
                        <input type="number" step="0.01" value={formData.areaSqFt} onChange={e => updateField('areaSqFt', e.target.value)} className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-sm focus:outline-none focus:border-indigo-500 transition-colors" placeholder="0.00" />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-zinc-400 mb-1.5">Status</label>
                        <select value={formData.statusId} onChange={e => updateField('statusId', e.target.value)} className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-sm focus:outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer">
                          <option value="">Select Status</option>
                          {statuses.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-zinc-400 mb-1.5">Description</label>
                        <input type="text" value={formData.description} onChange={e => updateField('description', e.target.value)} className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-sm focus:outline-none focus:border-indigo-500 transition-colors" placeholder="Optional details..." />
                      </div>
                    </div>
                  </div>
                );
              })}

              {!editingId && (
                <button 
                  type="button" 
                  onClick={() => setFormList([...formList, { ...emptyForm, statusId: statuses.length > 0 ? statuses[0].id : '' }])} 
                  className="w-full py-3 mt-2 border-2 border-dashed border-indigo-500/50 rounded-lg text-indigo-400 hover:bg-indigo-500/10 hover:border-indigo-500 flex justify-center items-center gap-2 transition-colors font-medium text-sm"
                >
                  <Plus size={16} /> Add More Plots
                </button>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t border-zinc-800 mt-6 sticky bottom-0 bg-zinc-900 pb-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-md shadow transition-colors">
                  {editingId ? 'Save Changes' : (formList.length > 1 ? `Create ${formList.length} Plots` : 'Create Plot')}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
