import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { goldenItemGroupSchema } from '@/testing/golden/item.schema';
import type { GoldenItem } from '@/testing/golden/types';

export async function loadGoldenItems(directory: string): Promise<readonly GoldenItem[]> {
  const files = await jsonFiles(directory);
  const groups = await Promise.all(files.map((file) => readGroup(file)));
  const items = groups.flat();
  const ids = new Set(items.map((item) => item.id));
  if (ids.size !== items.length) throw new Error('Content golden item ids must be unique');
  return items;
}

async function jsonFiles(directory: string): Promise<readonly string[]> {
  const subjects = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const subject of subjects) {
    if (!subject.isDirectory()) continue;
    const subjectDirectory = join(directory, subject.name);
    for (const entry of await readdir(subjectDirectory, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.json'))
        files.push(join(subjectDirectory, entry.name));
    }
  }
  return files.sort();
}

async function readGroup(filePath: string): Promise<readonly GoldenItem[]> {
  const input: unknown = JSON.parse(await readFile(filePath, 'utf8'));
  const parsed = goldenItemGroupSchema.safeParse(input);
  if (!parsed.success)
    throw new Error(`Invalid content golden file ${filePath}: ${parsed.error.message}`);
  return parsed.data;
}
