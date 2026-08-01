import React from 'react';
import UserProjectMap from '@/components/user/UserProjectMap';

export const metadata = {
  title: 'Project Map | Real Estate',
  description: 'View the project location and boundaries on the map.',
};

export default async function ProjectMapRoute({ params }) {
  const resolvedParams = await params;
  return <UserProjectMap projectId={resolvedParams.projectId} />;
}
