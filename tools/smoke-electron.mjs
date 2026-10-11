// Test di fumo dell'app Electron compilata (out/), pilotata via Chrome DevTools Protocol.
// Uso: npx electron-vite build && node tools/smoke-electron.mjs [cartellaOutput]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import electronPath from 'electron';

const outDir = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'pathbuilder-smoke-'));
const charsDir = path.join(outDir, 'personaggi');
fs.mkdirSync(charsDir, { recursive: true });
// Personaggio di prova completo, per verificare scheda e PDF
fs.copyFileSync(path.join(import.meta.dirname, '../tests/fixtures/valeros.json'), path.join(charsDir, 'fixture-valeros.json'));
fs.copyFileSync(path.join(import.meta.dirname, '../tests/fixtures/kalesh.json'), path.join(charsDir, 'fixture-kalesh.json'));
const port = 9333;
// SMOKE_EXE permette di testare l'eseguibile pacchettizzato (release/win-unpacked)
const exe = process.env.SMOKE_EXE;
const proc = spawn(exe || electronPath, [...(exe ? [] : ['.']), `--remote-debugging-port=${port}`], {
  env: { ...process.env, PATHBUILDER_CHARACTERS_DIR: charsDir, PATHBUILDER_PDF_PATH: path.join(outDir, 'scheda.pdf'), ELECTRON_RENDERER_URL: '' },
  stdio: 'pipe',
});
proc.stderr.on('data', (d) => process.env.DEBUG && process.stderr.write(d));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let target;
for (let i = 0; i < 40 && !target; i++) {
  await sleep(500);
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    target = list.find((t) => t.type === 'page');
  } catch {
    /* non ancora pronto */
  }
}
if (!target) throw new Error('Finestra Electron non trovata');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
const errors = [];
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
});
const send = (method, params = {}) =>
  new Promise((r) => {
    const mid = ++id;
    pending.set(mid, r);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const clickText = (text) =>
  evaluate(`(() => { const el = [...document.querySelectorAll('button')].find(b => b.textContent.trim().includes(${JSON.stringify(text)})); if (!el) return false; el.click(); return true; })()`);
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outDir, name), Buffer.from(r.result.data, 'base64'));
};

await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

const results = [];
const check = (name, ok) => results.push(`${ok ? 'OK  ' : 'FAIL'} ${name}`);

for (let i = 0; i < 30; i++) {
  if (await evaluate(`document.body.innerText.includes('I tuoi personaggi')`)) break;
  await sleep(300);
}
check('caricamento dati e home', await evaluate(`document.body.innerText.includes('I tuoi personaggi')`));
check('API preload disponibile', await evaluate(`typeof window.api?.readData === 'function'`));
await shot('01-home.png');

check('crea personaggio', await clickText('Nuovo personaggio'));
await sleep(800);
check('builder aperto', await evaluate(`document.body.innerText.includes('Dettagli del personaggio')`));
check('salvataggio su disco', fs.readdirSync(charsDir).some((f) => f.endsWith('.json')));

for (const step of ['Razza', 'Caratteristiche', 'Classi e livelli', 'Privilegi', 'Abilità', 'Talenti', 'Tratti', 'Incantesimi', 'Equipaggiamento', 'Scheda']) {
  const ok = await evaluate(`(() => { const el = [...document.querySelectorAll('nav button')].find(b => b.textContent.includes(${JSON.stringify(step)})); if (!el) return false; el.click(); return true; })()`);
  await sleep(300);
  check(`step ${step}`, ok);
}
await shot('02-scheda.png');

// Apre il personaggio di prova ed esporta la sua scheda
await clickText('Tutti i personaggi');
await sleep(300);
await evaluate("[...document.querySelectorAll('div')].find(d => d.className.includes('cursor-pointer') && d.textContent.includes('Valeros'))?.click()");
await sleep(800);
check('scheda del personaggio di prova', await evaluate("document.body.innerText.includes('Two-Handed Fighter') && document.body.innerText.includes('Greatsword +1')"));
await shot('03-valeros.png');
check('esportazione PDF', (await evaluate("window.api.exportPdf('scheda')")) === true && fs.statSync(path.join(outDir, 'scheda.pdf')).size > 10000);
// Cineta di prova: schermata dei talenti selvaggi
await clickText('Tutti i personaggi');
await sleep(300);
await evaluate("[...document.querySelectorAll('div')].find(d => d.className.includes('cursor-pointer') && d.textContent.includes('Kalesh'))?.click()");
await sleep(800);
await evaluate("[...document.querySelectorAll('nav button')].find(b => b.textContent.includes('Talenti selvaggi'))?.click()");
await sleep(500);
check(
  'talenti selvaggi del cineta',
  await evaluate("['Fire Blast', 'Magma Blast', '8d6+17', 'Kinetic Blade', 'Searing Flesh', 'Basic Geokinesis'].every((t) => document.body.innerText.includes(t))"),
);
await shot('05-cineta.png');
// Anteprima del layout di stampa
await send('Emulation.setEmulatedMedia', { media: 'print' });
await send('Emulation.setDeviceMetricsOverride', { width: 794, height: 1123, deviceScaleFactor: 1, mobile: false });
await sleep(300);
const h = await evaluate('document.documentElement.scrollHeight');
const ps = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: 794, height: h, scale: 1 } });
fs.writeFileSync(path.join(outDir, '04-stampa.png'), Buffer.from(ps.result.data, 'base64'));
check('nessun errore JavaScript', errors.length === 0);

console.log(results.join('\n'));
if (errors.length) console.log('Errori:\n' + errors.join('\n'));
console.log('Output in', outDir);
ws.close();
proc.kill();
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
