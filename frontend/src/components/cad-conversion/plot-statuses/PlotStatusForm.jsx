'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { createPlotStatus, updatePlotStatus } from '@/redux/slices/plotStatusesSlice';
import { ArrowLeft } from 'lucide-react';
import { ColorPicker, ConfigProvider, theme } from 'antd';
import Link from 'next/link';
import Swal from 'sweetalert2';

export default function PlotStatusForm({ projectId, statusId, initialData, currentMaxOrder }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const isEditing = !!statusId;

  const emptyForm = { name: '', fillColor: '#000000', isActive: true };
  const [formData, setFormData] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEditing && initialData) {
      setFormData({
        name: initialData.name || '',
        fillColor: initialData.fillColor || '#000000',
        isActive: initialData.isActive ?? true
      });
    }
  }, [isEditing, initialData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload = { ...formData };

      if (isEditing) {
        await dispatch(updatePlotStatus({ projectId, id: statusId, body: payload })).unwrap();
      } else {
        await dispatch(createPlotStatus({ projectId, body: payload })).unwrap();
      }
      
      router.push(`/cad-conversion/${projectId}/plot-statuses`);
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err || 'Failed to save plot status'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100 flex flex-col">
      <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/cad-conversion/${projectId}/plot-statuses`} className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-lg transition-colors border border-zinc-800">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{isEditing ? 'Edit Plot Status' : 'Add Plot Status'}</h1>
            <p className="text-zinc-400 mt-1">{isEditing ? `Editing status for project #${projectId}` : `Create a new status for project #${projectId}`}</p>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
          <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
            <div className="p-6 space-y-6">
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
                <div className="flex items-center gap-3 w-full">
                  <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
                    <ColorPicker
                      format="hex"
                      value={formData.fillColor}
                      onChange={(color) => setFormData(prev => ({ ...prev, fillColor: typeof color === 'string' ? color : color.toHexString() }))}
                      showText
                      size="large"
                      className="bg-zinc-950 border-zinc-800 text-white w-full flex justify-start"
                    />
                  </ConfigProvider>
                </div>
              </div>

              <div>
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
            
            <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 flex justify-end gap-3">
              <Link
                href={`/cad-conversion/${projectId}/plot-statuses`}
                className="px-5 py-2.5 text-sm font-medium text-zinc-400 hover:text-white transition-colors bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-lg"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg shadow-lg transition-all"
              >
                {loading ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Status')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
