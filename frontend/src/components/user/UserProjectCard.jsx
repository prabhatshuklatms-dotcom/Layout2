import React from 'react';
import Link from 'next/link';
import { MapPin, LayoutTemplate, ArrowRight } from 'lucide-react';

export default function UserProjectCard({ project }) {
  // If there's no explicitly set image, use a placeholder gradient
  const placeholderGradient = `linear-gradient(135deg, #2d3b55 0%, #1e293b 100%)`;

  return (
    <div className="group relative flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-[#d4af37] transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50">
      {/* Cover Image Area */}
      <div 
        className="w-full h-48 sm:h-56 relative overflow-hidden"
        style={{ background: placeholderGradient }}
      >
        {/* Placeholder for real image if added later */}
        {project.coverImage && (
          <img 
            src={project.coverImage} 
            alt={project.originalFileName} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        )}
        
        {/* Status Badge */}
        <div className="absolute top-4 right-4 px-3 py-1 bg-white/90 backdrop-blur-md border border-slate-200 rounded-full text-xs font-semibold text-[#d4af37] shadow-sm">
          Active
        </div>
      </div>

      {/* Content Area */}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="text-lg sm:text-xl font-bold text-[#2d3b55] mb-2 truncate">
          {project.name}
        </h3>
        
        <div className="flex items-center justify-between text-slate-500 text-sm mb-4">
          <div className="flex items-center">
            <MapPin className="w-4 h-4 mr-1 text-[#d4af37]" />
            <span className="truncate font-medium">{project.city || project.address || 'Prime Location'}</span>
          </div>
          {project.createdAt && (
            <span className="text-xs text-slate-400">{new Date(project.createdAt).toLocaleDateString()}</span>
          )}
        </div>
        
        <p className="text-slate-600 text-sm line-clamp-2 mb-6 flex-1 leading-relaxed">
          Explore the layout and premium plots for this upcoming development.
        </p>
        
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
          <div className="flex gap-3 items-center text-xs font-medium text-slate-500">
            <div className="flex items-center">
              <LayoutTemplate className="w-4 h-4 mr-1 text-slate-400" />
              <span>{project._count?.conversions || 0} Layouts</span>
            </div>
            <div className="flex items-center">
              <span className="w-1.5 h-1.5 bg-[#d4af37] rounded-full mr-1.5"></span>
              <span>{project._count?.plots || 0} Plots</span>
            </div>
          </div>
          
          <Link 
            href={`/projects/${project.id}`}
            className="flex items-center text-sm font-bold text-[#d4af37] hover:text-yellow-600 transition-colors group-hover:translate-x-1 duration-300"
          >
            View Project
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </div>
    </div>
  );
}
