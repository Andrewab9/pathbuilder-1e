// Genera build/icon.png (512x512) dall'SVG usando Electron. Uso: npx electron tools/make-icon.cjs
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
app.whenReady().then(async () => {
  const svg = fs.readFileSync(path.join(__dirname, '../build/icon.svg'), 'utf8');
  const win = new BrowserWindow({ width: 512, height: 512, show: false, frame: false, transparent: true, webPreferences: { offscreen: true } });
  await win.loadURL('data:text/html,' + encodeURIComponent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`));
  await new Promise((r) => setTimeout(r, 300));
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 });
  fs.writeFileSync(path.join(__dirname, '../build/icon.png'), img.resize({ width: 512, height: 512 }).toPNG());
  console.log('icona creata');
  app.quit();
});
