import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type AnatomyPage = {
  label: string;
  url: string;
  title: string;
  type: string;
  retrievals: number;
  citations: number;
  author: string;
  published: string;
  modified: string;
  schema: string;
};

export type Lifted = { chat: string; answer: string; page: string };

export type Anatomy = {
  slug: string;
  title: string;
  window: string;
  pages: { a: AnatomyPage; b: AnatomyPage };
  verdict: string;
  metrics: { metric: string; a: string; b: string; note: string }[];
  skeleton: { a: string[]; b: string[] };
  lifted: { a: Lifted[]; b: Lifted[] };
  diagnosis: string[];
  spec: string[];
};

const DIR = path.join(process.cwd(), 'data', 'anatomy');

export function listAnatomies(): Anatomy[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(path.join(DIR, f), 'utf8')) as Anatomy);
}

export function getAnatomy(slug: string): Anatomy | null {
  try {
    return JSON.parse(readFileSync(path.join(DIR, `${slug}.json`), 'utf8')) as Anatomy;
  } catch {
    return null;
  }
}
