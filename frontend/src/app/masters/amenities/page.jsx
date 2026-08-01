'use client';
import { useState, useEffect } from 'react';
import { getAmenities, createAmenity, updateAmenity, deleteAmenity, uploadAmenityIcon } from '@/lib/api';
import { Plus, Edit2, Trash2, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import Swal from 'sweetalert2';

export default function AmenitiesMasterPage() {
  const [amenities, setAmenities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    iconPath: ''
  });
  
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchAmenities();
  }, []);

  const fetchAmenities = async () => {
    try {
      setLoading(true);
      const data = await getAmenities();
      setAmenities(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleIconUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      setUploading(true);
      const { iconPath } = await uploadAmenityIcon(file);
      setFormData(prev => ({ ...prev, iconPath }));
    } catch (err) {
      alert('Failed to upload icon');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateAmenity(editingId, formData);
      } else {
        await createAmenity(formData);
      }
      setIsModalOpen(false);
      fetchAmenities();
    } catch (err) {
      alert('Failed to save amenity');
    }
  };

  const openModal = (amenity = null) => {
    if (amenity) {
      setEditingId(amenity.id);
      setFormData({
        name: amenity.name,
        category: amenity.category,
        description: amenity.description || '',
        iconPath: amenity.iconPath
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', category: '', description: '', iconPath: '' });
    }
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete Amenity?',
      text: 'Are you sure you want to delete this amenity? This action cannot be undone.',
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
        await deleteAmenity(id);
        Swal.fire({ title: 'Deleted!', text: 'Amenity has been deleted.', icon: 'success', background: '#18181b', color: '#fff' });
        fetchAmenities();
      } catch (err) {
        Swal.fire({ title: 'Error', text: 'Failed to delete amenity', icon: 'error', background: '#18181b', color: '#fff' });
      }
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Amenity Master</h1>
            <p className="text-zinc-400 mt-1">Manage global amenities to be used across all projects.</p>
          </div>
          <div className="flex gap-4">
            <Link href="/" className="px-4 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors flex items-center">
              Back to Home
            </Link>
            <button 
              onClick={() => openModal()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-md shadow flex items-center gap-2 transition-colors"
            >
              <Plus size={16} /> Add Amenity
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-zinc-950/50 border-b border-zinc-800">
              <tr>
                <th className="px-6 py-4 font-medium text-zinc-400">Icon</th>
                <th className="px-6 py-4 font-medium text-zinc-400">Name</th>
                <th className="px-6 py-4 font-medium text-zinc-400">Category</th>
                <th className="px-6 py-4 font-medium text-zinc-400 w-full">Description</th>
                <th className="px-6 py-4 font-medium text-zinc-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {loading ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-zinc-500">Loading...</td></tr>
              ) : amenities.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-zinc-500">No amenities found.</td></tr>
              ) : (
                amenities.map(amenity => (
                  <tr key={amenity.id} className="hover:bg-zinc-800/20 transition-colors">
                    <td className="px-6 py-4">
                      {amenity.iconPath ? (
                        <img src={`http://localhost:5000${amenity.iconPath}`} alt={amenity.name} className="w-10 h-10 object-contain bg-zinc-800 rounded p-1" />
                      ) : (
                        <div className="w-10 h-10 bg-zinc-800 rounded flex items-center justify-center text-zinc-500">
                          <ImageIcon size={20} />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-zinc-200">{amenity.name}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 text-xs font-medium bg-zinc-800 text-zinc-300 rounded-full">
                        {amenity.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-zinc-500 truncate max-w-xs">{amenity.description || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openModal(amenity)} className="p-2 text-zinc-400 hover:text-indigo-400 bg-zinc-950 hover:bg-zinc-800 rounded transition-colors">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(amenity.id)} className="p-2 text-zinc-400 hover:text-red-400 bg-zinc-950 hover:bg-zinc-800 rounded transition-colors">
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

      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-zinc-800">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit Amenity' : 'Add Amenity'}</h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              
              <div className="flex gap-4">
                {/* Icon Preview/Upload */}
                <div className="shrink-0">
                  <label className="block text-sm font-medium text-zinc-400 mb-1.5">Icon</label>
                  <div className="relative group cursor-pointer w-24 h-24 bg-zinc-950 border border-dashed border-zinc-700 hover:border-indigo-500 rounded-lg flex items-center justify-center overflow-hidden transition-colors">
                    {formData.iconPath ? (
                      <img src={`http://localhost:5000${formData.iconPath}`} alt="Preview" className="w-full h-full object-contain p-2" />
                    ) : (
                      <ImageIcon className="text-zinc-600 group-hover:text-indigo-500 transition-colors" size={24} />
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <span className="text-xs font-medium text-white">{uploading ? 'Uploading...' : 'Change'}</span>
                    </div>
                    <input 
                      type="file" 
                      accept="image/png, image/jpeg, image/svg+xml, image/webp" 
                      onChange={handleIconUpload}
                      disabled={uploading}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
                
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1.5">Name *</label>
                    <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-sm focus:outline-none focus:border-indigo-500 transition-colors" placeholder="e.g. Club House" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-400 mb-1.5">Category *</label>
                    <input required type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-sm focus:outline-none focus:border-indigo-500 transition-colors" placeholder="e.g. Leisure" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Description</label>
                <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none h-20" placeholder="Optional details..." />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-zinc-800 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors">Cancel</button>
                <button type="submit" disabled={uploading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-md shadow transition-colors">
                  {editingId ? 'Save Changes' : 'Create Amenity'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
