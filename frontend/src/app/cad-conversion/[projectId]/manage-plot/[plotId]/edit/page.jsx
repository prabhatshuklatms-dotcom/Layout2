'use client';
import { useState, useEffect, use } from 'react';
import PlotForm from '@/components/cad-conversion/plots/PlotForm';
import { getProjectPlot } from '@/lib/api';

export default function EditPlotPage({ params }) {
  const unwrappedParams = use(params);
  const projectId = unwrappedParams.projectId;
  const plotId = unwrappedParams.plotId;
  
  const [plot, setPlot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getProjectPlot(plotId)
      .then(data => {
        setPlot(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load plot');
        setLoading(false);
      });
  }, [plotId]);

  if (loading) {
    return <div className="min-h-screen bg-zinc-950 p-8 flex items-center justify-center text-zinc-500">Loading plot details...</div>;
  }

  if (error) {
    return <div className="min-h-screen bg-zinc-950 p-8 flex items-center justify-center text-red-500">{error}</div>;
  }

  return <PlotForm projectId={projectId} plotId={plotId} initialData={plot} />;
}
