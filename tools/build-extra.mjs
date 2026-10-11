// Importazioni aggiuntive da Archives of Nethys, eseguite dopo build-data.mjs:
//  - talenti selvaggi ed elementi del cineta (kineticist.json)
//  - scelte di classe mancanti nel compendio Foundry (grazie, crudeltà, trucchi del mesmerista, poteri ki,
//    amplificazioni freniche, evoluzioni dell'eidolon, focus del fantasma, scuole di impianto…) -> features.json
//  - scoperte arcane del mago come talenti -> feats.json
//  - oggetti magici e proprietà speciali di armi/armature -> gear.json, magicAbilities.json
// Uso: node tools/build-extra.mjs
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { RAW, OUT, writeJson, stripHtml, slug, decodeMixed, SKILL_LONG } from './lib.mjs';

const AON = path.join(RAW, 'aon');
const read = (f) => decodeMixed(fs.readFileSync(f));
const readJson = (n) => JSON.parse(fs.readFileSync(path.join(OUT, n), 'utf8'));
const books = readJson('books.json');
const bookNames = new Set(books.map((b) => b.name));
function book(name) {
  const n = String(name ?? '').replace(/\s+/g, ' ').trim().replace(/^PRPG Core Rulebook$/, 'Core Rulebook').replace(/^Pathfinder RPG Bestiary$/, 'Bestiary');
  if (n && !bookNames.has(n)) {
    books.push({ name: n, category: /^Pathfinder #\d/.test(n) ? 'ap' : 'companion' });
    bookNames.add(n);
  }
  return n || undefined;
}
function sourceFrom(html) {
  const m = /<i>([^<]*?)\s*pg\.\s*([\d, ]*)<\/i>/i.exec(html ?? '');
  return m ? { book: book(m[1]), page: m[2].trim() } : undefined;
}
const clean = (h) =>
  String(h ?? '')
    .replace(/<img[^>]*>/g, '')
    .replace(/<a [^>]*>(.*?)<\/a>/g, '$1')
    .replace(/<sup>[^<]*<\/sup>/g, '')
    .replace(/\s+style="[^"]*"/g, '')
    .replace(/(<br\s*\/?>\s*)+$/g, '')
    .replace(/^\s*(<br\s*\/?>\s*)+/g, '')
    .replace(/<hr\s*\/?>/g, '')
    .trim();
const minLevelOf = (text) => {
  const m = /(?:must be (?:at least )?|minimum (?:of )?)(\d+)(?:st|nd|rd|th)[- ]level|at least (\d+)(?:st|nd|rd|th) level/i.exec(stripHtml(text));
  return m ? +(m[1] ?? m[2]) : undefined;
};
const SKILL_NAME_TO_KEY = Object.fromEntries(
  Object.entries(SKILL_LONG).map(([long, key]) => [
    long.replace(/^knowledge\.(\w+)$/, 'knowledge ($1)').replace(/([A-Z])/g, ' $1').toLowerCase().trim(),
    key,
  ]),
);
SKILL_NAME_TO_KEY['knowledge (nobility and royalty)'] = 'kno';
SKILL_NAME_TO_KEY['knowledge (dungeoneering)'] = 'kdu';

// =================================================================== Cineta
console.log('Cineta…');
const KIN_TYPE = (t) => {
  t = t.toLowerCase();
  if (t.startsWith('simple blast')) return 'simple';
  if (t.startsWith('composite blast')) return 'composite';
  if (t.startsWith('defense')) return 'defense';
  if (t.startsWith('form infusion')) return 'form';
  if (t.startsWith('substance infusion')) return 'substance';
  if (t.startsWith('utility')) return 'utility';
  return 'other';
};
const kinTalents = [];
const kinDir = path.join(AON, 'kin', 'talents');
for (const f of fs.existsSync(kinDir) ? fs.readdirSync(kinDir) : []) {
  const h = read(path.join(kinDir, f));
  const i = h.indexOf('<h1 class="title">');
  if (i < 0) continue;
  let body = h.slice(i, h.indexOf('</span>', i));
  const name = stripHtml(body.slice(0, body.indexOf('</h1>')));
  const field = (k) => {
    const m = new RegExp(`<b>${k}</b>\\s*([^<;]*(?:<[^b][^>]*>[^<;]*)*?)(?:;|<br|<b>)`, 'i').exec(body);
    return m ? stripHtml(m[1]).trim() : undefined;
  };
  const elementTxt = field('Element') ?? '';
  const typeTxt = field('Type') ?? '';
  const levelTxt = field('Level');
  const burn = field('Burn');
  const prereq = field('Prerequisites?') ?? field('Prerequisite');
  const assoc = field('Associated Blasts');
  const save = field('Saving Throw');
  const blastType = field('Blast Type');
  const damage = field('Damage');
  const source = sourceFrom(body);
  // Il testo descrittivo segue l'ultima riga di intestazione
  const lastHeader = Math.max(...['Damage', 'Saving Throw', 'Associated Blasts', 'Prerequisite', 'Burn'].map((k) => body.lastIndexOf(`<b>${k}`)));
  let desc = body.slice(lastHeader);
  desc = desc.slice(desc.indexOf('<br') >= 0 ? desc.indexOf('<br') : 0).replace(/^<br\s*\/?>/, '');
  const elements = elementTxt.toLowerCase().split(/,\s*|\s+or\s+/).map((x) => x.trim()).filter(Boolean);
  kinTalents.push({
    id: slug(name),
    name,
    elements,
    type: KIN_TYPE(typeTxt),
    typeText: typeTxt,
    level: /^\d+$/.test(levelTxt ?? '') ? +levelTxt : null,
    burn: burn ?? '0',
    prereq,
    assoc: assoc ? (/^any/i.test(assoc) ? 'any' : assoc.toLowerCase().split(/,\s*/).map((x) => x.replace(/ blast$/, '').trim())) : undefined,
    save,
    blastType: blastType?.toLowerCase(),
    damage,
    desc: clean(desc),
    source,
  });
}
// Elementi
const kinElements = [];
{
  const h = read(path.join(AON, 'kin', 'elements.html'));
  const parts = h.split(/<h2 class="title">/).slice(1);
  for (const p of parts) {
    const name = stripHtml(p.slice(0, p.indexOf('</h2>')))
      .replace(/Source.*$/, '')
      .trim();
    if (!name || /Elements?$|^Universal/i.test(name)) continue;
    const text = p.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/&mdash;/g, '—');
    const csm = /Class Skills:\s*(?:An?|The)?\s*[\w-]+ adds (.*?) to (?:her|his|their) list of class skills/i.exec(text);
    const classSkills = [];
    if (csm) {
      for (const s of csm[1].split(/,\s*|\s+and\s+/)) {
        const k = SKILL_NAME_TO_KEY[s.trim().toLowerCase()];
        if (k) classSkills.push(k);
      }
    }
    const line = (label) => {
      const m = new RegExp(`${label}\\s*-\\s*([^\\n]*)`, 'i').exec(text);
      return m ? m[1].split(/,\s*/).map((x) => x.trim().replace(/†$/, '')).filter(Boolean) : [];
    };
    const id = name.toLowerCase().split(/\s+/)[0];
    const sm = /Source\s*([^\n]*?pg\. [\d, ]+)/.exec(text);
    kinElements.push({
      id,
      name,
      classSkills,
      simple: line('Simple Blasts?').map(slug),
      composite: line('Composite Blasts?').map(slug),
      defense: line('Defense').map(slug)[0],
      basic: kinTalents.find((t) => t.elements.includes(id) && /^Basic /.test(t.name))?.id,
      desc: stripHtml(text.slice(text.indexOf('\n'), text.indexOf('Class Skills'))).replace(/^Source[^\n]*?pg\. [\d, ]+/, '').trim(),
      source: sm ? sourceFrom(`<i>${sm[1]}</i>`) : undefined,
    });
  }
}
writeJson('kineticist.json', { elements: kinElements, talents: kinTalents.sort((a, b) => a.name.localeCompare(b.name)) });

// =================================================================== Scelte di classe da AoN
console.log('Scelte di classe…');
// Lo script è idempotente: scarta quanto aggiunto da una sua esecuzione precedente
const features = readJson('features.json').filter((f) => !f.id.startsWith('aon-'));
const featureKey = (name, cls) => `${name.toLowerCase().replace(/\s*\([^)]*\)$/, '').trim()}|${cls}`;
const existing = new Set(features.flatMap((f) => (f.classes ?? []).map((c) => featureKey(f.name, c))));
let added = 0;
function addFeature({ name, cls, tags, desc, source, type, minLevel, cost, extra }) {
  const key = featureKey(name, cls[0]);
  if (existing.has(key)) {
    // Arricchisce il privilegio esistente con livello minimo e tag mancanti
    const f = features.find((x) => featureKey(x.name, x.classes?.[0] ?? '') === key);
    if (f) {
      f.tags = [...new Set([...(f.tags ?? []), ...tags])];
      if (minLevel && !f.minLevel) f.minLevel = minLevel;
      if (cost !== undefined) f.cost = cost;
    }
    return;
  }
  existing.add(key);
  added++;
  features.push({
    id: 'aon-' + slug(tags[0] + '-' + name),
    name,
    origin: 'base',
    type,
    tags,
    classes: cls,
    desc,
    source,
    ...(minLevel ? { minLevel } : {}),
    ...(cost !== undefined ? { cost } : {}),
    ...extra,
  });
}

/** Legge le voci "DataList" di una pagina elenco di AoN, con il titolo del gruppo (h2) che le precede. */
function dataListEntries(file) {
  const h = read(file).replace(/<img[^>]*>/g, '');
  const out = [];
  const re = /<h2 class="title">(.*?)<\/h2>|<span id="MainContent_\w+?_LabelName_\d+">([\s\S]*?)<\/span>\s*<\/td>/g;
  let group = '';
  let m;
  while ((m = re.exec(h))) {
    if (m[1] !== undefined) {
      group = stripHtml(m[1]);
      continue;
    }
    const s = m[2];
    let name;
    let rest;
    let hm;
    if ((hm = /^\s*<h2 class="title">([\s\S]*?)<\/h2>/.exec(s))) {
      name = stripHtml(hm[1]);
      rest = s.slice(hm[0].length);
    } else if ((hm = /^\s*<(i|b)>([\s\S]*?)<\/\1>/.exec(s))) {
      name = stripHtml(hm[2]);
      rest = s.slice(hm[0].length);
    } else continue;
    const tm = /\((Su|Ex|Sp)\)/.exec(name + ' ' + rest.slice(0, 20));
    const type = tm ? tm[1].toLowerCase() : undefined;
    name = name.replace(/\s*\((Su|Ex|Sp)\)\s*/g, '').trim();
    const source = sourceFrom(rest);
    const desc = clean(
      rest
        .replace(/^\s*(\((Su|Ex|Sp)\)\s*)?\(<a[^>]*>\s*<i>[^<]*<\/i>\s*<\/a>(?:,\s*<a[^>]*>\s*<i>[^<]*<\/i>\s*<\/a>)*\)\s*:?\s*/, '')
        .replace(/<b>Source<\/b>[\s\S]*?<\/a>(?:,\s*<a[^>]*>[\s\S]*?<\/a>)*\s*(<br\s*\/?>)?/, ''),
    );
    out.push({ name, group, type, source, desc });
  }
  return out;
}
const levelOfGroup = (g) => {
  const m = /^(\d+)(?:st|nd|rd|th)-Level/i.exec(g);
  return m ? +m[1] : undefined;
};
const OPT = path.join(AON, 'options');
const LISTS = [
  { file: 'PaladinMercies', cls: ['Paladin'], tag: () => 'Mercy' },
  { file: 'MesmeristTricks', cls: ['Mesmerist'], tag: (g) => (/masterful/i.test(g) ? 'Masterful Trick' : 'Mesmerist Trick') },
  { file: 'MesmeristStares', cls: ['Mesmerist'], tag: (g) => (/devilbane/i.test(g) ? 'Devilbane Gaze' : 'Bold Stare') },
  { file: 'MonkUCKiPowers', cls: ['Monk (Unchained)'], tag: () => 'Ki Power' },
  { file: 'MonkUCStyleStrikes', cls: ['Monk (Unchained)'], tag: () => 'Style Strike' },
  { file: 'PhrenicAmplifications', cls: ['Psychic'], tag: (g) => (/major/i.test(g) ? 'Major Amplification' : 'Phrenic Amplification') },
  { file: 'SummonerEvolutions', cls: ['Summoner'], tag: () => 'Evolution', cost: (g) => +(/(\d)-Point/.exec(g)?.[1] ?? 0) || undefined },
  { file: 'SummonerUCEvolutions', cls: ['Summoner (Unchained)'], tag: () => 'Evolution', cost: (g) => +(/(\d)-Point/.exec(g)?.[1] ?? 0) || undefined },
  { file: 'EidolonUCSubtypes', cls: ['Summoner (Unchained)'], tag: () => 'Eidolon Subtype' },
  { file: 'WitchHexes', cls: ['Witch'], tag: (g) => (/grand/i.test(g) ? 'Grand Hex' : /major/i.test(g) ? 'Major Hex' : 'Hex') },
  { file: 'RogueTalents', cls: ['Rogue'], tag: (g) => (/advanced/i.test(g) ? 'Rogue Talent, Advanced' : 'Rogue Talent') },
  { file: 'NinjaTricks', cls: ['Ninja'], tag: (g) => (/master/i.test(g) ? 'Ninja Trick, Master' : 'Ninja Trick') },
  { file: 'MagusArcana', cls: ['Magus'], tag: () => 'Magus Arcana' },
  { file: 'InvestigatorTalents', cls: ['Investigator'], tag: () => 'Investigator Talent' },
  { file: 'VigilanteTalents', cls: ['Vigilante'], tag: (g) => (/social/i.test(g) ? 'Vigilante Social Talent' : 'Vigilante Talent') },
  { file: 'AlchemistDiscoveries', cls: ['Alchemist'], tag: () => 'Alchemist Discovery' },
  { file: 'OracleCurses', cls: ['Oracle'], tag: () => 'Curse' },
  { file: 'ShamanHexes', cls: ['Shaman'], tag: () => 'Hex' },
  { file: 'RogueUnchainedTalents', cls: ['Rogue (Unchained)'], tag: (g) => (/advanced/i.test(g) ? 'Rogue Talent, Advanced' : 'Rogue Talent') },
  { file: 'SlayerTalents', cls: ['Slayer'], tag: (g) => (/advanced/i.test(g) ? 'Slayer Talent, Advanced' : 'Slayer Talent') },
  { file: 'WitchPatrons', cls: ['Witch'], tag: () => 'Patron' },
];
for (const l of LISTS) {
  const file = path.join(OPT, l.file + '.html');
  if (!fs.existsSync(file)) continue;
  for (const e of dataListEntries(file)) {
    addFeature({
      name: e.name,
      cls: l.cls,
      tags: [l.tag(e.group)],
      desc: e.desc,
      source: e.source,
      type: e.type,
      minLevel: levelOfGroup(e.group) ?? minLevelOf(e.desc),
      cost: l.cost?.(e.group),
    });
  }
}
// Crudeltà dell'antipaladino (dal testo della classe)
{
  const t = stripHtml(read(path.join(AON, 'classes', 'Antipaladin.html')));
  const i = t.indexOf('Cruelty (Su)');
  const seg = t.slice(i, t.indexOf('These abilities are not cumulative', i));
  let lvl = 3;
  for (const part of seg.split(/(?=At \d+(?:st|nd|rd|th) level)/)) {
    const lm = /^At (\d+)/.exec(part);
    if (lm) lvl = +lm[1];
    for (const m of part.matchAll(/([A-Z][a-z]+): (The target[^.]*\.(?:[^A-Z]*?\.)?(?: The antipaladin must have the \w+ cruelty before selecting this cruelty\.)?)/g)) {
      addFeature({ name: m[1], cls: ['Antipaladin'], tags: ['Cruelty'], desc: `<p>${m[2]}</p>`, source: { book: 'Advanced Player\'s Guide', page: '119' }, minLevel: lvl });
    }
  }
}
// Pagine di dettaglio: focus emotivi del fantasma e scuole di impianto dell'occultista
const DET = path.join(OPT, 'detail');
for (const f of fs.existsSync(DET) ? fs.readdirSync(DET) : []) {
  if (!f.endsWith('.html')) continue;
  const h = read(path.join(DET, f)).replace(/<img[^>]*>/g, '');
  const i = h.indexOf('<h1 class="title">');
  if (i < 0) continue;
  const body = h.slice(i, h.indexOf('</span>', i));
  const name = stripHtml(body.slice(0, body.indexOf('</h1>')));
  const source = sourceFrom(body);
  const content = clean(body.slice(body.indexOf('</h1>') + 5).replace(/<b>Source<\/b>[\s\S]*?<\/a>(?:,\s*<a[^>]*>[\s\S]*?<\/a>)*\s*(<br\s*\/?>)?/, ''));
  if (f.startsWith('PhantomFocus')) {
    addFeature({ name, cls: ['Spiritualist'], tags: ['Emotional Focus'], desc: content, source });
  } else if (f.startsWith('OccultistImplements')) {
    const school = name.replace(/ Implements?$/, '');
    addFeature({ name: `${school} Implement School`, cls: ['Occultist'], tags: ['Implement School'], desc: content, source });
    // Ogni potere: <i>Nome (Su)</i>: testo, dentro le sezioni Base Focus Power / Focus Powers
    const sections = content.split(/<b>(Resonant Power|Base Focus Power|Focus Powers)<\/b>/);
    for (let k = 1; k < sections.length; k += 2) {
      const kind = sections[k];
      if (kind === 'Resonant Power') continue;
      for (const m of sections[k + 1].matchAll(/<i>([^<]+?)\s*\((Su|Ex|Sp)\)<\/i>\s*:\s*([\s\S]*?)(?=<br\s*\/?>\s*<br\s*\/?>\s*<i>|$)/g)) {
        addFeature({
          name: m[1].trim(),
          cls: ['Occultist'],
          tags: [kind === 'Base Focus Power' ? 'Base Focus Power' : 'Focus Power', `${school} Implement`],
          desc: `<p>${clean(m[3])}</p>`,
          source,
          type: m[2].toLowerCase(),
          minLevel: minLevelOf(m[3]),
        });
      }
    }
  }
}
// Livelli minimi fissati dalle regole di classe
for (const f of features) {
  if (f.tags?.includes('Masterful Trick')) f.minLevel = 12;
  if (f.tags?.includes('Major Amplification')) f.minLevel = 11;
}
// Livello minimo dichiarato nel testo per tutti i privilegi a scelta
for (const f of features) if (!f.minLevel && f.tags?.length) {
  const ml = minLevelOf(f.desc);
  if (ml && ml > 1) f.minLevel = ml;
}
console.log(`  privilegi aggiunti da AoN: ${added}`);
writeJson('features.json', features);

// Scoperte arcane come talenti (si scelgono al posto di un talento o di un talento bonus da mago)
{
  const feats = readJson('feats.json').filter((f) => !f.id.startsWith('arcane-discovery-'));
  const names = new Set(feats.map((f) => f.name.toLowerCase()));
  let n = 0;
  for (const e of dataListEntries(path.join(OPT, 'WizardArcaneDiscoveries.html'))) {
    if (names.has(e.name.toLowerCase())) continue;
    const ml = minLevelOf(e.desc);
    feats.push({
      id: 'arcane-discovery-' + slug(e.name),
      name: e.name,
      types: ['Arcane Discovery'],
      prereqText: ml ? `Wizard level ${ml}` : 'Wizard level 1',
      prereq: [{ t: 'class', c: 'wizard', v: ml ?? 1 }],
      summary: stripHtml(e.desc).slice(0, 110),
      benefit: e.desc,
      source: e.source,
    });
    n++;
  }
  feats.sort((a, b) => a.name.localeCompare(b.name));
  console.log(`  scoperte arcane: ${n}`);
  writeJson('feats.json', feats);
}

// =================================================================== Oggetti magici
console.log('Oggetti magici…');
const ITEMS = path.join(AON, 'magic', 'items');
const linkMap = fs.existsSync(path.join(ITEMS, 'index.json')) ? JSON.parse(fs.readFileSync(path.join(ITEMS, 'index.json'), 'utf8')) : {};
const gear = readJson('gear.json').filter((g) => g.type !== 'magic');
const foundryByName = new Map(gear.filter((g) => g.changes).map((g) => [g.name.toLowerCase(), g]));
const parsePrice = (s) => {
  const m = /([\d,]+(?:\.\d+)?)\s*gp/.exec(s ?? '');
  return m ? parseFloat(m[1].replace(/,/g, '')) : 0;
};
const parseWeight = (s) => {
  const m = /([\d.\/]+)\s*lbs?/.exec(s ?? '');
  if (!m) return 0;
  if (m[1].includes('/')) {
    const [a, b] = m[1].split('/');
    return +a / +b;
  }
  return +m[1] || 0;
};
const detailCache = new Map();
function detail(file) {
  if (detailCache.has(file)) return detailCache.get(file);
  const full = path.join(ITEMS, file);
  if (!fs.existsSync(full)) return null;
  const h = read(full).replace(/<img[^>]*>/g, '');
  const i = h.indexOf('<h1 class="title">');
  const body = h.slice(i, h.indexOf('</span>', i));
  const head = body.slice(0, body.indexOf('<h3'));
  const field = (k) => {
    const m = new RegExp(`<b>${k}</b>\\s*([^<]*)`, 'i').exec(head);
    return m ? stripHtml(m[1]).replace(/;\s*$/, '').trim() : undefined;
  };
  const descM = /<h3 class="framing">Description<\/h3>([\s\S]*?)(?=<h3 class="framing">|$)/.exec(body);
  const consM = /<h3 class="framing">Construction<\/h3>([\s\S]*)$/.exec(body);
  const d = {
    title: stripHtml(body.slice(0, body.indexOf('</h1>'))),
    aura: field('Aura'),
    cl: parseInt(field('CL') ?? '', 10) || undefined,
    slot: field('Slot'),
    priceText: field('Price'),
    weight: parseWeight(field('Weight')),
    desc: clean(descM ? descM[1] : body.slice(body.indexOf('</h1>') + 5)),
    construction: consM ? stripHtml(consM[1]) : undefined,
    source: sourceFrom(head),
  };
  detailCache.set(file, d);
  return d;
}

// Bonus automatici per gli oggetti più comuni (oltre a quelli già presenti nel compendio Foundry)
const ABILITY_ITEMS = [
  [/^Belt of Giant Strength/i, ['str']], [/^Belt of Incredible Dexterity/i, ['dex']], [/^Belt of Mighty Constitution/i, ['con']],
  [/^Belt of Physical Perfection/i, ['str', 'dex', 'con']], [/^Headband of Vast Intelligence/i, ['int']], [/^Headband of Inspired Wisdom/i, ['wis']],
  [/^Headband of Alluring Charisma/i, ['cha']], [/^Headband of Mental Superiority/i, ['int', 'wis', 'cha']],
];
function itemChanges(name, desc) {
  const plus = +(/\+(\d)\b/.exec(name)?.[1] ?? 0);
  const out = [];
  for (const [re, abil] of ABILITY_ITEMS) if (re.test(name) && plus) abil.forEach((a) => out.push({ formula: String(plus), target: a, type: 'enh' }));
  if (/^Cloak of Resistance/i.test(name) && plus) out.push({ formula: String(plus), target: 'allSavingThrows', type: 'resist' });
  if (/^Ring of Protection/i.test(name) && plus) out.push({ formula: String(plus), target: 'ac', type: 'deflection' });
  if (/^Amulet of Natural Armor/i.test(name) && plus) out.push({ formula: String(plus), target: 'nac', type: 'enh' });
  if (/^Bracers of Armor/i.test(name) && plus) out.push({ formula: String(plus), target: 'aac', type: 'armor' });
  if (/^Stone of Good Luck|^Luckstone/i.test(name)) out.push({ formula: '1', target: 'allSavingThrows', type: 'luck' });
  if (out.length) return out;
  // Bonus incondizionati alle abilità ("+5 competence bonus on Stealth checks")
  const text = stripHtml(desc);
  for (const m of text.matchAll(/\+(\d+) (competence|circumstance|enhancement|insight|luck|morale|resistance|sacred|profane) bonus on ([A-Z][\w ()]+?) checks(?=[.,;]| and )/g)) {
    for (const part of m[3].split(/,\s*|\s+and\s+/)) {
      const k = SKILL_NAME_TO_KEY[part.trim().toLowerCase()];
      if (k) out.push({ formula: m[1], target: `skill.${k}`, type: m[2] === 'enhancement' ? 'enh' : m[2] === 'resistance' ? 'resist' : m[2] });
    }
  }
  return out;
}

const CATEGORY_OF_PAGE = { MagicWondrousDisplay: 'wondrous', MagicRingsDisplay: 'ring', MagicRodsDisplay: 'rod', MagicStavesDisplay: 'staff', MagicArmorDisplay: 'armor', MagicWeaponsDisplay: 'weapon', MagicPotionsDisplay: 'potion' };
const magicAbilities = [];
const magicItems = [];
const seen = new Set();
for (const idxFile of fs.readdirSync(path.join(AON, 'magic', 'idx'))) {
  const $ = cheerio.load(read(path.join(AON, 'magic', 'idx', idxFile)));
  const quality = /Quality/.exec(idxFile) ? (/Shield/.test(idxFile) ? 'shield' : /Armor/.test(idxFile) ? 'armor' : /Ranged/.test(idxFile) ? 'ranged' : 'melee') : null;
  $('tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (tds.length < 2) return;
    const a = $(tds[0]).find('a[href]');
    const href = a.attr('href');
    if (!href || !linkMap[href]) return;
    const name = $(tds[0]).text().replace(/\s+/g, ' ').trim();
    const costTxt = $(tds[tds.length - 1]).text().trim();
    const d = detail(linkMap[href]);
    if (!d) return;
    const page = href.split('.aspx')[0];
    if (quality) {
      const bonus = /^\+(\d+) bonus/.exec(costTxt);
      const key = `${quality}|${name}`;
      if (seen.has(key)) return;
      seen.add(key);
      magicAbilities.push({
        id: slug(`${quality}-${name}`),
        name,
        kind: quality === 'melee' || quality === 'ranged' ? 'weapon' : quality,
        ranged: quality === 'ranged' ? true : undefined,
        bonus: bonus ? +bonus[1] : undefined,
        flat: bonus ? undefined : parsePrice(costTxt) || undefined,
        aura: d.aura,
        cl: d.cl,
        desc: d.desc,
        source: d.source,
      });
      return;
    }
    const key = `${page}|${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    const foundry = foundryByName.get(name.toLowerCase());
    const changes = foundry?.changes ?? itemChanges(name, d.desc);
    const slot = (d.slot ?? '').toLowerCase();
    magicItems.push({
      id: 'aon-' + slug(page.replace('Magic', '').replace('Display', '') + '-' + name),
      name,
      type: 'magic',
      subType: CATEGORY_OF_PAGE[page] ?? 'other',
      slot: slot && slot !== 'none' ? slot : undefined,
      price: parsePrice(costTxt) || parsePrice(d.priceText),
      weight: d.weight,
      cl: d.cl,
      aura: d.aura,
      changes: changes.length ? changes : undefined,
      desc: d.desc + (d.construction ? `<p><b>Construction</b>: ${d.construction}</p>` : ''),
      source: d.source,
    });
  });
}
// Il catalogo AoN sostituisce gli oggetti magici Foundry con lo stesso nome
const magicNames = new Set(magicItems.map((m) => m.name.toLowerCase()));
const gearOut = [...gear.filter((g) => !(g.subType === 'wondrous' && magicNames.has(g.name.toLowerCase()))), ...magicItems];
console.log(`  oggetti magici: ${magicItems.length} (con bonus automatici: ${magicItems.filter((m) => m.changes).length}); proprietà speciali: ${magicAbilities.length}`);
writeJson('gear.json', gearOut);
writeJson('magicAbilities.json', magicAbilities.sort((a, b) => a.name.localeCompare(b.name)));
writeJson('books.json', books.sort((a, b) => a.name.localeCompare(b.name)));
