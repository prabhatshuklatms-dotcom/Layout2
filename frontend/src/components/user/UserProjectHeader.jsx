import React from 'react';
import { Search, Filter } from 'lucide-react';

export default function UserProjectHeader() {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 pt-6">
      <div>
        <h1 className="text-3xl font-bold text-[#2d3b55] tracking-tight">Discover Projects</h1>
        <p className="text-slate-500 mt-2 text-sm max-w-lg">
          Explore our premium developments, view interactive layouts, and discover your next investment.
        </p>
      </div>


    </div>
  );
}
