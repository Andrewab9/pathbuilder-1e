import type {
  ArchetypeData, ArmorData, BookData, CasterProgression, ClassData, FeatData, FeatureData, GearData,
  KineticElement, KineticTalent, MagicAbilityData, RaceData, SpellData, TraitData, WeaponData,
} from './types';

export interface Database {
  classes: ClassData[];
  archetypes: ArchetypeData[];
  features: FeatureData[];
  races: RaceData[];
  feats: FeatData[];
  traits: TraitData[];
  spells: SpellData[];
  weapons: WeaponData[];
  armor: ArmorData[];
  gear: GearData[];
  books: BookData[];
  caster: CasterProgression;
  magicAbilities: MagicAbilityData[];
  kinetic: { elements: KineticElement[]; talents: KineticTalent[] };
  // Indici
  classById: Map<string, ClassData>;
  featureById: Map<string, FeatureData>;
  featById: Map<string, FeatData>;
  featByName: Map<string, FeatData>;
  raceById: Map<string, RaceData>;
  archetypeById: Map<string, ArchetypeData>;
  archetypesByClass: Map<string, ArchetypeData[]>;
  spellById: Map<string, SpellData>;
  traitById: Map<string, TraitData>;
  weaponById: Map<string, WeaponData>;
  armorById: Map<string, ArmorData>;
  gearById: Map<string, GearData>;
  featuresByTag: Map<string, FeatureData[]>;
  bookByName: Map<string, BookData>;
  magicAbilityById: Map<string, MagicAbilityData>;
  kineticTalentById: Map<string, KineticTalent>;
  kineticElementById: Map<string, KineticElement>;
}

async function read<T>(name: string): Promise<T> {
  const api = (window as unknown as { api?: { readData(n: string): Promise<string> } }).api;
  if (api) return JSON.parse(await api.readData(name));
  const r = await fetch(`./data/${name}`);
  return r.json();
}

let cached: Promise<Database> | null = null;

export function loadDatabase(onProgress?: (label: string) => void): Promise<Database> {
  if (cached) return cached;
  cached = (async () => {
    const files = [
      ['classes', 'classi'], ['archetypes', 'archetipi'], ['features', 'privilegi'], ['races', 'razze'],
      ['feats', 'talenti'], ['traits', 'tratti'], ['spells', 'incantesimi'], ['weapons', 'armi'],
      ['armor', 'armature'], ['gear', 'oggetti'], ['books', 'manuali'], ['casterProgression', 'tabelle'],
      ['magicAbilities', 'proprietà magiche'], ['kineticist', 'talenti selvaggi'],
    ] as const;
    const out: Record<string, unknown> = {};
    await Promise.all(
      files.map(async ([f, label]) => {
        out[f] = await read(`${f}.json`);
        onProgress?.(label);
      }),
    );
    const db = {
      classes: out.classes as ClassData[],
      archetypes: out.archetypes as ArchetypeData[],
      features: out.features as FeatureData[],
      races: out.races as RaceData[],
      feats: out.feats as FeatData[],
      traits: out.traits as TraitData[],
      spells: out.spells as SpellData[],
      weapons: out.weapons as WeaponData[],
      armor: out.armor as ArmorData[],
      gear: out.gear as GearData[],
      books: out.books as BookData[],
      caster: out.casterProgression as CasterProgression,
      magicAbilities: out.magicAbilities as MagicAbilityData[],
      kinetic: out.kineticist as Database['kinetic'],
    } as Database;
    db.classes.sort((a, b) => a.name.localeCompare(b.name));
    db.races.sort((a, b) => Number(b.core) - Number(a.core) || a.name.localeCompare(b.name));
    db.spells.sort((a, b) => a.name.localeCompare(b.name));
    db.classById = new Map(db.classes.map((x) => [x.id, x]));
    db.featureById = new Map(db.features.map((x) => [x.id, x]));
    db.featById = new Map(db.feats.map((x) => [x.id, x]));
    db.featByName = new Map(db.feats.map((x) => [x.name.toLowerCase(), x]));
    db.raceById = new Map(db.races.map((x) => [x.id, x]));
    db.archetypeById = new Map(db.archetypes.map((x) => [x.id, x]));
    db.archetypesByClass = new Map();
    for (const a of db.archetypes) {
      if (!db.archetypesByClass.has(a.classId)) db.archetypesByClass.set(a.classId, []);
      db.archetypesByClass.get(a.classId)!.push(a);
    }
    for (const list of db.archetypesByClass.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    db.spellById = new Map(db.spells.map((x) => [x.id, x]));
    db.traitById = new Map(db.traits.map((x) => [x.id, x]));
    db.weaponById = new Map(db.weapons.map((x) => [x.id, x]));
    db.armorById = new Map(db.armor.map((x) => [x.id, x]));
    db.gearById = new Map(db.gear.map((x) => [x.id, x]));
    db.featuresByTag = new Map();
    for (const f of db.features) {
      for (const t of f.tags ?? []) {
        if (!db.featuresByTag.has(t)) db.featuresByTag.set(t, []);
        db.featuresByTag.get(t)!.push(f);
      }
    }
    db.bookByName = new Map(db.books.map((b) => [b.name, b]));
    db.magicAbilityById = new Map(db.magicAbilities.map((x) => [x.id, x]));
    db.kineticTalentById = new Map(db.kinetic.talents.map((x) => [x.id, x]));
    db.kineticElementById = new Map(db.kinetic.elements.map((x) => [x.id, x]));
    return db;
  })();
  return cached;
}
