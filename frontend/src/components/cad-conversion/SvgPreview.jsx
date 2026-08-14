import React from 'react';
import { AlertCircle, Image as ImageIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import CadEditorWorkspace from './editor/CadEditorWorkspace';

export default function SvgPreview({ conversion, conversions = [], projectId }) {
  const router = useRouter();

  const renderContent = () => {
    if (!conversion) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 bg-[#0A0A0A]">
          <ImageIcon size={48} className="mb-4 opacity-50" />
          <p>No conversion selected</p>
        </div>
      );
    }

    if (conversion.status === 'PROCESSING') {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 bg-[#0A0A0A]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mb-4"></div>
          <p>Converting {conversion.originalFileName}...</p>
        </div>
      );
    }

    if (conversion.status === 'FAILED') {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500 bg-[#0A0A0A]">
          <AlertCircle size={48} className="mb-4 opacity-50" />
          <p>Conversion Failed</p>
        </div>
      );
    }

    return (
      <div className="absolute inset-0 bg-[#0f1115]">
        <CadEditorWorkspace 
          conversionId={conversion.id} 
          projectId={projectId} 
          readOnly={true} 
        />
      </div>
    );
  };

  return (
    <div className="absolute inset-0 w-full h-full">
      {renderContent()}

      {/* Continue Editing Overlay - Only visible if a conversion is selected */}
      {conversion && (() => {
        const targetConversionId = conversion.status === 'SUCCESS' ? conversion.id : null;

        return (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
            <button
              onClick={() => {
                if (targetConversionId) {
                  router.push(`/cad-conversion/${projectId}/editor/${targetConversionId}`);
                }
              }}
              disabled={!targetConversionId}
              className={`px-4 py-1.5 text-sm font-medium rounded-full shadow-lg flex items-center gap-1.5 transition-all
                ${targetConversionId 
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-105 hover:shadow-indigo-500/25' 
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'}`}
              title={!targetConversionId ? "This conversion failed or is still processing" : ""}
            >
              {!targetConversionId ? 'No Editor Available' : 'Continue Editing'}
              {targetConversionId && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>}
            </button>
          </div>
        );
      })()}
    </div>
  );
}

