import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ListingCard from '@/components/ListingCard';

export default async function MyListingsPage() {
  const supabase: any = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  const { data: listings, error } = await supabase
    .from('listings')
    .select('*, listing_photos(storage_path, position)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return <p className="text-red-500">Failed to load your listings.</p>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4 text-white">My Listings</h1>
      {listings?.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {listings.map((l: any) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      ) : (
        <p className="text-slate-400">You have no listings yet.</p>
      )}
    </div>
  );
}
