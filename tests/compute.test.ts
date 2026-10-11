import { beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '@/data/db';
import { newCharacter, type Character } from '@/rules/character';
import { compute } from '@/rules/compute';
import { evalFormula } from '@/rules/formula';
import { loadDb } from './helpers';

let db: Database;
beforeAll(async () => {
  db = await loadDb();
});

function fighter(levels: number): Character {
  const c = newCharacter();
  c.raceId = 'human';
  c.raceAbilityChoice = 'str';
  c.baseAbilities = { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 };
  c.favoredClasses = ['fighter'];
  for (let i = 0; i < levels; i++) c.levels.push({ classId: 'fighter', fcb: 'hp' });
  return c;
}

describe('formule', () => {
  it('valuta le funzioni Foundry', () => {
    const ctx = (p: string) => ({ 'skills.per.rank': 10, 'attributes.hd.total': 7 } as Record<string, number>)[p];
    expect(evalFormula('2 + if(gte(@skills.per.rank, 10), 2)', ctx)).toBe(4);
    expect(evalFormula('max(3, @attributes.hd.total)', ctx)).toBe(7);
    expect(evalFormula('1d6', ctx)).toBeNull();
  });
});

describe('calcolo personaggio', () => {
  it('guerriero umano di 1° livello', () => {
    const r = compute(fighter(1), db);
    expect(r.abilities.str.total).toBe(18);
    expect(r.bab).toBe(1);
    expect(r.saves.fort.total).toBe(2 + 2);
    expect(r.saves.ref.total).toBe(0 + 2);
    expect(r.saves.will.total).toBe(0 + 1);
    expect(r.hp.total).toBe(10 + 2 + 1);
    // 2 + Int 0 + 1 umano
    expect(r.skillPoints.total).toBe(3);
    // Livello 1 + umano + guerriero 1
    expect(r.featSlots.length).toBe(3);
    expect(r.cmb.total).toBe(1 + 4);
    expect(r.cmd.total).toBe(10 + 1 + 4 + 2);
    expect(r.ac.total).toBe(12);
  });

  it('guerriero di 6° livello: BAB iterativo, TS e PF medi', () => {
    const c = fighter(6);
    c.levels[3].ability = 'str';
    const r = compute(c, db);
    expect(r.bab).toBe(6);
    expect(r.saves.fort.total).toBe(5 + 2);
    expect(r.saves.will.total).toBe(2 + 1);
    // 10 + 5*6 (media d10) + Con 2*6 + FCB 6
    expect(r.hp.total).toBe(10 + 30 + 12 + 6);
    expect(r.abilities.str.total).toBe(19);
    // talenti: 1,3,5 + umano + guerriero 1,2,4,6
    expect(r.featSlots.length).toBe(3 + 1 + 4);
    const unarmed = r.attacks[0];
    expect(unarmed.attack.length).toBe(2);
  });

  it('mago elfo: incantesimi al giorno e bonus', () => {
    const c = newCharacter();
    c.raceId = 'elf';
    c.baseAbilities = { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 };
    for (let i = 0; i < 3; i++) c.levels.push({ classId: 'wizard' });
    const r = compute(c, db);
    expect(r.abilities.int.total).toBe(18);
    const w = r.casters[0];
    expect(w.casterLevel).toBe(3);
    // Mago 3: 2 di 1°, 1 di 2°, più bonus Int 18 (+4): +1 1°, +1 2°
    expect(w.perDay[0]).toBe('inf');
    expect(w.perDay[1]).toBe(3);
    expect(w.perDay[2]).toBe(2);
    expect(w.perDay[3]).toBeNull();
    expect(w.prepared?.[0]).toBe(4);
    expect(r.bab).toBe(1);
    expect(r.saves.will.total).toBe(3 + 1);
  });

  it('stregone: incantesimi conosciuti', () => {
    const c = newCharacter();
    c.raceId = 'half-elf';
    c.raceAbilityChoice = 'cha';
    c.baseAbilities = { str: 8, dex: 14, con: 14, int: 10, wis: 10, cha: 16 };
    for (let i = 0; i < 4; i++) c.levels.push({ classId: 'sorcerer' });
    const r = compute(c, db);
    const s = r.casters[0];
    expect(s.known?.slice(0, 3)).toEqual([6, 3, 1]);
    expect(s.perDay[1]).toBe(6 + 1);
    expect(s.perDay[2]).toBe(3 + 1);
  });

  it('paladino 4: incantesimi solo bonus, LI = livello − 3', () => {
    const c = newCharacter();
    c.raceId = 'human';
    c.raceAbilityChoice = 'cha';
    c.baseAbilities = { str: 16, dex: 10, con: 14, int: 10, wis: 12, cha: 14 };
    for (let i = 0; i < 4; i++) c.levels.push({ classId: 'paladin' });
    const r = compute(c, db);
    const p = r.casters[0];
    expect(p.casterLevel).toBe(1);
    expect(p.perDay[0]).toBeNull();
    expect(p.perDay[1]).toBe(1);
  });

  it('classe di prestigio: tiri salvezza a progressione di prestigio', () => {
    const c = fighter(5);
    for (let i = 0; i < 2; i++) c.levels.push({ classId: 'eldritchKnight' });
    const r = compute(c, db);
    expect(r.classes.length).toBe(2);
    // Guerriero 5: Temp 4, Rifl 1, Vol 1; Cavaliere mistico 2: Temp 1, Rifl 1, Vol 1
    expect(r.saves.fort.base).toBe(5);
    expect(r.saves.ref.base).toBe(2);
    expect(r.bab).toBe(7);
  });

  it('talenti con modificatori (Toughness, Iron Will)', () => {
    const c = fighter(3);
    c.feats.push({ uid: 'a', featId: 'toughness', slot: 'lvl1' });
    c.feats.push({ uid: 'b', featId: 'iron-will', slot: 'lvl3' });
    const r = compute(c, db);
    const base = compute(fighter(3), db);
    expect(r.hp.total - base.hp.total).toBe(3);
    expect(r.saves.will.total - base.saves.will.total).toBe(2);
  });

  it('requisiti dei talenti', () => {
    const c = fighter(1);
    c.feats.push({ uid: 'a', featId: 'cleave', slot: 'lvl1' });
    let r = compute(c, db);
    expect(r.feats[0].prereq.ok).toBe(false);
    c.feats.push({ uid: 'b', featId: 'power-attack', slot: 'race0' });
    r = compute(c, db);
    expect(r.feats.find((f) => f.featId === 'cleave')!.prereq.ok).toBe(true);
  });

  it('armatura: CA, Des massima e penalità', () => {
    const c = fighter(1);
    const plate = db.armor.find((a) => a.name === 'Full Plate')!;
    c.equipment.push({ uid: 'x', kind: 'armor', refId: plate.id, name: plate.name, qty: 1, equipped: true, price: plate.price, weight: plate.weight });
    const r = compute(c, db);
    expect(r.ac.total).toBe(10 + 9 + 1);
    expect(r.armor.acp).toBe(6);
    expect(r.speed.land).toBe(20);
  });

  it('tratti con bonus automatici (Reactionary, Armor Expert)', () => {
    const c = fighter(1);
    const plate = db.armor.find((a) => a.name === 'Full Plate')!;
    c.equipment.push({ uid: 'x', kind: 'armor', refId: plate.id, name: plate.name, qty: 1, equipped: true, price: plate.price, weight: plate.weight });
    c.traits = ['basic-combat-reactionary', 'basic-combat-armor-expert'];
    const r = compute(c, db);
    expect(r.init.total).toBe(2 + 2);
    expect(r.armor.acp).toBe(5);
  });

  it('tratto razziale alternativo che sostituisce il talento bonus umano', () => {
    const c = fighter(1);
    const human = db.raceById.get('human')!;
    const alt = human.alternateTraits!.find((t) => t.replaces.some((r) => /bonus feat/i.test(r)) && !t.replaces.some((r) => /skilled/i.test(r)))!;
    c.alternateTraits = [alt.name];
    const r = compute(c, db);
    expect(r.featSlots.filter((s) => s.kind === 'race').length).toBe(0);
  });
});
