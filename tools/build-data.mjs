// Converte le fonti grezze (compendio Foundry PF1, modulo pf1e-archetypes, Archives of Nethys)
// nel formato dati usato dall'app (public/data/*.json).
// Uso: node tools/build-data.mjs
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import {
  RAW, OUT, loadPack, writeJson, cleanHtml, stripHtml, slug, normSkills, changesOf, sourceOf, idFromUuid,
  SKILL_LONG, KNOWLEDGE, decodeMixed,
} from './lib.mjs';

const PF1 = path.join(RAW, 'pf1', 'packs');
const ARCH = path.join(RAW, 'arch', 'src');
const AON = path.join(RAW, 'aon');

// ---------------------------------------------------------------- Fonti (manuali)
const foundrySources = JSON.parse(fs.readFileSync(path.join(RAW, 'sources.json'), 'utf8'));
const books = new Map(); // nome -> { name, abbr, category }
function bookCategory(name, type) {
  if (type === 'core') return 'core';
  if (type === 'companion') return 'companion';
  if (type === 'ap' || /^Pathfinder #\d+/.test(name)) return 'ap';
  if (type === 'setting' || /Golarion|Inner Sea|Campaign Setting/.test(name)) return 'setting';
  return type ? 'other' : 'companion';
}
const AON_ALIASES = {
  'PRPG Core Rulebook': 'Core Rulebook',
  'Pathfinder RPG Bestiary': 'Bestiary',
  'Pathfinder RPG Bestiary 2': 'Bestiary 2',
  'Pathfinder RPG Bestiary 3': 'Bestiary 3',
  'Pathfinder RPG Bestiary 4': 'Bestiary 4',
  'Pathfinder RPG Bestiary 5': 'Bestiary 5',
  'Pathfinder RPG Bestiary 6': 'Bestiary 6',
  'Pathfinder RPG GameMastery Guide': 'GameMastery Guide',
};
function normBookName(n) {
  n = String(n ?? '').replace(/\s+/g, ' ').trim();
  n = AON_ALIASES[n] ?? n;
  return n.replace(/^Bestiary \[1\]$/, 'Bestiary');
}
for (const [, v] of Object.entries(foundrySources)) {
  const name = normBookName(v.name);
  books.set(name, { name, abbr: v.abbr, category: bookCategory(name, v.type) });
}
function registerBook(name) {
  name = normBookName(name);
  if (!name) return undefined;
  if (!books.has(name)) books.set(name, { name, category: bookCategory(name) });
  return name;
}
function src(sys) {
  const s = sourceOf(sys);
  if (!s) return undefined;
  const fs_ = foundrySources[s.id];
  const book = registerBook(fs_ ? fs_.name : s.id);
  return { book, page: s.page };
}

// ---------------------------------------------------------------- Privilegi di classe
console.log('Privilegi di classe…');
const classAbilities = loadPack(path.join(PF1, 'class-abilities'));
const archFeatures = loadPack(path.join(ARCH, 'pf-arch-features'));
const prestigeFeatures = loadPack(path.join(ARCH, 'pf-prestige-features'));
const features = new Map();
function addFeature(d, origin) {
  const sys = d.system ?? {};
  features.set(d._id, {
    id: d._id,
    name: d.name,
    origin, // base | archetype | prestige
    type: sys.abilityType && sys.abilityType !== 'none' ? sys.abilityType : undefined,
    tags: sys.tags?.length ? sys.tags : undefined,
    classes: sys.associations?.classes?.length ? sys.associations.classes : undefined,
    desc: cleanHtml(sys.description?.value),
    changes: changesOf(sys).length ? changesOf(sys) : undefined,
    source: src(sys),
  });
}
classAbilities.forEach((d) => addFeature(d, 'base'));
archFeatures.forEach((d) => addFeature(d, 'archetype'));
prestigeFeatures.forEach((d) => addFeature(d, 'prestige'));

// ---------------------------------------------------------------- Classi
console.log('Classi…');
const SAVE = (v) => (v === 'high' ? 'good' : 'poor');
function classOut(d, kind) {
  const s = d.system;
  return {
    id: s.tag || slug(d.name),
    name: d.name,
    kind, // base | prestige | npc | hybrid | unchained
    hd: s.hd,
    skillRanks: s.skillsPerLevel,
    bab: s.bab, // high | med | low
    saves: { fort: SAVE(s.savingThrows?.fort?.value), ref: SAVE(s.savingThrows?.ref?.value), will: SAVE(s.savingThrows?.will?.value) },
    classSkills: normSkills(s.classSkills),
    armorProf: s.armorProf ?? [],
    weaponProf: s.weaponProf ?? [],
    casting: s.casting?.type
      ? {
          type: s.casting.type,
          progression: s.casting.progression,
          ability: s.casting.ability,
          tradition: s.casting.spells,
          cantrips: !!s.casting.cantrips,
          domainSlots: s.casting.domain || 0,
        }
      : undefined,
    features: (s.links?.supplements ?? [])
      .map((l) => ({ level: l.level, id: idFromUuid(l.uuid) }))
      .filter((l) => features.has(l.id)),
    wealth: s.wealth,
    summary: stripHtml(s.description?.summary),
    desc: cleanHtml(s.description?.value),
    source: src(s),
  };
}
const HYBRID = new Set(['arcanist', 'bloodrager', 'brawler', 'hunter', 'investigator', 'shaman', 'skald', 'slayer', 'swashbuckler', 'warpriest']);
const classes = [];
for (const d of loadPack(path.join(PF1, 'classes'))) {
  const s = d.system;
  let kind = s.subType === 'npc' ? 'npc' : 'base';
  if (/unchained/i.test(s.tag ?? '')) kind = 'unchained';
  else if (HYBRID.has(s.tag)) kind = 'hybrid';
  if (s.subType === 'racial' || s.subType === 'mythic') continue;
  classes.push(classOut(d, kind));
}

// Classi di prestigio: privilegi e progressione incantesimi ricavati dalla tabella nella descrizione.
const ORD = /^(\d+)(?:st|nd|rd|th)$/i;
function parsePrestigeTable(html) {
  const $ = cheerio.load(html ?? '');
  let rows = [];
  $('table').each((_, t) => {
    const r = $(t).find('tr').toArray().map((tr) => $(tr).find('td,th').toArray().map((c) => $(c).text().replace(/\s+/g, ' ').trim()));
    const head = r.findIndex((x) => x.some((c) => /^Level$/i.test(c)) && x.some((c) => /Special/i.test(c)));
    if (head >= 0 && !rows.length) rows = r.slice(head);
  });
  if (!rows.length) return null;
  const head = rows[0];
  const iLvl = head.findIndex((c) => /^Level$/i.test(c));
  const iSpecial = head.findIndex((c) => /Special/i.test(c));
  const iSpells = head.findIndex((c) => /Spells per Day|Spellcasting|Spells/i.test(c));
  const out = [];
  for (const r of rows.slice(1)) {
    const m = ORD.exec(r[iLvl] ?? '');
    if (!m) continue;
    out.push({
      level: +m[1],
      special: (r[iSpecial] ?? '').replace(/—/g, '').trim(),
      spells: iSpells >= 0 ? (r[iSpells] ?? '').trim() : '',
    });
  }
  return out;
}
function prestigeRequirements(html) {
  const $ = cheerio.load(html ?? '');
  const h = $('h2').filter((_, e) => /Requirements/i.test($(e).text())).first();
  if (!h.length) return undefined;
  let out = '';
  let n = h[0].nextSibling;
  while (n && !(n.type === 'tag' && /^h[12]$/.test(n.name))) {
    out += $.html(n);
    n = n.nextSibling;
  }
  return cleanHtml(out);
}
const prestigeFeatByClass = new Map();
for (const d of prestigeFeatures) {
  for (const c of d.system?.associations?.classes ?? []) {
    if (!prestigeFeatByClass.has(c)) prestigeFeatByClass.set(c, []);
    prestigeFeatByClass.get(c).push(d);
  }
}
const baseName = (n) => n.replace(/\s*\([^)]*\)\s*$/, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
for (const d of loadPack(path.join(ARCH, 'pf-prestige-classes'))) {
  const c = classOut(d, 'prestige');
  const table = parsePrestigeTable(d.system.description?.value);
  const feats = prestigeFeatByClass.get(d.name) ?? [];
  if (table) {
    c.levels = table.length;
    c.spellProgression = table.map((r) => /\+1 (?:level|caster level)|level of existing/i.test(r.spells));
    const feat = [];
    for (const row of table) {
      for (const part of row.special.split(/,(?![^(]*\))/).map((x) => x.trim()).filter(Boolean)) {
        const key = baseName(part.replace(/\s*[+-]?\d+(?:d\d+)?\s*$/, '').replace(/\s+\d+\/day$/i, ''));
        const f = feats.find((x) => baseName(x.name) === key) ?? feats.find((x) => key && baseName(x.name).startsWith(key));
        if (f && !feat.some((x) => x.id === f._id)) feat.push({ level: row.level, id: f._id });
        else if (!f) feat.push({ level: row.level, label: part });
      }
    }
    c.features = feat;
  } else {
    c.levels = 10;
    c.features = feats.map((f) => ({ level: 1, id: f._id }));
  }
  c.requirements = prestigeRequirements(d.system.description?.value);
  classes.push(c);
}

// ---------------------------------------------------------------- Archetipi
console.log('Archetipi…');
const classByName = new Map(classes.map((c) => [c.name.toLowerCase(), c]));
const archetypes = [];
for (const d of loadPack(path.join(ARCH, 'pf-archetypes'))) {
  const s = d.system;
  const cname = s.associations?.classes?.[0] ?? '';
  const cls = classByName.get(cname.toLowerCase());
  if (!cls) continue;
  const m = /^[^(]+\((.+)\)$/.exec(d.name);
  const feats = (s.links?.supplements ?? [])
    .map((l) => ({ level: l.level, id: idFromUuid(l.uuid) }))
    .filter((l) => features.has(l.id));
  // Testo "This ability replaces ..." per capire quali privilegi base vengono sostituiti.
  const baseFeatureNames = cls.features.map((f) => features.get(f.id)?.name).filter(Boolean);
  const replaced = new Set();
  for (const f of feats) {
    const fd = features.get(f.id);
    // Un privilegio d'archetipo con lo stesso nome di uno base (es. "Weapon Training (Two-Handed Fighter)") lo modifica
    const same = baseFeatureNames.find((bn) => baseName(bn) === baseName(fd.name));
    if (same) replaced.add(same);
    const txt = stripHtml(fd.desc);
    const re = /(?:replaces?|replacing|in place of|instead of|alters?|modif(?:y|ies))\s+(?:the\s+)?([^.;]+)/gi;
    let mm;
    const hits = [];
    while ((mm = re.exec(txt))) hits.push(mm[1]);
    fd.replaces = hits.length ? hits.join('; ') : undefined;
    for (const h of hits) {
      const low = h.toLowerCase();
      for (const bn of baseFeatureNames) {
        const k = bn.toLowerCase().replace(/\s*\(.*\)$/, '');
        if (k.length > 2 && low.includes(k)) replaced.add(bn);
      }
    }
  }
  archetypes.push({
    id: d._id,
    name: m ? m[1] : d.name,
    classId: cls.id,
    features: feats,
    replaces: [...replaced],
    desc: cleanHtml(s.description?.value),
    source: src(s),
  });
}

// ---------------------------------------------------------------- Razze
console.log('Razze…');
const ABILS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const races = [];
for (const d of loadPack(path.join(PF1, 'races'))) {
  const s = d.system;
  const changes = changesOf(s);
  const abilityMods = {};
  const other = [];
  for (const c of changes) {
    if (ABILS.includes(c.target) && /^-?\d+$/.test(c.formula)) abilityMods[c.target] = (abilityMods[c.target] ?? 0) + +c.formula;
    else other.push(c);
  }
  const desc = cleanHtml(s.description?.value);
  const flexible = Object.keys(abilityMods).length === 0 && /of (?:their|his or her) choice|any one ability/i.test(stripHtml(desc));
  races.push({
    id: slug(d.name),
    name: d.name,
    core: (s.tags ?? []).includes('Core'),
    size: s.size,
    speed: s.speeds ?? { land: 30 },
    abilityMods,
    flexible,
    changes: other,
    changeFlags: s.changeFlags,
    languages: s.languages ?? [],
    types: s.creatureTypes ?? [],
    subtypes: s.creatureSubtypes ?? [],
    weaponProf: s.weaponProf,
    notes: Object.values(s.contextNotes ?? {}).map((n) => ({ text: n.text, target: n.target })),
    desc,
    source: src(s),
  });
}

// Tratti razziali (standard e alternativi) e opzioni di classe preferita da AoN.
const CLASS_BY_LOWER = new Map(classes.map((c) => [c.name.toLowerCase(), c.id]));
for (const r of races) {
  const file = path.join(AON, 'races', r.name.replace(/[^a-zA-Z0-9 ,'()-]/g, '_') + '.html');
  if (!fs.existsSync(file)) continue;
  const html = decodeMixed(fs.readFileSync(file));
  // Le sezioni sono separate da <h1 class="title">: le spezziamo a mano (l'HTML di AoN non è ben formato).
  const sections = html.split('<h1 class="title">').slice(1).map((s) => {
    const end = s.indexOf('</h1>');
    const head = s.indexOf('<h2') >= 0 && s.indexOf('<h2') < end ? s.slice(0, s.indexOf('<h2')) : s.slice(0, end);
    return { title: stripHtml(head), body: s };
  });
  const std = sections.find((s) => /Racial Traits$/.test(s.title) && !/Alternate/.test(s.title));
  if (std) {
    const body = std.body.slice(std.body.indexOf('</h1>') + 5).split(/<h1|<h2|<\/span>/)[0];
    r.traits = body.split(/<br\s*\/?>/).map((chunk) => {
      const m = /<b>([\s\S]*?)<\/b>\s*:?\s*([\s\S]*)/.exec(chunk);
      return m ? { name: stripHtml(m[1]), desc: stripHtml(m[2]) } : null;
    }).filter((x) => x && x.name && x.desc);
  }
  r.alternateTraits = [];
  for (const s of sections.filter((x) => /Alternate Racial Trait/.test(x.title))) {
    for (const grp of s.body.split('<h2 class="title">').slice(1)) {
      const replacesTxt = stripHtml(grp.slice(0, grp.indexOf('</h2>'))).replace(/^Replaces\s*/i, '');
      const replaces = replacesTxt ? replacesTxt.split(/,\s*|\s+and\s+/).filter(Boolean) : [];
      const items = grp.slice(grp.indexOf('</h2>') + 5).split(/<br \/><br \/>(?=\s*<b>)/);
      for (const it of items) {
        const nm = /<b>(?:<img[^>]*>)?\s*([^<]+?)\s*<\/b>/.exec(it);
        if (!nm) continue;
        const bm = /<b>Source<\/b>\s*<a[^>]*>\s*<i>([^<]*?)\s*pg\.\s*([\d, ]*)<\/i>/i.exec(it);
        const desc = cleanAonText(it.replace(/^[\s\S]*?<\/b>/, '').replace(/<b>Source<\/b>[\s\S]*?<\/a>(?:,\s*<a[^>]*>[\s\S]*?<\/a>)*/i, ''));
        if (!desc) continue;
        r.alternateTraits.push({ name: nm[1].trim(), replaces, desc, source: bm ? { book: registerBook(bm[1]), page: bm[2].trim() } : undefined });
      }
    }
  }
  r.favoredClassOptions = [];
  const fcb = sections.find((x) => /Favored Class Options/.test(x.title));
  if (fcb) {
    for (const m of fcb.body.matchAll(/<b>(?:<img[^>]*>)?\s*([^<]+?)<\/b>\s*\(([\s\S]*?)\):\s*([\s\S]*?)(?=<br \/>|<\/span>|<h)/g)) {
      const cid = CLASS_BY_LOWER.get(m[1].trim().toLowerCase());
      if (!cid) continue;
      const bm = /<i>([^<]*?)\s*pg\.\s*([\d, ]*)<\/i>/.exec(m[2]);
      r.favoredClassOptions.push({ classId: cid, desc: stripHtml(m[3]), source: bm ? { book: registerBook(bm[1]), page: bm[2].trim() } : undefined });
    }
  }
}
function cleanAonText(h) {
  return stripHtml(String(h).replace(/<sup>[^<]*<\/sup>/g, ''));
}

// ---------------------------------------------------------------- Talenti (AoN + modificatori Foundry)
console.log('Talenti…');
const foundryFeats = new Map(loadPack(path.join(PF1, 'feats')).map((d) => [d.name.toLowerCase(), d]));
const featIndex = new Map(); // nome -> { prereq, summary }
{
  const $ = cheerio.load(decodeMixed(fs.readFileSync(path.join(RAW, 'aon_feats.html'))));
  $('tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 3) return;
    const a = $(tds[0]).find('a[href^="FeatDisplay"]');
    if (!a.length) return;
    const name = decodeURIComponent(a.attr('href').replace('FeatDisplay.aspx?ItemName=', ''));
    featIndex.set(name, { summary: $(tds[2]).text().trim() });
  });
}
const SKILL_NAMES = {
  acrobatics: 'acr', appraise: 'apr', artistry: 'art', bluff: 'blf', climb: 'clm', craft: 'crf', diplomacy: 'dip',
  'disable device': 'dev', disguise: 'dis', 'escape artist': 'esc', fly: 'fly', 'handle animal': 'han', heal: 'hea',
  intimidate: 'int', 'knowledge (arcana)': 'kar', 'knowledge (dungeoneering)': 'kdu', 'knowledge (engineering)': 'ken',
  'knowledge (geography)': 'kge', 'knowledge (history)': 'khi', 'knowledge (local)': 'klo', 'knowledge (nature)': 'kna',
  'knowledge (nobility)': 'kno', 'knowledge (planes)': 'kpl', 'knowledge (religion)': 'kre', linguistics: 'lin',
  lore: 'lor', perception: 'per', perform: 'prf', profession: 'pro', ride: 'rid', 'sense motive': 'sen',
  'sleight of hand': 'slt', spellcraft: 'spl', stealth: 'ste', survival: 'sur', swim: 'swm', 'use magic device': 'umd',
};
const ABIL_NAMES = { str: 'str', dex: 'dex', con: 'con', int: 'int', wis: 'wis', cha: 'cha', strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' };
const CLASS_IDS = new Map(classes.map((c) => [c.name.toLowerCase(), c.id]));

/** Analizza un singolo requisito testuale in una struttura verificabile. */
const RACE_NAMES = new Map(races.map((r) => [r.name.toLowerCase(), r.id]));
const BOOK_SUFFIX = /(?<=[a-z)])(?:APG|ACG|ARG|UCa|UC|UM|UE|UI|UW|OA|ISWG|ISG|ISM|ISR|MA|HA|PU|AG|B[1-6]|CRB|PA|VC|BotD)\b/g;
function parseClause(raw, featNames) {
  const t = raw.replace(/\.$/, '').replace(BOOK_SUFFIX, '').replace(/\s+/g, ' ').trim();
  const low = t.toLowerCase();
  let m;
  if (RACE_NAMES.has(low)) return { t: 'race', r: RACE_NAMES.get(low) };
  if ((m = /^(?:must be (?:an? )?)?([a-z-]+) race$/i.exec(t)) && RACE_NAMES.has(m[1].toLowerCase())) return { t: 'race', r: RACE_NAMES.get(m[1].toLowerCase()) };
  if ((m = /^(\d+) (?:or more )?hit dice$/i.exec(t))) return { t: 'level', v: +m[1] };
  if ((m = /^base (fortitude|reflex|will) sav(?:e|ing throw) bonus \+(\d+)$/i.exec(t)))
    return { t: 'save', s: { fortitude: 'fort', reflex: 'ref', will: 'will' }[m[1].toLowerCase()], v: +m[2] };
  if ((m = /^proficiency with (light|medium|heavy) armor$/i.exec(t))) return { t: 'armorProf', v: { light: 'lgt', medium: 'med', heavy: 'hvy' }[m[1].toLowerCase()] };
  if ((m = /^(?:the )?ability to cast (?:(\d)(?:st|nd|rd|th)-level )?(arcane|divine|psychic)? ?spells(?: of (\d)(?:st|nd|rd|th) level or higher)?$/i.exec(t)))
    return { t: 'caster', trad: m[2]?.toLowerCase(), v: +(m[1] ?? m[3] ?? 0) || undefined };
  if ((m = /^(.+?) with the chosen weapon$/i.exec(t)) && featNames.has(m[1].toLowerCase())) return { t: 'feat', name: featNames.get(m[1].toLowerCase()) };
  if ((m = /^(.+?) (?:class feature|class ability|racial trait|ability)(?: .*)?$/i.exec(t)) && !/spell-like/i.test(m[1]))
    return { t: 'feature', name: m[1].replace(/\s+[+]?\d+d\d+$/, '').trim() };
  if ((m = /^(channel(?: positive| negative)? energy|sneak attack|bardic performance|rage|wild shape|ki pool|grit|panache|flurry of blows|bomb|hex|mutagen|judgment|bane|smite evil|lay on hands|arcane pool|evasion|studied target|favored enemy|trapfinding|uncanny dodge)(?:\s+[+]?\d+d\d+)?$/i.exec(t)))
    return { t: 'feature', name: m[1] };
  if ((m = /^(str|dex|con|int|wis|cha|strength|dexterity|constitution|intelligence|wisdom|charisma)\s+(\d+)$/i.exec(t)))
    return { t: 'ability', a: ABIL_NAMES[m[1].toLowerCase()], v: +m[2] };
  if ((m = /^base attack bonus \+?(\d+)$/i.exec(t))) return { t: 'bab', v: +m[1] };
  if ((m = /^caster level (\d+)(?:st|nd|rd|th)?$/i.exec(t))) return { t: 'cl', v: +m[1] };
  if ((m = /^character level (\d+)(?:st|nd|rd|th)?$/i.exec(t))) return { t: 'level', v: +m[1] };
  if ((m = /^(?:(\d+)(?:st|nd|rd|th)[- ]level\s+([a-z ]+)|([a-z ]+?) level (\d+)(?:st|nd|rd|th)?)$/i.exec(t))) {
    const cname = (m[2] ?? m[3]).trim().toLowerCase();
    const lv = +(m[1] ?? m[4]);
    if (CLASS_IDS.has(cname)) return { t: 'class', c: CLASS_IDS.get(cname), v: lv };
  }
  if ((m = /^(.+?)\s+(\d+)\s+ranks?$/i.exec(t))) {
    const sk = SKILL_NAMES[m[1].toLowerCase()] ?? (/^knowledge \(any\)$/i.test(m[1]) ? 'kno*' : /^(craft|perform|profession) \(any\)$/i.test(m[1]) ? SKILL_NAMES[m[1].toLowerCase().split(' ')[0]] : undefined);
    const sk2 = sk ?? (/^(craft|perform|profession)/i.test(m[1]) ? SKILL_NAMES[m[1].toLowerCase().split(' ')[0]] : undefined);
    if (sk2) return { t: 'skill', s: sk2, v: +m[2] };
  }
  // Talento (anche con specializzazione, es. "Weapon Focus (longsword)")
  const featBase = t.replace(/\s*\([^)]*\)$/, '').replace(/^\*|\*$/g, '');
  const fname = featNames.get(t.toLowerCase()) ?? featNames.get(featBase.toLowerCase());
  if (fname) return { t: 'feat', name: fname, ...(featBase !== t ? { detail: t.slice(featBase.length).trim().replace(/^\(|\)$/g, '') } : {}) };
  if ((m = /^proficiency with (.+)$/i.exec(t))) return { t: 'text', text: t };
  void low;
  return { t: 'text', text: t };
}
function splitTop(s, sep) {
  const out = [];
  let depth = 0, cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth === 0 && s.startsWith(sep, i)) { out.push(cur); cur = ''; i += sep.length - 1; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}
function parsePrereq(text, featNames) {
  if (!text || text === '—') return [];
  // Rimuove i riferimenti bibliografici "(Ultimate Combat 123)"
  const clean = text.replace(/\s*\((?:[A-Z][\w'’:,& -]+ \d+(?:, \d+)*)\)/g, '').replace(/[.;]\s*$/, '');
  const out = [];
  for (const part0 of splitTop(clean.replace(/;/g, ','), ',')) {
    // "A, B, or C": la parte che inizia con "or" si unisce alla precedente in un gruppo OR.
    const leadingOr = /^or\s+/i.test(part0);
    const part = part0.replace(/^(?:or|and)\s+/i, '');
    const ors = splitTop(part, ' or ').map((o) => parseClause(o, featNames));
    const node = ors.length > 1 ? { t: 'or', of: ors } : ors[0];
    if (leadingOr && out.length) {
      const prev = out.pop();
      out.push({ t: 'or', of: [...(prev.t === 'or' ? prev.of : [prev]), ...(node.t === 'or' ? node.of : [node])] });
    } else out.push(node);
  }
  return out;
}

const featFiles = fs.existsSync(path.join(AON, 'feats')) ? fs.readdirSync(path.join(AON, 'feats')) : [];
const featsRaw = [];
for (const f of featFiles) {
  const html = decodeMixed(fs.readFileSync(path.join(AON, 'feats', f)));
  const $ = cheerio.load(html);
  const h1 = $('h1.title').first();
  if (!h1.length) continue;
  const title = h1.text().replace(/\s+/g, ' ').trim();
  const tm = /^(.*?)\s*(?:\(([^)]*)\))?$/.exec(title);
  const name = tm[1].replace(/\*$/, '').trim();
  const types = tm[2] ? tm[2].split(',').map((x) => x.trim()) : [];
  // Contenuto del primo blocco (fino al primo h2 = varianti mitiche, combat trick, ecc.)
  let body = '';
  let n = h1[0].nextSibling;
  while (n && !(n.type === 'tag' && (n.name === 'h2' || n.name === 'h1'))) {
    body += $.html(n);
    n = n.nextSibling;
  }
  const bm = /<b>Source<\/b>\s*<a[^>]*>\s*<i>([^<]*?)\s*pg\.\s*([\d, ]*)<\/i><\/a>/i.exec(body);
  const book = registerBook(bm ? bm[1] : undefined);
  body = body.replace(/<b>Source<\/b>[\s\S]*?<\/a>(?:,\s*<a[^>]*>[\s\S]*?<\/a>)*/i, '');
  // Sezioni <b>Xxx</b>: testo
  const sections = {};
  const parts = body.split(/<b>([^<]+?)<\/b>\s*:?/);
  const flavor = stripHtml(parts[0]);
  for (let i = 1; i < parts.length; i += 2) sections[parts[i].replace(/:$/, '').trim().toLowerCase()] = parts[i + 1];
  const prereqText = stripHtml(sections['prerequisites'] ?? sections['prerequisite'] ?? '').replace(/^:\s*/, '');
  const benefitHtml = cleanAon(sections['benefit'] ?? sections['benefits'] ?? '');
  const extra = {};
  for (const k of Object.keys(sections)) {
    if (/^prerequisites?$|^benefits?$/.test(k)) continue;
    extra[k] = cleanAon(sections[k]);
  }
  featsRaw.push({ name, types, book, page: bm?.[2]?.trim(), flavor, prereqText, benefitHtml, extra });
}
function cleanAon(html) {
  return String(html ?? '')
    .replace(/^\s*:\s*/, '')
    .replace(/<a [^>]*>(.*?)<\/a>/g, '$1')
    .replace(/<img[^>]*>/g, '')
    .replace(/\s+style="[^"]*"/g, '')
    .replace(/(<br\s*\/?>\s*)+$/g, '')
    .replace(/^(\s*<br\s*\/?>)+/g, '')
    .trim();
}
const featNames = new Map(featsRaw.map((f) => [f.name.toLowerCase(), f.name]));
const feats = featsRaw
  .map((f) => {
    const fd = foundryFeats.get(f.name.toLowerCase());
    const changes = fd ? changesOf(fd.system) : [];
    const multiple = /can (?:gain|take|select) this feat multiple times|may be taken multiple times|can be taken multiple times/i.test(stripHtml(f.extra.special ?? ''));
    return {
      id: slug(f.name),
      name: f.name,
      types: f.types,
      prereqText: f.prereqText || undefined,
      prereq: parsePrereq(f.prereqText, featNames),
      summary: featIndex.get(f.name)?.summary ?? undefined,
      flavor: f.flavor || undefined,
      benefit: f.benefitHtml,
      normal: f.extra.normal,
      special: f.extra.special,
      extra: Object.fromEntries(Object.entries(f.extra).filter(([k]) => !['normal', 'special'].includes(k))),
      multiple: multiple || undefined,
      changes: changes.length ? changes : undefined,
      source: f.book ? { book: f.book, page: f.page } : undefined,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));
for (const f of feats) if (f.extra && !Object.keys(f.extra).length) delete f.extra;

// ---------------------------------------------------------------- Tratti
console.log('Tratti…');
const SKILL_BY_EN = Object.fromEntries(Object.entries(SKILL_NAMES).map(([k, v]) => [k.replace(/ \((\w+)\)$/, ' ($1)'), v]));
/** Ricava i bonus numerici incondizionati dal testo dei tratti più comuni. */
function traitChanges(text) {
  const out = [];
  const conditional = /^\s*(?:to|made|against|when|while|in|involving|for|that|with|about|if|on|during|relating)\b/i;
  let m;
  const re = /\+(\d+) (?:trait )?bonus on ([^.;]+?) (checks|saves|saving throws)/gi;
  while ((m = re.exec(text))) {
    const rest = text.slice(m.index + m[0].length, m.index + m[0].length + 30);
    if (conditional.test(rest)) continue;
    const v = m[1];
    const what = m[2].replace(/^all /i, '');
    if (/^initiative$/i.test(what)) { out.push({ formula: v, target: 'init', type: 'trait' }); continue; }
    const save = /^(Fortitude|Reflex|Will)$/i.exec(what);
    if (save && m[3] !== 'checks') { out.push({ formula: v, target: { fortitude: 'fort', reflex: 'ref', will: 'will' }[save[1].toLowerCase()], type: 'trait' }); continue; }
    if (m[3] !== 'checks') continue;
    for (const part of what.split(/,\s*|\s+and\s+|\s+or\s+/)) {
      const key = SKILL_BY_EN[part.trim().toLowerCase()];
      if (key) out.push({ formula: v, target: `skill.${key}`, type: 'trait' });
    }
  }
  if ((m = /\+(\d+) trait bonus on initiative/i.exec(text)) && !out.some((c) => c.target === 'init')) out.push({ formula: m[1], target: 'init', type: 'trait' });
  if (/reduce (?:that suit[’']s|the) armor check penalty by 1/i.test(text)) out.push({ formula: '1', target: 'acpA', type: 'untyped' });
  if ((m = /\+(\d+) trait bonus to CMD/i.exec(text))) out.push({ formula: m[1], target: 'cmd', type: 'trait' });
  return out;
}
const traits = [];
const traitDir = path.join(AON, 'traits-index');
if (fs.existsSync(traitDir)) {
  for (const file of fs.readdirSync(traitDir)) {
    const category = file.replace(/\.html$/, '');
    const $ = cheerio.load(decodeMixed(fs.readFileSync(path.join(traitDir, file))));
    $('span[id^="MainContent_DataListTypes_LabelType_"]').each((_, sp) => {
      const h2 = $(sp).find('h2').first();
      const name = h2.text().replace(/\[Link\]/, '').replace(/\s+/g, ' ').trim();
      let html = $(sp).html();
      html = html.replace(/<h2[\s\S]*?<\/h2>/, '');
      const bm = /<b>Source<\/b>\s*<a[^>]*>\s*<i>([^<]*?)\s*pg\.\s*([\d, ]*)<\/i><\/a>/i.exec(html);
      html = html.replace(/<b>Source<\/b>[\s\S]*?<\/a>(?:,\s*<a[^>]*>[\s\S]*?<\/a>)*/i, '');
      const body = cleanAon(html);
      const reqm = /<b>Requirements?<\/b>\s*:?\s*([\s\S]*?)(?:<br|$)/i.exec(body);
      const changes = traitChanges(stripHtml(body));
      traits.push({
        ...(changes.length ? { changes } : {}),
        id: slug(category + '-' + name),
        name,
        category: category.replace(/^Basic \((.*)\)$/, '$1'),
        basic: category.startsWith('Basic'),
        requirement: reqm ? stripHtml(reqm[1]) : undefined,
        desc: body,
        source: bm ? { book: registerBook(bm[1]), page: bm[2].trim() } : undefined,
      });
    });
  }
}

// ---------------------------------------------------------------- Incantesimi
console.log('Incantesimi…');
const spells = [];
for (const d of loadPack(path.join(PF1, 'spells'))) {
  const s = d.system;
  const act = Object.values(s.actions ?? {})[0] ?? {};
  const comps = s.components ?? {};
  const c = [];
  if (comps.verbal) c.push('V');
  if (comps.somatic) c.push('S');
  if (comps.thought) c.push('T');
  if (comps.emotion) c.push('E');
  if (comps.material) c.push('M' + (s.materials?.value ? ` (${s.materials.value})` : ''));
  if (comps.focus) c.push('F' + (s.materials?.focus ? ` (${s.materials.focus})` : ''));
  if (comps.divineFocus) c.push(comps.divineFocus === 2 ? 'M/DF' : comps.divineFocus === 3 ? 'F/DF' : 'DF');
  const rangeUnits = act.range?.units;
  const range = { personal: 'personal', touch: 'touch', close: 'close (25 ft. + 5 ft./2 levels)', medium: 'medium (100 ft. + 10 ft./level)', long: 'long (400 ft. + 40 ft./level)', unlimited: 'unlimited', ft: `${act.range?.value} ft.`, mi: `${act.range?.value} mi.`, spec: act.range?.value, seeText: 'see text' }[rangeUnits] ?? act.range?.value;
  const dur = act.duration;
  const durText = dur ? (dur.units === 'inst' ? 'instantaneous' : dur.units === 'perm' ? 'permanent' : dur.units === 'spec' || dur.units === 'seeText' ? dur.value : [dur.value, dur.units].filter(Boolean).join(' ')) + (dur.dismiss ? ' (D)' : '') + (dur.concentration ? ' (concentration)' : '') : undefined;
  const learned = {};
  for (const [k, v] of Object.entries(s.learnedAt ?? {})) if (v && Object.keys(v).length) learned[k] = v;
  spells.push({
    id: d._id,
    name: d.name,
    school: s.school,
    subschool: s.subschool?.length ? s.subschool : undefined,
    descriptors: s.descriptors?.length ? s.descriptors : undefined,
    levels: learned.class ?? {},
    other: Object.keys(learned).filter((k) => k !== 'class').length ? Object.fromEntries(Object.entries(learned).filter(([k]) => k !== 'class')) : undefined,
    components: c.join(', '),
    time: act.activation ? `${act.activation.cost ?? 1} ${act.activation.type}` : undefined,
    range,
    area: act.area || undefined,
    target: act.target?.value || undefined,
    effect: act.effect || undefined,
    duration: durText,
    save: act.save?.description || undefined,
    sr: s.sr === true ? 'yes' : s.sr === false ? 'no' : undefined,
    summary: stripHtml(s.description?.summary) || undefined,
    desc: cleanHtml(s.description?.value),
    source: src(s),
  });
}

// ---------------------------------------------------------------- Equipaggiamento
console.log('Equipaggiamento…');
const weapons = [];
for (const d of loadPack(path.join(PF1, 'weapons-and-ammo'))) {
  const s = d.system;
  if (d.type !== 'weapon' || s.subType === 'siege') continue;
  const act = Object.values(s.actions ?? {})[0] ?? {};
  const part = act.damage?.parts?.[0];
  let dmg = '';
  const sm = /sizeRoll\((\d+),\s*(\d+)/.exec(part?.formula ?? '');
  if (sm) dmg = `${sm[1]}d${sm[2]}`;
  else if (part?.formula) dmg = part.formula;
  weapons.push({
    id: d._id,
    name: d.name,
    category: s.subType, // simple | martial | exotic | misc
    kind: s.weaponSubtype, // light | 1h | 2h | ranged
    damage: dmg,
    damageTypes: part?.types ?? [],
    critRange: act.ability?.critRange ?? 20,
    critMult: act.ability?.critMult ?? 2,
    rangeIncrement: act.range?.units === 'ft' ? +act.range.value || undefined : undefined,
    ranged: act.actionType === 'rwak' || act.actionType === 'twak',
    groups: s.weaponGroups ?? [],
    properties: Array.isArray(s.properties) ? s.properties : Object.entries(s.properties ?? {}).filter(([, v]) => v).map(([k]) => k),
    price: s.price?.base ?? 0,
    weight: s.weight?.value ?? 0,
    desc: cleanHtml(s.description?.value),
    source: src(s),
  });
}
const armor = [];
for (const d of loadPack(path.join(PF1, 'armors-and-shields'))) {
  const s = d.system;
  armor.push({
    id: d._id,
    name: d.name,
    kind: s.subType, // armor | shield
    category: s.equipmentSubtype, // lightArmor | mediumArmor | heavyArmor | lightShield | ...
    ac: s.armor?.value ?? 0,
    maxDex: s.armor?.dex ?? null,
    acp: s.armor?.acp ?? 0,
    asf: s.spellFailure ?? 0,
    price: s.price?.base ?? 0,
    weight: s.weight?.value ?? 0,
    desc: cleanHtml(s.description?.value),
    source: src(s),
  });
}
const gear = [];
for (const d of loadPack(path.join(PF1, 'items'))) {
  const s = d.system;
  if (!s) continue;
  const ch = changesOf(s);
  gear.push({
    id: d._id,
    name: d.name,
    type: d.type,
    subType: s.subType,
    slot: s.slot,
    price: s.price?.base ?? 0,
    weight: s.weight?.value ?? 0,
    cl: s.cl,
    changes: ch.length ? ch : undefined,
    desc: cleanHtml(s.description?.value),
    source: src(s),
  });
}

// ---------------------------------------------------------------- Output
console.log('Scrittura file:');
const usedFeatureIds = new Set();
for (const c of classes) c.features.forEach((f) => f.id && usedFeatureIds.add(f.id));
for (const a of archetypes) a.features.forEach((f) => usedFeatureIds.add(f.id));
writeJson('classes.json', classes);
writeJson('archetypes.json', archetypes);
writeJson('features.json', [...features.values()]);
writeJson('races.json', races);
writeJson('feats.json', feats);
writeJson('traits.json', traits);
writeJson('spells.json', spells);
writeJson('weapons.json', weapons);
writeJson('armor.json', armor);
writeJson('gear.json', gear);
writeJson('books.json', [...books.values()].sort((a, b) => a.name.localeCompare(b.name)));
fs.copyFileSync(path.join(RAW, 'casterProgression.json'), path.join(OUT, 'casterProgression.json'));

// Statistiche sui requisiti dei talenti (per controllare la qualità del parser)
const kinds = {};
for (const f of feats) for (const p of f.prereq) { const k = p.t; kinds[k] = (kinds[k] ?? 0) + 1; }
console.log('Requisiti talenti per tipo:', kinds);
void SKILL_LONG; void KNOWLEDGE;
