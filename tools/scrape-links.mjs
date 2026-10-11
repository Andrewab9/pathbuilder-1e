// Scarica (con cache) tutte le pagine di dettaglio linkate da un insieme di pagine indice di AoN.
// Uso: node tools/scrape-links.mjs <outDir> <regexLink> <indice1.html> [indice2.html …]
// Esempio regexLink: "Magic\\w+Display\\.aspx\\?\\w+="
// Il file salvato si chiama <pagina>__<valore del parametro>.html; un file index.json mappa link -> file.
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const [, , outDir, linkRe, ...indexFiles] = process.argv;
const re = new RegExp('^' + linkRe);
const links = new Set();
for (const f of indexFiles) {
  const $ = cheerio.load(fs.readFileSync(f, 'utf8'));
  $('a[href]').each((_, a) => {
    const h = $(a).attr('href');
    if (re.test(h)) links.add(h);
  });
}
fs.mkdirSync(outDir, { recursive: true });
const fileFor = (href) => {
  const [page, q] = href.split('?');
  const v = decodeURIComponent((q ?? '').split('=').slice(1).join('='));
  return page.replace(/\.aspx$/, '') + '__' + v.replace(/[^a-zA-Z0-9 ,'()+-]/g, '_').slice(0, 150) + '.html';
};
const map = {};
for (const l of links) map[l] = fileFor(l);
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(map, null, 1));
const valid = (f) => fs.existsSync(f) && fs.statSync(f).size > 2000 && fs.readFileSync(f, 'latin1').includes('<h1 class="title">');
const todo = [...links].filter((l) => !valid(path.join(outDir, map[l])));
console.log(`${links.size} link, ${todo.length} da scaricare`);
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
let done = 0;
let failed = 0;
async function worker() {
  while (todo.length) {
    const l = todo.shift();
    const [page, q] = l.split('?');
    const [k, ...rest] = q.split('=');
    const url = `https://aonprd.com/${page}?${k}=${enc(rest.join('='))}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Pathbuilder data import)' } });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const buf = Buffer.from(await r.arrayBuffer());
        if (!buf.toString('latin1').includes('<h1 class="title">')) throw new Error('pagina vuota');
        fs.writeFileSync(path.join(outDir, map[l]), buf);
        break;
      } catch (e) {
        if (attempt === 2) {
          failed++;
          console.log('FAIL', l, e.message);
        } else await new Promise((r) => setTimeout(r, 2000));
      }
    }
    if (++done % 250 === 0) console.log(done, 'scaricate');
    await new Promise((r) => setTimeout(r, 120));
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
console.log('fine; falliti:', failed);
