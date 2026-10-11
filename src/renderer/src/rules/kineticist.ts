// Regole del cineta (Occult Adventures): elementi, blast, talenti selvaggi, burn ed elemental overflow.
import type { Database } from '@/data/db';
import type { AbilityKey, KineticElement, KineticTalent } from '@/data/types';
import type { Character } from './character';

export const INFUSION_LEVELS = [1, 3, 5, 9, 11, 13, 17, 19];
export const UTILITY_LEVELS = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];

export interface KineticSlot {
  id: string;
  /** Livello da cineta a cui si ottiene. */
  level: number;
  kind: 'infusion' | 'utility' | 'any';
  label: string;
  talent?: KineticTalent;
}

export interface KineticBlast {
  talent: KineticTalent;
  composite: boolean;
  physical: boolean;
  attack: number;
  damage: string;
  burn: number;
  dc: number;
  notes: string[];
}

export interface KineticInfo {
  level: number;
  primary?: KineticElement;
  expanded: (KineticElement | undefined)[];
  /** Elementi conosciuti (primario + espansi, senza duplicati). */
  elements: KineticElement[];
  blastChoices: { slot: string; label: string; options: KineticTalent[]; chosen?: KineticTalent }[];
  knownSimple: KineticTalent[];
  composites: KineticTalent[];
  blasts: KineticBlast[];
  slots: KineticSlot[];
  automatic: KineticTalent[];
  burnMax: number;
  burnPerRound: number;
  burn: number;
  burnNonlethal: number;
  overflowBonus: number;
  overflowMax: number;
  /** Bonus di taglia alle caratteristiche fisiche concessi dall'elemental overflow con il burn attuale. */
  overflowAbilities: Partial<Record<AbilityKey, number>>;
  critIgnore: number;
  infusionSpecialization: number;
  internalBuffer: number;
  metakinesis: string[];
  blastDc: number;
  formDc: number;
  classSkills: string[];
  warnings: string[];
}

const dice = (n: number) => `${n}d6`;

/** Livello effettivo di un talento: 1° sempre, altrimenti livello cineta ≥ 2× livello del talento. */
export function maxTalentLevel(kinLevel: number) {
  return Math.max(1, Math.floor(kinLevel / 2));
}

export function talentAvailable(t: KineticTalent, info: Pick<KineticInfo, 'level' | 'primary' | 'elements'>): { ok: boolean; reason?: string } {
  const elemIds = info.elements.map((e) => e.id);
  const universal = t.elements.includes('universal');
  const matching = t.elements.filter((e) => elemIds.includes(e));
  if (!universal && !matching.length) return { ok: false, reason: 'elemento non conosciuto' };
  // Per gli elementi espansi diversi dal primario il livello del cineta conta 4 in meno
  const viaPrimary = universal || (info.primary && t.elements.includes(info.primary.id));
  const lvl = viaPrimary ? info.level : info.level - 4;
  if (t.level && t.level > 1 && t.level > maxTalentLevel(lvl)) return { ok: false, reason: `richiede livello ${t.level * 2}${viaPrimary ? '' : ' (+4 per elemento espanso)'}` };
  return { ok: true };
}

/** Un blast composito è disponibile se ne soddisfi i prerequisiti. */
function compositeQualifies(t: KineticTalent, simple: KineticTalent[], primary: string | undefined, expanded: (string | undefined)[]) {
  const pre = (t.prereq ?? '').toLowerCase();
  if (!pre) return false;
  const simpleNames = simple.map((s) => s.name.toLowerCase());
  for (const clause of pre.split(/,\s*/)) {
    let m: RegExpExecArray | null;
    if ((m = /^primary element \((\w+)\)$/.exec(clause))) {
      if (primary !== m[1]) return false;
    } else if ((m = /^expanded element \((\w+)\)$/.exec(clause))) {
      if (m[1] === 'any' ? !expanded.some(Boolean) : !expanded.includes(m[1])) return false;
    } else if ((m = /^any other (physical|energy) simple blast$/.exec(clause))) {
      const others = simple.filter((s) => s.blastType === m![1] && !pre.startsWith(s.name.toLowerCase()));
      if (!others.length) return false;
    } else if (/ blast$/.test(clause)) {
      if (!simpleNames.includes(clause)) return false;
    }
  }
  return true;
}

