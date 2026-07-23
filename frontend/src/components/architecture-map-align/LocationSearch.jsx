import React, { useState } from 'react';
import axios from 'axios';

export default function LocationSearch({ onLocationSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Check if it's lat/lng
    const coordsMatch = query.match(/^([-+]?\d{1,2}(?:\.\d+)?),\s*([-+]?\d{1,3}(?:\.\d+)?)$/);
    if (coordsMatch) {
      onLocationSelect({ lat: parseFloat(coordsMatch[1]), lng: parseFloat(coordsMatch[2]) });
      setOpen(false);
      return;
    }

    setSearching(true);
    setOpen(true);
    try {
      const res = await axios.get(`https://nominatim.openstreetmap.org/search`, {
        params: { q: query, format: 'json', limit: 5 }
      });
      setResults(res.data || []);
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = (result) => {
    onLocationSelect({ lat: parseFloat(result.lat), lng: parseFloat(result.lon) });
    setOpen(false);
    setQuery(result.display_name);
  };

  return (
    <div className="relative w-80">
      <form onSubmit={handleSearch} className="relative">
        <input 
          type="text" 
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search area, city, or lat,lng..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-3 pr-10 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 shadow-md"
        />
        <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-indigo-400">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
      </form>
      
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden z-[9999]">
          {searching ? (
            <div className="p-2 text-xs text-zinc-400 text-center">Searching...</div>
          ) : (
            results.map((r, i) => (
              <button 
                key={i}
                onClick={() => handleSelect(r)}
                className="w-full text-left px-3 py-2 text-[11px] text-zinc-300 hover:bg-zinc-700 hover:text-white border-b border-zinc-700/50 last:border-0 truncate"
                title={r.display_name}
              >
                {r.display_name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
