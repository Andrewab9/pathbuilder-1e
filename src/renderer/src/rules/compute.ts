// Calcola tutte le statistiche derivate di un personaggio a partire dalle sue scelte.
import type { Database } from '@/data/db';
import type {
  AbilityKey, ArchetypeData, ArmorData, Change, ClassData, FeatData, FeatureData, RaceData, SaveKey, WeaponData,
} from '@/data/types';
import type { Character, ChoicePick, FeatPick } from './character';
import { CLASS_CHOICES, CLASS_POOLS, type ChoiceDef, type PoolDef } from './classChoices';
import { computeKinetic, type KineticInfo } from './kineticist';
import {
  ABILITIES, ABILITY_INCREASE_LEVELS, BONUS_TYPE_LABEL, POINT_BUY_COST, SAVES, SAVE_ABILITY, SIZE_FLY, SIZE_MOD,
  SIZE_SPECIAL, SIZE_STEALTH, SKILLS, STACKING_TYPES, UNCHAINED_ONLY, WEALTH_BY_LEVEL, isFeatLevel, mod, type SkillDef,
} from './constants';
import { evalFormula } from './formula';
import { checkPrereqs, type PrereqResult } from './prereq';

export interface Part {
  label: string;
  value: number;
}
export interface Stat {
  total: number;
  parts: Part[];
}

export interface ClassLevelInfo {
  cls: ClassData;
  level: number;
  archetypes: ArchetypeData[];
  /** Primo livello del personaggio in cui si è presa la classe. */
  firstCharLevel: number;
}

export interface FeatSlot {
  id: string;
  label: string;
  /** Livello del personaggio in cui lo slot diventa disponibile. */
  level: number;
  kind: 'general' | 'race' | 'class' | 'extra';
  classId?: string;
  filter?: (f: FeatData) => boolean;
  pick?: FeatPick;
}

export interface ChoiceSlot {
  id: string;
  classId: string;
  def: ChoiceDef;
  level: number;
  index: number;
  pick?: ChoicePick;
}

export interface FeatureEntry {
  key: string;
  feature?: FeatureData;
  label: string;
  level: number;
  classId?: string;
  source: 'class' | 'archetype' | 'choice' | 'linked' | 'extra' | 'race';
  replaced?: boolean;
  archetype?: string;
}

export interface SkillRow {
  key: string;
  def: SkillDef;
  specialty?: string;
  label: string;
  ranks: number;
  classSkill: boolean;
  total: number;
  parts: Part[];
  usable: boolean;
}

export interface CasterInfo {
  classId: string;
  cls: ClassData;
  effectiveLevel: number;
  casterLevel: number;
  ability: AbilityKey;
  abilityScore: number;
  /** Incantesimi al giorno per livello (0-9): numero, 'inf' (a volontà) o null (non disponibile). */
  perDay: (number | 'inf' | null)[];
  bonus: number[];
  /** Incantesimi conosciuti per livello (incantatori spontanei/ibridi), altrimenti null. */
  known: (number | null)[] | null;
  /** Numero di incantesimi preparabili per livello (preparatori). */
  prepared: (number | null)[] | null;
  maxSpellLevel: number;
  domainSlots: number;
  dcBase: number;
}

export interface AttackRow {
  uid: string;
  name: string;
  attack: number[];
  damage: string;
  crit: string;
  type: string;
  notes: string[];
}

export interface PoolUsage {
  classId: string;
  def: PoolDef;
  points: number;
  used: number;
  picks: FeatureData[];
}

export interface Warning {
  level: 'error' | 'warn' | 'info';
  text: string;
  section?: string;
}

export interface Computed {
  level: number;
  race?: RaceData;
  size: string;
  classes: ClassLevelInfo[];
  abilities: Record<AbilityKey, { base: number; racial: number; levelUp: number; bonus: number; total: number; mod: number; parts: Part[] }>;
  pointBuy: { spent: number; budget: number };
  bab: number;
  saves: Record<SaveKey, Stat & { base: number }>;
  hp: Stat;
  ac: Stat;
  touch: number;
  flatFooted: number;
  cmb: Stat;
  cmd: Stat;
  init: Stat;
  speed: Record<string, number>;
  sr: number;
  skills: SkillRow[];
  skillPoints: { total: number; used: number; perLevel: number[] };
  classSkills: Set<string>;
  featSlots: FeatSlot[];
  feats: (FeatPick & { feat?: FeatData; prereq: PrereqResult })[];
  choiceSlots: ChoiceSlot[];
  features: FeatureEntry[];
  casters: CasterInfo[];
  armor: { acp: number; maxDex: number | null; asf: number; armorName?: string; shieldName?: string; type: number };
  attacks: AttackRow[];
  load: { weight: number; light: number; medium: number; heavy: number; level: 0 | 1 | 2 | 3 };
  wealth: { spent: number; budget: number; money: number };
  favoredClasses: string[];
  bonusFeatsFromRace: number;
  warnings: Warning[];
  traitClassSkills: string[];
  kinetic?: KineticInfo;
  pools: PoolUsage[];
  /** Verifica i requisiti di un talento rispetto allo stato attuale del personaggio. */
  checkFeat: (f: FeatData, excludeUid?: string) => PrereqResult;
  ctx: (path: string) => number | undefined;
}

const AVG_HP: Record<number, number> = { 4: 3, 6: 4, 8: 5, 10: 6, 12: 7 };

function babFor(prog: string, lvl: number) {
  if (prog === 'high') return lvl;
  if (prog === 'med') return Math.floor((lvl * 3) / 4);
  return Math.floor(lvl / 2);
}
function saveFor(good: boolean, lvl: number, prestige: boolean) {
  if (prestige) return good ? Math.floor((lvl + 1) / 2) : Math.floor((lvl + 1) / 3);
  return good ? 2 + Math.floor(lvl / 2) : Math.floor(lvl / 3);
}

interface Applied extends Change {
  value: number;
  label: string;
}

/** Applica le regole di cumulo dei bonus: stessi tipi non si sommano (tranne schivare, circostanza, senza tipo). */
function stack(list: Applied[]): { total: number; parts: Part[] } {
  const byType = new Map<string, Applied[]>();
  for (const b of list) {
    if (!byType.has(b.type)) byType.set(b.type, []);
    byType.get(b.type)!.push(b);
  }
  let total = 0;
  const parts: Part[] = [];
  for (const [type, arr] of byType) {
    if (STACKING_TYPES.has(type)) {
      for (const b of arr) {
        total += b.value;
        parts.push({ label: b.label, value: b.value });
      }
    } else {
      const pos = arr.filter((b) => b.value > 0).sort((a, b) => b.value - a.value)[0];
      const neg = arr.filter((b) => b.value < 0).sort((a, b) => a.value - b.value)[0];
      for (const b of [pos, neg]) if (b) {
        total += b.value;
        parts.push({ label: `${b.label} (${BONUS_TYPE_LABEL[type] ?? type})`, value: b.value });
      }
    }
  }
  return { total, parts };
}

