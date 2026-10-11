import type { AbilityKey, Change } from '@/data/types';

export interface LevelEntry {
  classId: string;
  /** Punti ferita tirati per questo livello (solo con metodo "tiro"/"manuale"). */
  hpRoll?: number;
  /** Bonus della classe preferita scelto a questo livello. */
  fcb?: 'hp' | 'skill' | 'alt' | 'none';
  /** Indice dell'opzione alternativa (razziale) della classe preferita. */
  fcbAlt?: number;
  /** Incremento di caratteristica (livelli 4, 8, 12, 16, 20). */
  ability?: AbilityKey;
}

export interface FeatPick {
  uid: string;
  featId: string;
  /** Identificativo dello slot occupato (vedi computeFeatSlots). */
  slot: string;
  /** Specializzazione, es. "longsword" per Weapon Focus. */
  detail?: string;
}

export interface ChoicePick {
  uid: string;
  classId: string;
  choiceKey: string;
  /** Livello di classe a cui è stata fatta la scelta. */
  level: number;
  /** Indice della scelta quando un livello ne concede più di una (es. due domini). */
  index: number;
  featureId?: string;
  /** Per le scelte libere (nemico prescelto, grazia, ecc.). */
  text?: string;
}

export interface EquipItem {
  uid: string;
  kind: 'weapon' | 'armor' | 'gear' | 'custom';
  refId?: string;
  name: string;
  qty: number;
  equipped: boolean;
  /** Bonus di potenziamento (+1…+5) per armi, armature e scudi. */
  enhancement?: number;
  masterwork?: boolean;
  /** Materiale speciale o proprietà (testo libero). */
  notes?: string;
  price: number;
  weight: number;
  changes?: Change[];
  /** Proprietà speciali (id di magicAbilities.json) per armi e armature magiche. */
  abilities?: string[];
}

export interface CustomBonus {
  uid: string;
  label: string;
  target: string;
  value: number;
  type: string;
  enabled: boolean;
}

export interface SpellSelection {
  /** Incantesimi conosciuti / nel libro, per id. */
  known: string[];
  /** Incantesimi preparati per livello (possono ripetersi). */
  prepared: Record<number, string[]>;
}

/** Scelte specifiche del cineta. */
export interface KineticistChoices {
  primary?: string;
  /** Blast semplici scelti (id dei talenti). */
  blasts: string[];
  expanded7?: string;
  expanded15?: string;
  /** Talenti per slot: 'inf-1', 'util-2', 'bonus-7', 'feat-<n>'… */
  talents: Record<string, string>;
  /** Burn attuale (per elemental overflow e danni non letali). */
  burn: number;
  /** Ordine delle caratteristiche fisiche per i bonus di taglia dell'elemental overflow. */
  overflow: AbilityKey[];
}

export interface CharacterSettings {
  abilityMethod: 'pointbuy' | 'manual';
  pointBuy: number;
  hpMethod: 'max' | 'avg' | 'roll';
  backgroundSkills: boolean;
  /** Manuali abilitati: vuoto = tutti. */
  books: string[];
  /** Categorie di manuali escluse (es. "ap" per gli Adventure Path). */
  excludeCategories: string[];
}

export interface Character {
  version: 1;
  id: string;
  name: string;
  player: string;
  alignment: string;
  deity: string;
  gender: string;
  age: string;
  height: string;
  weight: string;
  homeland: string;
  languages: string;
  notes: string;
  portrait?: string;
  created: number;
  updated: number;

  settings: CharacterSettings;
  baseAbilities: Record<AbilityKey, number>;
  raceId?: string;
  raceAbilityChoice?: AbilityKey;
  alternateTraits: string[];
  favoredClasses: string[];
  levels: LevelEntry[];
  archetypes: Record<string, string[]>;
  /** Gradi nelle abilità: chiave abilità o "chiave:specializzazione". */
  skills: Record<string, number>;
  skillSpecialties: Record<string, string[]>;
  feats: FeatPick[];
  /** Slot talento aggiuntivi aggiunti a mano (da privilegi non automatizzati). */
  extraFeatSlots: { id: string; label: string }[];
  choices: ChoicePick[];
  traits: string[];
  /** Privilegi aggiunti liberamente dall'utente (id di features.json). */
  extraFeatures: string[];
  spells: Record<string, SpellSelection>;
  /** Per ogni classe di prestigio: id della classe incantatrice che ne riceve i livelli. */
  prestigeCasting: Record<string, string>;
  equipment: EquipItem[];
  money: { pp: number; gp: number; sp: number; cp: number };
  customBonuses: CustomBonus[];
  kineticist: KineticistChoices;
  /** Scelte a punti (es. evoluzioni dell'eidolon): chiave classe:pool -> id dei privilegi (ripetibili). */
  pools: Record<string, string[]>;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function newCharacter(): Character {
  const now = Date.now();
  return {
    version: 1,
    id: uid(),
    name: 'Nuovo personaggio',
    player: '',
    alignment: 'tn',
    deity: '',
    gender: '',
    age: '',
    height: '',
    weight: '',
    homeland: '',
    languages: '',
    notes: '',
    created: now,
    updated: now,
    settings: { abilityMethod: 'pointbuy', pointBuy: 20, hpMethod: 'avg', backgroundSkills: false, books: [], excludeCategories: [] },
    baseAbilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    alternateTraits: [],
    favoredClasses: [],
    levels: [],
    archetypes: {},
    skills: {},
    skillSpecialties: {},
    feats: [],
    extraFeatSlots: [],
    choices: [],
    traits: [],
    extraFeatures: [],
    spells: {},
    prestigeCasting: {},
    equipment: [],
    money: { pp: 0, gp: 0, sp: 0, cp: 0 },
    customBonuses: [],
    kineticist: { blasts: [], talents: {}, burn: 0, overflow: ['dex', 'con', 'str'] },
    pools: {},
  };
}

/** Porta un personaggio salvato con una versione precedente allo schema attuale. */
export function migrate(raw: Partial<Character>): Character {
  const base = newCharacter();
  return {
    ...base,
    ...raw,
    settings: { ...base.settings, ...raw.settings },
    money: { ...base.money, ...raw.money },
    kineticist: { ...base.kineticist, ...raw.kineticist },
    pools: { ...raw.pools },
  } as Character;
}