export function computeKinetic(
  char: Character,
  db: Database,
  ctx: { level: number; charLevel: number; conMod: number; dexMod: number; bab: number; sizeMod: number; rangedAttackBonus: number; damageBonus: number; blastFocus: number; extraWildTalents: number },
): KineticInfo {
  const k = char.kineticist;
  const L = ctx.level;
  const el = (id?: string) => (id ? db.kineticElementById.get(id) : undefined);
  const T = (id?: string) => (id ? db.kineticTalentById.get(id) : undefined);
  const primary = el(k.primary);
  const exp7 = L >= 7 ? el(k.expanded7) : undefined;
  const exp15 = L >= 15 ? el(k.expanded15) : undefined;
  const elements = [primary, exp7, exp15].filter((e, i, a): e is KineticElement => !!e && a.indexOf(e) === i);
  const warnings: string[] = [];
  if (!primary) warnings.push('Scegli l\'elemento primario.');
  if (L >= 15 && exp15 && exp7 && exp15.id === exp7.id && exp15.id !== primary?.id) warnings.push('A 15° livello non puoi scegliere lo stesso elemento espanso del 7° (a meno che sia il primario).');

  // Blast semplici: uno dall'elemento primario, uno per ogni elemento espanso
  const blastChoices: KineticInfo['blastChoices'] = [];
  const known = new Set<string>();
  const addChoice = (slot: string, label: string, e?: KineticElement) => {
    if (!e) return;
    const options = e.simple.map((id) => T(id)).filter((t): t is KineticTalent => !!t && !known.has(t.id));
    let chosen = options.find((o) => k.blasts.includes(o.id) && !known.has(o.id));
    if (!chosen && options.length === 1) chosen = options[0];
    if (chosen) known.add(chosen.id);
    else if (options.length) warnings.push(`${label}: scegli un blast semplice.`);
    blastChoices.push({ slot, label, options, chosen });
  };
  addChoice('primary', 'Blast dell\'elemento primario', primary);
  if (L >= 7) addChoice('exp7', 'Blast dell\'elemento espanso (7°)', exp7);
  if (L >= 15) addChoice('exp15', 'Blast dell\'elemento espanso (15°)', exp15);
  const knownSimple = [...known].map((id) => T(id)!).filter(Boolean);
  const composites = db.kinetic.talents.filter(
    (t) => t.type === 'composite' && compositeQualifies(t, knownSimple, primary?.id, [exp7?.id, exp15?.id]),
  );

  // Slot dei talenti selvaggi
  const slots: KineticSlot[] = [];
  for (const lv of INFUSION_LEVELS) if (lv <= L) slots.push({ id: `inf-${lv}`, level: lv, kind: 'infusion', label: `Infusione (${lv}°)` });
  for (const lv of UTILITY_LEVELS) if (lv <= L) slots.push({ id: `util-${lv}`, level: lv, kind: 'utility', label: `Talento di utilità (${lv}°)` });
  if (exp7 && exp7.id === primary?.id) slots.push({ id: 'bonus-7', level: 7, kind: 'any', label: 'Elemento espanso (7°): infusione o utilità bonus' });
  if (exp15 && exp15.id === primary?.id) slots.push({ id: 'bonus-15', level: 15, kind: 'any', label: 'Elemento espanso (15°): infusione o utilità bonus' });
  for (let i = 0; i < ctx.extraWildTalents; i++) slots.push({ id: `feat-${i}`, level: 1, kind: 'any', label: 'Extra Wild Talent (talento)' });
  slots.sort((a, b) => a.level - b.level);
  for (const s of slots) s.talent = T(k.talents[s.id]);

  // Talenti automatici: utilità base degli elementi conosciuti e difesa dell'elemento primario
  const automatic: KineticTalent[] = [];
  for (const e of elements) {
    const b = T(e.basic);
    if (b) automatic.push(b);
  }
  if (L >= 2 && primary?.defense) {
    const d = T(primary.defense);
    if (d) automatic.push(d);
  }

  const info: KineticInfo = {
    level: L, primary, expanded: [exp7, exp15], elements, blastChoices, knownSimple, composites, blasts: [], slots, automatic,
    burnMax: Math.max(0, 3 + ctx.conMod), burnPerRound: L >= 6 ? 2 + Math.floor((L - 6) / 3) : 1, burn: 0, burnNonlethal: 0,
    overflowBonus: 0, overflowMax: L >= 3 ? Math.floor(L / 3) : 0, overflowAbilities: {}, critIgnore: 0,
    infusionSpecialization: L >= 5 ? 1 + Math.floor((L - 5) / 3) : 0,
    internalBuffer: L >= 16 ? 3 : L >= 11 ? 2 : L >= 6 ? 1 : 0,
    metakinesis: [L >= 5 && 'Empower (1 burn)', L >= 9 && 'Maximize (2 burn)', L >= 13 && 'Quicken (3 burn)', L >= 17 && 'Doppio blast (4 burn)'].filter(Boolean) as string[],
    blastDc: 10 + Math.floor(L / 2) + ctx.conMod,
    formDc: 10 + Math.floor(L / 2) + ctx.dexMod,
    classSkills: primary?.classSkills ?? [],
    warnings,
  };

  // Validazione dei talenti scelti
  const chosenNames = new Set([...slots.map((s) => s.talent?.name.toLowerCase()), ...automatic.map((a) => a.name.toLowerCase()), ...knownSimple.map((s) => s.name.toLowerCase())].filter(Boolean) as string[]);
  for (const s of slots) {
    if (!s.talent) {
      warnings.push(`${s.label}: da scegliere.`);
      continue;
    }
    const av = talentAvailable(s.talent, info);
    if (!av.ok) warnings.push(`${s.talent.name}: ${av.reason}.`);
    if (s.kind === 'infusion' && !['form', 'substance'].includes(s.talent.type)) warnings.push(`${s.talent.name} non è un'infusione.`);
    if (s.kind === 'utility' && s.talent.type !== 'utility') warnings.push(`${s.talent.name} non è un talento di utilità.`);
    for (const p of (s.talent.prereq ?? '').split(/,\s*/).filter(Boolean)) {
      const pl = p.toLowerCase();
      if (/level|element|blast$|kineticist/.test(pl)) continue;
      if (!chosenNames.has(pl)) warnings.push(`${s.talent.name}: richiede ${p}.`);
    }
  }

  // Burn ed elemental overflow
  const burn = Math.max(0, Math.min(k.burn ?? 0, info.burnMax));
  info.burn = burn;
  info.burnNonlethal = burn * ctx.charLevel;
  info.overflowBonus = Math.min(burn, info.overflowMax);
  if (L >= 6) info.critIgnore = 5 * burn;
  const ord = (k.overflow?.length === 3 ? k.overflow : ['dex', 'con', 'str']) as AbilityKey[];
  if (L >= 16 && burn >= 7) info.overflowAbilities = { [ord[0]]: 6, [ord[1]]: 4, [ord[2]]: 2 };
  else if (L >= 11 && burn >= 5) info.overflowAbilities = { [ord[0]]: 4, [ord[1]]: 2, [ord[2]]: 2 };
  else if (L >= 6 && burn >= 3) info.overflowAbilities = { [ord[0]]: 2, [ord[1]]: 2 };

  // Blast
  const n = Math.floor((L + 1) / 2);
  const mastery = exp7?.id === primary?.id && exp15?.id === primary?.id && L >= 15 ? 1 : 0;
  for (const t of [...knownSimple, ...composites]) {
    const composite = t.type === 'composite';
    const physical = t.blastType === 'physical';
    const special = !physical && t.blastType !== 'energy';
    const dn = composite ? 2 * n : n;
    const ownElement = !!primary && t.elements.includes(primary.id);
    const extraAtk = info.overflowBonus + (ownElement ? mastery : 0);
    const extraDmg = 2 * info.overflowBonus + (ownElement ? mastery : 0) + ctx.damageBonus;
    const flat = physical ? dn + ctx.conMod + extraDmg : Math.floor(ctx.conMod / 2) + extraDmg;
    const baseBurn = parseInt(t.burn, 10) || 0;
    const burnCost = Math.max(0, baseBurn - (composite && L >= 16 ? 1 : 0));
    const notes: string[] = [];
    if (!physical && !special) notes.push('contatto a distanza');
    if (physical) notes.push('niente RI');
    if (special) notes.push('vedi testo');
    if (t.damage) notes.push(t.damage);
    info.blasts.push({
      talent: t,
      composite,
      physical,
      attack: ctx.bab + ctx.dexMod + ctx.sizeMod + extraAtk + ctx.rangedAttackBonus + ctx.blastFocus,
      damage: special ? '—' : `${dice(dn)}${flat ? (flat > 0 ? `+${flat}` : `${flat}`) : ''}`,
      burn: burnCost,
      dc: info.blastDc + (ownElement ? mastery : 0),
      notes,
    });
  }
  return info;
}