/** Livello di un privilegio legato (es. poteri di dominio) ricavato dal testo "At 8th level…". */
function levelFromText(desc: string): number {
  const m = /At (\d+)(?:st|nd|rd|th) level/i.exec(desc.replace(/<[^>]+>/g, ' ').slice(0, 300));
  return m ? +m[1] : 1;
}
const LINKED_POWER_TAGS = new Set([
  'Domain Power', 'Bloodline Power', 'School Power', 'Order Ability', 'Minor Blessing', 'Major Blessing',
  'Spirit Ability', 'Greater Spirit Ability', 'True Spirit Ability', 'Base Focus Power',
]);

const CARRY_HEAVY = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 115, 130, 150, 175, 200, 230, 260, 300, 350, 400, 460, 520, 600, 700, 800, 920, 1040, 1200, 1400];
function heavyLoad(str: number) {
  if (str <= 0) return 0;
  if (str < 30) return CARRY_HEAVY[str];
  const extra = Math.floor((str - 20) / 10);
  return CARRY_HEAVY[str - extra * 10] * Math.pow(4, extra);
}

/** Dadi di danno per taglia (da Media verso le altre taglie), tabella standard. */
const DMG_SMALL: Record<string, string> = {
  '1d2': '1', '1d3': '1d2', '1d4': '1d3', '1d6': '1d4', '1d8': '1d6', '1d10': '1d8', '1d12': '1d10', '2d4': '1d6', '2d6': '1d10', '2d8': '2d6', '2d10': '2d8',
};
const DMG_LARGE: Record<string, string> = {
  '1d2': '1d3', '1d3': '1d4', '1d4': '1d6', '1d6': '1d8', '1d8': '2d6', '1d10': '2d8', '1d12': '3d6', '2d4': '2d6', '2d6': '3d6', '2d8': '3d8', '2d10': '4d8',
};
export function damageForSize(dmg: string, size: string) {
  if (size === 'sm') return DMG_SMALL[dmg] ?? dmg;
  if (size === 'lg') return DMG_LARGE[dmg] ?? dmg;
  return dmg;
}

const ARMOR_TYPE: Record<string, number> = { lightArmor: 1, mediumArmor: 2, heavyArmor: 3 };
const ARMOR_PROF_KEY: Record<string, string> = { lightArmor: 'lgt', mediumArmor: 'med', heavyArmor: 'hvy', lightShield: 'shl', heavyShield: 'shl', other: 'shl', towerShield: 'twr' };

