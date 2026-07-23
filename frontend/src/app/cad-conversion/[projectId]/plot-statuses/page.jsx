'use client';
import { useState, useEffect, use } from 'react';
import { getProjectPlotStatuses, createProjectPlotStatus, updateProjectPlotStatus, deleteProjectPlotStatus, getCadProject } from '@/lib/api';
import { Plus, Edit2, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

export default function ProjectPlotStatusesPage({ params }) {
  const unwrappedParams = use(params);
  const projectId = unwrappedParams.projectId;
  
  const searchParams = useSearchParams();
  const editorId = searchParams.get('editorId');
  const router = useRouter();
  
  const [statuses, setStatuses] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const emptyForm = { name: '', fillColor: '#000000', description: '', isActive: true, displayOrder: 0 };
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statusesData, projectData] = await Promise.all([
        getProjectPlotStatuses(projectId),
        getCadProject(projectId)
      ]);
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
      const payload = {
        ...formData,
        displayOrder: parseInt(formData.displayOrder) || 0
      };

      if (editingId) {
        await updateProjectPlotStatus(projectId, editingId, payload);
      } else {
        await createProjectPlotStatus(projectId, payload);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to save plot status');
    }
  };

  const openModal = (status = null) => {
    if (status) {
      setEditingId(status.id);
      setFormData({
        name: status.name,
        fillColor: status.fillColor,
        description: status.description || '',
        isActive: status.isActive ?? true,
        displayOrder: status.displayOrder ?? 0
      });
    } else {
      setEditingId(null);
      setFormData({ ...emptyForm, displayOrder: statuses.length + 1 });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id, name) => {
    if (confirm(`Are you sure you want to delete status "${name}"?`)) {
      try {
        await deleteProjectPlotStatus(projectId, id);
        fetchData();
      } catch (err) {
        alert(err.message || 'Failed to delete plot status');
      }
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <Link 
                href={editorId ? `/cad-conversion/${projectId}/editor/${editorId}` : `/cad-conversion`}
                className="p-2 hover:bg-zinc-800 rounded-full transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-zinc-400" />
              </Link>
              <h1 className="text-2xl font-bold">Project Plot Statuses</h1>
            </div>
            <p className="text-zinc-400 ml-11">
              Manage custom statuses for <span className="text-white font-medium">{project?.name}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">

            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Status
            </button>
          </div>
        </div>

        {/* Statuses Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-400">
              <thead className="text-xs uppercase bg-zinc-800/50 text-zinc-300">
                <tr>
                  <th className="px-6 py-4 font-medium">Order</th>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Color</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {statuses.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-zinc-500">
                      No statuses defined for this project.
                    </td>
                  </tr>
                ) : (
                  statuses.map((status) => (
                    <tr key={status.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-6 py-4">{status.displayOrder}</td>
                      <td className="px-6 py-4 font-medium text-white">{status.name}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-6 h-6 rounded border border-zinc-700 shadow-sm"
                            style={{ backgroundColor: status.fillColor }}
                          />
                          <span className="font-mono text-xs">{status.fillColor}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          status.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-500/10 text-zinc-400'
                        }`}>
                          {status.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openModal(status)}
                            className="p-2 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded transition-colors"
                            title="Edit Status"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(status.id, status.name)}
                            className="p-2 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 rounded transition-colors"
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
        </div>
      </div>

      {/* Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-zinc-800 shrink-0">
              <h2 className="text-xl font-bold">{editingId ? 'Edit Status' : 'Add Status'}</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Status Name</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                    placeholder="e.g. Premium"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Fill Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      required
                      type="color"
                      value={formData.fillColor}
                      onChange={e => setFormData(prev => ({ ...prev, fillColor: e.target.value }))}
                      className="w-12 h-12 rounded cursor-pointer bg-zinc-950 border border-zinc-800"
                    />
                    <input
                      required
                      type="text"
                      value={formData.fillColor}
                      onChange={e => setFormData(prev => ({ ...prev, fillColor: e.target.value }))}
                      className="flex-1 px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-white"
                      placeholder="#000000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Description (Optional)</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white resize-none"
                    placeholder="Brief description..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-zinc-400 mb-1.5">Display Order</label>
                    <input
                      type="number"
                      value={formData.displayOrder}
                      onChange={e => setFormData(prev => ({ ...prev, displayOrder: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-white"
                    />
                  </div>
                  <div className="flex-1 flex items-center pt-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={e => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                        className="w-5 h-5 rounded border-zinc-700 text-indigo-600 focus:ring-indigo-500 bg-zinc-900"
                      />
                      <span className="text-sm font-medium text-white">Active Status</span>
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 shrink-0 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Save Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
