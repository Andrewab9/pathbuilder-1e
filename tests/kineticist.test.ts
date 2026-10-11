import { beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '@/data/db';
import { newCharacter, type Character } from '@/rules/character';
import { compute } from '@/rules/compute';
import { loadDb } from './helpers';

let db: Database;
beforeAll(async () => {
  db = await loadDb();
});

function kineticist(levels: number, primary = 'fire'): Character {
  const c = newCharacter();
  c.raceId = 'human';
  c.raceAbilityChoice = 'con';
  c.baseAbilities = { str: 10, dex: 16, con: 16, int: 10, wis: 10, cha: 10 };
  for (let i = 0; i < levels; i++) c.levels.push({ classId: 'kineticist' });
  c.kineticist.primary = primary;
  return c;
}

describe('cineta', () => {
  it('blast semplice di 1° livello (fuoco, energia)', () => {
    const r = compute(kineticist(1), db);
    const k = r.kinetic!;
    expect(k.knownSimple.map((t) => t.name)).toEqual(['Fire Blast']);
    // Con 18 (+4): energia 1d6 + metà Con
    const fire = k.blasts.find((b) => b.talent.name === 'Fire Blast')!;
    expect(fire.damage).toBe('1d6+2');
    expect(fire.attack).toBe(0 + 3);
    expect(k.burnMax).toBe(7);
    // Con 18 rende Percezione e Intimidire abilità di classe; il fuoco aggiunge Artista della Fuga
    expect(r.classSkills.has('esc')).toBe(true);
  });

  it('blast fisico, slot e privilegi al 7° livello con elemento espanso', () => {
    const c = kineticist(7, 'earth');
    c.kineticist.expanded7 = 'fire';
    const r = compute(c, db);
    const k = r.kinetic!;
    const earth = k.blasts.find((b) => b.talent.name === 'Earth Blast')!;
    // 4d6 + 4 + Con 4
    expect(earth.damage).toBe('4d6+8');
    expect(k.composites.map((t) => t.name)).toContain('Magma Blast');
    const magma = k.blasts.find((b) => b.talent.name === 'Magma Blast')!;
    expect(magma.damage).toBe('8d6+12');
    expect(k.slots.filter((s) => s.kind === 'infusion').length).toBe(3);
    expect(k.slots.filter((s) => s.kind === 'utility').length).toBe(3);
    expect(k.infusionSpecialization).toBe(1);
    expect(k.automatic.map((t) => t.name)).toEqual(expect.arrayContaining(['Basic Geokinesis', 'Basic Pyrokinesis', 'Flesh of Stone']));
  });

  it('elemental overflow: bonus al burn e alle caratteristiche', () => {
    const c = kineticist(6);
    c.kineticist.burn = 3;
    c.kineticist.overflow = ['dex', 'con', 'str'];
    const r = compute(c, db);
    const k = r.kinetic!;
    expect(k.overflowBonus).toBe(2);
    expect(r.abilities.dex.total).toBe(18);
    expect(r.abilities.con.total).toBe(20);
    const fire = k.blasts.find((b) => b.talent.name === 'Fire Blast')!;
    // 3d6 + metà Con (5/2=2) + 2× overflow (4)
    expect(fire.damage).toBe('3d6+6');
  });

  it('scelta del blast quando l\'elemento ne ha più di uno', () => {
    const c = kineticist(1, 'air');
    let r = compute(c, db);
    expect(r.kinetic!.knownSimple).toHaveLength(0);
    c.kineticist.blasts = ['electric-blast'];
    r = compute(c, db);
    expect(r.kinetic!.knownSimple.map((t) => t.name)).toEqual(['Electric Blast']);
  });
});

describe('evoluzioni dell\'eidolon', () => {
  it('conteggio dei punti evoluzione', () => {
    const c = newCharacter();
    c.levels.push({ classId: 'summoner' });
    const evo = db.features.filter((f) => f.tags?.includes('Evolution') && f.classes?.includes('Summoner'));
    const two = evo.find((f) => f.cost === 2)!;
    const one = evo.find((f) => f.cost === 1)!;
    c.pools['summoner:evolutions'] = [two.id, one.id];
    let r = compute(c, db);
    expect(r.pools[0].points).toBe(3);
    expect(r.pools[0].used).toBe(3);
    c.pools['summoner:evolutions'].push(one.id);
    r = compute(c, db);
    expect(r.warnings.some((w) => w.text.includes('usati 4 punti su 3'))).toBe(true);
  });
});
