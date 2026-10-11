// Utility condivise dagli script di importazione dati.
import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const RAW = path.join(ROOT, 'data-raw');
export const OUT = path.join(ROOT, 'src', 'renderer', 'public', 'data');

export function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.yaml')) out.push(p);
  }
  return out;
}

/** Carica tutti i documenti YAML di un pack Foundry, scartando le cartelle. */
export function loadPack(dir) {
  return walk(dir)
    .map((f) => yaml.load(fs.readFileSync(f, 'utf8')))
    .filter((d) => d && d.type !== 'Item' && d.name && !d._key?.startsWith('!folders'));
}

export function writeJson(name, data) {
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, name);
  fs.writeFileSync(file, JSON.stringify(data));
  const kb = (fs.statSync(file).size / 1024).toFixed(0);
  console.log(`  ${name}: ${Array.isArray(data) ? data.length + ' voci, ' : ''}${kb} KB`);
}

/** Pulisce l'HTML di Foundry: risolve i link @UUID/@Compendium e rimuove inline roll. */
export function cleanHtml(html) {
  if (!html) return '';
  return String(html)
    // I blocchi @Embed incorporano altri documenti (mostrati a parte dall'app)
    .replace(/<p>\s*@Embed\[[^\]]*\](?:\{[^}]*\})?\s*<\/p>/g, '')
    .replace(/@Embed\[[^\]]*\](?:\{[^}]*\})?/g, '')
    .replace(/@(?:UUID|Compendium)\[[^\]]*\]\{([^}]*)\}/g, '<em class="ref">$1</em>')
    .replace(/@(?:UUID|Compendium)\[([^\]]*)\]/g, (_, p) => `<em class="ref">${p.split('.').pop()}</em>`)
    .replace(/\[\[\/?\w*\s*([^\]]*)\]\](?:\{([^}]*)\})?/g, (_, f, label) => label || f)
    .replace(/<img[^>]*>/g, '')
    .replace(/\s+style="[^"]*"/g, '')
    .replace(/\n/g, ' ')
    .trim();
}

export function stripHtml(html) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&times;/g, '×')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function slug(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Chiavi brevi delle abilità usate da Foundry; mappa anche i nomi lunghi.
export const SKILL_LONG = {
  acrobatics: 'acr', appraise: 'apr', artistry: 'art', bluff: 'blf', climb: 'clm', craft: 'crf',
  diplomacy: 'dip', disableDevice: 'dev', disguise: 'dis', escapeArtist: 'esc', fly: 'fly',
  handleAnimal: 'han', heal: 'hea', intimidate: 'int', 'knowledge.arcana': 'kar',
  'knowledge.dungeoneering': 'kdu', 'knowledge.engineering': 'ken', 'knowledge.geography': 'kge',
  'knowledge.history': 'khi', 'knowledge.local': 'klo', 'knowledge.nature': 'kna',
  'knowledge.nobility': 'kno', 'knowledge.planes': 'kpl', 'knowledge.religion': 'kre',
  linguistics: 'lin', lore: 'lor', perception: 'per', perform: 'prf', profession: 'pro', ride: 'rid',
  senseMotive: 'sen', sleightOfHand: 'slt', spellcraft: 'spl', stealth: 'ste', survival: 'sur',
  swim: 'swm', useMagicDevice: 'umd',
};
export const KNOWLEDGE = ['kar', 'kdu', 'ken', 'kge', 'khi', 'klo', 'kna', 'kno', 'kpl', 'kre'];
const SHORT = new Set(Object.values(SKILL_LONG));

export function normSkills(list) {
  const out = new Set();
  for (const s of list ?? []) {
    if (s === 'knowledge') KNOWLEDGE.forEach((k) => out.add(k));
    else if (SKILL_LONG[s]) out.add(SKILL_LONG[s]);
    else if (SHORT.has(s)) out.add(s);
  }
  return [...out];
}

/** Normalizza il target di una "change" Foundry (skill.perception -> skill.per). */
export function normChange(c) {
  let target = c.target;
  const m = /^skill\.(.+)$/.exec(target ?? '');
  if (m && SKILL_LONG[m[1]]) target = 'skill.' + SKILL_LONG[m[1]];
  else if (m && m[1] === 'knowledge') target = 'skill.knowledge';
  return { formula: String(c.formula ?? '0'), target, type: c.type ?? 'untyped', ...(c.operator && c.operator !== 'add' ? { op: c.operator } : {}) };
}

export function changesOf(sys) {
  return Object.values(sys?.changes ?? {}).filter((c) => c && c.target).map(normChange);
}

export function sourceOf(sys) {
  const s = (sys?.sources ?? [])[0];
  return s ? { id: s.id ?? s.title ?? '', page: s.pages ? String(s.pages) : undefined } : undefined;
}

export function idFromUuid(uuid) {
  return String(uuid ?? '').split('.').pop();
}

// Windows-1252 per i byte 0x80-0x9F (gli altri coincidono con Latin-1).
const CP1252 = { 0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ' };

/** Decodifica le pagine di AoN, che mescolano sequenze UTF-8 valide e singoli byte Windows-1252. */
export function decodeMixed(buf) {
  let out = '';
  for (let i = 0; i < buf.length; ) {
    const b = buf[i];
    if (b < 0x80) { out += String.fromCharCode(b); i++; continue; }
    const len = b >= 0xf0 && b < 0xf8 ? 4 : b >= 0xe0 ? 3 : b >= 0xc2 && b < 0xe0 ? 2 : 0;
    let ok = len > 0 && i + len <= buf.length;
    for (let k = 1; ok && k < len; k++) ok = (buf[i + k] & 0xc0) === 0x80;
    if (ok) { out += buf.subarray(i, i + len).toString('utf8'); i += len; }
    else { out += CP1252[b] ?? String.fromCharCode(b); i++; }
  }
  return out;
}
