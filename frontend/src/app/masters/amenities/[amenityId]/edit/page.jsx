'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getAmenity } from '@/lib/api';
import AmenityForm from '@/components/masters/amenities/AmenityForm';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function EditAmenityPage() {
  const { amenityId } = useParams();
  const [initialData, setInitialData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getAmenity(amenityId);
        setInitialData(data);
      } catch (err) {
        console.error(err);
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [amenityId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 p-8 flex items-center justify-center text-zinc-400">
        Loading amenity data...
      </div>
    );
  }

  if (error || !initialData) {
    return (
      <div className="min-h-screen bg-zinc-950 p-8">
        <div className="max-w-4xl mx-auto space-y-6 text-center pt-20">
          <h2 className="text-xl font-medium text-zinc-300">Amenity not found or failed to load.</h2>
          <Link href="/masters/amenities" className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors">
            <ArrowLeft size={16} /> Back to Amenities Master
          </Link>
        </div>
      </div>
    );
  }

  return <AmenityForm initialData={initialData} />;
}
