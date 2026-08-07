'use client';
import { useState, useEffect, use } from 'react';
import { getProjectPlotStatuses, deleteProjectPlotStatus, getCadProject } from '@/lib/api';
import { Plus, Edit2, Trash2, ArrowLeft, Search } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

export default function ProjectPlotStatusesPage({ params }) {
  const unwrappedParams = use(params);
  const projectId = unwrappedParams.projectId;
  
  const searchParams = useSearchParams();
  const editorId = searchParams.get('editorId');
  const router = useRouter();
  
  const [statuses, setStatuses] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    getCadProject(projectId)
      .then(setProject)
      .catch(console.error);
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [projectId, currentPage, debouncedSearch]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await getProjectPlotStatuses(projectId, {
        page: currentPage,
        limit,
        search: debouncedSearch
      });
      
      if (res && res.pagination) {
        setStatuses(res.data);
        setTotalRecords(res.pagination.total);
        setTotalPages(res.pagination.totalPages);
      } else if (Array.isArray(res)) {
        setStatuses(res);
        setTotalRecords(res.length);
        setTotalPages(Math.ceil(res.length / limit));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    const result = await Swal.fire({
      title: 'Delete Plot Status?',
      text: `Are you sure you want to delete status "${name}"? This action cannot be undone.`,
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
        await deleteProjectPlotStatus(projectId, id);
        Swal.fire({ title: 'Deleted!', text: 'Plot status has been deleted.', icon: 'success', background: '#18181b', color: '#fff' });
        fetchData();
      } catch (err) {
        Swal.fire({ title: 'Error', text: err.message || 'Failed to delete plot status', icon: 'error', background: '#18181b', color: '#fff' });
      }
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 flex flex-col">
      <div className="max-w-6xl mx-auto space-y-6 w-full flex-1 flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <Link 
                href={editorId ? `/cad-conversion/${projectId}/editor/${editorId}` : `/cad-conversion`}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors border border-transparent hover:border-zinc-700"
              >
                <ArrowLeft className="w-5 h-5 text-zinc-400" />
              </Link>
              <h1 className="text-3xl font-bold tracking-tight">Project Plot Statuses</h1>
            </div>
            <p className="text-zinc-400 ml-12">
              Manage custom statuses for <span className="text-white font-medium">{project?.name || `Project #${projectId}`}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/cad-conversion/${projectId}/plot-statuses/add`}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-md shadow transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Status
            </Link>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex gap-4 items-center bg-zinc-900 p-4 rounded-xl border border-zinc-800">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input 
              type="text" 
              placeholder="Search statuses by name..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* Statuses Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl flex-1 flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm text-zinc-400 whitespace-nowrap">
              <thead className="bg-zinc-950/50 border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-4 font-medium text-zinc-400">Name</th>
                  <th className="px-6 py-4 font-medium text-zinc-400">Color</th>
                  <th className="px-6 py-4 font-medium text-zinc-400">Status</th>
                  <th className="px-6 py-4 font-medium text-zinc-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-zinc-500">
                      Loading statuses...
                    </td>
                  </tr>
                ) : statuses.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-zinc-500">
                      No statuses found.
                    </td>
                  </tr>
                ) : (
                  statuses.map((status) => (
                    <tr key={status.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4 font-medium text-white">{status.name}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-6 h-6 rounded border border-zinc-700 shadow-sm"
                            style={{ backgroundColor: status.fillColor }}
                          />
                          <span className="font-mono text-xs text-zinc-300">{status.fillColor}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          status.isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                        }`}>
                          {status.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/cad-conversion/${projectId}/plot-statuses/${status.id}/edit`}
                            className="p-2 bg-zinc-950 hover:bg-zinc-800 border border-transparent hover:border-zinc-700 text-zinc-400 hover:text-indigo-400 rounded transition-colors"
                            title="Edit Status"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(status.id, status.name)}
                            className="p-2 bg-zinc-950 hover:bg-zinc-800 border border-transparent hover:border-zinc-700 text-zinc-400 hover:text-red-400 rounded transition-colors"
                            title="Delete Status"
                          >
                            <Trash2 className="w-4 h-4" />
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
              Showing {totalRecords === 0 ? 0 : ((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalRecords)} of {totalRecords} statuses
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
