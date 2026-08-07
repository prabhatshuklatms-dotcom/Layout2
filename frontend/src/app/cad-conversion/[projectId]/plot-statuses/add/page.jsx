'use client';
import { use } from 'react';
import PlotStatusForm from '@/components/cad-conversion/plot-statuses/PlotStatusForm';

export default function AddPlotStatusPage({ params }) {
  const unwrappedParams = use(params);
  const projectId = unwrappedParams.projectId;
  
  return <PlotStatusForm projectId={projectId} />;
}
