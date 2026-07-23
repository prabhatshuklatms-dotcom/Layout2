import ProjectMapWorkspace from '@/components/cad-conversion/ProjectMapWorkspace';

export const metadata = {
  title: 'CAD Project Map Workspace | Layout',
};

export default async function ProjectMapPage({ params }) {
  const { projectId } = await params;
  return <ProjectMapWorkspace projectId={projectId} />;
}
