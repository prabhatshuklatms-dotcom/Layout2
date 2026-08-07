'use client';
import { useState, useEffect, use } from 'react';
import PlotStatusForm from '@/components/cad-conversion/plot-statuses/PlotStatusForm';
import { getPlotStatus } from '@/lib/api';

export default function EditPlotStatusPage({ params }) {
  const unwrappedParams = use(params);
  const projectId = unwrappedParams.projectId;
  const statusId = unwrappedParams.statusId;
  
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getPlotStatus(statusId)
      .then(data => {
        setStatusData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load status');
        setLoading(false);
      });
  }, [statusId]);

  if (loading) {
    return <div className="min-h-screen bg-zinc-950 p-8 flex items-center justify-center text-zinc-500">Loading status details...</div>;
  }

  if (error) {
    return <div className="min-h-screen bg-zinc-950 p-8 flex items-center justify-center text-red-500">{error}</div>;
  }

  return <PlotStatusForm projectId={projectId} statusId={statusId} initialData={statusData} />;
}
