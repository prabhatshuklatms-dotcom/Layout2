'use client';
import { use } from 'react';
import PlotForm from '@/components/cad-conversion/plots/PlotForm';

export default function AddPlotPage({ params }) {
  const unwrappedParams = use(params);
  const projectId = unwrappedParams.projectId;
  
  return <PlotForm projectId={projectId} />;
}
