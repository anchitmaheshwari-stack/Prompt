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

export type Playbook = { bucket: string; use_when: string; blueprint: string[]; evidence: string[] };

export type Anatomy = {
  slug: string;
  bucket?: string;
  title: string;
  window: string;
  pages: { a: AnatomyPage; b: AnatomyPage };
  verdict: string;
  metrics: { metric: string; a: string; b: string; note: string }[];
  skeleton: { a: string[]; b: string[] };
  lifted: { a: Lifted[]; b: Lifted[] };
  diagnosis: string[];
  spec: string[];
  playbook?: Playbook;
  /** True when the bucket only exists on branded prompts; kept for reference, excluded from the unbranded playbook. */
  branded_only?: boolean;
};

const DIR = path.join(process.cwd(), 'data', 'anatomy');

/** Display order of the buckets. Anything not listed sorts last, alphabetically. */
export const BUCKET_ORDER = [
  'how-to-guide',
  'wise-alternatives',
  'x-vs-y-comparison',
  'persona-guide',
  'corridor-guide',
  'compliance-reference',
  'vendor-product-page',
];

export function listAnatomies(): Anatomy[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(path.join(DIR, f), 'utf8')) as Anatomy)
    .sort((x, y) => {
      const ix = BUCKET_ORDER.indexOf(x.slug);
      const iy = BUCKET_ORDER.indexOf(y.slug);
      if (ix === -1 && iy === -1) return x.slug.localeCompare(y.slug);
      if (ix === -1) return 1;
      if (iy === -1) return -1;
      return ix - iy;
    });
}

export function getAnatomy(slug: string): Anatomy | null {
  try {
    return JSON.parse(readFileSync(path.join(DIR, `${slug}.json`), 'utf8')) as Anatomy;
  } catch {
    return null;
  }
}
