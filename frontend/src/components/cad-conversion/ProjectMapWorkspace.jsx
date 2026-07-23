'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { MapPin, ArrowLeft, Search, Save, Layers, Loader2, ArrowRight } from 'lucide-react';
import { getCadProject, updateCadProject } from '@/lib/api';

const LeafletMap = dynamic(() => import('@/components/map/LeafletMap'), { ssr: false });

export default function ProjectMapWorkspace({ projectId }) {
  const router = useRouter();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [mapType, setMapType] = useState('satellite'); // satellite, street, hybrid
  const [draftLocation, setDraftLocation] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);

  useEffect(() => {
    if (projectId) {
      getCadProject(projectId)
        .then((p) => {
          setProject(p);
          if (p.latitude != null && p.longitude != null) {
            setDraftLocation({ lat: p.latitude, lng: p.longitude, zoom: p.mapZoom || 16 });
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [projectId]);

  const handleMapClick = async (e) => {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    setDraftLocation(prev => ({
      ...prev,
      lat,
      lng,
      address: 'Resolving address...'
    }));

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.village || addr.county;
      const state = addr.state;
      const country = addr.country;
      const displayAddress = data.display_name;

      setDraftLocation(prev => ({
        ...prev,
        lat,
        lng,
        address: displayAddress,
        city,
        state,
        country
      }));
    } catch (err) {
      console.error('Reverse geocoding failed:', err);
      setDraftLocation(prev => ({
        ...prev,
        lat,
        lng,
        address: 'Address could not be resolved.'
      }));
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      // Use Nominatim API for open-source geocoding
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = (result) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    
    // Automatically fly the map to the location
    if (mapInstance) {
      mapInstance.flyTo([lat, lon], 16);
    }

    const addr = result.address || {};
    const city = addr.city || addr.town || addr.village || addr.county;
    const state = addr.state;
    const country = addr.country;

    setDraftLocation(prev => ({
      ...prev,
      lat,
      lng: lon,
      zoom: 16,
      address: result.display_name,
      city,
      state,
      country
    }));
    
    setSearchResults([]);
    setSearchQuery(result.display_name);
  };

  const handleSave = async () => {
    if (!draftLocation || !draftLocation.lat || !draftLocation.lng) return;
    
    try {
      const updatedProject = await updateCadProject(project.id, {
        latitude: draftLocation.lat,
        longitude: draftLocation.lng,
        mapZoom: draftLocation.zoom || 16,
        address: draftLocation.address,
        city: draftLocation.city,
        state: draftLocation.state,
        country: draftLocation.country
      });
      
      setProject(updatedProject);
      // Navigate back to the dashboard after saving
      router.push(`/cad-conversion/${project.id}`);
    } catch (err) {
      console.error('Failed to save project location', err);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <Loader2 className="animate-spin mr-2" /> Loading workspace...
      </div>
    );
  }

  const markers = [];
  if (draftLocation && draftLocation.lat && draftLocation.lng) {
    markers.push({
      position: [draftLocation.lat, draftLocation.lng],
      title: project?.name || 'Project Location',
      popup: draftLocation.address || project?.name || 'Project Location'
    });
  }

  const defaultCenter = [20.5937, 78.9629]; // Default center (India)
  const center = draftLocation?.lat ? [draftLocation.lat, draftLocation.lng] : defaultCenter;
  const zoom = draftLocation?.zoom || 5;

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden text-zinc-300">
      {/* Top Navbar */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-6 shrink-0 z-50 shadow-md">
        <div className="flex items-center gap-6">
          <Link 
            href={`/cad-conversion/${projectId}`} 
            className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>
          <div className="w-px h-6 bg-zinc-800"/>
          <h1 className="text-sm font-semibold text-zinc-100 uppercase tracking-widest flex items-center gap-2">
            <MapPin size={16} className="text-indigo-400" />
            {project?.name} - Map Workspace
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={!draftLocation?.lat}
            className="text-sm px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            Save Location
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 relative flex">
        
        {/* Floating Search & Controls Panel */}
        <div className="absolute top-6 left-6 z-[1000] flex flex-col gap-4 w-96 pointer-events-none">
          
          {/* Search Box */}
          <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-700 rounded-lg shadow-2xl p-4 pointer-events-auto">
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                placeholder="Search Address, Village, City, Coordinates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 text-zinc-100 rounded-md pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <Search size={16} className="absolute left-3 top-3 text-zinc-500" />
              <button 
                type="submit" 
                className="absolute right-2 top-1.5 p-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded flex items-center justify-center transition-colors"
              >
                {isSearching ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              </button>
            </form>

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-60 overflow-y-auto bg-zinc-950 border border-zinc-700 rounded-md shadow-xl">
                {searchResults.map((res, i) => (
                  <div 
                    key={i}
                    onClick={() => selectSearchResult(res)}
                    className="p-3 border-b border-zinc-800 last:border-0 hover:bg-zinc-900 cursor-pointer transition-colors"
                  >
                    <p className="text-sm text-zinc-200 line-clamp-2">{res.display_name}</p>
                  </div>
                ))}
              </div>
            )}
            
            {draftLocation?.lat && (
              <div className="mt-4 pt-4 border-t border-zinc-800">
                <p className="text-xs text-zinc-400 font-semibold mb-1">Selected Location:</p>
                <p className="text-sm text-zinc-200">
                  {draftLocation.address ? draftLocation.address : `${draftLocation.lat.toFixed(6)}, ${draftLocation.lng.toFixed(6)}`}
                </p>
              </div>
            )}
          </div>

          {/* Map Layer Controls */}
          <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-700 rounded-lg shadow-2xl p-2 pointer-events-auto flex items-center gap-1">
            <Layers size={16} className="text-zinc-500 ml-2 mr-1" />
            <div className="flex bg-zinc-950 rounded-md overflow-hidden p-1 gap-1">
              {['satellite', 'hybrid', 'street'].map((type) => (
                <button
                  key={type}
                  onClick={() => setMapType(type)}
                  className={`text-xs font-medium px-3 py-1.5 rounded transition-colors capitalize ${
                    mapType === type 
                      ? 'bg-zinc-800 text-white' 
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative z-0 bg-[#0a0a0a]">
          <LeafletMap
            center={center}
            zoom={zoom}
            mapType={mapType}
            markers={markers}
            onMapClick={handleMapClick}
            onMapReady={(map) => {
              setMapInstance(map);
              map.on('zoomend', () => {
                setDraftLocation(prev => prev ? { ...prev, zoom: map.getZoom() } : prev);
              });
            }}
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  );
}


