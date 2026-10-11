import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

const isDev = !app.isPackaged && !!process.env.ELECTRON_RENDERER_URL;
// La cartella può essere cambiata con PATHBUILDER_CHARACTERS_DIR (utile per test o installazioni portatili)
const charactersDir = () => process.env.PATHBUILDER_CHARACTERS_DIR || path.join(app.getPath('documents'), 'Pathbuilder 1e', 'Personaggi');
// In sviluppo i dati sono serviti da Vite (public/), nell'app compilata sono accanto all'index.html
const dataDir = () => (isDev ? path.join(app.getAppPath(), 'src/renderer/public/data') : path.join(__dirname, '../renderer/data'));

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#0f1115',
    title: 'Pathbuilder 1e',
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
    },
  });
  win.once('ready-to-show', () => win?.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  if (isDev) win.loadURL(process.env.ELECTRON_RENDERER_URL!);
  else win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

const safeId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '');

ipcMain.handle('data:read', async (_e, name: string) => {
  return fs.readFile(path.join(dataDir(), path.basename(name)), 'utf8');
});

ipcMain.handle('chars:list', async () => {
  await fs.mkdir(charactersDir(), { recursive: true });
  const files = (await fs.readdir(charactersDir())).filter((f) => f.endsWith('.json'));
  const out = [];
  for (const f of files) {
    try {
      out.push(JSON.parse(await fs.readFile(path.join(charactersDir(), f), 'utf8')));
    } catch {
      /* file corrotto: lo ignoriamo */
    }
  }
  return out;
});

ipcMain.handle('chars:save', async (_e, char: { id: string }) => {
  await fs.mkdir(charactersDir(), { recursive: true });
  const file = path.join(charactersDir(), safeId(char.id) + '.json');
  await fs.writeFile(file + '.tmp', JSON.stringify(char, null, 2), 'utf8');
  await fs.rename(file + '.tmp', file);
  return true;
});

ipcMain.handle('chars:delete', async (_e, id: string) => {
  await fs.rm(path.join(charactersDir(), safeId(id) + '.json'), { force: true });
  return true;
});

ipcMain.handle('chars:openFolder', async () => {
  await fs.mkdir(charactersDir(), { recursive: true });
  await shell.openPath(charactersDir());
});

ipcMain.handle('chars:export', async (_e, char: { name?: string }) => {
  const res = await dialog.showSaveDialog(win!, {
    title: 'Esporta personaggio',
    defaultPath: `${char.name || 'personaggio'}.pf1.json`,
    filters: [{ name: 'Personaggio Pathbuilder', extensions: ['json'] }],
  });
  if (res.canceled || !res.filePath) return false;
  await fs.writeFile(res.filePath, JSON.stringify(char, null, 2), 'utf8');
  return true;
});

ipcMain.handle('chars:import', async () => {
  const res = await dialog.showOpenDialog(win!, {
    title: 'Importa personaggio',
    properties: ['openFile'],
    filters: [{ name: 'Personaggio Pathbuilder', extensions: ['json'] }],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  return JSON.parse(await fs.readFile(res.filePaths[0], 'utf8'));
});

ipcMain.handle('pdf:export', async (_e, name: string) => {
  if (!win) return false;
  // PATHBUILDER_PDF_PATH salta la finestra di dialogo (usato dai test automatici)
  const res = process.env.PATHBUILDER_PDF_PATH
    ? { canceled: false, filePath: process.env.PATHBUILDER_PDF_PATH }
    : await dialog.showSaveDialog(win, {
        title: 'Esporta scheda PDF',
        defaultPath: `${name || 'scheda'}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
  if (res.canceled || !res.filePath) return false;
  const pdf = await win.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
  });
  await fs.writeFile(res.filePath, pdf);
  if (!process.env.PATHBUILDER_PDF_PATH) shell.openPath(res.filePath);
  return true;
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
