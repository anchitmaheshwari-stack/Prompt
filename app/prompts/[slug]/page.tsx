import { existsSync } from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  FUNNEL_GID,
  FUNNEL_SHEET_URL,
  funnelFor,
  getFunnel,
  getImportantPrompts,
  isAnalysed,
  SheetAccessError,
  sheetRowUrl,
  splitList,
  yesNo,
  type FunnelRow,
  type Prompt,
} from '@/lib/sheet';
import SheetSetup from '../SheetSetup';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `${slug.replace(/-/g, ' ')} · Prompt RCA` };
}

/** Fallback when the Funnel tab's screenshot cell is empty: public/screenshots/<slug>-<n>.jpg */
function localScreenshot(slug: string, k: number) {
  const file = `${slug}-${k + 1}.jpg`;
  return existsSync(path.join(process.cwd(), 'public', 'screenshots', file))
    ? `/screenshots/${file}`
    : '';
}

function pct(v: number | null) {
  return v == null ? '–' : `${Math.round(v * 100)}%`;
}

const BUCKET_TONES = [
  'bg-sky-50 text-sky-800 border-sky-200',
  'bg-violet-50 text-violet-800 border-violet-200',
  'bg-amber-50 text-amber-800 border-amber-200',
  'bg-rose-50 text-rose-800 border-rose-200',
  'bg-teal-50 text-teal-800 border-teal-200',
];

