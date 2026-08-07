'use client';
import { useState, useEffect, useCallback } from 'react';
import { getAmenities, deleteAmenity } from '@/lib/api';
import { Plus, Edit2, Trash2, Image as ImageIcon, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import Swal from 'sweetalert2';

// Debounce hook or utility
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

export default function AmenitiesMasterPage() {
  const [amenities, setAmenities] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;
  
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 500);

  const fetchAmenities = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getAmenities({
        page: page,
        limit,
        search: debouncedSearch
      });
      if (res && res.data) {
        setAmenities(res.data);
        setTotalPages(res.pagination?.totalPages || 1);
      } else {
        // Fallback if the backend somehow returns an array instead of paginated structure
        setAmenities(Array.isArray(res) ? res : []);
        setTotalPages(1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch]);

  useEffect(() => {
    fetchAmenities();
  }, [fetchAmenities]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

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
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Amenity Master</h1>
            <p className="text-zinc-400 mt-1">Manage global amenities to be used across all projects.</p>
          </div>
          <div className="flex gap-4 items-center">
            <Link href="/" className="px-4 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors flex items-center">
              Back to Home
            </Link>
            <Link 
              href="/masters/amenities/add"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-md shadow flex items-center gap-2 transition-colors"
            >
              <Plus size={16} /> Add Amenity
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-lg flex items-center">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-zinc-500" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="Search amenities by name..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
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
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link 
                          href={`/masters/amenities/${amenity.id}/edit`} 
                          className="p-2 text-zinc-400 hover:text-indigo-400 bg-zinc-950 hover:bg-zinc-800 rounded transition-colors"
                        >
                          <Edit2 size={16} />
                        </Link>
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
          
          {/* Pagination Controls */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-950/30">
              <span className="text-sm text-zinc-400">
                Page <span className="font-medium text-white">{page}</span> of <span className="font-medium text-white">{totalPages}</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 bg-zinc-900 border border-zinc-800 rounded hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-zinc-300"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 bg-zinc-900 border border-zinc-800 rounded hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-zinc-300"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
