import { create } from 'zustand';
import { useMemo } from 'react';
import type { Database } from './data/db';
import { migrate, newCharacter, uid, type Character } from './rules/character';
import { compute, type Computed } from './rules/compute';

export type Step =
  | 'details' | 'race' | 'abilities' | 'classes' | 'features' | 'kinetic' | 'skills' | 'feats' | 'traits' | 'spells' | 'equipment' | 'sheet';
export type View = 'home' | 'builder' | 'compendium';

interface Api {
  listCharacters(): Promise<unknown[]>;
  saveCharacter(c: unknown): Promise<boolean>;
  deleteCharacter(id: string): Promise<boolean>;
  exportCharacter(c: unknown): Promise<boolean>;
  importCharacter(): Promise<unknown | null>;
  openCharactersFolder(): Promise<void>;
  exportPdf(name: string): Promise<boolean>;
}
export const api: Api | undefined = (window as unknown as { api?: Api }).api;

// Fallback su localStorage quando l'app gira nel browser (sviluppo).
const LS_KEY = 'pathbuilder.characters';
const local = {
  list(): Character[] {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]');
    } catch {
      return [];
    }
  },
  save(c: Character) {
    const all = local.list().filter((x) => x.id !== c.id);
    localStorage.setItem(LS_KEY, JSON.stringify([...all, c]));
  },
  remove(id: string) {
    localStorage.setItem(LS_KEY, JSON.stringify(local.list().filter((x) => x.id !== id)));
  },
};

interface State {
  db: Database | null;
  characters: Character[];
  currentId: string | null;
  view: View;
  step: Step;
  theme: 'dark' | 'light';
  saving: boolean;
  setDb(db: Database): void;
  loadCharacters(): Promise<void>;
  setView(v: View): void;
  setStep(s: Step): void;
  toggleTheme(): void;
  createCharacter(): void;
  openCharacter(id: string): void;
  duplicateCharacter(id: string): void;
  deleteCharacter(id: string): Promise<void>;
  importCharacter(): Promise<void>;
  update(fn: (c: Character) => void): void;
}

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
function persist(c: Character, set: (p: Partial<State>) => void) {
  clearTimeout(saveTimers.get(c.id));
  set({ saving: true });
  saveTimers.set(
    c.id,
    setTimeout(async () => {
      if (api) await api.saveCharacter(c);
      else local.save(c);
      set({ saving: false });
    }, 400),
  );
}

const initialTheme = (localStorage.getItem('pathbuilder.theme') as 'dark' | 'light' | null) ?? 'dark';
document.documentElement.dataset.theme = initialTheme;

export const useStore = create<State>((set, get) => ({
  db: null,
  characters: [],
  currentId: null,
  view: 'home',
  step: 'details',
  theme: initialTheme,
  saving: false,
  setDb: (db) => set({ db }),
  async loadCharacters() {
    const raw = api ? await api.listCharacters() : local.list();
    const characters = (raw as Partial<Character>[]).map(migrate).sort((a, b) => b.updated - a.updated);
    set({ characters });
  },
  setView: (view) => set({ view }),
  setStep: (step) => set({ step }),
  toggleTheme() {
    const theme = get().theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('pathbuilder.theme', theme);
    set({ theme });
  },
  createCharacter() {
    const c = newCharacter();
    set({ characters: [c, ...get().characters], currentId: c.id, view: 'builder', step: 'details' });
    persist(c, set);
  },
  openCharacter(id) {
    set({ currentId: id, view: 'builder', step: 'sheet' });
  },
  duplicateCharacter(id) {
    const src = get().characters.find((c) => c.id === id);
    if (!src) return;
    const c: Character = { ...structuredClone(src), id: uid(), name: `${src.name} (copia)`, created: Date.now(), updated: Date.now() };
    set({ characters: [c, ...get().characters] });
    persist(c, set);
  },
  async deleteCharacter(id) {
    if (api) await api.deleteCharacter(id);
    else local.remove(id);
    set({ characters: get().characters.filter((c) => c.id !== id), currentId: get().currentId === id ? null : get().currentId });
  },
  async importCharacter() {
    const raw = api ? await api.importCharacter() : null;
    if (!raw) return;
    const c = migrate(raw as Partial<Character>);
    if (get().characters.some((x) => x.id === c.id)) c.id = uid();
    set({ characters: [c, ...get().characters] });
    persist(c, set);
  },
  update(fn) {
    const id = get().currentId;
    if (!id) return;
    const characters = get().characters.map((c) => {
      if (c.id !== id) return c;
      const next = structuredClone(c);
      fn(next);
      next.updated = Date.now();
      persist(next, set);
      return next;
    });
    set({ characters });
  },
}));

export function useCharacter(): Character | undefined {
  return useStore((s) => s.characters.find((c) => c.id === s.currentId));
}

export function useDb(): Database {
  return useStore((s) => s.db)!;
}

export function useComputed(): { char: Character; c: Computed } | undefined {
  const char = useCharacter();
  const db = useStore((s) => s.db);
  return useMemo(() => (char && db ? { char, c: compute(char, db) } : undefined), [char, db]);
}
