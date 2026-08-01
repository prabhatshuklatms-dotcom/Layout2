import React from 'react';
import UserProjectCard from './UserProjectCard';

export default function UserProjectGrid({ projects }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full pb-12">
      {projects.map(project => (
        <UserProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
