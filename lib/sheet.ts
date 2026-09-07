// Google Sheet used as the only data source for the prompt analysis pages.
// The sheet must be readable by link (Share -> Anyone with the link -> Viewer),
// or published to the web, for the CSV export endpoint to work without auth.

export const SHEET_ID =
  process.env.PROMPT_SHEET_ID ?? '1goicfq-TMd_RunG-FcSLhGxiXlpprgreRPS6FCyNePA';
export const IMPORTANT_GID = process.env.PROMPT_SHEET_GID ?? '844521354';
export const ALL_GID = process.env.PROMPT_SHEET_ALL_GID ?? '0';
export const FUNNEL_GID = process.env.PROMPT_SHEET_FUNNEL_GID ?? '1715666796';

export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${IMPORTANT_GID}#gid=${IMPORTANT_GID}`;
export const FUNNEL_SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${FUNNEL_GID}#gid=${FUNNEL_GID}`;

export type Prompt = {
  slug: string;
  row: number; // 1-based row number in the sheet (header is row 1)
  topic: string;
  prompt: string;
  visibility: number | null; // 0-1
  position: number | null;
  importance: string;
  fanouts: string;
  answers: string;
  webSearch: string;
  seoRank: string;
  url: string;
  rootCause: string;
  lever: string;
  action: string;
  retrieved: string;
  cited: string;
  mentioned: string;
  skydoPages: string;
  matchingPage: string;
};

// One row of the Funnel tab: a fanout bucket for a prompt.
export type FunnelRow = {
  row: number;
  prompt: string;
  bucket: string;
  share: string;
  queries: string[];
  gptAnswer: string;
  screenshot: string;
  cited: string[];
  skydo: string;
  family: string;
};

export class SheetAccessError extends Error {
  status: number;
  constructor(status: number) {
    super(`Sheet returned HTTP ${status}`);
    this.status = status;
  }
}

function csvUrl(gid: string) {
  // Optional override, mainly for local testing with a mock CSV server:
  // PROMPT_SHEET_CSV_BASE=http://localhost:8999/  -> fetches <base><gid>.csv
  const base = process.env.PROMPT_SHEET_CSV_BASE;
  if (base) return `${base}${gid}.csv`;
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
}

// RFC 4180-ish parser: handles quoted fields, "" escapes, and newlines inside quotes.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Cells that hold lists use " | " or newlines as separators.
export function splitList(s: string): string[] {
  return s
    .split(/\s\|\s|\r?\n/)
    .map((x) => x.replace(/^[•\-*]\s*/, '').trim())
    .filter(Boolean);
}

