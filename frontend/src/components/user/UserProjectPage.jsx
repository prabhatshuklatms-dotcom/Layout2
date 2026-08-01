'use client';

import React, { useState, useEffect } from 'react';
import UserNavbar from './UserNavbar';
import { getPublicProjects } from '@/lib/api';
import UserProjectGrid from './UserProjectGrid';
import UserProjectLoading from './UserProjectLoading';
import UserProjectEmptyState from './UserProjectEmptyState';

export default function UserProjectPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchProjects() {
      try {
        setLoading(true);
        const data = await getPublicProjects();
        setProjects(data || []);
      } catch (err) {
        console.error('Failed to fetch projects:', err);
        setError('Failed to load projects. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchProjects();
  }, []);

  return (
    <>
      <UserNavbar />
      <div className="min-h-screen bg-[#f4f2ef] text-[#2d3b55] selection:bg-[#d4af37]/30 font-sans">
      
      {/* Hero Banner Section */}
      <div className="w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="w-full sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl ml-auto">
            <img 
              src="/1.png" 
              alt="Delawala Group Premium Projects" 
              className="w-full h-auto object-contain mix-blend-multiply"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <UserProjectLoading />
        ) : projects.length === 0 ? (
          <UserProjectEmptyState />
        ) : (
          <UserProjectGrid projects={projects} />
        )}
      </div>
      </div>
    </>
  );
}
