import React from 'react';
import { LayoutTemplate } from 'lucide-react';

export default function UserProjectEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full text-zinc-500 bg-[#121214] border border-zinc-800 rounded-xl p-8 text-center">
      <div className="w-16 h-16 bg-zinc-800/50 rounded-full flex items-center justify-center mb-6">
        <LayoutTemplate className="w-8 h-8 text-zinc-400" />
      </div>
      <h3 className="text-xl font-medium text-zinc-300 mb-2">No Projects Found</h3>
      <p className="text-zinc-500 max-w-sm mx-auto">
        There are currently no active projects available. Please check back later.
      </p>
    </div>
  );
}
