import { useState } from 'react';
import { listingCategories, listingConditions } from '@/lib/validation/listingSchema';

export interface Filters {
  text?: string;
  category?: string;
  priceRange?: string; // "0-20", "21-50", "51-100"
  condition?: string;
  delivery?: boolean;
  pickup?: boolean;
  college?: string;
}

export default function FiltersPanel({ onChange }: { onChange: (filters: Filters) => void }) {
  const [filters, setFilters] = useState<Filters>({});

  const update = (key: keyof Filters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onChange(newFilters);
  };

  return (
    <div className="space-y-4 p-2 bg-neutral-800 rounded">
      {/* Text search */}
      <input
        type="text"
        placeholder="Search..."
        className="w-full rounded bg-neutral-700 p-2 text-white"
        onChange={(e) => update('text', e.target.value)}
      />

      {/* Category chips */}
      <div className="flex flex-wrap gap-2">
        {listingCategories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`px-2 py-1 rounded ${filters.category === cat ? 'bg-teal-600 text-white' : 'bg-neutral-600 text-gray-300'}`}
            onClick={() => update('category', filters.category === cat ? undefined : cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Price range */}
      <div className="flex space-x-2">
        {['0-20', '21-50', '51-100'].map((range) => (
          <button
            key={range}
            type="button"
            className={`px-2 py-1 rounded ${filters.priceRange === range ? 'bg-teal-600 text-white' : 'bg-neutral-600 text-gray-300'}`}
            onClick={() => update('priceRange', filters.priceRange === range ? undefined : range)}
          >
            ₹{range.replace('-', '‑')}
          </button>
        ))}
      </div>

      {/* Condition */}
      <div className="flex flex-wrap gap-2">
        {listingConditions.map((cond) => (
          <button
            key={cond}
            type="button"
            className={`px-2 py-1 rounded ${filters.condition === cond ? 'bg-teal-600 text-white' : 'bg-neutral-600 text-gray-300'}`}
            onClick={() => update('condition', filters.condition === cond ? undefined : cond)}
          >
            {cond.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Delivery / Pickup toggles */}
      <div className="flex space-x-2">
        <button
          type="button"
          className={`px-2 py-1 rounded ${filters.delivery ? 'bg-teal-600 text-white' : 'bg-neutral-600 text-gray-300'}`}
          onClick={() => update('delivery', !filters.delivery)}
        >
          Delivery
        </button>
        <button
          type="button"
          className={`px-2 py-1 rounded ${filters.pickup ? 'bg-teal-600 text-white' : 'bg-neutral-600 text-gray-300'}`}
          onClick={() => update('pickup', !filters.pickup)}
        >
          Pickup
        </button>
      </div>
    </div>
  );
}
