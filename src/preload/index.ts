import { contextBridge, ipcRenderer } from 'electron';

const api = {
  readData: (name: string): Promise<string> => ipcRenderer.invoke('data:read', name),
  listCharacters: (): Promise<unknown[]> => ipcRenderer.invoke('chars:list'),
  saveCharacter: (c: unknown): Promise<boolean> => ipcRenderer.invoke('chars:save', c),
  deleteCharacter: (id: string): Promise<boolean> => ipcRenderer.invoke('chars:delete', id),
  exportCharacter: (c: unknown): Promise<boolean> => ipcRenderer.invoke('chars:export', c),
  importCharacter: (): Promise<unknown | null> => ipcRenderer.invoke('chars:import'),
  openCharactersFolder: (): Promise<void> => ipcRenderer.invoke('chars:openFolder'),
  exportPdf: (name: string): Promise<boolean> => ipcRenderer.invoke('pdf:export', name),
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
