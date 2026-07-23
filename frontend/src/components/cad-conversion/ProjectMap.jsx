import React from 'react';
import Link from 'next/link';
import { MapPin, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function ProjectMap({ project }) {
  if (!project) return null;

  const hasLocation = project.latitude != null && project.longitude != null;

  return (
    <div className="flex flex-col bg-zinc-950 text-zinc-300 rounded-xl border border-zinc-800 overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
        <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
          <MapPin size={16} className="text-indigo-400" />
          Project Location
        </h2>
      </div>
      
      <div className="p-6 flex flex-col items-center justify-center text-center space-y-4">
        {hasLocation ? (
          <>
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 mb-2">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h3 className="text-lg font-medium text-zinc-100">Location Selected ✓</h3>
              {project.address ? (
                <p className="text-sm text-zinc-400 mt-1 line-clamp-2" title={project.address}>
                  {project.address}
                </p>
              ) : (
                <p className="text-sm text-zinc-400 mt-1">
                  {project.latitude.toFixed(6)}, {project.longitude.toFixed(6)}
                </p>
              )}
              <p className="text-xs text-zinc-500 mt-1">Zoom Level: {project.mapZoom || 16}</p>
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500 mb-2">
              <MapPin size={32} />
            </div>
            <div>
              <h3 className="text-lg font-medium text-zinc-100">No Location Set</h3>
              <p className="text-sm text-zinc-400 mt-1">
                Pin this project on the map to enable GIS features.
              </p>
            </div>
          </>
        )}

        <Link 
          href={`/cad-conversion/${project.id}/map`}
          className="mt-4 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors font-medium flex items-center gap-2 w-full justify-center"
        >
          {hasLocation ? 'Edit Map Location' : 'Continue to Map'}
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
