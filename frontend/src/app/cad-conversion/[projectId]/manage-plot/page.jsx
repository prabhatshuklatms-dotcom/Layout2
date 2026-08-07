'use client';
import { useState, useEffect, use } from 'react';
import { getProjectPlots, deleteProjectPlot, getProjectPlotStatuses, getCadProject, updateProjectPlotAssignment } from '@/lib/api';
import { Plus, Edit2, Trash2, Search, Filter, ArrowLeft } from 'lucide-react';
import { getContrastYIQ } from '@/lib/utils';
import { PLOT_TYPE_CONFIG } from '@/lib/plotTypeConfig';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Swal from 'sweetalert2';

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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Keep local filters but note they only apply to the current page 
  // since backend filtering for these wasn't explicitly requested.
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAssignment, setFilterAssignment] = useState('');
  
  const [sortConfig, setSortConfig] = useState({ key: 'plotNumber', direction: 'asc' });
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1); // Reset to page 1 on new search
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch initial project & statuses
  useEffect(() => {
    Promise.all([
      getProjectPlotStatuses(projectId, { pagination: false }),
      getCadProject(projectId)
    ])
    .then(([statusesData, projectData]) => {
      setStatuses(statusesData);
      setProject(projectData);
    })
    .catch(console.error);
  }, [projectId]);

  // Fetch paginated plots
  useEffect(() => {
    fetchPlots();
  }, [projectId, currentPage, debouncedSearch]);

  const fetchPlots = async () => {
    try {
      setLoading(true);
      const res = await getProjectPlots(projectId, { 
        page: currentPage, 
        limit, 
        search: debouncedSearch 
      });
      
      // Handle the new response format or fallback to array if unpaginated (should be paginated here)
      if (res && res.pagination) {
        setPlots(res.data);
        setTotalRecords(res.pagination.total);
        setTotalPages(res.pagination.totalPages);
      } else if (Array.isArray(res)) {
        setPlots(res);
        setTotalRecords(res.length);
        setTotalPages(Math.ceil(res.length / limit));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete Plot?',
      text: 'Are you sure you want to delete this plot? This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#3f3f46',
      confirmButtonText: 'Yes, Delete',
      background: '#18181b',
      color: '#fff'
    });

    if (result.isConfirmed) {
      try {
        await deleteProjectPlot(projectId, id);
        Swal.fire({ title: 'Deleted!', text: 'Plot has been deleted.', icon: 'success', background: '#18181b', color: '#fff' });
        fetchPlots();
      } catch (err) {
        Swal.fire({ title: 'Error', text: 'Failed to delete plot', icon: 'error', background: '#18181b', color: '#fff' });
      }
    }
  };

  const handleAssignmentChange = async (plot, newValue) => {
    try {
      let cadRegionId = null;
      if (newValue === 'assigned') {
        const { value: manualId } = await Swal.fire({
          title: 'Assign CAD Region',
          input: 'text',
          inputLabel: 'Enter the CAD shape ID (e.g., shape-1234)',
          inputPlaceholder: 'CAD Region ID',
          showCancelButton: true,
          inputValidator: (value) => {
            if (!value) return 'You need to write something!';
          }
        });
        if (!manualId) {
          setPlots([...plots]);
          return;
        }
        cadRegionId = manualId;
      }
      setPlots(prev => prev.map(p => p.id === plot.id ? { ...p, cadRegionId } : p));
      await updateProjectPlotAssignment(projectId, plot.id, { cadRegionId });
      Swal.fire({ icon: 'success', title: 'Success', text: 'Assignment updated successfully.', timer: 2000, showConfirmButton: false });
    } catch (error) {
      console.error(error);
      fetchPlots();
      Swal.fire({ icon: 'error', title: 'Error', text: 'Failed to update assignment.' });
    }
  };

  const filteredPlots = plots.filter(plot => {
    const matchesStatus = filterStatus ? plot.statusId === parseInt(filterStatus) : true;
    let matchesAssignment = true;
    if (filterAssignment === 'available') matchesAssignment = !plot.cadRegionId;
    if (filterAssignment === 'assigned') matchesAssignment = !!plot.cadRegionId;
    return matchesStatus && matchesAssignment;
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

    if (sortConfig.key === 'plotNumber') {
      return sortConfig.direction === 'asc' 
        ? aVal.toString().localeCompare(bVal.toString(), undefined, { numeric: true, sensitivity: 'base' })
        : bVal.toString().localeCompare(aVal.toString(), undefined, { numeric: true, sensitivity: 'base' });
    }

    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

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
            <Link 
              href={`/cad-conversion/${projectId}/add-plot`}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-md shadow flex items-center gap-2 transition-colors"
            >
              <Plus size={16} /> Add Plot
            </Link>
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
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <select 
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
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
              onChange={e => setFilterAssignment(e.target.value)}
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
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-zinc-950/50 border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-4 font-medium text-zinc-400 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('plotNumber')}>Plot Number {sortConfig.key === 'plotNumber' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="px-6 py-4 font-medium text-zinc-400 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('plotType')}>Plot Type {sortConfig.key === 'plotType' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="px-6 py-4 font-medium text-zinc-400">Dimensions</th>
                  <th className="px-6 py-4 font-medium text-zinc-400 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('areaSqFt')}>Area (Sq. Ft.) {sortConfig.key === 'areaSqFt' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="px-6 py-4 font-medium text-zinc-400 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('status')}>Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="px-6 py-4 font-medium text-zinc-400 cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('cadRegionId')}>Assignment {sortConfig.key === 'cadRegionId' && (sortConfig.direction === 'asc' ? '↑' : '↓')}</th>
                  <th className="px-6 py-4 font-medium text-zinc-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {loading ? (
                  <tr><td colSpan="7" className="px-6 py-8 text-center text-zinc-500">Loading plots...</td></tr>
                ) : sortedPlots.length === 0 ? (
                  <tr><td colSpan="7" className="px-6 py-8 text-center text-zinc-500">No plots found.</td></tr>
                ) : (
                  sortedPlots.map(plot => (
                    <tr key={plot.id} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-zinc-200">{plot.plotNumber}</td>
                      <td className="px-6 py-4 text-zinc-400">{PLOT_TYPE_CONFIG[plot.plotType]?.displayName || plot.plotType}</td>
                      <td className="px-6 py-4 text-zinc-400">
                        {plot.dimensions?.length > 0 
                          ? (
                              <table className="text-xs">
                                <tbody>
                                  {plot.dimensions.map((d, i) => {
                                    const config = PLOT_TYPE_CONFIG[plot.plotType];
                                    const isMissing = d.value === null || d.value === undefined || d.value === '';
                                    const val = isMissing ? '—' : Number(d.value).toFixed(2);
                                    const unit = isMissing ? '' : (d.unit || 'm');
                                    
                                    if (config?.hideLabels) {
                                      return (
                                        <tr key={i}>
                                          <td className="text-zinc-200 font-medium py-0.5">{val} {unit}</td>
                                        </tr>
                                      );
                                    }
                                    
                                    return (
                                      <tr key={i}>
                                        <td className="text-zinc-500 pr-2 py-0.5 whitespace-nowrap text-right">{d.label}</td>
                                        <td className="text-zinc-600 pr-2 py-0.5">:</td>
                                        <td className="text-zinc-200 font-medium py-0.5 whitespace-nowrap">{val} {unit}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )
                          : '-'}
                      </td>
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
                        <select
                          value={plot.cadRegionId ? 'assigned' : 'available'}
                          onChange={(e) => handleAssignmentChange(plot, e.target.value)}
                          className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs font-medium focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                          <option value="available" className="text-green-400">🟢 Available</option>
                          <option value="assigned" className="text-blue-400">🔵 Assigned</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/cad-conversion/${projectId}/manage-plot/${plot.id}/edit`} className="p-2 text-zinc-400 hover:text-indigo-400 bg-zinc-950 hover:bg-zinc-800 rounded transition-colors">
                            <Edit2 size={16} />
                          </Link>
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
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900 gap-4">
            <div className="text-sm text-zinc-400">
              Showing {totalRecords === 0 ? 0 : ((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalRecords)} of {totalRecords} plots
            </div>
            
            <div className="flex gap-2 items-center">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1 || totalRecords === 0}
                className="px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-sm text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors font-medium"
              >
                Previous
              </button>
              
              <div className="hidden sm:flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-9 h-9 flex items-center justify-center rounded-md text-sm font-medium transition-colors ${
                      currentPage === pageNum 
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm' 
                        : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
              </div>

              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || totalRecords === 0}
                className="px-4 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-sm text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors font-medium"
              >
                Next
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
