'use client';
import { useState, useEffect } from 'react';
import { createAmenity, updateAmenity, uploadAmenityIcon } from '@/lib/api';
import { Image as ImageIcon, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

export default function AmenityForm({ initialData = null }) {
  const router = useRouter();
  const isEditing = !!initialData;

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    iconPath: ''
  });
  
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        category: initialData.category || '',
        iconPath: initialData.iconPath || ''
      });
    }
  }, [initialData]);

  const handleIconUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      setUploading(true);
      const { iconPath } = await uploadAmenityIcon(file);
      setFormData(prev => ({ ...prev, iconPath }));
    } catch (err) {
      Swal.fire({ title: 'Error', text: 'Failed to upload icon', icon: 'error', background: '#18181b', color: '#fff' });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEditing) {
        await updateAmenity(initialData.id, formData);
      } else {
        await createAmenity(formData);
      }
      router.push('/masters/amenities');
    } catch (err) {
      Swal.fire({ title: 'Error', text: 'Failed to save amenity', icon: 'error', background: '#18181b', color: '#fff' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <div className="flex items-center gap-4 mb-8">
          <Link href="/masters/amenities" className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-lg transition-colors border border-zinc-800">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{isEditing ? 'Edit Amenity' : 'Add Amenity'}</h1>
            <p className="text-zinc-400 mt-1">{isEditing ? 'Modify existing amenity' : 'Create a new global amenity'}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="border border-zinc-800 p-6 rounded-xl bg-zinc-900/50 shadow-lg space-y-6">
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
                  disabled={uploading || submitting}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
            </div>
            
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Name *</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} disabled={submitting} className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-indigo-500 transition-colors" placeholder="e.g. Club House" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">Category *</label>
                <input required type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} disabled={submitting} className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-sm focus:outline-none focus:border-indigo-500 transition-colors" placeholder="e.g. Leisure" />
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-zinc-800/50 mt-6">
            <Link href="/masters/amenities" className="px-4 py-2.5 text-sm font-medium text-zinc-400 hover:text-white transition-colors flex items-center justify-center">
              Cancel
            </Link>
            <button type="submit" disabled={uploading || submitting} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg shadow-lg transition-colors flex items-center justify-center">
              {submitting ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Amenity')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
