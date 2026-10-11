import React, { useState } from 'react';
import Image from 'next/image';

/**
 * Carousel component for a listing's photos.
 * @param photos Array of public URLs (e.g., from Supabase storage) ordered by position.
 */
interface Props {
  photos: string[];
}

export default function ListingCarousel({ photos }: Props) {
  const [current, setCurrent] = useState(0);
  if (!photos || photos.length === 0) return null;
  const prev = () => setCurrent((i) => (i - 1 + photos.length) % photos.length);
  const next = () => setCurrent((i) => (i + 1) % photos.length);
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded">
      <Image src={photos[current]} alt={`Listing photo ${current + 1}`} fill className="object-cover" priority />
      <button type="button" onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white" aria-label="Previous photo">◀</button>
      <button type="button" onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white" aria-label="Next photo">▶</button>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-1">
        {photos.map((_, i) => (
          <span key={i} className={`inline-block h-2 w-2 rounded-full ${i === current ? 'bg-teal-500' : 'bg-white/50'}`} />
        ))}
      </div>
    </div>
  );
}
