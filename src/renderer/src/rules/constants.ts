import type { AbilityKey, SaveKey } from '@/data/types';

export const ABILITIES: AbilityKey[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const ABILITY_LABEL: Record<AbilityKey, string> = {
  str: 'Forza', dex: 'Destrezza', con: 'Costituzione', int: 'Intelligenza', wis: 'Saggezza', cha: 'Carisma',
};
export const ABILITY_SHORT: Record<AbilityKey, string> = {
  str: 'FOR', dex: 'DES', con: 'COS', int: 'INT', wis: 'SAG', cha: 'CAR',
};
export const SAVES: SaveKey[] = ['fort', 'ref', 'will'];
export const SAVE_LABEL: Record<SaveKey, string> = { fort: 'Tempra', ref: 'Riflessi', will: 'Volontà' };
export const SAVE_ABILITY: Record<SaveKey, AbilityKey> = { fort: 'con', ref: 'dex', will: 'wis' };

export const mod = (score: number) => Math.floor((score - 10) / 2);
export const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`.replace('-', '−'));

export interface SkillDef {
  key: string;
  it: string;
  en: string;
  ability: AbilityKey;
  trained: boolean;
  acp: boolean;
  /** Abilità con specializzazioni libere (Artigianato, Intrattenere, Professione). */
  multi?: boolean;
  /** Abilità di "background" (regola opzionale di Pathfinder Unchained). */
  background?: boolean;
}

export const SKILLS: SkillDef[] = [
  { key: 'acr', it: 'Acrobazia', en: 'Acrobatics', ability: 'dex', trained: false, acp: true },
  { key: 'apr', it: 'Valutare', en: 'Appraise', ability: 'int', trained: false, acp: false, background: true },
  { key: 'art', it: 'Arte', en: 'Artistry', ability: 'int', trained: true, acp: false, multi: true, background: true },
  { key: 'blf', it: 'Raggirare', en: 'Bluff', ability: 'cha', trained: false, acp: false },
  { key: 'clm', it: 'Scalare', en: 'Climb', ability: 'str', trained: false, acp: true },
  { key: 'crf', it: 'Artigianato', en: 'Craft', ability: 'int', trained: false, acp: false, multi: true, background: true },
  { key: 'dip', it: 'Diplomazia', en: 'Diplomacy', ability: 'cha', trained: false, acp: false },
  { key: 'dev', it: 'Disattivare Congegni', en: 'Disable Device', ability: 'dex', trained: true, acp: true },
  { key: 'dis', it: 'Camuffare', en: 'Disguise', ability: 'cha', trained: false, acp: false },
  { key: 'esc', it: 'Artista della Fuga', en: 'Escape Artist', ability: 'dex', trained: false, acp: true },
  { key: 'fly', it: 'Volare', en: 'Fly', ability: 'dex', trained: false, acp: true },
  { key: 'han', it: 'Addestrare Animali', en: 'Handle Animal', ability: 'cha', trained: true, acp: false, background: true },
  { key: 'hea', it: 'Guarire', en: 'Heal', ability: 'wis', trained: false, acp: false },
  { key: 'int', it: 'Intimidire', en: 'Intimidate', ability: 'cha', trained: false, acp: false },
  { key: 'kar', it: 'Conoscenze (arcane)', en: 'Knowledge (arcana)', ability: 'int', trained: true, acp: false },
  { key: 'kdu', it: 'Conoscenze (dungeon)', en: 'Knowledge (dungeoneering)', ability: 'int', trained: true, acp: false },
  { key: 'ken', it: 'Conoscenze (ingegneria)', en: 'Knowledge (engineering)', ability: 'int', trained: true, acp: false, background: true },
  { key: 'kge', it: 'Conoscenze (geografia)', en: 'Knowledge (geography)', ability: 'int', trained: true, acp: false, background: true },
  { key: 'khi', it: 'Conoscenze (storia)', en: 'Knowledge (history)', ability: 'int', trained: true, acp: false, background: true },
  { key: 'klo', it: 'Conoscenze (locali)', en: 'Knowledge (local)', ability: 'int', trained: true, acp: false },
  { key: 'kna', it: 'Conoscenze (natura)', en: 'Knowledge (nature)', ability: 'int', trained: true, acp: false },
  { key: 'kno', it: 'Conoscenze (nobiltà)', en: 'Knowledge (nobility)', ability: 'int', trained: true, acp: false, background: true },
  { key: 'kpl', it: 'Conoscenze (piani)', en: 'Knowledge (planes)', ability: 'int', trained: true, acp: false },
  { key: 'kre', it: 'Conoscenze (religioni)', en: 'Knowledge (religion)', ability: 'int', trained: true, acp: false },
  { key: 'lin', it: 'Linguistica', en: 'Linguistics', ability: 'int', trained: true, acp: false, background: true },
  { key: 'lor', it: 'Sapere', en: 'Lore', ability: 'int', trained: true, acp: false, multi: true, background: true },
  { key: 'per', it: 'Percezione', en: 'Perception', ability: 'wis', trained: false, acp: false },
  { key: 'prf', it: 'Intrattenere', en: 'Perform', ability: 'cha', trained: false, acp: false, multi: true, background: true },
  { key: 'pro', it: 'Professione', en: 'Profession', ability: 'wis', trained: true, acp: false, multi: true, background: true },
  { key: 'rid', it: 'Cavalcare', en: 'Ride', ability: 'dex', trained: false, acp: true },
  { key: 'sen', it: 'Intuizione', en: 'Sense Motive', ability: 'wis', trained: false, acp: false },
  { key: 'slt', it: 'Rapidità di Mano', en: 'Sleight of Hand', ability: 'dex', trained: true, acp: true, background: true },
  { key: 'spl', it: 'Sapienza Magica', en: 'Spellcraft', ability: 'int', trained: true, acp: false },
  { key: 'ste', it: 'Furtività', en: 'Stealth', ability: 'dex', trained: false, acp: true },
  { key: 'sur', it: 'Sopravvivenza', en: 'Survival', ability: 'wis', trained: false, acp: false },
  { key: 'swm', it: 'Nuotare', en: 'Swim', ability: 'str', trained: false, acp: true },
  { key: 'umd', it: 'Utilizzare Congegni Magici', en: 'Use Magic Device', ability: 'cha', trained: true, acp: false },
];
export const SKILL_BY_KEY = new Map(SKILLS.map((s) => [s.key, s]));
/** Abilità introdotte con le regole opzionali "background skills" (non presenti nel Core). */
export const UNCHAINED_ONLY = new Set(['art', 'lor']);

export const SIZES = ['fine', 'dim', 'tiny', 'sm', 'med', 'lg', 'huge', 'grg', 'col'] as const;
export type Size = (typeof SIZES)[number];
export const SIZE_LABEL: Record<string, string> = {
  fine: 'Piccolissima', dim: 'Minuta', tiny: 'Minuscola', sm: 'Piccola', med: 'Media', lg: 'Grande',
  huge: 'Enorme', grg: 'Mastodontica', col: 'Colossale',
};
export const SIZE_MOD: Record<string, number> = { fine: 8, dim: 4, tiny: 2, sm: 1, med: 0, lg: -1, huge: -2, grg: -4, col: -8 };
export const SIZE_SPECIAL: Record<string, number> = { fine: -8, dim: -4, tiny: -2, sm: -1, med: 0, lg: 1, huge: 2, grg: 4, col: 8 };
export const SIZE_STEALTH: Record<string, number> = { fine: 16, dim: 12, tiny: 8, sm: 4, med: 0, lg: -4, huge: -8, grg: -12, col: -16 };
export const SIZE_FLY: Record<string, number> = { fine: 8, dim: 6, tiny: 4, sm: 2, med: 0, lg: -2, huge: -4, grg: -6, col: -8 };

export const POINT_BUY_COST: Record<number, number> = {
  7: -4, 8: -2, 9: -1, 10: 0, 11: 1, 12: 2, 13: 3, 14: 5, 15: 7, 16: 10, 17: 13, 18: 17,
};
export const POINT_BUY_BUDGETS = [
  { value: 10, label: 'Bassa fantasia (10)' },
  { value: 15, label: 'Standard (15)' },
  { value: 20, label: 'Alta fantasia (20)' },
  { value: 25, label: 'Epica (25)' },
];

export const ALIGNMENTS = [
  { key: 'lg', label: 'Legale Buono' }, { key: 'ng', label: 'Neutrale Buono' }, { key: 'cg', label: 'Caotico Buono' },
  { key: 'ln', label: 'Legale Neutrale' }, { key: 'tn', label: 'Neutrale' }, { key: 'cn', label: 'Caotico Neutrale' },
  { key: 'le', label: 'Legale Malvagio' }, { key: 'ne', label: 'Neutrale Malvagio' }, { key: 'ce', label: 'Caotico Malvagio' },
];

export const SCHOOL_LABEL: Record<string, string> = {
  abj: 'Abiurazione', con: 'Evocazione', div: 'Divinazione', enc: 'Ammaliamento', evo: 'Invocazione',
  ill: 'Illusione', nec: 'Necromanzia', trs: 'Trasmutazione', uni: 'Universale', misc: 'Varie',
};

export const BONUS_TYPE_LABEL: Record<string, string> = {
  untyped: 'senza tipo', enh: 'potenziamento', deflection: 'deviazione', dodge: 'schivare', insight: 'cognitivo',
  luck: 'fortuna', morale: 'morale', competence: 'competenza', circumstance: 'circostanza', racial: 'razziale',
  resist: 'resistenza', sacred: 'sacro', profane: 'profano', natural: 'armatura naturale', armor: 'armatura',
  shield: 'scudo', size: 'taglia', trait: 'tratto', alchemical: 'alchemico', inherent: 'intrinseco', base: 'base',
  untypedPerm: 'senza tipo',
};
/** Tipi di bonus che si sommano tra loro anche se della stessa natura. */
export const STACKING_TYPES = new Set(['untyped', 'untypedPerm', 'dodge', 'circumstance', 'base']);

export const ARMOR_PROF_LABEL: Record<string, string> = { lgt: 'leggere', med: 'medie', hvy: 'pesanti', shl: 'scudi', twr: 'scudo torre' };

/** Livelli a cui si ottiene un incremento di caratteristica (+1). */
export const ABILITY_INCREASE_LEVELS = [4, 8, 12, 16, 20];
/** Livelli del personaggio che concedono un talento generico (1 e ogni livello dispari). */
export const isFeatLevel = (lvl: number) => lvl === 1 || lvl % 2 === 1;

/** Ricchezza per livello del personaggio (PG, Core Rulebook tab. 12-4). */
export const WEALTH_BY_LEVEL = [0, 0, 1000, 3000, 6000, 10500, 16000, 23500, 33000, 46000, 62000, 82000, 108000, 140000, 185000, 240000, 315000, 410000, 530000, 685000, 880000];
