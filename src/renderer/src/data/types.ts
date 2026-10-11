// Tipi dei file JSON generati da tools/build-data.mjs

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export type SaveKey = 'fort' | 'ref' | 'will';

export interface Source {
  book?: string;
  page?: string;
}

export interface Change {
  formula: string;
  target: string;
  type: string;
  op?: string;
}

export interface ClassFeatureRef {
  level: number;
  id?: string;
  label?: string;
}

export interface CastingInfo {
  type: 'prepared' | 'spontaneous' | 'hybrid' | 'prestige' | 'npc';
  progression: 'high' | 'med' | 'low';
  ability: AbilityKey;
  tradition: 'arcane' | 'divine' | 'psychic' | 'alchemy';
  cantrips: boolean;
  domainSlots: number;
}

export interface ClassData {
  id: string;
  name: string;
  kind: 'base' | 'hybrid' | 'unchained' | 'prestige' | 'npc';
  hd: number;
  skillRanks: number;
  bab: 'high' | 'med' | 'low';
  saves: Record<SaveKey, 'good' | 'poor'>;
  classSkills: string[];
  armorProf: string[];
  weaponProf: string[];
  casting?: CastingInfo;
  features: ClassFeatureRef[];
  wealth?: string;
  summary?: string;
  desc: string;
  source?: Source;
  levels?: number;
  spellProgression?: boolean[];
  requirements?: string;
}

export interface FeatureData {
  id: string;
  name: string;
  origin: 'base' | 'archetype' | 'prestige';
  type?: string;
  tags?: string[];
  classes?: string[];
  desc: string;
  changes?: Change[];
  replaces?: string;
  /** Livello di classe minimo per sceglierlo. */
  minLevel?: number;
  /** Costo in punti evoluzione (evoluzioni dell'eidolon). */
  cost?: number;
  source?: Source;
}

export interface ArchetypeData {
  id: string;
  name: string;
  classId: string;
  features: { level: number; id: string }[];
  replaces: string[];
  desc: string;
  source?: Source;
}

export interface RaceData {
  id: string;
  name: string;
  core: boolean;
  size: string;
  speed: Record<string, number>;
  abilityMods: Partial<Record<AbilityKey, number>>;
  flexible: boolean;
  changes: Change[];
  changeFlags?: string[];
  languages: string[];
  types: string[];
  subtypes: string[];
  weaponProf?: string[];
  notes: { text: string; target: string }[];
  desc: string;
  source?: Source;
  traits?: { name: string; desc: string }[];
  alternateTraits?: { name: string; replaces: string[]; desc: string; source?: Source }[];
  favoredClassOptions?: { classId: string; desc: string; source?: Source }[];
}

export type Prereq =
  | { t: 'ability'; a: AbilityKey; v: number }
  | { t: 'bab'; v: number }
  | { t: 'cl'; v: number }
  | { t: 'level'; v: number }
  | { t: 'class'; c: string; v: number }
  | { t: 'skill'; s: string; v: number }
  | { t: 'feat'; name: string; detail?: string }
  | { t: 'race'; r: string }
  | { t: 'save'; s: SaveKey; v: number }
  | { t: 'armorProf'; v: string }
  | { t: 'caster'; trad?: string; v?: number }
  | { t: 'feature'; name: string }
  | { t: 'text'; text: string }
  | { t: 'or'; of: Prereq[] };

export interface FeatData {
  id: string;
  name: string;
  types: string[];
  prereqText?: string;
  prereq: Prereq[];
  summary?: string;
  flavor?: string;
  benefit: string;
  normal?: string;
  special?: string;
  extra?: Record<string, string>;
  multiple?: boolean;
  changes?: Change[];
  source?: Source;
}

export interface TraitData {
  id: string;
  name: string;
  category: string;
  basic: boolean;
  requirement?: string;
  desc: string;
  changes?: Change[];
  source?: Source;
}

export interface SpellData {
  id: string;
  name: string;
  school: string;
  subschool?: string[];
  descriptors?: string[];
  levels: Record<string, number>;
  other?: Record<string, Record<string, number>>;
  components: string;
  time?: string;
  range?: string;
  area?: string;
  target?: string;
  effect?: string;
  duration?: string;
  save?: string;
  sr?: string;
  summary?: string;
  desc: string;
  source?: Source;
}

export interface WeaponData {
  id: string;
  name: string;
  category: 'simple' | 'martial' | 'exotic' | 'misc';
  kind: 'light' | '1h' | '2h' | 'ranged' | 'ammo' | string;
  damage: string;
  damageTypes: string[];
  critRange: number;
  critMult: number;
  rangeIncrement?: number;
  ranged: boolean;
  groups: string[];
  properties: string[];
  price: number;
  weight: number;
  desc: string;
  source?: Source;
}

export interface ArmorData {
  id: string;
  name: string;
  kind: 'armor' | 'shield';
  category: string;
  ac: number;
  maxDex: number | null;
  acp: number;
  asf: number;
  price: number;
  weight: number;
  desc: string;
  source?: Source;
}

export interface GearData {
  id: string;
  name: string;
  type: string;
  subType?: string;
  slot?: string;
  price: number;
  weight: number;
  cl?: number;
  aura?: string;
  changes?: Change[];
  desc: string;
  source?: Source;
}

/** Proprietà speciale di armi/armature/scudi (flaming, keen, fortification…). */
export interface MagicAbilityData {
  id: string;
  name: string;
  kind: 'weapon' | 'armor' | 'shield';
  ranged?: boolean;
  /** Equivalente in bonus di potenziamento. */
  bonus?: number;
  /** Costo fisso in mo. */
  flat?: number;
  aura?: string;
  cl?: number;
  desc: string;
  source?: Source;
}

export interface KineticElement {
  id: string;
  name: string;
  classSkills: string[];
  simple: string[];
  composite: string[];
  defense?: string;
  basic?: string;
  desc: string;
  source?: Source;
}

export interface KineticTalent {
  id: string;
  name: string;
  elements: string[];
  type: 'simple' | 'composite' | 'defense' | 'form' | 'substance' | 'utility' | 'other';
  typeText: string;
  level: number | null;
  burn: string;
  prereq?: string;
  assoc?: string[] | 'any';
  save?: string;
  blastType?: string;
  damage?: string;
  desc: string;
  source?: Source;
}

export interface BookData {
  name: string;
  abbr?: string;
  category: 'core' | 'companion' | 'ap' | 'setting' | 'other';
}

/** Tabelle di progressione incantesimi (estratte dal sistema Foundry PF1). "inf" = a volontà. */
export type SlotTable = (number | 'inf' | null)[][];
export interface CasterProgression {
  castsPerDay: Record<string, Record<string, SlotTable>>;
  spellsPreparedPerDay: Record<string, Record<string, SlotTable>>;
}
