// Scelte che una classe concede salendo di livello: privilegi a scelta (poteri d'ira, talenti
// da ladro, maledizioni, domini…), talenti bonus e scelte libere (nemico prescelto, grazie…).
import type { FeatData, FeatureData } from '@/data/types';

export interface ChoiceDef {
  key: string;
  label: string;
  /** Livelli di classe a cui si ottiene una scelta. */
  levels: number[];
  /** Numero di scelte per livello (default 1). */
  count?: number;
  kind: 'feature' | 'feat' | 'text';
  /** Filtro sui privilegi (kind = feature). */
  filter?: (f: FeatureData) => boolean;
  /** Filtro sui talenti (kind = feat); se assente, qualsiasi talento. */
  featFilter?: (f: FeatData) => boolean;
  /** Suggerimenti per le scelte libere (kind = text). */
  options?: string[];
  /** Restringe il pool in base a una scelta precedente (es. rivelazioni del mistero scelto). */
  linkedTo?: string;
  hint?: string;
}

const base = (f: FeatureData) => f.origin === 'base';
const tags = (...t: string[]) => (f: FeatureData) => base(f) && !!f.tags?.some((x) => t.includes(x));
const tagPrefix = (p: string) => (f: FeatureData) => base(f) && !!f.tags?.some((x) => x.startsWith(p));
const nameFor = (re: RegExp, cls: string, not?: RegExp) => (f: FeatureData) =>
  base(f) && re.test(f.name) && !!f.classes?.includes(cls) && !(not && not.test(f.name));
const tagsFor = (cls: string, ...t: string[]) => (f: FeatureData) => tags(...t)(f) && !!f.classes?.includes(cls);
const featType = (...t: string[]) => (f: FeatData) => f.types.some((x) => t.includes(x));

const every = (start: number, step: number, max = 20) => {
  const out: number[] = [];
  for (let l = start; l <= max; l += step) out.push(l);
  return out;
};
const EVEN = every(2, 2);
const ODD = every(1, 2);

const COMBAT = featType('Combat');
const MONK_FEATS = new Set([
  'catch off-guard', 'combat reflexes', 'deflect arrows', 'dodge', 'improved grapple', 'scorpion style',
  'throw anything', 'gorgon\'s fist', 'improved bull rush', 'improved disarm', 'improved feint', 'improved trip',
  'mobility', 'improved critical', 'medusa\'s wrath', 'snatch arrows', 'spring attack',
]);
const FAVORED_ENEMIES = ['Aberration', 'Animal', 'Construct', 'Dragon', 'Fey', 'Humanoid (aquatic)', 'Humanoid (dwarf)', 'Humanoid (elf)', 'Humanoid (giant)', 'Humanoid (goblinoid)', 'Humanoid (gnoll)', 'Humanoid (gnome)', 'Humanoid (halfling)', 'Humanoid (human)', 'Humanoid (orc)', 'Humanoid (reptilian)', 'Humanoid (other subtype)', 'Magical beast', 'Monstrous humanoid', 'Ooze', 'Outsider (air)', 'Outsider (chaotic)', 'Outsider (earth)', 'Outsider (evil)', 'Outsider (fire)', 'Outsider (good)', 'Outsider (lawful)', 'Outsider (native)', 'Outsider (water)', 'Plant', 'Undead', 'Vermin'];
const FAVORED_TERRAINS = ['Cold (ice, glaciers, snow, tundra)', 'Desert (sand and wastelands)', 'Forest (coniferous and deciduous)', 'Jungle', 'Mountain (including hills)', 'Planes (pick one, other than Material Plane)', 'Plains', 'Swamp', 'Underground (caves and dungeons)', 'Urban (buildings, streets, sewers)', 'Water (above and below the surface)'];