function num(s: string | undefined): number | null {
  if (s == null) return null;
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function normHeader(h: string) {
  return h.toLowerCase().replace(/[?_\s]+/g, ' ').trim();
}

function indexHeaders<K extends string>(header: string[], map: Record<string, K>) {
  const idx: Partial<Record<K, number>> = {};
  header.map(normHeader).forEach((h, i) => {
    const key = map[h];
    if (key && idx[key] === undefined) idx[key] = i;
  });
  return (r: string[], k: K) => (idx[k] === undefined ? '' : (r[idx[k]!] ?? '').trim());
}

const PROMPT_HEADERS: Record<string, keyof Prompt> = {
  'topic name': 'topic',
  prompt: 'prompt',
  visibility: 'visibility',
  position: 'position',
  importance: 'importance',
  fanouts: 'fanouts',
  answers: 'answers',
  'web search': 'webSearch',
  'seo ranking': 'seoRank',
  url: 'url',
  'root cause': 'rootCause',
  lever: 'lever',
  action: 'action',
  retrieved: 'retrieved',
  cited: 'cited',
  mentioned: 'mentioned',
  'skydo pages': 'skydoPages',
  'matching page': 'matchingPage',
};

export function rowsToPrompts(rows: string[][]): Prompt[] {
  if (rows.length === 0) return [];
  const get = indexHeaders(rows[0], PROMPT_HEADERS);
  const out: Prompt[] = [];
  rows.slice(1).forEach((r, i) => {
    const prompt = get(r, 'prompt');
    if (!prompt) return;
    out.push({
      slug: slugify(prompt),
      row: i + 2,
      topic: get(r, 'topic'),
      prompt,
      visibility: num(get(r, 'visibility')),
      position: num(get(r, 'position')),
      importance: get(r, 'importance'),
      fanouts: get(r, 'fanouts'),
      answers: get(r, 'answers'),
      webSearch: get(r, 'webSearch'),
      seoRank: get(r, 'seoRank'),
      url: get(r, 'url'),
      rootCause: get(r, 'rootCause'),
      lever: get(r, 'lever'),
      action: get(r, 'action'),
      retrieved: get(r, 'retrieved'),
      cited: get(r, 'cited'),
      mentioned: get(r, 'mentioned'),
      skydoPages: get(r, 'skydoPages'),
      matchingPage: get(r, 'matchingPage'),
    });
  });
  return out;
}

const FUNNEL_HEADERS: Record<string, keyof FunnelRow> = {
  prompt: 'prompt',
  bucket: 'bucket',
  share: 'share',
  queries: 'queries',
  'gpt answer': 'gptAnswer',
  screenshot: 'screenshot',
  cited: 'cited',
  skydo: 'skydo',
  family: 'family',
};

export function rowsToFunnel(rows: string[][]): FunnelRow[] {
  if (rows.length === 0) return [];
  const get = indexHeaders(rows[0], FUNNEL_HEADERS);
  const out: FunnelRow[] = [];
  rows.slice(1).forEach((r, i) => {
    const prompt = get(r, 'prompt');
    const bucket = get(r, 'bucket');
    if (!prompt || !bucket) return;
    out.push({
      row: i + 2,
      prompt,
      bucket,
      share: get(r, 'share'),
      queries: splitList(get(r, 'queries')),
      gptAnswer: get(r, 'gptAnswer'),
      screenshot: get(r, 'screenshot'),
      cited: splitList(get(r, 'cited')),
      skydo: get(r, 'skydo'),
      family: get(r, 'family'),
    });
  });
  return out;
}

async function fetchCsv(gid: string): Promise<string> {
  const res = await fetch(csvUrl(gid), { redirect: 'follow' });
  if (!res.ok) throw new SheetAccessError(res.status);
  const text = await res.text();
  // A private sheet redirects to a Google sign-in page (HTML) with a 200.
  if (text.trimStart().startsWith('<')) throw new SheetAccessError(401);
  return text;
}

export async function getImportantPrompts(): Promise<Prompt[]> {
  const text = await fetchCsv(IMPORTANT_GID);
  return rowsToPrompts(parseCsv(text));
}

export async function getAllPrompts(): Promise<Prompt[]> {
  const text = await fetchCsv(ALL_GID);
  return rowsToPrompts(parseCsv(text));
}

export async function getFunnel(): Promise<FunnelRow[]> {
  try {
    const text = await fetchCsv(FUNNEL_GID);
    return rowsToFunnel(parseCsv(text));
  } catch (e) {
    // A missing Funnel tab should not break the prompt pages.
    if (e instanceof SheetAccessError && e.status !== 401) return [];
    throw e;
  }
}

export function funnelFor(rows: FunnelRow[], prompt: string): FunnelRow[] {
  const key = slugify(prompt);
  return rows.filter((r) => slugify(r.prompt) === key);
}

export function isAnalysed(p: Prompt) {
  return p.rootCause.trim().length > 0;
}

// Yes/No/unknown from a free-text cell like "Yes, 4/88 answers".
export function yesNo(s: string): 'yes' | 'no' | 'unknown' {
  const t = s.trim().toLowerCase();
  if (!t) return 'unknown';
  if (t.startsWith('y') || t.startsWith('partly')) return 'yes';
  if (t.startsWith('n')) return 'no';
  return 'unknown';
}

export function sheetRowUrl(row: number, gid: string = IMPORTANT_GID) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${gid}#gid=${gid}&range=A${row}`;
}
