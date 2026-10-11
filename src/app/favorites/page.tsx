import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ListingCard from '@/components/ListingCard';

export default async function FavoritesPage() {
  const supabase: any = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');

  // Join favorites with listings
  const { data: favorites, error } = await supabase
    .from('favorites')
    .select('listing_id')
    .eq('user_id', user.id);

  if (error) {
    console.error(error);
    return <p className="text-red-500">Failed to load favorites.</p>;
  }

  const listingIds = favorites?.map((f: any) => f.listing_id) ?? [];
  if (listingIds.length === 0) {
    return <p className="p-4 text-slate-400">You have no favorites yet.</p>;
  }

  const { data: listings, error: listingsError } = await supabase
    .from('listings')
    .select('*, listing_photos(storage_path, position)')
    .in('id', listingIds);

  if (listingsError) {
    console.error(listingsError);
    return <p className="text-red-500">Failed to load favorite listings.</p>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4 text-white">My Favorites</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {listings?.map((l: any) => (
          <ListingCard key={l.id} listing={l} />
        ))}
      </div>
    </div>
  );
}
