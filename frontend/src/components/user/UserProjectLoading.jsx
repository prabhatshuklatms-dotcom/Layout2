import React from 'react';
import { Loader2 } from 'lucide-react';

export default function UserProjectLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full text-zinc-400">
      <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
      <p className="text-lg font-medium text-zinc-300">Loading projects...</p>
      <p className="text-sm mt-2 text-zinc-500">Please wait while we fetch the latest properties.</p>
    </div>
  );
}
