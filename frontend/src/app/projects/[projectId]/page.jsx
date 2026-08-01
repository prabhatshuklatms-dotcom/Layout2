import React from 'react';
import UserProjectDetails from '@/components/user/UserProjectDetails';

export const metadata = {
  title: 'Project Details | Real Estate',
  description: 'View layout and available plots.',
};

export default async function ProjectDetailsRoute({ params }) {
  const resolvedParams = await params;
  return <UserProjectDetails projectId={resolvedParams.projectId} />;
}
