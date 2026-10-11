// Verifica dei requisiti dei talenti.
import type { AbilityKey, FeatData, Prereq, SaveKey } from '@/data/types';
import { ABILITY_SHORT, SAVE_LABEL, SKILL_BY_KEY } from './constants';

export type ClauseStatus = 'ok' | 'fail' | 'unknown';

export interface PrereqEnv {
  abilities: Record<AbilityKey, number>;
  bab: number;
  level: number;
  classLevels: Map<string, number>;
  skillRanks: (key: string) => number;
  raceId?: string;
  raceSubtypes: string[];
  baseSaves: Record<SaveKey, number>;
  armorProfs: Set<string>;
  casters: { tradition: string; cl: number; maxLevel: number }[];
  featureNames: string[];
  featNames: Set<string>;
}

export interface ClauseResult {
  text: string;
  status: ClauseStatus;
}
export interface PrereqResult {
  ok: boolean;
  clauses: ClauseResult[];
}

const KNOWLEDGE = ['kar', 'kdu', 'ken', 'kge', 'khi', 'klo', 'kna', 'kno', 'kpl', 'kre'];

export function describe(p: Prereq, classNames?: Map<string, string>): string {
  switch (p.t) {
    case 'ability': return `${ABILITY_SHORT[p.a]} ${p.v}`;
    case 'bab': return `BAB +${p.v}`;
    case 'cl': return `Livello incantatore ${p.v}`;
    case 'level': return `Livello del personaggio ${p.v}`;
    case 'class': return `${classNames?.get(p.c) ?? p.c} ${p.v}° livello`;
    case 'skill': return p.s === 'kno*' ? `Conoscenze (qualsiasi) ${p.v} gradi` : `${SKILL_BY_KEY.get(p.s)?.it ?? p.s} ${p.v} gradi`;
    case 'feat': return p.detail ? `${p.name} (${p.detail})` : p.name;
    case 'race': return `Razza: ${p.r}`;
    case 'save': return `TS base ${SAVE_LABEL[p.s]} +${p.v}`;
    case 'armorProf': return `Competenza armature ${p.v === 'lgt' ? 'leggere' : p.v === 'med' ? 'medie' : 'pesanti'}`;
    case 'caster': return `Incantatore${p.trad ? ` ${p.trad}` : ''}${p.v ? ` (incantesimi di ${p.v}° livello)` : ''}`;
    case 'feature': return p.name;
    case 'text': return p.text;
    case 'or': return p.of.map((x) => describe(x, classNames)).join(' oppure ');
  }
}

function check(p: Prereq, env: PrereqEnv): ClauseStatus {
  switch (p.t) {
    case 'ability': return env.abilities[p.a] >= p.v ? 'ok' : 'fail';
    case 'bab': return env.bab >= p.v ? 'ok' : 'fail';
    case 'level': return env.level >= p.v ? 'ok' : 'fail';
    case 'cl': return env.casters.some((c) => c.cl >= p.v) ? 'ok' : 'fail';
    case 'class': return (env.classLevels.get(p.c) ?? 0) >= p.v ? 'ok' : 'fail';
    case 'skill':
      if (p.s === 'kno*') return KNOWLEDGE.some((k) => env.skillRanks(k) >= p.v) ? 'ok' : 'fail';
      return env.skillRanks(p.s) >= p.v ? 'ok' : 'fail';
    case 'feat': return env.featNames.has(p.name.toLowerCase()) ? 'ok' : 'fail';
    case 'race': return env.raceId === p.r || env.raceSubtypes.includes(p.r) ? 'ok' : 'fail';
    case 'save': return env.baseSaves[p.s] >= p.v ? 'ok' : 'fail';
    case 'armorProf': return env.armorProfs.has(p.v) ? 'ok' : 'fail';
    case 'caster':
      return env.casters.some((c) => (!p.trad || c.tradition === p.trad) && (!p.v || c.maxLevel >= p.v)) ? 'ok' : 'fail';
    case 'feature': {
      const n = p.name.toLowerCase();
      return env.featureNames.some((f) => f.includes(n)) ? 'ok' : 'unknown';
    }
    case 'text': return 'unknown';
    case 'or': {
      const r = p.of.map((x) => check(x, env));
      if (r.includes('ok')) return 'ok';
      if (r.includes('unknown')) return 'unknown';
      return 'fail';
    }
  }
}

export function checkPrereqs(feat: FeatData, env: PrereqEnv, classNames?: Map<string, string>): PrereqResult {
  const clauses = feat.prereq.map((p) => ({ text: describe(p, classNames), status: check(p, env) }));
  return { ok: !clauses.some((c) => c.status === 'fail'), clauses };
}
