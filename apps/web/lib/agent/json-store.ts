import * as fs from 'fs/promises';
import * as path from 'path';

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      console.warn(`[JSON Store] Failed to read ${filePath}:`, error);
    }
    return fallback;
  }
}

export async function writeJsonFile<T>(filePath: string, value: T): Promise<void> {
  const directory = path.dirname(filePath);
  const tempPath = `${filePath}.tmp`;

  try {
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(tempPath, JSON.stringify(value, null, 2), 'utf8');
    await fs.rename(tempPath, filePath);
  } catch (error) {
    console.warn(`[JSON Store] Failed to write ${filePath}:`, error);
    throw error;
  }
}
