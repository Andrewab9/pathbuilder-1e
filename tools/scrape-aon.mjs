// Scarica (con cache su disco) le pagine di dettaglio da Archives of Nethys.
// Uso: node tools/scrape-aon.mjs <indexFile> <linkPrefix> <outDir> [concorrenza]
// Le pagine già scaricate e valide (con <h1 class="title">) vengono saltate.
import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const [, , indexFile, prefix, outDir, concArg] = process.argv;
// indexFile può essere una pagina HTML indice oppure un .txt con un nome per riga.
let names;
if (indexFile.endsWith('.txt')) names = fs.readFileSync(indexFile, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
else {
  const $ = cheerio.load(fs.readFileSync(indexFile, 'utf8'));
  names = [...new Set($(`a[href^="${prefix}"]`).toArray().map((a) => $(a).attr('href').slice(prefix.length)))];
}
fs.mkdirSync(outDir, { recursive: true });
const safeName = (n) => n.replace(/[^a-zA-Z0-9 ,'()-]/g, '_') + '.html';
const valid = (f) => fs.existsSync(f) && fs.readFileSync(f, 'latin1').includes('<h1 class="title">');
const todo = names.filter((n) => !valid(path.join(outDir, safeName(n))));
console.log(`${names.length} voci, ${todo.length} da scaricare`);
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
let done = 0;
let failed = 0;
async function worker() {
  while (todo.length) {
    const n = todo.shift();
    const url = 'https://aonprd.com/' + prefix + enc(n);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Pathbuilder data import)' } });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        // Salva i byte grezzi: AoN mescola UTF-8 e Windows-1252, la decodifica avviene dopo.
        const buf = Buffer.from(await r.arrayBuffer());
        if (!buf.toString('latin1').includes('<h1 class="title">')) throw new Error('pagina vuota');
        fs.writeFileSync(path.join(outDir, safeName(n)), buf);
        break;
      } catch (e) {
        if (attempt === 2) {
          failed++;
          console.log('FAIL', n, e.message);
        } else await new Promise((r) => setTimeout(r, 2000));
      }
    }
    if (++done % 200 === 0) console.log(done, 'scaricate');
    await new Promise((r) => setTimeout(r, 150));
  }
}
await Promise.all(Array.from({ length: +(concArg || 4) }, worker));
console.log('fine; falliti:', failed);
