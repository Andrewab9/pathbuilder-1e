import fs from 'node:fs';
import path from 'node:path';
import { loadDatabase, type Database } from '@/data/db';

const dir = path.resolve(__dirname, '../src/renderer/public/data');

export function loadDb(): Promise<Database> {
  (globalThis as unknown as { window: unknown }).window = {
    api: { readData: async (n: string) => fs.readFileSync(path.join(dir, n), 'utf8') },
  };
  return loadDatabase();
}
