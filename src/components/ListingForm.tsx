"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import { listingSchema, listingCategories, listingConditions, ListingInput } from '@/lib/validation/listingSchema';
import { contactSchema } from '@/lib/validation/contactSchema';
import { PhotoUploader } from '@/components/PhotoUploader';

interface ListingFormProps {
  initialData?: Partial<ListingInput>;
  listingId?: string;
}

export default function ListingForm({ initialData, listingId }: ListingFormProps = {}) {
  const router = useRouter();
  const supabase = createSupabaseClient();

  const [formData, setFormData] = useState<Partial<ListingInput>>({
    pickup_available: true,
    delivery_available: false,
    rules: 'Return in same condition. Report any issues immediately.',
    ...initialData,
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const target = e.target as HTMLInputElement;
    const { name, value, type, checked } = target;
    setFormData(prev => {
      const next = {
        ...prev,
        [name]: type === 'checkbox' ? checked : (type === 'number' ? Number(value) : value),
      };
      if (name === 'owner_phone' && !value.trim()) {
        next.share_phone = false;
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (photos.length === 0 && !listingId) {
      setError('Please add at least one photo before publishing.');
      return;
    }

    const phoneVal = formData.owner_phone ? formData.owner_phone.trim() : null;
    const shareVal = Boolean(phoneVal && formData.share_phone);

    const contactParse = contactSchema.safeParse({
      owner_phone: phoneVal || null,
      share_phone: shareVal,
    });
    if (!contactParse.success) {
      const issueMessages = contactParse.error.issues.map((iss) => iss.message);
      setError(issueMessages.join('\n'));
      return;
    }

    const parse = listingSchema.safeParse({
      ...formData,
      owner_phone: phoneVal || null,
      share_phone: shareVal,
    });
    if (!parse.success) {
      const issueMessages = parse.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`);
      setError(issueMessages.join('\n'));
      return;
    }

    setSubmitting(true);
    try {
      // 1. Call create or update endpoint
      const endpoint = listingId ? `/api/listings/${listingId}` : '/api/listings';
      const method = listingId ? 'PATCH' : 'POST';
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...parse.data,
          owner_phone: phoneVal || null,
          share_phone: shareVal,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || result.message || `Failed to create listing (Status ${response.status})`);
      }

      const listing = result.listing;
      if (!listing?.id) {
        throw new Error('Listing was created but no listing ID returned.');
      }

      // 2. Upload photos to Supabase storage if provided
      const { data: { user } } = await supabase.auth.getUser();
      if (user && photos.length > 0) {
        for (let i = 0; i < photos.length; i++) {
          const file = photos[i];
          const fileExt = file.name.split('.').pop() || 'jpg';
          const storagePath = `${user.id}/${listing.id}/photo_${i}_${Date.now()}.${fileExt}`;

          const { error: uploadErr } = await supabase.storage
            .from('listing-photos')
            .upload(storagePath, file, { upsert: true });

          if (!uploadErr) {
            await supabase.from('listing_photos').insert({
              listing_id: listing.id,
              storage_path: storagePath,
              position: i,
            });
          }
        }
      }

      // 3. Redirect to /my-listings on success
      router.push('/my-listings');
      router.refresh();
    } catch (err: any) {
      console.error('Error creating listing:', err);
      setError(err.message ?? 'An unexpected error occurred while creating the listing.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {error && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm whitespace-pre-line">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
          Title *
        </label>
        <input
          type="text"
          name="title"
          required
          minLength={3}
          maxLength={80}
          placeholder="e.g. Casio fx-991EX Scientific Calculator"
          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-base placeholder-slate-500 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal min-h-[44px]"
          onChange={handleChange}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            Category *
          </label>
          <select
            name="category"
            required
            defaultValue=""
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-base focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal min-h-[44px]"
            onChange={handleChange}
          >
            <option value="" disabled>Select category…</option>
            {listingCategories.map(cat => (
              <option key={cat} value={cat} className="capitalize">
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            Condition *
          </label>
          <select
            name="condition"
            required
            defaultValue=""
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-base focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal min-h-[44px]"
            onChange={handleChange}
          >
            <option value="" disabled>Select condition…</option>
            {listingConditions.map(cond => (
              <option key={cond} value={cond}>
                {cond.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
          Description *
        </label>
        <textarea
          name="description"
          required
          rows={3}
          maxLength={1000}
          placeholder="Describe your item, accessories included, and condition details..."
          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-base placeholder-slate-500 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal"
          onChange={handleChange}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            Price per day (₹10 – ₹100) *
          </label>
          <input
            type="number"
            name="price_per_day"
            required
            min={10}
            max={100}
            placeholder="25"
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-base placeholder-slate-500 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal min-h-[44px]"
            onChange={handleChange}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            Max rental days (1 – 30)
          </label>
          <input
            type="number"
            name="max_rental_days"
            min={1}
            max={30}
            placeholder="7"
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-base placeholder-slate-500 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal min-h-[44px]"
            onChange={handleChange}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
          Rental Rules *
        </label>
        <input
          type="text"
          name="rules"
          required
          maxLength={500}
          defaultValue={formData.rules}
          placeholder="e.g. Handle with care, no water contact"
          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-base placeholder-slate-500 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal min-h-[44px]"
          onChange={handleChange}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            College / Campus (Optional)
          </label>
          <input
            type="text"
            name="college"
            placeholder="e.g. Main Campus / Block A"
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-base placeholder-slate-500 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal min-h-[44px]"
            onChange={handleChange}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            Pickup Zone (Optional)
          </label>
          <input
            type="text"
            name="pickup_zone"
            placeholder="e.g. Library Entrance, Hostel 4"
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-base placeholder-slate-500 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal min-h-[44px]"
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="space-y-3 pt-1">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
            Mobile number (Optional)
          </label>
          <input
            type="tel"
            name="owner_phone"
            value={formData.owner_phone || ''}
            placeholder="e.g. 9876543210 or +919876543210"
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-base placeholder-slate-500 focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal min-h-[44px]"
            onChange={handleChange}
          />
        </div>

        <div>
          <label className={`flex items-center gap-2 text-sm min-h-[44px] ${!formData.owner_phone?.trim() ? 'opacity-50 cursor-not-allowed text-slate-500' : 'cursor-pointer text-slate-300'}`}>
            <input
              type="checkbox"
              name="share_phone"
              checked={Boolean(formData.share_phone && formData.owner_phone?.trim())}
              disabled={!formData.owner_phone?.trim()}
              onChange={handleChange}
              className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-brand-teal focus:ring-brand-teal"
            />
            <span>Share my number with confirmed renters</span>
          </label>
        </div>
      </div>

      <div className="flex gap-6 pt-1">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300 min-h-[44px]">
          <input
            type="checkbox"
            name="pickup_available"
            defaultChecked={formData.pickup_available}
            onChange={handleChange}
            className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-brand-teal focus:ring-brand-teal"
          />
          <span>Self-Pickup Available</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300 min-h-[44px]">
          <input
            type="checkbox"
            name="delivery_available"
            defaultChecked={formData.delivery_available}
            onChange={handleChange}
            className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-brand-teal focus:ring-brand-teal"
          />
          <span>Campus Delivery Available</span>
        </label>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
          Photos (Add 1 to 8 photos) *
        </label>
        <PhotoUploader onChange={setPhotos} />
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full mt-4 py-3.5 px-4 rounded-xl font-bold bg-brand-teal text-slate-950 hover:bg-emerald-400 disabled:opacity-50 transition-colors shadow-lg shadow-brand-teal/10 min-h-[44px] flex items-center justify-center text-base"
      >
        {submitting ? 'Publishing Listing…' : 'Publish Listing'}
      </button>
    </form>
  );
}
