"use client";

import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import { useState, useEffect } from "react";
import { Heart } from "lucide-react";

export default function FavoriteButton({ listingId }: { listingId: string }) {
  const supabase = createSupabaseClient();
  const [fav, setFav] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load initial favorite state
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setLoading(false);
      const { data, error } = await supabase
        .from('favorites')
        .select('user_id')
        .eq('listing_id', listingId)
        .eq('user_id', user.id)
        .single();
      if (!error && data) setFav(true);
      setLoading(false);
    })();
  }, [listingId]);

  const toggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setFav(prev => !prev);
    if (!fav) {
      await supabase.from('favorites').insert({ user_id: user.id, listing_id: listingId });
    } else {
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('listing_id', listingId);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-label="Toggle favorite"
      data-testid="favorite-btn"
      data-favorited={fav}
      className="rounded-full p-2 bg-slate-950/60 backdrop-blur-sm text-teal-400 hover:bg-slate-900 transition-colors shadow"
    >
      <Heart className="w-5 h-5 text-brand-teal" fill={fav ? '#00E5B0' : 'none'} />
    </button>
  );
}
