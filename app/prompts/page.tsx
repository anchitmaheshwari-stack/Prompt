import Link from 'next/link';
import {
  getImportantPrompts,
  isAnalysed,
  SheetAccessError,
  SHEET_URL,
  type Prompt,
} from '@/lib/sheet';
import SheetSetup from './SheetSetup';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Prompt RCA · Skydo' };

function pct(v: number | null) {
  return v == null ? '–' : `${Math.round(v * 100)}%`;
}

function VisBar({ v }: { v: number | null }) {
  const w = v == null ? 0 : Math.max(2, Math.round(v * 100));
  const tone = v == null ? 'bg-gray-200' : v >= 0.6 ? 'bg-emerald-500' : v >= 0.3 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2 min-w-[140px]">
      <div className="h-2 flex-1 bg-gray-100 rounded overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${w}%` }} />
      </div>
      <span className="text-xs tabular-nums text-gray-700 w-9 text-right">{pct(v)}</span>
    </div>
  );
}

function RankPill({ p }: { p: Prompt }) {
  if (!p.seoRank) return <span className="text-xs text-gray-400">–</span>;
  const n = Number(p.seoRank);
  const tone = Number.isFinite(n)
    ? n <= 3
      ? 'bg-emerald-50 text-emerald-700'
      : n <= 10
      ? 'bg-amber-50 text-amber-700'
      : 'bg-red-50 text-red-700'
    : 'bg-gray-100 text-gray-600';
  return <span className={`text-xs px-2 py-0.5 rounded ${tone}`}>{p.seoRank}</span>;
}

export default async function PromptsPage() {
  let prompts: Prompt[];
  try {
    prompts = await getImportantPrompts();
  } catch (e) {
    if (e instanceof SheetAccessError) return <SheetSetup status={e.status} />;
    throw e;
  }

  const analysed = prompts.filter(isAnalysed).length;
  const byTopic = new Map<string, Prompt[]>();
  for (const p of prompts) {
    const list = byTopic.get(p.topic) ?? [];
    list.push(p);
    byTopic.set(p.topic, list);
  }

  return (
    <main className="max-w-6xl mx-auto p-8">
      <div className="flex items-end justify-between mb-2">
        <div>
          <h1 className="text-3xl font-bold">Prompt RCA</h1>
          <p className="text-sm text-gray-500 mt-1">
            Skydo on ChatGPT, non-branded prompts. Data comes straight from the sheet.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/anatomy" className="text-gray-600 hover:text-gray-900 underline">
            Page anatomy
          </Link>
          <Link href="/prompts/all" className="text-gray-600 hover:text-gray-900 underline">
            All tracked prompts
          </Link>
          <a
            href={SHEET_URL}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
          >
            Open sheet ↗
          </a>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 my-6">
        <Stat label="Focus prompts" value={String(prompts.length)} />
        <Stat label="RCA done" value={`${analysed} / ${prompts.length}`} />
        <Stat
          label="Avg ChatGPT visibility"
          value={pct(avg(prompts.map((p) => p.visibility)))}
        />
      </div>

      {[...byTopic.entries()].map(([topic, list]) => (
        <section key={topic} className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {topic || 'Untagged'} <span className="text-gray-400 font-normal">· {list.length}</span>
          </h2>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Prompt</th>
                  <th className="text-left font-medium px-4 py-2 w-48">Visibility</th>
                  <th className="text-right font-medium px-4 py-2 w-20">Position</th>
                  <th className="text-left font-medium px-4 py-2 w-28">Google rank</th>
                  <th className="text-left font-medium px-4 py-2 w-24">RCA</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.slug} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <Link href={`/prompts/${p.slug}`} className="font-medium hover:underline">
                        {p.prompt}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <VisBar v={p.visibility} />
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                      {p.position ?? '–'}
                    </td>
                    <td className="px-4 py-2">
                      <RankPill p={p} />
                    </td>
                    <td className="px-4 py-2">
                      {isAnalysed(p) ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                          Done
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function avg(xs: (number | null)[]) {
  const v = xs.filter((x): x is number => x != null);
  if (v.length === 0) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}
