'use client';

import React, { useState, useEffect } from 'react';
import { getCadProject, getCadConversions } from '@/lib/api';
import UserLayoutViewer from './UserLayoutViewer';
import UserProjectLoading from './UserProjectLoading';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function UserProjectDetails({ projectId }) {
  const [project, setProject] = useState(null);
  const [activeConversion, setActiveConversion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        // Fetch project and its conversions
        const [projectData, conversionsData] = await Promise.all([
          getCadProject(projectId),
          getCadConversions(projectId)
        ]);
        
        setProject(projectData);
        
        // Find the first successful conversion to display as the layout
        if (conversionsData && conversionsData.length > 0) {
          const successConversion = conversionsData.find(c => c.status === 'SUCCESS') || conversionsData[0];
          setActiveConversion(successConversion);
        }
      } catch (err) {
        console.error('Failed to fetch project details:', err);
        setError('Failed to load project details. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    
    if (projectId) {
      fetchData();
    }
  }, [projectId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <UserProjectLoading />
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] text-slate-200 flex flex-col items-center justify-center p-8">
        <h2 className="text-2xl font-bold mb-4">Project Not Found</h2>
        <p className="text-slate-400 mb-8">{error || "The project you're looking for doesn't exist or is unavailable."}</p>
        <Link href="/projects" className="px-6 py-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors">
          Back to Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0B0B0B] overflow-hidden">
      {activeConversion && activeConversion.status === 'SUCCESS' ? (
        <UserLayoutViewer project={project} conversion={activeConversion} />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center">
          <h2 className="text-2xl font-bold text-slate-200 mb-4">No Layout Available</h2>
          <p className="text-slate-400 max-w-md text-center mb-8">
            This project does not have a finalized master plan layout available for viewing yet.
          </p>
          <Link href="/projects" className="px-6 py-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Projects
          </Link>
        </div>
      )}
    </div>
  );
}
