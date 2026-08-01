import CadEditorWorkspace from '@/components/cad-conversion/editor/CadEditorWorkspace';

export const metadata = {
  title: 'CAD Editor | Layout',
};

export default async function CadProjectEditorPage({ params }) {
  const { projectId, editorId } = await params;
  return <CadEditorWorkspace conversionId={editorId} projectId={projectId} />;
}
