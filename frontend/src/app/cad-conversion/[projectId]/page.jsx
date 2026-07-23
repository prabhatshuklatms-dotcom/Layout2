import CadConversionStudio from '@/components/cad-conversion/CadConversionStudio';

export const metadata = {
  title: 'CAD Conversion Studio | Layout',
};

export default async function ProjectDashboardPage({ params }) {
  const { projectId } = await params;
  return <CadConversionStudio projectId={projectId} />;
}
