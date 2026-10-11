import { useCallback } from 'react';
import type { Source } from './data/types';
import { useCharacter, useDb } from './store';

export const BOOK_CATEGORIES = [
  { key: 'core', label: 'Manuali principali (Core, APG, Ultimate…)' },
  { key: 'companion', label: 'Player Companion' },
  { key: 'setting', label: 'Campaign Setting' },
  { key: 'ap', label: 'Adventure Path' },
  { key: 'other', label: 'Altro (moduli, fumetti, PFS…)' },
] as const;

/** Restituisce una funzione che dice se una fonte è abilitata nelle impostazioni del personaggio. */
export function useSourceFilter() {
  const char = useCharacter();
  const db = useDb();
  const excluded = char?.settings.excludeCategories ?? [];
  return useCallback(
    (s?: Source) => {
      if (!excluded.length || !s?.book) return true;
      const cat = db.bookByName.get(s.book)?.category ?? 'other';
      return !excluded.includes(cat);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [excluded.join(','), db],
  );
}

export function bookOptions(sources: (Source | undefined)[]) {
  const set = new Set<string>();
  for (const s of sources) if (s?.book) set.add(s.book);
  return [...set].sort().map((b) => ({ value: b, label: b }));
}
