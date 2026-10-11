import type { Database } from './data/db';
import type { Character } from './rules/character';

export function classSummary(char: Character, db: Database): string {
  const counts = new Map<string, number>();
  for (const l of char.levels) counts.set(l.classId, (counts.get(l.classId) ?? 0) + 1);
  return [...counts]
    .map(([id, n]) => {
      const cls = db.classById.get(id);
      const arch = (char.archetypes[id] ?? []).map((a) => db.archetypeById.get(a)?.name).filter(Boolean);
      return `${cls?.name ?? id}${arch.length ? ` (${arch.join(', ')})` : ''} ${n}`;
    })
    .join(' / ');
}

export function ordinal(n: number) {
  return `${n}°`;
}

export function gp(n: number) {
  return `${n.toLocaleString('it-IT', { maximumFractionDigits: 2 })} mo`;
}

export function lbs(n: number) {
  return `${n.toLocaleString('it-IT', { maximumFractionDigits: 1 })} lb`;
}

export function relativeTime(ts: number) {
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return 'adesso';
  if (d < 3600) return `${Math.floor(d / 60)} min fa`;
  if (d < 86400) return `${Math.floor(d / 3600)} h fa`;
  return new Date(ts).toLocaleDateString('it-IT');
}