export function compute(char: Character, db: Database): Computed {
  const warnings: Warning[] = [];
  const level = char.levels.length;
  const race = char.raceId ? db.raceById.get(char.raceId) : undefined;
  const size = race?.size ?? 'med';

  // ---------------------------------------------------------------- Classi e livelli
  const classMap = new Map<string, ClassLevelInfo>();
  char.levels.forEach((l, i) => {
    const cls = db.classById.get(l.classId);
    if (!cls) return;
    const info = classMap.get(cls.id);
    if (info) info.level++;
    else classMap.set(cls.id, { cls, level: 1, archetypes: [], firstCharLevel: i + 1 });
  });
  for (const info of classMap.values()) {
    info.archetypes = (char.archetypes[info.cls.id] ?? []).map((id) => db.archetypeById.get(id)).filter(Boolean) as ArchetypeData[];
  }
  const classes = [...classMap.values()];

  // ---------------------------------------------------------------- Caratteristiche (fase 1)
  const levelUps: Record<AbilityKey, number> = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
  char.levels.forEach((l, i) => {
    if (ABILITY_INCREASE_LEVELS.includes(i + 1) && l.ability) levelUps[l.ability]++;
  });
  const racial: Record<AbilityKey, number> = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
  if (race) {
    for (const a of ABILITIES) racial[a] = race.abilityMods[a] ?? 0;
    if (race.flexible && char.raceAbilityChoice) racial[char.raceAbilityChoice] += 2;
  }
  let spent = 0;
  if (char.settings.abilityMethod === 'pointbuy') for (const a of ABILITIES) spent += POINT_BUY_COST[char.baseAbilities[a]] ?? 0;
  if (char.settings.abilityMethod === 'pointbuy' && spent > char.settings.pointBuy)
    warnings.push({ level: 'error', text: `Point buy: spesi ${spent} punti su ${char.settings.pointBuy}.`, section: 'abilities' });
  if (race?.flexible && !char.raceAbilityChoice)
    warnings.push({ level: 'warn', text: `${race.name}: scegli la caratteristica che riceve il bonus razziale +2.`, section: 'race' });

  // ---------------------------------------------------------------- Raccolta delle "changes"
  const sources: { changes: Change[]; label: string; classLevel?: number; isRace?: boolean }[] = [];
  // Tratti razziali sostituiti da quelli alternativi (es. "Bonus Feat", "Skilled" dell'umano)
  const altReplaced = new Set<string>();
  for (const name of char.alternateTraits) race?.alternateTraits?.find((t) => t.name === name)?.replaces.forEach((r) => altReplaced.add(r.toLowerCase()));
  const raceChanges = (race?.changes ?? []).filter(
    (ch) => !(ch.target === 'bonusFeats' && altReplaced.has('bonus feat')) && !(ch.target === 'bonusSkillRanks' && altReplaced.has('skilled')),
  );
  if (raceChanges.length) sources.push({ changes: raceChanges, label: race!.name, isRace: true });
  const featPicks = char.feats.map((p) => ({ ...p, feat: db.featById.get(p.featId) }));
  for (const p of featPicks) if (p.feat?.changes) sources.push({ changes: p.feat.changes, label: p.feat.name });
  for (const id of char.traits) {
    const t = db.traitById.get(id);
    if (t?.changes) sources.push({ changes: t.changes, label: t.name });
  }

  // Privilegi di classe attivi (servono sia per l'elenco sia per le changes)
  const features: FeatureEntry[] = [];
  for (const info of classes) {
    const replaced = new Set(info.archetypes.flatMap((a) => a.replaces));
    for (const f of info.cls.features) {
      if (f.level > info.level) continue;
      const fd = f.id ? db.featureById.get(f.id) : undefined;
      const label = fd?.name ?? f.label ?? '?';
      features.push({ key: `${info.cls.id}:${f.id ?? label}:${f.level}`, feature: fd, label, level: f.level, classId: info.cls.id, source: 'class', replaced: !!fd && replaced.has(fd.name) });
    }
    for (const a of info.archetypes) {
      for (const f of a.features) {
        if (f.level > info.level) continue;
        const fd = db.featureById.get(f.id);
        features.push({ key: `${a.id}:${f.id}:${f.level}`, feature: fd, label: fd?.name ?? '?', level: f.level, classId: info.cls.id, source: 'archetype', archetype: a.name });
      }
    }
    // Archetipi incompatibili: sostituiscono lo stesso privilegio
    const seen = new Map<string, string>();
    for (const a of info.archetypes) {
      for (const r of a.replaces) {
        if (seen.has(r)) warnings.push({ level: 'error', text: `Archetipi incompatibili: ${seen.get(r)} e ${a.name} modificano entrambi "${r}".`, section: 'classes' });
        else seen.set(r, a.name);
      }
    }
  }

  // ---------------------------------------------------------------- Slot delle scelte di classe
  const choiceSlots: ChoiceSlot[] = [];
  for (const info of classes) {
    for (const def of CLASS_CHOICES[info.cls.id] ?? []) {
      if (def.kind === 'feat') continue;
      for (const lv of def.levels) {
        if (lv > info.level) continue;
        for (let n = 0; n < (def.count ?? 1); n++) {
          const id = `${info.cls.id}:${def.key}:${lv}:${n}`;
          choiceSlots.push({ id, classId: info.cls.id, def, level: lv, index: n, pick: undefined });
        }
      }
    }
  }
  const choicePicks = new Map(char.choices.map((c) => [`${c.classId}:${c.choiceKey}:${c.level}:${c.index ?? 0}`, c]));
  for (const s of choiceSlots) s.pick = choicePicks.get(s.id);
  for (const s of choiceSlots) {
    const fd = s.pick?.featureId ? db.featureById.get(s.pick.featureId) : undefined;
    if (fd) {
      features.push({ key: `choice:${s.id}`, feature: fd, label: fd.name, level: s.level, classId: s.classId, source: 'choice' });
      if (fd.minLevel && fd.minLevel > s.level)
        warnings.push({ level: 'error', text: `${fd.name} richiede il ${fd.minLevel}° livello di classe (scelto al ${s.level}°).`, section: 'features' });
      // Poteri legati (dominio, linea di sangue, scuola, ordine…)
      const info = classMap.get(s.classId)!;
      // Un dominio concede solo i poteri di dominio, una benedizione solo le benedizioni, ecc.
      const allowedTags = fd.tags?.some((t) => t === 'Domain' || t === 'Subdomain')
        ? ['Domain Power']
        : fd.tags?.includes('Blessing')
          ? ['Minor Blessing', 'Major Blessing']
          : [...LINKED_POWER_TAGS].filter((t) => t !== 'Domain Power' && !t.endsWith('Blessing'));
      for (const lf of db.featuresByTag.get(fd.name) ?? []) {
        if (lf.id === fd.id || !lf.tags?.some((t) => allowedTags.includes(t))) continue;
        const lv = levelFromText(lf.desc);
        if (lv > info.level) continue;
        features.push({ key: `linked:${s.id}:${lf.id}`, feature: lf, label: lf.name, level: lv, classId: s.classId, source: 'linked' });
      }
    } else if (s.pick?.text) {
      features.push({ key: `choice:${s.id}`, label: `${s.def.label}: ${s.pick.text}`, level: s.level, classId: s.classId, source: 'choice' });
    } else {
      warnings.push({ level: 'info', text: `${db.classById.get(s.classId)?.name} ${s.level}: scelta "${s.def.label}" da completare.`, section: 'features' });
    }
  }
  for (const id of char.extraFeatures) {
    const fd = db.featureById.get(id);
    if (fd) features.push({ key: `extra:${id}`, feature: fd, label: fd.name, level: 0, source: 'extra' });
  }
  for (const fe of features) {
    if (fe.replaced || !fe.feature?.changes) continue;
    const info = fe.classId ? classMap.get(fe.classId) : undefined;
    // I talenti bonus di classe sono gestiti come slot, non come changes
    const ch = fe.feature.changes.filter((c) => c.target !== 'bonusFeats');
    if (ch.length) sources.push({ changes: ch, label: fe.label, classLevel: info?.level });
  }

  // Equipaggiamento indossato
  const equipped = char.equipment.filter((e) => e.equipped);
  for (const e of equipped) {
    const ch = e.changes ?? (e.kind === 'gear' && e.refId ? db.gearById.get(e.refId)?.changes : undefined);
    if (ch?.length) sources.push({ changes: ch, label: e.name });
  }
  for (const b of char.customBonuses) {
    if (b.enabled) sources.push({ changes: [{ formula: String(b.value), target: b.target, type: b.type }], label: b.label || 'Bonus manuale' });
  }
  // Elemental overflow del cineta: bonus di taglia alle caratteristiche fisiche in base al burn
  const kinLevel = classMap.get('kineticist')?.level ?? 0;
  if (kinLevel >= 6) {
    const roughCon = mod(char.baseAbilities.con + racial.con + levelUps.con);
    const burn = Math.min(char.kineticist?.burn ?? 0, Math.max(0, 3 + roughCon));
    const ord = char.kineticist?.overflow?.length === 3 ? char.kineticist.overflow : (['dex', 'con', 'str'] as AbilityKey[]);
    const vals = kinLevel >= 16 && burn >= 7 ? [6, 4, 2] : kinLevel >= 11 && burn >= 5 ? [4, 2, 2] : burn >= 3 ? [2, 2, 0] : [];
    const ch = vals.map((v, i) => ({ formula: String(v), target: ord[i], type: 'size' })).filter((c) => c.formula !== '0');
    if (ch.length) sources.push({ changes: ch, label: 'Elemental overflow' });
  }

  // Armatura e scudo indossati
  let armorItem: { data: ArmorData; enh: number; mw: boolean; name: string } | undefined;
  let shieldItem: typeof armorItem;
  for (const e of equipped) {
    if (e.kind !== 'armor' || !e.refId) continue;
    const data = db.armorById.get(e.refId);
    if (!data) continue;
    const it = { data, enh: e.enhancement ?? 0, mw: !!e.masterwork || (e.enhancement ?? 0) > 0, name: e.name };
    if (data.kind === 'shield') shieldItem ??= it;
    else armorItem ??= it;
  }
  const armorType = armorItem ? ARMOR_TYPE[armorItem.data.category] ?? 1 : 0;

  // ---------------------------------------------------------------- Contesto per le formule
  const abilityTotals = {} as Record<AbilityKey, number>;
  const skillRanksByKey = (key: string) =>
    Object.entries(char.skills).filter(([k]) => k === key || k.startsWith(key + ':')).reduce((a, [, v]) => Math.max(a, v), 0);
  let babTotal = 0;
  for (const info of classes) babTotal += babFor(info.cls.bab, info.level);
  let currentClassLevel = 0;
  const ctx = (p: string): number | undefined => {
    let m: RegExpExecArray | null;
    if ((m = /^abilities\.(\w+)\.(mod|total|value)$/.exec(p))) {
      const t = abilityTotals[m[1] as AbilityKey] ?? 10;
      return m[2] === 'mod' ? mod(t) : t;
    }
    if (p === 'attributes.hd.total' || p === 'details.level.value') return level;
    if (p === 'attributes.bab.total') return babTotal;
    if ((m = /^skills?\.(\w+)\.ranks?$/.exec(p))) return skillRanksByKey(m[1]);
    if (p === 'class.level' || p === 'class.unlevel') return currentClassLevel;
    if (p === 'armor.type') return armorType;
    if (p === 'shield.type') return shieldItem ? (shieldItem.data.category === 'towerShield' ? 3 : 1) : 0;
    if (p === 'attributes.encumbrance.level') return 0;
    if (p === 'size') return ['fine', 'dim', 'tiny', 'sm', 'med', 'lg', 'huge', 'grg', 'col'].indexOf(size);
    return undefined;
  };

  // Valuta le changes in due fasi: prima le caratteristiche, poi il resto.
  const byTarget = new Map<string, Applied[]>();
  const evalAll = (filter: (t: string) => boolean) => {
    for (const s of sources) {
      for (const c of s.changes) {
        if (!filter(c.target)) continue;
        currentClassLevel = s.classLevel ?? level;
        const v = evalFormula(c.formula, ctx);
        if (v === null || v === 0) continue;
        if (!byTarget.has(c.target)) byTarget.set(c.target, []);
        byTarget.get(c.target)!.push({ ...c, value: v, label: s.label });
      }
    }
  };
  const isAbility = (t: string) => (ABILITIES as string[]).includes(t);
  // Le changes razziali delle caratteristiche sono già in racial; evitiamo doppi conteggi.
  evalAll(isAbility);
  const abilities = {} as Computed['abilities'];
  for (const a of ABILITIES) {
    const bonus = stack(byTarget.get(a) ?? []);
    const base = char.baseAbilities[a];
    const total = base + racial[a] + levelUps[a] + bonus.total;
    abilityTotals[a] = total;
    const parts: Part[] = [{ label: 'Base', value: base }];
    if (racial[a]) parts.push({ label: 'Razza', value: racial[a] });
    if (levelUps[a]) parts.push({ label: 'Aumenti di livello', value: levelUps[a] });
    parts.push(...bonus.parts);
    abilities[a] = { base, racial: racial[a], levelUp: levelUps[a], bonus: bonus.total, total, mod: mod(total), parts };
  }
  evalAll((t) => !isAbility(t));
  const sum = (...targets: string[]) => stack(targets.flatMap((t) => byTarget.get(t) ?? []));

  // ---------------------------------------------------------------- Carico
  const totalWeight = char.equipment.reduce((a, e) => a + e.weight * e.qty, 0);
  const sizeMult = size === 'sm' ? 0.75 : size === 'lg' ? 2 : size === 'tiny' ? 0.5 : 1;
  const heavy = Math.floor(heavyLoad(abilityTotals.str) * sizeMult);
  const light = Math.floor(heavy / 3);
  const medium = Math.floor((heavy * 2) / 3);
  const noEnc = race?.changeFlags?.includes('noMediumEncumbrance');
  const loadLevel: 0 | 1 | 2 | 3 = totalWeight <= light ? 0 : totalWeight <= medium ? (noEnc ? 0 : 1) : totalWeight <= heavy ? (race?.changeFlags?.includes('noHeavyEncumbrance') ? 0 : 2) : 3;

  // ---------------------------------------------------------------- Armatura
  const mDexBonus = sum('mDexA').total;
  const acpReduction = sum('acpA').total;
  let maxDex: number | null = armorItem?.data.maxDex ?? null;
  if (maxDex !== null) maxDex += mDexBonus;
  const loadMaxDex = loadLevel === 1 ? 3 : loadLevel >= 2 ? 1 : null;
  if (loadMaxDex !== null) maxDex = maxDex === null ? loadMaxDex : Math.min(maxDex, loadMaxDex);
  const itemAcp = (it?: typeof armorItem) => (it ? Math.max(0, it.data.acp - (it.mw ? 1 : 0)) : 0);
  let acp = Math.max(0, itemAcp(armorItem) - acpReduction) + itemAcp(shieldItem);
  const loadAcp = loadLevel === 1 ? 3 : loadLevel >= 2 ? 6 : 0;
  acp = Math.max(acp, loadAcp);
  const asf = (armorItem?.data.asf ?? 0) + (shieldItem?.data.asf ?? 0);

  // Competenze
  const armorProfs = new Set<string>();
  for (const info of classes) {
    // Le classi multiple concedono le competenze solo se prese al 1° livello? In PF1 si ottengono comunque tutte.
    info.cls.armorProf.forEach((p) => armorProfs.add(p));
  }
  for (const p of featPicks) {
    const n = p.feat?.name;
    if (n === 'Light Armor Proficiency') armorProfs.add('lgt');
    if (n === 'Medium Armor Proficiency') armorProfs.add('med');
    if (n === 'Heavy Armor Proficiency') armorProfs.add('hvy');
    if (n === 'Shield Proficiency') armorProfs.add('shl');
    if (n === 'Tower Shield Proficiency') armorProfs.add('twr');
  }
  let armorNonProf = 0;
  for (const it of [armorItem, shieldItem]) {
    if (!it) continue;
    const key = ARMOR_PROF_KEY[it.data.category];
    if (key && !armorProfs.has(key)) {
      armorNonProf += itemAcp(it);
      warnings.push({ level: 'warn', text: `Non competente in ${it.name}: la penalità di armatura si applica ai tiri per colpire.`, section: 'equipment' });
    }
  }

  // ---------------------------------------------------------------- Livelli incantatore ecc.
  const sizeMod = SIZE_MOD[size] ?? 0;
  const dexMod = abilities.dex.mod;
  const dexToAc = maxDex !== null ? Math.min(dexMod, maxDex) : dexMod;

  // ---------------------------------------------------------------- BAB e TS
  const saves = {} as Computed['saves'];
  for (const s of SAVES) {
    let base = 0;
    for (const info of classes) base += saveFor(info.cls.saves[s] === 'good', info.level, info.cls.kind === 'prestige');
    const b = sum('allSavingThrows', s);
    const am = abilities[SAVE_ABILITY[s]].mod;
    saves[s] = {
      base,
      total: base + am + b.total,
      parts: [{ label: 'Base', value: base }, { label: 'Caratteristica', value: am }, ...b.parts],
    };
  }

  // ---------------------------------------------------------------- Punti ferita
  const favored = char.favoredClasses;
  const hpParts: Part[] = [];
  let hpDice = 0;
  let fcbHp = 0;
  let fcbSkill = 0;
  char.levels.forEach((l, i) => {
    const cls = db.classById.get(l.classId);
    if (!cls) return;
    let v: number;
    if (i === 0 || char.settings.hpMethod === 'max') v = cls.hd;
    else if (char.settings.hpMethod === 'roll') v = Math.min(cls.hd, Math.max(1, l.hpRoll ?? AVG_HP[cls.hd] ?? cls.hd / 2 + 1));
    else v = AVG_HP[cls.hd] ?? Math.floor(cls.hd / 2) + 1;
    hpDice += v;
    if (favored.includes(cls.id)) {
      if (l.fcb === 'hp') fcbHp++;
      if (l.fcb === 'skill') fcbSkill++;
      if (!l.fcb) warnings.push({ level: 'info', text: `Livello ${i + 1}: scegli il bonus della classe preferita.`, section: 'classes' });
    }
  });
  const conHp = abilities.con.mod * level;
  hpParts.push({ label: 'Dadi vita', value: hpDice });
  if (level) hpParts.push({ label: 'Costituzione', value: conHp });
  if (fcbHp) hpParts.push({ label: 'Classe preferita', value: fcbHp });
  const mhp = sum('mhp');
  hpParts.push(...mhp.parts);
  const hpTotal = Math.max(level ? level : 0, hpDice + conHp + fcbHp + mhp.total);

  // ---------------------------------------------------------------- CA
  const acParts: Part[] = [{ label: 'Base', value: 10 }];
  const armorBonus = armorItem ? armorItem.data.ac + armorItem.enh : 0;
  const shieldBonus = shieldItem ? shieldItem.data.ac + shieldItem.enh : 0;
  // I bonus di armatura (es. bracciali dell'armatura) non si sommano all'armatura indossata
  const aacAll = byTarget.get('aac') ?? [];
  const aacArmor = stack(aacAll.filter((b) => b.type === 'armor'));
  const aac = stack(aacAll.filter((b) => b.type !== 'armor'));
  const sac = sum('sac');
  const nac = sum('nac');
  const acGeneric = byTarget.get('ac') ?? [];
  const acStack = stack(acGeneric);
  const dodgeAndOther = acStack;
  const armorTotal = Math.max(armorBonus, aacArmor.total, 0) + aac.total;
  const shieldTotal = shieldBonus + sac.total;
  if (armorTotal) acParts.push({ label: armorItem ? `Armatura (${armorItem.name})` : 'Armatura', value: armorTotal });
  if (shieldTotal) acParts.push({ label: shieldItem ? `Scudo (${shieldItem.name})` : 'Scudo', value: shieldTotal });
  if (dexToAc) acParts.push({ label: 'Destrezza', value: dexToAc });
  if (sizeMod) acParts.push({ label: 'Taglia', value: sizeMod });
  if (nac.total) acParts.push({ label: 'Armatura naturale', value: nac.total });
  acParts.push(...dodgeAndOther.parts);
  const acTotal = 10 + armorTotal + shieldTotal + dexToAc + sizeMod + nac.total + dodgeAndOther.total;
  const dodgeTotal = acGeneric.filter((b) => b.type === 'dodge').reduce((a, b) => a + b.value, 0);
  const touch = 10 + dexToAc + sizeMod + dodgeAndOther.total;
  const flatFooted = acTotal - Math.max(0, dexToAc) - Math.max(0, dodgeTotal);

  // ---------------------------------------------------------------- Manovre e iniziativa
  const cmbB = sum('cmb');
  const strMod = abilities.str.mod;
  const tinyOrSmaller = ['fine', 'dim', 'tiny'].includes(size);
  const cmbAbility = tinyOrSmaller ? dexMod : strMod;
  const cmbTotal = babTotal + cmbAbility + (SIZE_SPECIAL[size] ?? 0) + cmbB.total;
  const cmdB = sum('cmd');
  const acForCmd = acGeneric.filter((b) => ['deflection', 'dodge', 'insight', 'luck', 'morale', 'profane', 'sacred', 'circumstance', 'untyped'].includes(b.type));
  const cmdAc = stack(acForCmd).total;
  const cmdTotal = 10 + babTotal + strMod + dexMod + (SIZE_SPECIAL[size] ?? 0) + cmdB.total + cmdAc;
  const initB = sum('init');
  const init = { total: dexMod + initB.total, parts: [{ label: 'Destrezza', value: dexMod }, ...initB.parts] };

  // ---------------------------------------------------------------- Velocità
  const speed: Record<string, number> = { ...(race?.speed ?? { land: 30 }) };
  const slowArmor = (armorType >= 2 && !race?.changeFlags?.includes(armorType === 2 ? 'mediumArmorFullSpeed' : 'heavyArmorFullSpeed')) || loadLevel >= 1 && !noEnc;
  if (slowArmor && speed.land) speed.land = speed.land >= 30 ? speed.land - 10 * Math.floor(speed.land / 30) : speed.land - 5;
  for (const k of ['land', 'swim', 'fly', 'climb', 'burrow']) {
    const b = sum(`${k}Speed`).total;
    if (b) speed[k] = (speed[k] ?? 0) + b;
  }

  // ---------------------------------------------------------------- Abilità
  const classSkills = new Set<string>();
  for (const info of classes) info.cls.classSkills.forEach((s) => classSkills.add(s));
  if (kinLevel) db.kineticElementById.get(char.kineticist?.primary ?? '')?.classSkills.forEach((s) => classSkills.add(s));
  const traitClassSkills: string[] = [];
  for (const tid of char.traits) {
    const t = db.traitById.get(tid);
    if (!t) continue;
    const text = t.desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    for (const m of text.matchAll(/([A-Z][A-Za-z ]+(?:\([a-z ]+\))?)\s+is (?:always )?a class skill/g)) {
      const name = m[1].trim().toLowerCase();
      const sk = SKILLS.find((s) => name.endsWith(s.en.toLowerCase()));
      if (sk) { classSkills.add(sk.key); traitClassSkills.push(sk.key); }
    }
  }
  const perLevel: number[] = [];
  const bonusRanks = sum('bonusSkillRanks').total;
  char.levels.forEach((l, i) => {
    const cls = db.classById.get(l.classId);
    if (!cls) return;
    // Int al livello i (aumenti di caratteristica non retroattivi)
    let intAt = abilities.int.total - abilities.int.levelUp;
    char.levels.slice(0, i + 1).forEach((x, j) => { if (ABILITY_INCREASE_LEVELS.includes(j + 1) && x.ability === 'int') intAt++; });
    let pts = Math.max(1, cls.skillRanks + mod(intAt));
    if (favored.includes(cls.id) && l.fcb === 'skill') pts++;
    perLevel.push(pts);
  });
  const skillTotal = perLevel.reduce((a, b) => a + b, 0) + bonusRanks;
  void fcbSkill;
  const skills: SkillRow[] = [];
  let used = 0;
  const visibleSkills = SKILLS.filter((s) => char.settings.backgroundSkills || !UNCHAINED_ONLY.has(s.key));
  for (const def of visibleSkills) {
    const keys = def.multi ? (char.skillSpecialties[def.key] ?? []).map((sp) => `${def.key}:${sp}`) : [def.key];
    if (def.multi && !keys.length) keys.push(def.key);
    for (const key of keys) {
      const ranks = char.skills[key] ?? 0;
      used += ranks;
      const cs = classSkills.has(def.key);
      const am = abilities[def.ability].mod;
      const parts: Part[] = [];
      if (ranks) parts.push({ label: 'Gradi', value: ranks });
      parts.push({ label: 'Caratteristica', value: am });
      if (cs && ranks > 0) parts.push({ label: 'Abilità di classe', value: 3 });
      if (def.acp && acp) parts.push({ label: 'Penalità armatura', value: -acp });
      if (def.key === 'ste' && SIZE_STEALTH[size]) parts.push({ label: 'Taglia', value: SIZE_STEALTH[size] });
      if (def.key === 'fly' && SIZE_FLY[size]) parts.push({ label: 'Taglia', value: SIZE_FLY[size] });
      const knowledge = def.key.startsWith('k') && def.key.length === 3 && def.key !== 'kno' ? ['skill.knowledge'] : def.key === 'kno' ? ['skill.knowledge'] : [];
      const b = sum(`skill.${def.key}`, 'skills', `${def.ability}Skills`, ...knowledge);
      parts.push(...b.parts);
      const total = parts.reduce((a, p) => a + p.value, 0);
      if (ranks > level) warnings.push({ level: 'error', text: `${def.it}: ${ranks} gradi superano il massimo (${level}).`, section: 'skills' });
      const specialty = key.includes(':') ? key.split(':')[1] : undefined;
      skills.push({ key, def, specialty, label: specialty ? `${def.it} (${specialty})` : def.it, ranks, classSkill: cs, total, parts, usable: !def.trained || ranks > 0 });
    }
  }
  if (used > skillTotal) warnings.push({ level: 'error', text: `Gradi abilità: assegnati ${used} su ${skillTotal}.`, section: 'skills' });
  else if (used < skillTotal && level) warnings.push({ level: 'info', text: `Gradi abilità: ${skillTotal - used} ancora da assegnare.`, section: 'skills' });

  // ---------------------------------------------------------------- Slot talenti
  const featSlots: FeatSlot[] = [];
  for (let L = 1; L <= level; L++) if (isFeatLevel(L)) featSlots.push({ id: `lvl${L}`, label: `Livello ${L}`, level: L, kind: 'general' });
  let bonusFeatsFromRace = 0;
  if (race) {
    for (const c of raceChanges.filter((c) => c.target === 'bonusFeats')) bonusFeatsFromRace += evalFormula(c.formula, ctx) ?? 0;
  }
  if (level) for (let n = 0; n < bonusFeatsFromRace; n++) featSlots.push({ id: `race${n}`, label: `Talento bonus razziale`, level: 1, kind: 'race' });
  for (const info of classes) {
    for (const def of CLASS_CHOICES[info.cls.id] ?? []) {
      if (def.kind !== 'feat') continue;
      for (const lv of def.levels) {
        if (lv > info.level) continue;
        // Livello del personaggio in cui si ottiene il livello di classe lv
        let count = 0;
        let charLevel = 1;
        for (let i = 0; i < char.levels.length; i++) {
          if (char.levels[i].classId === info.cls.id) count++;
          if (count === lv) { charLevel = i + 1; break; }
        }
        featSlots.push({ id: `class:${info.cls.id}:${def.key}:${lv}`, label: `${def.label} (${info.cls.name} ${lv})`, level: charLevel, kind: 'class', classId: info.cls.id, filter: def.featFilter });
      }
    }
  }
  for (const x of char.extraFeatSlots) featSlots.push({ id: x.id, label: x.label || 'Talento bonus', level: 0, kind: 'extra' });
  const pickBySlot = new Map(char.feats.map((f) => [f.slot, f]));
  for (const s of featSlots) s.pick = pickBySlot.get(s.id);
  for (const s of featSlots) if (!s.pick) warnings.push({ level: 'info', text: `Slot talento libero: ${s.label}.`, section: 'feats' });
  const orphan = char.feats.filter((f) => !featSlots.some((s) => s.id === f.slot));
  for (const o of orphan) warnings.push({ level: 'warn', text: `Il talento ${db.featById.get(o.featId)?.name ?? o.featId} non ha più uno slot valido (livello rimosso?).`, section: 'feats' });

  // ---------------------------------------------------------------- Incantatori
  const casters: CasterInfo[] = [];
  const prestigeBonus = new Map<string, number>();
  for (const info of classes) {
    if (info.cls.kind !== 'prestige' || !info.cls.spellProgression?.some(Boolean)) continue;
    const target = char.prestigeCasting[info.cls.id];
    const n = info.cls.spellProgression.slice(0, info.level).filter(Boolean).length;
    if (target) prestigeBonus.set(target, (prestigeBonus.get(target) ?? 0) + n);
    else warnings.push({ level: 'warn', text: `${info.cls.name}: scegli quale classe incantatrice avanza (+${n} livelli incantatore).`, section: 'spells' });
  }
  for (const info of classes) {
    const c = info.cls.casting;
    if (!c) continue;
    const eff = info.level + (prestigeBonus.get(info.cls.id) ?? 0);
    const type = c.type === 'npc' ? 'npc' : c.type;
    const prog = type === 'hybrid' || type === 'npc' ? (type === 'npc' ? 'med' : 'high') : c.progression;
    const castsTable = db.caster.castsPerDay[type]?.[prog];
    const prepTable = db.caster.spellsPreparedPerDay[type]?.[prog];
    if (!castsTable) continue;
    const row = castsTable[Math.min(eff, 20) - 1] ?? [];
    const prow = prepTable?.[Math.min(eff, 20) - 1] ?? [];
    const score = abilities[c.ability].total;
    const am = mod(score);
    const perDay: (number | 'inf' | null)[] = [];
    const bonus: number[] = [];
    let maxSpellLevel = -1;
    for (let sl = 0; sl <= 9; sl++) {
      const base = row[sl];
      if (base === undefined || base === null || (sl === 0 && !c.cantrips)) { perDay.push(null); bonus.push(0); continue; }
      if (score < 10 + sl) { perDay.push(null); bonus.push(0); continue; }
      const b = sl > 0 && am >= sl ? 1 + Math.floor((am - sl) / 4) : 0;
      if (base === 'inf') perDay.push('inf');
      else perDay.push(base + b);
      bonus.push(b);
      if (base === 'inf' || base + b > 0) maxSpellLevel = sl;
    }
    const known = type === 'spontaneous' || type === 'hybrid' ? perDay.map((_, sl) => (prow[sl] === undefined || prow[sl] === null || perDay[sl] === null ? null : Number(prow[sl]))) : null;
    const prepared = type === 'prepared' || type === 'hybrid' || type === 'npc'
      ? perDay.map((p, sl) => {
          if (p === null) return null;
          const pc = type === 'hybrid' ? row[sl] : prow[sl];
          if (pc === undefined || pc === null) return null;
          if (pc === 'inf') return Number(prow[sl] ?? 0);
          return Number(pc) + bonus[sl] + (sl > 0 && c.domainSlots ? c.domainSlots : 0);
        })
      : null;
    casters.push({
      classId: info.cls.id,
      cls: info.cls,
      effectiveLevel: eff,
      casterLevel: prog === 'low' && type !== 'npc' ? Math.max(0, eff - 3) : eff,
      ability: c.ability,
      abilityScore: score,
      perDay,
      bonus,
      known,
      prepared,
      maxSpellLevel,
      domainSlots: c.domainSlots,
      dcBase: 10 + am,
    });
  }
  for (const ci of casters) {
    const sel = char.spells[ci.classId];
    if (!sel || !ci.known) continue;
    for (let sl = 0; sl <= 9; sl++) {
      const lim = ci.known[sl];
      const n = sel.known.filter((id) => db.spellById.get(id)?.levels[ci.classId] === sl).length;
      if (lim !== null && n > lim) warnings.push({ level: 'error', text: `${ci.cls.name}: ${n} incantesimi conosciuti di ${sl}° livello (massimo ${lim}).`, section: 'spells' });
    }
  }

  // ---------------------------------------------------------------- Attacchi
  const featNames = new Set(featPicks.map((p) => p.feat?.name).filter(Boolean) as string[]);
  const featDetails = (name: string) => featPicks.filter((p) => p.feat?.name === name).map((p) => (p.detail ?? '').toLowerCase());
  const atkAll = sum('attack');
  const atkMelee = sum('mattack');
  const atkRanged = sum('rattack');
  const dmgAll = sum('damage', 'wdamage');
  const attacks: AttackRow[] = [];
  const weaponProfs = new Set<string>();
  for (const info of classes) info.cls.weaponProf.forEach((w) => weaponProfs.add(w.toLowerCase()));
  race?.weaponProf?.forEach((w) => weaponProfs.add(w.toLowerCase()));
  if (featNames.has('Simple Weapon Proficiency')) weaponProfs.add('simple');
  if (featNames.has('Martial Weapon Proficiency')) featDetails('Martial Weapon Proficiency').forEach((d) => weaponProfs.add(d));
  featDetails('Exotic Weapon Proficiency').forEach((d) => weaponProfs.add(d));
  const iterative = (bonus: number) => {
    const out = [bonus];
    for (let b = babTotal - 5, i = 1; b > 0 && i < 4; b -= 5, i++) out.push(bonus - 5 * i);
    return out;
  };
  const weaponRow = (uid: string, name: string, w: WeaponData, enh: number, mw: boolean, abilityIds: string[] = []) => {
    const notes: string[] = [];
    // Proprietà speciali: danni extra (es. flaming +1d6 fuoco) e nomi in nota
    for (const id of abilityIds) {
      const ab = db.magicAbilityById.get(id);
      if (!ab) continue;
      const m = /extra (\d+d\d+) points? of (\w+) damage/i.exec(ab.desc.replace(/<[^>]+>/g, ''));
      notes.push(m ? `${ab.name} (+${m[1]} ${m[2]})` : ab.name);
    }
    const finesse = featNames.has('Weapon Finesse') && (w.kind === 'light' || w.properties.includes('fin') || /rapier|whip|spiked chain|elven curve blade/i.test(w.name));
    const atkAbility = w.ranged ? dexMod : finesse ? Math.max(dexMod, strMod) : strMod;
    const nameLow = w.name.toLowerCase();
    const matches = (d: string) => !!d && (nameLow.includes(d) || d.includes(nameLow));
    const wf = featDetails('Weapon Focus').some(matches) ? 1 : 0;
    const gwf = featDetails('Greater Weapon Focus').some(matches) ? 1 : 0;
    const ws = featDetails('Weapon Specialization').some(matches) ? 2 : 0;
    const gws = featDetails('Greater Weapon Specialization').some(matches) ? 2 : 0;
    const prof = w.category === 'misc' || weaponProfs.has(w.category) || weaponProfs.has(nameLow) || [...weaponProfs].some((p) => p.length > 3 && nameLow.includes(p));
    if (!prof) notes.push('non competente (−4)');
    const atk = babTotal + atkAbility + sizeMod + (enh || (mw ? 1 : 0)) + wf + gwf + atkAll.total + (w.ranged ? atkRanged.total : atkMelee.total) - (prof ? 0 : 4) - armorNonProf;
    const twoHanded = w.kind === '2h' && !w.ranged;
    const strDmg = w.ranged ? (/composite/i.test(w.name) ? Math.min(strMod, 0) : /sling|thrown/i.test(w.name) ? strMod : Math.min(strMod, 0)) : twoHanded ? Math.floor(strMod * 1.5) : strMod;
    const dmgBonus = strDmg + enh + ws + gws + dmgAll.total;
    const dice = damageForSize(w.damage, size);
    const crit = `${w.critRange < 20 ? `${w.critRange}-20` : '20'}/×${w.critMult}`;
    if (w.rangeIncrement) notes.push(`incremento ${w.rangeIncrement} ft.`);
    if (finesse && dexMod > strMod) notes.push('Weapon Finesse');
    attacks.push({
      uid,
      name: enh ? `${name} +${enh}` : mw ? `${name} (perfetta)` : name,
      attack: iterative(atk),
      damage: dice ? `${dice}${dmgBonus ? (dmgBonus > 0 ? `+${dmgBonus}` : `${dmgBonus}`) : ''}` : '—',
      crit,
      type: w.damageTypes.map((t) => t[0].toUpperCase()).join('/'),
      notes,
    });
  };
  for (const e of equipped) {
    if (e.kind !== 'weapon' || !e.refId) continue;
    const w = db.weaponById.get(e.refId);
    if (w && w.kind !== 'ammo') weaponRow(e.uid, e.name, w, e.enhancement ?? 0, !!e.masterwork, e.abilities);
  }
  // Colpo senz'armi (con la progressione del monaco, se presente)
  const monkLevel = (classMap.get('monk')?.level ?? 0) + (classMap.get('monkUnchained')?.level ?? 0) + (classMap.get('brawler')?.level ?? 0);
  const monkDice = ['1d3', '1d6', '1d6', '1d6', '1d8', '1d8', '1d8', '1d8', '1d10', '1d10', '1d10', '1d10', '2d6', '2d6', '2d6', '2d6', '2d8', '2d8', '2d8', '2d8', '2d10'];
  const unarmed: WeaponData = {
    id: 'unarmed', name: 'Unarmed Strike', category: 'simple', kind: 'light', damage: monkDice[Math.min(monkLevel, 20)],
    damageTypes: ['bludgeoning'], critRange: 20, critMult: 2, ranged: false, groups: ['monk'], properties: [], price: 0, weight: 0, desc: '',
  };
  weaponProfs.add('unarmed strike');
  weaponRow('unarmed', 'Colpo senz\'armi', unarmed, 0, false);
  if (!monkLevel && !featNames.has('Improved Unarmed Strike')) attacks[attacks.length - 1].notes.push('danni non letali, provoca AdO');

  // ---------------------------------------------------------------- Cineta
  const kinetic = kinLevel
    ? computeKinetic(char, db, {
        level: kinLevel,
        charLevel: level,
        conMod: abilities.con.mod,
        dexMod,
        bab: babTotal,
        sizeMod,
        rangedAttackBonus: atkAll.total + atkRanged.total,
        damageBonus: dmgAll.total,
        blastFocus: featDetails('Weapon Focus').some((d) => /blast/.test(d)) ? 1 : 0,
        extraWildTalents: featPicks.filter((p) => p.feat?.name === 'Extra Wild Talent').length,
      })
    : undefined;
  for (const w of kinetic?.warnings ?? []) warnings.push({ level: /richiede|non è|non puoi/.test(w) ? 'warn' : 'info', text: `Cineta: ${w}`, section: 'kinetic' });
  if (kinetic) {
    for (const t of [...kinetic.automatic, ...kinetic.slots.map((s) => s.talent).filter(Boolean)])
      features.push({ key: `kin:${t!.id}`, label: t!.name, level: 1, classId: 'kineticist', source: 'choice' });
  }

  // ---------------------------------------------------------------- Scelte a punti (evoluzioni)
  const pools: PoolUsage[] = [];
  for (const info of classes) {
    for (const def of CLASS_POOLS[info.cls.id] ?? []) {
      const ids = char.pools[`${info.cls.id}:${def.key}`] ?? [];
      const picks = ids.map((id) => db.featureById.get(id)).filter(Boolean) as FeatureData[];
      const used = picks.reduce((a, f) => a + (f.cost ?? 1), 0);
      const points = def.points[Math.min(info.level, def.points.length) - 1] ?? 0;
      pools.push({ classId: info.cls.id, def, points, used, picks });
      if (used > points) warnings.push({ level: 'error', text: `${def.label}: usati ${used} punti su ${points}.`, section: 'features' });
      for (const f of picks) if (f.minLevel && f.minLevel > info.level) warnings.push({ level: 'error', text: `${f.name} richiede il ${f.minLevel}° livello.`, section: 'features' });
    }
  }

  // ---------------------------------------------------------------- Requisiti dei talenti
  const featureNames = features.filter((f) => !f.replaced).map((f) => f.label.toLowerCase());
  if (race) {
    featureNames.push(...(race.traits ?? []).map((t) => t.name.toLowerCase()));
    featureNames.push(...char.alternateTraits.map((t) => t.toLowerCase()));
  }
  const prereqEnv = {
    abilities: abilityTotals,
    bab: babTotal,
    level,
    classLevels: new Map(classes.map((c) => [c.cls.id, c.level])),
    skillRanks: skillRanksByKey,
    raceId: race?.id,
    raceSubtypes: race?.subtypes ?? [],
    baseSaves: { fort: saves.fort.base, ref: saves.ref.base, will: saves.will.base },
    armorProfs,
    casters: casters.map((c) => ({ tradition: c.cls.casting!.tradition, cl: c.casterLevel, maxLevel: c.maxSpellLevel })),
    featureNames,
  };
  const classNames = new Map(db.classes.map((x) => [x.id, x.name]));
  const checkFeat = (f: FeatData, excludeUid?: string) => {
    const others = new Set(featPicks.filter((x) => x.uid !== excludeUid).map((x) => x.feat?.name.toLowerCase()).filter(Boolean) as string[]);
    return checkPrereqs(f, { ...prereqEnv, featNames: others }, classNames);
  };
  const feats = featPicks.map((p) => {
    const prereq = p.feat ? checkFeat(p.feat, p.uid) : { ok: true, clauses: [] };
    if (p.feat && !prereq.ok) warnings.push({ level: 'warn', text: `${p.feat.name}: requisiti non soddisfatti.`, section: 'feats' });
    return { ...p, prereq };
  });
  // Talenti duplicati non ripetibili
  const counts = new Map<string, number>();
  for (const p of featPicks) if (p.feat) counts.set(p.feat.id + '|' + (p.detail ?? ''), (counts.get(p.feat.id + '|' + (p.detail ?? '')) ?? 0) + 1);
  for (const [k, n] of counts) {
    const f = db.featById.get(k.split('|')[0]);
    if (n > 1 && f && !f.multiple) warnings.push({ level: 'warn', text: `${f.name} è stato scelto ${n} volte.`, section: 'feats' });
  }

  // ---------------------------------------------------------------- Varie
  const srB = sum('spellResist');
  const money = char.money.pp * 10 + char.money.gp + char.money.sp / 10 + char.money.cp / 100;
  const spentGp = char.equipment.reduce((a, e) => a + e.price * e.qty, 0);
  if (level && favored.length === 0) warnings.push({ level: 'info', text: 'Scegli la classe preferita.', section: 'classes' });
  if (!race) warnings.push({ level: 'info', text: 'Scegli una razza.', section: 'race' });
  if (!level) warnings.push({ level: 'info', text: 'Aggiungi almeno un livello di classe.', section: 'classes' });
  for (const info of classes) {
    if (info.cls.kind === 'prestige' && info.firstCharLevel === 1)
      warnings.push({ level: 'error', text: `${info.cls.name} è una classe di prestigio: non può essere presa al 1° livello.`, section: 'classes' });
    if (info.cls.levels && info.level > info.cls.levels)
      warnings.push({ level: 'error', text: `${info.cls.name} ha solo ${info.cls.levels} livelli.`, section: 'classes' });
  }
  for (let i = 0; i < char.levels.length; i++)
    if (ABILITY_INCREASE_LEVELS.includes(i + 1) && !char.levels[i].ability)
      warnings.push({ level: 'info', text: `Livello ${i + 1}: scegli la caratteristica da aumentare.`, section: 'abilities' });

  return {
    level,
    race,
    size,
    classes,
    abilities,
    pointBuy: { spent, budget: char.settings.pointBuy },
    bab: babTotal,
    saves,
    hp: { total: hpTotal, parts: hpParts },
    ac: { total: acTotal, parts: acParts },
    touch,
    flatFooted,
    cmb: { total: cmbTotal, parts: [{ label: 'BAB', value: babTotal }, { label: tinyOrSmaller ? 'Destrezza' : 'Forza', value: cmbAbility }, { label: 'Taglia', value: SIZE_SPECIAL[size] ?? 0 }, ...cmbB.parts] },
    cmd: { total: cmdTotal, parts: [{ label: 'Base', value: 10 }, { label: 'BAB', value: babTotal }, { label: 'Forza', value: strMod }, { label: 'Destrezza', value: dexMod }, { label: 'Taglia', value: SIZE_SPECIAL[size] ?? 0 }, ...cmdB.parts, ...(cmdAc ? [{ label: 'Bonus alla CA', value: cmdAc }] : [])] },
    init,
    speed,
    sr: srB.total,
    skills,
    skillPoints: { total: skillTotal, used, perLevel },
    classSkills,
    featSlots,
    feats,
    choiceSlots,
    features,
    casters,
    armor: { acp, maxDex, asf, armorName: armorItem?.name, shieldName: shieldItem?.name, type: armorType },
    attacks,
    load: { weight: totalWeight, light, medium, heavy, level: loadLevel },
    wealth: { spent: spentGp, budget: WEALTH_BY_LEVEL[Math.min(level, 20)] ?? 0, money },
    favoredClasses: favored,
    bonusFeatsFromRace,
    warnings,
    traitClassSkills,
    kinetic,
    pools,
    checkFeat,
    ctx,
  };
}
