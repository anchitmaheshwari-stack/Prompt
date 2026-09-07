import Link from 'next/link';
import { getAllPrompts, getImportantPrompts, SheetAccessError, type Prompt } from '@/lib/sheet';
import SheetSetup from '../SheetSetup';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'All prompts · Prompt RCA' };

function pct(v: number | null) {
  return v == null ? '–' : `${Math.round(v * 100)}%`;
}

export default async function AllPromptsPage() {
  let all: Prompt[];
  let important: Prompt[];
  try {
    [all, important] = await Promise.all([getAllPrompts(), getImportantPrompts()]);
  } catch (e) {
    if (e instanceof SheetAccessError) return <SheetSetup status={e.status} />;
    throw e;
  }
  const focus = new Set(important.map((p) => p.slug));
  const sorted = [...all].sort((a, b) => (a.visibility ?? -1) - (b.visibility ?? -1));

  return (
    <main className="max-w-5xl mx-auto p-8">
      <div className="mb-6 text-sm">
        <Link href="/prompts" className="text-gray-500 hover:text-gray-900">
          ← Focus prompts
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-1">All tracked prompts</h1>
      <p className="text-sm text-gray-500 mb-6">
        {all.length} prompts from the All Prompts tab, sorted by ChatGPT visibility. Highlighted rows
        are in the focus set.
      </p>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="text-left font-medium px-4 py-2">Prompt</th>
              <th className="text-left font-medium px-4 py-2 w-56">Topic</th>
              <th className="text-right font-medium px-4 py-2 w-24">Visibility</th>
              <th className="text-right font-medium px-4 py-2 w-20">Position</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const inFocus = focus.has(p.slug);
              return (
                <tr
                  key={p.slug + p.row}
                  className={`border-t border-gray-100 ${inFocus ? 'bg-amber-50/60' : ''}`}
                >
                  <td className="px-4 py-1.5">
                    {inFocus ? (
                      <Link href={`/prompts/${p.slug}`} className="font-medium hover:underline">
                        {p.prompt}
                      </Link>
                    ) : (
                      p.prompt
                    )}
                  </td>
                  <td className="px-4 py-1.5 text-gray-500 text-xs">{p.topic}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums">{pct(p.visibility)}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums text-gray-700">
                    {p.position ?? '–'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
