import React, { useRef, useState } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';

export default function UploadPanel({ projectId, onUploadStart, onUploadError }) {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'dwg' && ext !== 'dxf') {
      onUploadError('Only DWG and DXF files are supported.');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      onUploadError('File size exceeds 100MB limit.');
      return;
    }

    setIsUploading(true);
    onUploadStart();

    const formData = new FormData();
    formData.append('file', file);
    if (projectId) {
      formData.append('projectId', projectId);
    }

    try {
      const res = await fetch('http://localhost:5000/api/cad-conversion/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Upload failed');
      }
      
      // Successfully uploaded
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      onUploadError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full">
      <input 
        type="file" 
        accept=".dwg,.dxf"
        className="hidden" 
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      <button 
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="w-full h-24 border-2 border-dashed border-zinc-700 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-indigo-500 hover:bg-indigo-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-zinc-400 hover:text-indigo-400"
      >
        {isUploading ? (
          <Loader2 size={24} className="animate-spin text-indigo-500" />
        ) : (
          <UploadCloud size={24} />
        )}
        <span className="text-sm font-medium">
          {isUploading ? 'Uploading...' : 'Upload DWG/DXF'}
        </span>
      </button>
    </div>
  );
}
