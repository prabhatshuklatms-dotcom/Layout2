import ProjectBoundaryWorkspace from '@/components/cad-conversion/ProjectBoundaryWorkspace';

export const metadata = {
  title: 'CAD Project Land Boundary | Layout',
};

export default async function ProjectMapPage({ params }) {
  const { projectId } = await params;
  return <ProjectBoundaryWorkspace projectId={projectId} />;
}

