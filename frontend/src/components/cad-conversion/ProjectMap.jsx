'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, ArrowRight, Loader2 } from 'lucide-react';
import { getProjectBoundaries } from '@/lib/api';
import dynamic from 'next/dynamic';

const LeafletMap = dynamic(() => import('@/components/map/LeafletMap'), { ssr: false });
const BOUNDARY_DRAW_MODE = { POINTER: 'POINTER' };

export default function ProjectMap({ project }) {
  const [boundary, setBoundary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (project?.id) {
      getProjectBoundaries(project.id)
        .then(bounds => {
          if (bounds && bounds.length > 0) {
            const b = bounds[0];
            if (typeof b.geoJson === 'string') {
              try { b.geoJson = JSON.parse(b.geoJson); } catch (e) {}
            }
            setBoundary(b);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [project?.id]);

  if (!project) return null;

  return (
    <div className="flex flex-col bg-zinc-950 text-zinc-300 rounded-xl border border-zinc-800 overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
        <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <MapPin size={16} className="text-indigo-400" />
          Project Location
        </h2>
      </div>
      
      <div className="flex flex-col flex-1 relative min-h-[280px]">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-zinc-500 h-full">
            <Loader2 className="animate-spin mb-2" size={24} />
            <p className="text-sm">Loading location data...</p>
          </div>
        ) : boundary ? (
          <div className="flex flex-col w-full h-full">
            {/* Map Preview */}
            <div className="w-full h-48 sm:h-64 lg:h-80 xl:h-72 2xl:h-80 relative bg-[#0a0a0a] pointer-events-none">
               <LeafletMap
                  mapType="hybrid"
                  drawMode={BOUNDARY_DRAW_MODE.POINTER}
                  drawingBoundary={false}
                  boundaries={[boundary]}
                  activeBoundaryId={null}
                  initialBounds={boundary.latMin ? [[boundary.latMin, boundary.lngMin], [boundary.latMax, boundary.lngMax]] : null}
                  staticPreview={true}
                  className="w-full h-full"
               />
               {/* Overlay to ensure it feels like a static card preview */}
               <div className="absolute inset-0 ring-1 ring-inset ring-black/50 z-10" />
            </div>
            
            {/* Details */}
            <div className="p-5 flex flex-col space-y-4 bg-zinc-900/30">
               <Link 
                 href={`/cad-conversion/${project.id}/map`}
                 className="mt-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors font-medium flex items-center gap-2 w-full justify-center"
               >
                 Continue to Map
                 <ArrowRight size={16} />
               </Link>
            </div>
          </div>
        ) : (
          <div className="p-6 flex flex-col items-center justify-center text-center space-y-4 h-full">
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500 mb-2">
              <MapPin size={32} />
            </div>
            <div>
              <h3 className="text-lg font-medium text-zinc-100">No Location Set</h3>
              <p className="text-sm text-zinc-400 mt-1">
                Pin this project on the map to enable GIS features.
              </p>
            </div>

            <Link 
              href={`/cad-conversion/${project.id}/map`}
              className="mt-4 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors font-medium flex items-center gap-2 w-full justify-center"
            >
              Continue to Map
              <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