export const CLASS_CHOICES: Record<string, ChoiceDef[]> = {
  alchemist: [
    { key: 'discovery', label: 'Scoperta', levels: EVEN, kind: 'feature', filter: tags('Alchemist Discovery', 'Bomb Discovery') },
  ],
  antipaladin: [
    { key: 'cruelty', label: 'Crudeltà', levels: every(3, 3), kind: 'feature', filter: tagsFor('Antipaladin', 'Cruelty') },
  ],
  arcanist: [
    { key: 'exploit', label: 'Sfruttamento arcano', levels: ODD, kind: 'feature', filter: tagPrefix('Arcanist Exploit'), hint: 'Gli sfruttamenti superiori sono disponibili dall\'11° livello.' },
  ],
  barbarian: [
    { key: 'ragePower', label: 'Potere d\'ira', levels: EVEN, kind: 'feature', filter: tagPrefix('Rage Power') },
  ],
  barbarianUnchained: [
    { key: 'ragePower', label: 'Potere d\'ira', levels: EVEN, kind: 'feature', filter: tagPrefix('Rage Power') },
  ],
  bloodrager: [
    { key: 'bloodline', label: 'Linea di sangue', levels: [1], kind: 'feature', filter: nameFor(/Bloodrager Bloodline$/, 'Bloodrager', /^Bloodrager Bloodline$/) },
    { key: 'bonusFeat', label: 'Talento bonus (linea di sangue)', levels: [6, 9, 12, 15, 18], kind: 'feat' },
  ],
  brawler: [
    { key: 'bonusFeat', label: 'Talento di combattimento bonus', levels: [2, 5, 8, 11, 14, 17, 20], kind: 'feat', featFilter: COMBAT },
  ],
  cavalier: [
    { key: 'order', label: 'Ordine', levels: [1], kind: 'feature', filter: tags('Cavalier Order') },
    { key: 'bonusFeat', label: 'Talento bonus', levels: [6, 12, 18], kind: 'feat', featFilter: COMBAT },
  ],
  samurai: [
    { key: 'order', label: 'Ordine', levels: [1], kind: 'feature', filter: tags('Samurai Order', 'Cavalier Order') },
    { key: 'bonusFeat', label: 'Talento bonus', levels: [6, 12, 18], kind: 'feat', featFilter: COMBAT },
  ],
  cleric: [
    { key: 'domain', label: 'Dominio', levels: [1], count: 2, kind: 'feature', filter: tags('Domain', 'Subdomain') },
  ],
  druid: [
    { key: 'natureBond', label: 'Legame con la natura (dominio)', levels: [1], kind: 'feature', filter: (f) => base(f) && !!f.classes?.includes('Druid') && /Domain$|Subdomain/.test(f.name) && !f.tags?.includes('Domain Power'), hint: 'Lascia vuoto se scegli il compagno animale.' },
  ],
  fighter: [
    { key: 'bonusFeat', label: 'Talento bonus da guerriero', levels: [1, ...EVEN], kind: 'feat', featFilter: COMBAT },
  ],
  gunslinger: [
    { key: 'bonusFeat', label: 'Talento bonus', levels: [4, 8, 12, 16, 20], kind: 'feat', featFilter: featType('Combat', 'Grit') },
  ],
  hunter: [
    { key: 'bonusFeat', label: 'Talento di squadra bonus', levels: every(3, 3), kind: 'feat', featFilter: featType('Teamwork') },
  ],
  inquisitor: [
    { key: 'domain', label: 'Dominio o inquisizione', levels: [1], kind: 'feature', filter: tags('Domain', 'Subdomain', 'Inquisition') },
    { key: 'teamworkFeat', label: 'Talento di squadra bonus', levels: every(3, 3), kind: 'feat', featFilter: featType('Teamwork') },
  ],
  investigator: [
    { key: 'talent', label: 'Talento da investigatore', levels: ODD.filter((l) => l >= 3), kind: 'feature', filter: tags('Investigator Talent') },
  ],
  magus: [
    { key: 'arcana', label: 'Arcano del magus', levels: every(3, 3), kind: 'feature', filter: tags('Magus Arcana') },
    { key: 'bonusFeat', label: 'Talento bonus', levels: [5, 11, 17], kind: 'feat', featFilter: featType('Combat', 'Item Creation', 'Metamagic') },
  ],
  monk: [
    { key: 'bonusFeat', label: 'Talento bonus da monaco', levels: [1, 2, 6, 10, 14, 18], kind: 'feat', featFilter: (f) => MONK_FEATS.has(f.name.toLowerCase()) || f.types.includes('Style') },
  ],
  monkUnchained: [
    { key: 'bonusFeat', label: 'Talento bonus da monaco', levels: [1, 2, 6, 10, 14, 18], kind: 'feat', featFilter: COMBAT },
    { key: 'kiPower', label: 'Potere ki', levels: EVEN.filter((l) => l >= 4), kind: 'feature', filter: tagsFor('Monk (Unchained)', 'Ki Power') },
    { key: 'styleStrike', label: 'Colpo di stile', levels: [5, 9, 13, 17], kind: 'feature', filter: (f) => base(f) && !!f.tags?.includes('Style Strike') && !!f.classes?.some((c) => /Monk/.test(c)) },
  ],
  ninja: [
    { key: 'trick', label: 'Trucco da ninja', levels: EVEN, kind: 'feature', filter: tagPrefix('Ninja Trick') },
  ],
  oracle: [
    { key: 'mystery', label: 'Mistero', levels: [1], kind: 'feature', filter: nameFor(/Mystery$/, 'Oracle') },
    { key: 'curse', label: 'Maledizione', levels: [1], kind: 'feature', filter: tags('Curse') },
    { key: 'revelation', label: 'Rivelazione', levels: [1, 3, 7, 11, 15, 19], kind: 'feature', filter: tags('Revelation'), linkedTo: 'mystery' },
  ],
  paladin: [
    { key: 'mercy', label: 'Grazia', levels: every(3, 3), kind: 'feature', filter: tagsFor('Paladin', 'Mercy') },
  ],
  mesmerist: [
    { key: 'trick', label: 'Trucco del mesmerista', levels: [1, ...EVEN], kind: 'feature', filter: tagsFor('Mesmerist', 'Mesmerist Trick', 'Masterful Trick'), hint: 'Trucchi magistrali dal 12° livello.' },
    { key: 'boldStare', label: 'Sguardo audace', levels: [3, 7, 11, 15, 19], kind: 'feature', filter: tagsFor('Mesmerist', 'Bold Stare') },
  ],
  occultist: [
    { key: 'implement', label: 'Scuola di impianto', levels: [1, 2, 6, 10, 14, 18], count: 1, kind: 'feature', filter: tagsFor('Occultist', 'Implement School') },
    { key: 'implement2', label: 'Seconda scuola di impianto', levels: [1], kind: 'feature', filter: tagsFor('Occultist', 'Implement School') },
    { key: 'focusPower', label: 'Potere focale', levels: [1, ...ODD.filter((l) => l >= 3)], kind: 'feature', filter: tagsFor('Occultist', 'Focus Power'), linkedTo: 'implement' },
  ],
  spiritualist: [
    { key: 'emotionalFocus', label: 'Focus emotivo del fantasma', levels: [1], kind: 'feature', filter: tagsFor('Spiritualist', 'Emotional Focus') },
  ],
  summoner: [
    { key: 'baseForm', label: "Forma base dell'eidolon", levels: [1], kind: 'text', options: ['Biped', 'Quadruped', 'Serpentine', 'Aquatic'] },
  ],
  summonerUnchained: [
    { key: 'subtype', label: "Sottotipo dell'eidolon", levels: [1], kind: 'feature', filter: tagsFor('Summoner (Unchained)', 'Eidolon Subtype') },
    { key: 'baseForm', label: "Forma base dell'eidolon", levels: [1], kind: 'text', options: ['Biped', 'Quadruped', 'Serpentine', 'Aquatic'] },
  ],
  psychic: [
    { key: 'discipline', label: 'Disciplina psichica', levels: [1], kind: 'feature', filter: nameFor(/Discipline$/, 'Psychic') },
    { key: 'amplification', label: 'Amplificazione frenica', levels: [1, 3, 7, 11, 15, 19], kind: 'feature', filter: tagsFor('Psychic', 'Phrenic Amplification', 'Major Amplification'), hint: "Amplificazioni maggiori dall'11° livello." },
  ],
  ranger: [
    { key: 'favoredEnemy', label: 'Nemico prescelto', levels: [1, 5, 10, 15, 20], kind: 'text', options: FAVORED_ENEMIES },
    { key: 'combatStyle', label: 'Stile di combattimento', levels: [2], kind: 'feature', filter: tags('Ranger Combat Style') },
    { key: 'styleFeat', label: 'Talento di stile', levels: [2, 6, 10, 14, 18], kind: 'feat', featFilter: COMBAT },
    { key: 'favoredTerrain', label: 'Terreno prescelto', levels: [3, 8, 13, 18], kind: 'text', options: FAVORED_TERRAINS },
  ],
  rogue: [
    { key: 'talent', label: 'Talento da ladro', levels: EVEN, kind: 'feature', filter: tagPrefix('Rogue Talent'), hint: 'I talenti avanzati sono disponibili dal 10° livello.' },
  ],
  rogueUnchained: [
    { key: 'talent', label: 'Talento da ladro', levels: EVEN, kind: 'feature', filter: tagPrefix('Rogue Talent') },
  ],
  shaman: [
    { key: 'spirit', label: 'Spirito', levels: [1], kind: 'feature', filter: tags('Shaman Spirit') },
    { key: 'hex', label: 'Maleficio', levels: [2, 4, 8, 10, 12, 16, 18], kind: 'feature', filter: (f) => base(f) && !!f.classes?.includes('Shaman') && !!f.tags?.some((t) => /Hex$/.test(t)) },
  ],
  shifter: [
    { key: 'aspect', label: 'Aspetto', levels: [1, 5, 10, 15, 20], kind: 'feature', filter: tags('Shifter Aspect') },
  ],
  skald: [
    { key: 'ragePower', label: 'Potere d\'ira', levels: every(3, 3), kind: 'feature', filter: tagPrefix('Rage Power') },
  ],
  slayer: [
    { key: 'talent', label: 'Talento da cacciatore', levels: EVEN, kind: 'feature', filter: tagPrefix('Slayer Talent') },
  ],
  sorcerer: [
    { key: 'bloodline', label: 'Linea di sangue', levels: [1], kind: 'feature', filter: nameFor(/Bloodline$/, 'Sorcerer', /Bloodrager|^Bloodline$/) },
    { key: 'bonusFeat', label: 'Talento bonus (linea di sangue)', levels: [7, 13, 19], kind: 'feat' },
  ],
  swashbuckler: [
    { key: 'bonusFeat', label: 'Talento di combattimento bonus', levels: [4, 8, 12, 16, 20], kind: 'feat', featFilter: COMBAT },
  ],
  vigilante: [
    { key: 'social', label: 'Talento sociale', levels: ODD, kind: 'feature', filter: tags('Vigilante Social Talent') },
    { key: 'vigilanteTalent', label: 'Talento da vigilante', levels: EVEN, kind: 'feature', filter: tags('Vigilante Talent', 'Vigilante Talents') },
  ],
  warpriest: [
    { key: 'blessing', label: 'Benedizione', levels: [1], count: 2, kind: 'feature', filter: tags('Blessing') },
    { key: 'bonusFeat', label: 'Talento bonus', levels: every(3, 3), kind: 'feat', featFilter: COMBAT },
  ],
  witch: [
    { key: 'patron', label: 'Patrono', levels: [1], kind: 'feature', filter: nameFor(/Patron$/, 'Witch') },
    { key: 'hex', label: 'Maleficio', levels: [1, ...EVEN], kind: 'feature', filter: tags('Hex', 'Major Hex', 'Grand Hex'), hint: 'Malefici maggiori dal 10°, supremi dal 18° livello.' },
  ],
  wizard: [
    { key: 'school', label: 'Scuola arcana', levels: [1], kind: 'feature', filter: tags('Wizard School') },
    { key: 'bonusFeat', label: 'Talento bonus', levels: [5, 10, 15, 20], kind: 'feat', featFilter: featType('Metamagic', 'Item Creation') },
  ],
  eldritchKnight: [
    { key: 'bonusFeat', label: 'Talento di combattimento bonus', levels: [1, 5, 9], kind: 'feat', featFilter: COMBAT },
  ],
};

/** Scelte a punti, come le evoluzioni dell'eidolon. */
export interface PoolDef {
  key: string;
  label: string;
  /** Punti disponibili per livello di classe (indice 0 = 1° livello). */
  points: number[];
  filter: (f: FeatureData) => boolean;
  hint?: string;
}

export const CLASS_POOLS: Record<string, PoolDef[]> = {
  summoner: [
    { key: 'evolutions', label: "Evoluzioni dell'eidolon", points: [3, 4, 5, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 25, 26], filter: tagsFor('Summoner', 'Evolution'), hint: 'Il costo è indicato su ogni evoluzione; alcune possono essere prese più volte.' },
  ],
  summonerUnchained: [
    { key: 'evolutions', label: "Evoluzioni dell'eidolon", points: [1, 2, 3, 3, 4, 5, 6, 6, 7, 8, 9, 9, 10, 11, 12, 12, 13, 14, 15, 15], filter: tagsFor('Summoner (Unchained)', 'Evolution'), hint: 'Oltre alle evoluzioni gratuite concesse dal sottotipo.' },
  ],
};

export function choicesFor(classId: string): ChoiceDef[] {
  return CLASS_CHOICES[classId] ?? [];
}
