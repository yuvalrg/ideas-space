import { useEffect, useState } from 'react';
import { getSupabase } from '../../lib/supabase';
import type { Category } from './api';

export interface Lookups {
  /** profile id -> display name (every partner, including removed ones: their work keeps their name) */
  partners: Map<string, string>;
  /** partners who can be assigned work: active profiles, sorted by name */
  activePartners: { id: string; name: string }[];
  /** sorted by sort_order */
  categories: Category[];
}

let cached: Promise<Lookups> | null = null;

async function load(): Promise<Lookups> {
  const supabase = getSupabase();
  const [profiles, categories] = await Promise.all([
    supabase.from('profiles').select('id, display_name, is_active'),
    supabase.from('categories').select('*').order('sort_order'),
  ]);
  if (profiles.error) throw profiles.error;
  if (categories.error) throw categories.error;
  return {
    partners: new Map(profiles.data.map((p) => [p.id, p.display_name])),
    activePartners: profiles.data
      .filter((p) => p.is_active)
      .map((p) => ({ id: p.id, name: p.display_name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'he')),
    categories: categories.data,
  };
}

/** Call after a partner's name changes so the next screen reloads names. */
export function invalidateLookups(): void {
  cached = null;
}

/** Partner names and categories, loaded once per page load and shared by every screen. */
export function useLookups(): Lookups | null {
  const [value, setValue] = useState<Lookups | null>(null);
  useEffect(() => {
    let cancelled = false;
    cached ??= load();
    cached.then(
      (lookups) => {
        if (!cancelled) setValue(lookups);
      },
      () => {
        cached = null; // retry on the next screen
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return value;
}

export function partnerName(lookups: Lookups | null, id: string | null): string {
  return (id && lookups?.partners.get(id)) || '';
}