export default async function PromptPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let prompts: Prompt[];
  let funnelRows: FunnelRow[];
  try {
    [prompts, funnelRows] = await Promise.all([getImportantPrompts(), getFunnel()]);
  } catch (e) {
    if (e instanceof SheetAccessError) return <SheetSetup status={e.status} />;
    throw e;
  }

  const i = prompts.findIndex((p) => p.slug === slug);
  if (i === -1) return notFound();
  const p = prompts[i];
  const prev = prompts[i - 1];
  const next = prompts[i + 1];
  const buckets = funnelFor(funnelRows, p.prompt);
  const done = isAnalysed(p);

  const retrieved = yesNo(p.retrieved);
  const cited = yesNo(p.cited);
  const mentioned = yesNo(p.mentioned);
  const anyYes = [retrieved, cited, mentioned].includes('yes');

  return (
    <main className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6 text-sm">
        <Link href="/prompts" className="text-gray-500 hover:text-gray-900">
          ← All prompts
        </Link>
        <div className="flex gap-3">
          {prev && (
            <Link href={`/prompts/${prev.slug}`} className="text-gray-500 hover:text-gray-900">
              ← Prev
            </Link>
          )}
          {next && (
            <Link href={`/prompts/${next.slug}`} className="text-gray-500 hover:text-gray-900">
              Next →
            </Link>
          )}
        </div>
      </div>

      {!done && (
        <div className="border border-dashed border-gray-300 rounded-lg p-4 text-sm text-gray-500 mb-6">
          RCA not done yet for this prompt. Fill the row in the Important Prompts tab and add its
          buckets to the Funnel tab; this page updates on reload.
        </div>
      )}

      {/* 1. Prompt */}
      <Stage n={1} title="Prompt">
        <div className="text-xs text-gray-500 mb-1">{p.topic}</div>
        <h1 className="text-2xl font-bold mb-4">{p.prompt}</h1>
        <div className="grid grid-cols-4 gap-3">
          <Stat label="ChatGPT visibility" value={pct(p.visibility)} sub="90 days, non-branded" />
          <Stat label="Avg position" value={p.position == null ? '–' : String(p.position)} />
          <Stat label="Web search used" value={p.webSearch || '–'} />
          <Stat label="Google rank (IN)" value={p.seoRank || '–'} sub={p.url && p.url !== '-' ? p.url.replace(/^https?:\/\/(www\.)?/, '') : undefined} href={p.url && p.url !== '-' ? p.url : undefined} />
        </div>
      </Stage>

      {/* 2. Buckets of fanouts */}
      <Stage n={2} title="Buckets of fanouts" hint={p.fanouts}>
        {buckets.length === 0 ? (
          <Empty what="bucket rows in the Funnel tab" />
        ) : (
          <div className="space-y-3">
            {buckets.map((b, k) => (
              <div key={b.row} className={`border rounded-lg p-4 ${tone(k)}`}>
                <div className="flex items-baseline justify-between gap-4">
                  <div className="font-semibold">{b.bucket}</div>
                  <div className="text-xs opacity-80 whitespace-nowrap">{b.share}</div>
                </div>
                <ul className="mt-2 space-y-1 text-sm font-mono text-[13px] opacity-90">
                  {b.queries.map((q, j) => (
                    <li key={j}>“{q}”</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Stage>

      {/* 3. What GPT answers, per bucket */}
      <Stage n={3} title="What ChatGPT answers, one per bucket" hint={p.answers}>
        {buckets.length === 0 ? (
          <Empty what="bucket rows in the Funnel tab" />
        ) : (
          <div className="space-y-4">
            {buckets.map((b, k) => {
              const shot = b.screenshot || localScreenshot(slug, k);
              return (
              <div key={b.row} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className={`px-4 py-2 text-xs font-semibold border-b flex items-center justify-between gap-3 ${tone(k)}`}>
                  <span>{b.bucket}</span>
                  {b.family && <span className="font-normal opacity-70">{b.family}</span>}
                </div>
                <div className="p-4 text-sm leading-relaxed">
                  {b.gptAnswer || <span className="text-gray-400">No answer summary yet.</span>}
                </div>
                {shot ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={shot}
                    alt={`ChatGPT answer for ${b.bucket}`}
                    className="w-full border-t border-gray-200"
                  />
                ) : (
                  <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
                    No screenshot yet. Put an image link in the Funnel tab “screenshot” column
                    (row {b.row}).
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </Stage>

      {/* 4. What gets cited */}
      <Stage n={4} title="What gets cited">
        {buckets.length === 0 ? (
          <Empty what="bucket rows in the Funnel tab" />
        ) : (
          <div className="space-y-4">
            {buckets.map((b, k) => (
              <div key={b.row}>
                <div className={`inline-block text-xs font-semibold px-2 py-0.5 rounded border mb-2 ${tone(k)}`}>
                  {b.bucket}
                </div>
                {b.cited.length === 0 ? (
                  <div className="text-sm text-gray-400">No citations recorded.</div>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {b.cited.map((c, j) => (
                      <li key={j} className="flex gap-2">
                        <span className="text-gray-300">•</span>
                        <Cite text={c} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </Stage>

      {/* 5. Did we get retrieved / cited / mentioned */}
      <Stage n={5} title="Did Skydo get retrieved, cited, mentioned?">
        <div className="grid grid-cols-3 gap-3">
          <Flag label="Retrieved" state={retrieved} text={p.retrieved} />
          <Flag label="Cited" state={cited} text={p.cited} />
          <Flag label="Mentioned" state={mentioned} text={p.mentioned} />
        </div>
        {buckets.some((b) => b.skydo) && (
          <div className="mt-4 space-y-2">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Per bucket</div>
            {buckets.map((b, k) =>
              b.skydo ? (
                <div key={b.row} className="flex gap-3 text-sm">
                  <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded border h-fit ${tone(k)}`}>
                    {b.bucket.split('.')[0]}
                  </span>
                  <span>{b.skydo}</span>
                </div>
              ) : null,
            )}
          </div>
        )}
      </Stage>

      {/* 6. If yes, which pages */}
      <Stage n={6} title="If yes: which Skydo pages got retrieved or cited" muted={!anyYes}>
        {p.skydoPages ? (
          <ul className="space-y-1 text-sm">
            {splitList(p.skydoPages).map((s, j) => (
              <li key={j} className="flex gap-2">
                <span className="text-gray-300">•</span>
                <Cite text={s} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty what="the “Skydo pages” cell" />
        )}
      </Stage>

      {/* 7. If no, do we have a matching page */}
      <Stage n={7} title="Do we have a page that matches this prompt?">
        {p.matchingPage ? (
          <div>
            <div className={`inline-block text-xs font-semibold px-2 py-0.5 rounded mb-2 ${
              /^yes/i.test(p.matchingPage)
                ? 'bg-emerald-50 text-emerald-700'
                : /^partly/i.test(p.matchingPage)
                ? 'bg-amber-50 text-amber-700'
                : 'bg-red-50 text-red-700'
            }`}>
              {p.matchingPage.split(':')[0]}
            </div>
            <ul className="space-y-1 text-sm">
              {splitList(p.matchingPage.replace(/^[^:]*:\s*/, '')).map((s, j) => (
                <li key={j} className="flex gap-2">
                  <span className="text-gray-300">•</span>
                  <Cite text={s} />
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <Empty what="the “Matching page” cell" />
        )}
      </Stage>

      {/* Outcome */}
      <div className="mt-10 mb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Outcome</div>
      <Section title="Root cause" tone="red">
        {p.rootCause ? <Points text={p.rootCause} /> : <Empty what="Root cause" />}
      </Section>
      <Section title="Lever">{p.lever ? <Points text={p.lever} /> : <Empty what="Lever" />}</Section>
      <Section title="Action" tone="emerald">
        {p.action ? <Points text={p.action} /> : <Empty what="Action" />}
      </Section>

      <div className="mt-8 text-xs text-gray-500 flex gap-4">
        <span>
          Important Prompts row {p.row} ·{' '}
          <a href={sheetRowUrl(p.row)} target="_blank" rel="noreferrer" className="underline">
            Edit ↗
          </a>
        </span>
        <span>
          Funnel rows {buckets.length ? buckets.map((b) => b.row).join(', ') : '–'} ·{' '}
          <a
            href={buckets.length ? sheetRowUrl(buckets[0].row, FUNNEL_GID) : FUNNEL_SHEET_URL}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Edit ↗
          </a>
        </span>
      </div>
    </main>
  );
}

function tone(k: number) {
  return BUCKET_TONES[k % BUCKET_TONES.length];
}

function Stage({
  n,
  title,
  hint,
  muted,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className={`group border border-gray-200 rounded-lg mb-3 bg-white ${muted ? 'opacity-60' : ''}`}>
      <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <span className="w-8 h-8 shrink-0 rounded-full bg-gray-900 text-white text-sm font-semibold flex items-center justify-center">
          {n}
        </span>
        <span className="flex-1 text-base font-semibold text-gray-900">{title}</span>
        <span className="text-gray-400 text-xs transition-transform group-open:rotate-180">▼</span>
      </summary>
      <div className="px-4 pb-5 pt-1 border-t border-gray-100">
        {children}
        {hint && (
          <details className="mt-3 text-xs text-gray-500">
            <summary className="cursor-pointer select-none">Full note from the sheet</summary>
            <p className="mt-2 leading-relaxed whitespace-pre-wrap text-gray-600">{hint}</p>
          </details>
        )}
      </div>
    </details>
  );
}

/** One bullet per line. Accepts "• a\n• b", "- a", or " | " separated cells. */
function Points({ text }: { text: string }) {
  const items = splitList(text)
    .map((l) => l.replace(/^[•\-*]\s*/, '').trim())
    .filter(Boolean);
  if (items.length <= 1) return <p>{items[0] ?? text}</p>;
  return (
    <ul className="list-disc pl-5 space-y-1">
      {items.map((l, k) => (
        <li key={k}>{l}</li>
      ))}
    </ul>
  );
}

function Stat({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  href?: string;
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold mt-0.5">{value}</div>
      {sub &&
        (href ? (
          <a href={href} target="_blank" rel="noreferrer" className="block text-xs text-gray-500 mt-0.5 underline break-all">
            {sub}
          </a>
        ) : (
          <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
        ))}
    </div>
  );
}

function Flag({ label, state, text }: { label: string; state: 'yes' | 'no' | 'unknown'; text: string }) {
  const tone =
    state === 'yes'
      ? 'border-emerald-300 bg-emerald-50'
      : state === 'no'
      ? 'border-red-300 bg-red-50'
      : 'border-gray-200 bg-gray-50';
  const word = state === 'yes' ? 'Yes' : state === 'no' ? 'No' : '–';
  return (
    <div className={`border rounded-lg p-3 ${tone}`}>
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-xl font-semibold">{word}</div>
      <div className="text-xs text-gray-600 mt-1 leading-snug">{text.replace(/^(yes|no)[,:]?\s*/i, '') || ''}</div>
    </div>
  );
}

// Renders "domain/path (note)" as a link when it looks like a URL.
function Cite({ text }: { text: string }) {
  const m = text.match(/^((?:https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s(]*)?)(.*)$/i);
  if (!m) return <span>{text}</span>;
  const url = m[1].startsWith('http') ? m[1] : `https://${m[1]}`;
  return (
    <span>
      <a href={url} target="_blank" rel="noreferrer" className="underline break-all">
        {m[1]}
      </a>
      <span className="text-gray-500">{m[2]}</span>
    </span>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: 'emerald' | 'red';
  children: React.ReactNode;
}) {
  const bar =
    tone === 'emerald' ? 'border-l-emerald-500' : tone === 'red' ? 'border-l-red-400' : 'border-l-gray-300';
  return (
    <details className={`group border border-gray-200 border-l-4 ${bar} rounded-lg mb-4 bg-white`}>
      <summary className="flex items-center gap-3 px-5 py-3 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <span className="flex-1 text-sm font-semibold text-gray-900">{title}</span>
        <span className="text-gray-400 text-xs transition-transform group-open:rotate-180">▼</span>
      </summary>
      <div className="px-5 pb-5 text-sm text-gray-800 leading-relaxed">{children}</div>
    </details>
  );
}

function Empty({ what }: { what: string }) {
  return <span className="text-sm text-gray-400">Not filled in yet: {what}.</span>;
}
