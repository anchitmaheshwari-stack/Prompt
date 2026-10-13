'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import LineChart, { type Series } from '../LineChart';
import type { Dashboard as Data, Day } from '../types';

const int = (v: number) => Math.round(v).toLocaleString('en-IN');
const dec = (v: number) => v.toLocaleString('en-IN', { maximumFractionDigits: 1 });
const toDate = (d: string) => new Date(d + 'T00:00:00Z');
const shortDate = (d: string) => toDate(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const addDays = (d: string, n: number) => new Date(toDate(d).getTime() + n * 864e5).toISOString().slice(0, 10);
const maxDate = (a: string, b: string) => (a > b ? a : b);

type MetricKey = 'ytViews' | 'pageViews' | 'plays' | 'clicks' | 'impressions' | 'position' | 'aiBlog' | 'aiVideo';

type Ctx = { addedOn: string; videoPublished: string; lastAnalyticsDay: string | null; prevTotal: Map<string, number | null> };
type Row = { day: Day; value: number | null; note?: string };

type Metric = {
  key: MetricKey;
  label: string;
  hint: string;
  color: string;
  format: (v: number) => string;
  /** Per-day value; null where there is no data. */
  daily: (d: Day, ctx: Ctx) => { value: number | null; note?: string };
  /** Card number for the selected days. */
  total: (rows: Row[]) => number | null;
  invert?: boolean;
};

const sum = (rows: Row[]) => (rows.some((r) => r.value !== null) ? rows.reduce((s, r) => s + (r.value ?? 0), 0) : null);

const METRICS: Metric[] = [
  {
    key: 'ytViews',
    label: 'YouTube views',
    hint: 'Views of the video on YouTube per day. The last 2–3 days are estimated from the daily view counter until YouTube publishes its numbers.',
    color: 'var(--series-1)',
    format: int,
    daily: (d, c) => {
      if (d.date < c.videoPublished) return { value: null };
      // YouTube Analytics leaves out zero-view days, so inside its processed range a gap means 0.
      if (c.lastAnalyticsDay && d.date <= c.lastAnalyticsDay) return { value: d.ytViews ?? 0 };
      const prev = c.prevTotal.get(d.date);
      return d.ytTotal !== null && prev != null ? { value: Math.max(0, d.ytTotal - prev), note: 'estimate' } : { value: null };
    },
    total: sum,
  },
  {
    key: 'pageViews',
    label: 'Blog page views',
    hint: 'All visits to the blog post from any source: Google, direct, social, AI tools, YouTube (Mixpanel, www.skydo.com only). Search clicks are the part that came from Google.',
    color: 'var(--series-6)',
    format: int,
    daily: (d) => ({ value: d.pageViews }),
    total: sum,
  },
  {
    key: 'plays',
    label: 'Plays on blog',
    hint: 'Times the play button was pressed on the video inside the blog (Mixpanel). Counted from the day the video was added.',
    color: 'var(--series-2)',
    format: int,
    daily: (d, c) => ({ value: d.date >= c.addedOn ? d.plays : null }),
    total: sum,
  },
  {
    key: 'clicks',
    label: 'Search clicks',
    hint: 'Clicks from Google search results to the blog (Search Console, 2–3 day lag).',
    color: 'var(--series-3)',
    format: int,
    daily: (d) => ({ value: d.clicks }),
    total: sum,
  },
  {
    key: 'impressions',
    label: 'Search impressions',
    hint: 'Times the blog appeared in Google search results (Search Console, 2–3 day lag).',
    color: 'var(--series-4)',
    format: int,
    daily: (d) => ({ value: d.impressions }),
    total: sum,
  },
  {
    key: 'position',
    label: 'Avg. position',
    hint: 'Average Google ranking of the blog. Lower is better; 1 is the top result. The card is weighted by impressions.',
    color: 'var(--series-5)',
    format: dec,
    invert: true,
    daily: (d) => ({ value: d.position }),
    total: (rows) => {
      const w = rows.filter((r) => r.value !== null && r.day.impressions);
      const imp = w.reduce((s, r) => s + r.day.impressions!, 0);
      return imp ? w.reduce((s, r) => s + r.value! * r.day.impressions!, 0) / imp : null;
    },
  },
  {
    key: 'aiBlog',
    label: 'AI answers using blog',
    hint: 'Answers from ChatGPT, Google AI Overview, AI Mode and Gemini to the prompts tracked in Peec that pulled the blog in as a source.',
    color: 'var(--series-7)',
    format: int,
    daily: (d) => ({ value: d.aiBlog }),
    total: sum,
  },
  {
    key: 'aiVideo',
    label: 'AI answers using video',
    hint: 'Answers from ChatGPT, Google AI Overview, AI Mode and Gemini to the prompts tracked in Peec that pulled the YouTube video in as a source. Counted from the day the video was published.',
    color: 'var(--series-8)',
    format: int,
    daily: (d, c) => ({ value: d.date >= c.videoPublished ? d.aiVideo : null }),
    total: sum,
  },
];

type Preset = 'added' | '7' | '30' | '90' | 'custom';
const PRESETS: [Exclude<Preset, 'custom'>, string][] = [
  ['added', 'Since video added'],
  ['7', 'Last 7 days'],
  ['30', 'Last 30 days'],
  ['90', 'Last 90 days'],
];

export default function Dashboard({ data }: { data: Data }) {
  const { video: v, days: allDays } = data;
  const first = allDays[0]?.date ?? v.blogPublished;
  const today = allDays.at(-1)?.date ?? v.addedOn;

  // "Since video added" keeps a week before it for context.
  const rangeFor = (p: Exclude<Preset, 'custom'>): [string, string] =>
    p === 'added' ? [maxDate(first, addDays(v.addedOn, -7)), today] : [maxDate(first, addDays(today, -Number(p) + 1)), today];

  const [preset, setPreset] = useState<Preset>('30');
  const [[from, to], setRange] = useState<[string, string]>(() => rangeFor('30'));
  const [selected, setSelected] = useState<MetricKey[]>(['ytViews']);

  const ctx: Ctx = useMemo(() => {
    const prevTotal = new Map<string, number | null>();
    allDays.forEach((d, i) => prevTotal.set(d.date, i > 0 ? allDays[i - 1].ytTotal : null));
    return {
      addedOn: v.addedOn,
      videoPublished: v.videoPublished,
      lastAnalyticsDay: allDays.filter((d) => d.ytViews !== null).at(-1)?.date ?? null,
      prevTotal,
    };
  }, [allDays, v.addedOn, v.videoPublished]);

  const days = useMemo(() => allDays.filter((d) => d.date >= from && d.date <= to), [allDays, from, to]);
  const perMetric = useMemo(
    () => Object.fromEntries(METRICS.map((m) => [m.key, days.map((d) => ({ day: d, ...m.daily(d, ctx) }))])) as Record<MetricKey, Row[]>,
    [days, ctx],
  );

  // At least one metric always stays on the chart.
  const toggle = (k: MetricKey) =>
    setSelected((cur) => (cur.includes(k) ? (cur.length > 1 ? cur.filter((x) => x !== k) : cur) : [...cur, k]));

  const series: Series[] = METRICS.filter((m) => selected.includes(m.key)).map((m) => ({
    key: m.key,
    label: m.label,
    color: m.color,
    format: m.format,
    invert: m.invert,
    values: perMetric[m.key].map((r) => r.value),
    notes: perMetric[m.key].map((r) => r.note),
  }));

  const problems = [
    ...data.sources.filter((s) => !s.ok && s.name !== 'Page check').map((s) => `${s.name} didn't update on the last refresh.`),
    data.health && !data.health.embedFound ? 'The video was not found on the blog page.' : null,
    data.health && !data.health.videoObjectSchema ? 'The blog has no VideoObject schema, so Google is unlikely to show it as a video result.' : null,
  ].filter(Boolean) as string[];

  const inputStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink-1)' };

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <nav className="text-sm mb-5" style={{ color: 'var(--ink-3)' }}>
        <Link href="/videos" className="hover:underline">← All videos</Link>
      </nav>

      <header className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`} alt="" className="w-32 aspect-video rounded-lg object-cover shrink-0" style={{ border: '1px solid var(--border)' }} />
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-snug">{v.title}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-sm" style={{ color: 'var(--ink-2)' }}>
            <a href={v.blogUrl} target="_blank" rel="noreferrer" className="hover:underline">Blog ↗</a>
            <a href={`https://www.youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noreferrer" className="hover:underline">YouTube ↗</a>
            <a href={data.sheetUrl} target="_blank" rel="noreferrer" className="hover:underline">Data sheet ↗</a>
            <span style={{ color: 'var(--ink-3)' }}>· Added to blog {shortDate(v.addedOn)} · updated {data.updatedLabel}</span>
          </div>
        </div>
      </header>

      {problems.length > 0 && (
        <div className="rounded-lg px-3 py-2 mb-5 text-sm flex gap-2" style={{ background: 'var(--warning-wash)', border: '1px solid var(--border)' }} role="status">
          <span aria-hidden style={{ color: 'var(--warning)' }}>▲</span>
          <span style={{ color: 'var(--ink-2)' }}>{problems.join(' ')}</span>
        </div>
      )}

      {/* Date range */}
      <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
        {PRESETS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => { setPreset(k); setRange(rangeFor(k)); }}
            aria-pressed={preset === k}
            className="rounded-full px-3 py-1"
            style={preset === k ? { background: 'var(--ink-1)', color: 'var(--surface)' } : { color: 'var(--ink-2)', border: '1px solid var(--border)' }}
          >
            {label}
          </button>
        ))}
        <span className="flex items-center gap-1.5 sm:ml-2">
          <input
            type="date" aria-label="From" value={from} min={first} max={to} className="rounded-md px-2 py-1 viz-num" style={inputStyle}
            onChange={(e) => { if (e.target.value) { setRange([e.target.value, to]); setPreset('custom'); } }}
          />
          <span style={{ color: 'var(--ink-3)' }}>to</span>
          <input
            type="date" aria-label="To" value={to} min={from} max={today} className="rounded-md px-2 py-1 viz-num" style={inputStyle}
            onChange={(e) => { if (e.target.value) { setRange([from, e.target.value > today ? today : e.target.value]); setPreset('custom'); } }}
          />
        </span>
      </div>

      {/* Metric cards: click to add or remove a line */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3" role="group" aria-label="Metrics on the chart">
        {METRICS.map((m) => {
          const on = selected.includes(m.key);
          const total = m.total(perMetric[m.key]);
          return (
            <button
              key={m.key}
              onClick={() => toggle(m.key)}
              aria-pressed={on}
              title={m.hint}
              className="text-left rounded-xl transition-shadow hover:shadow-sm"
              style={{ background: 'var(--surface)', border: on ? `2px solid ${m.color}` : '1px solid var(--border)', padding: on ? 11 : 12 }}
            >
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--ink-2)' }}>
                <span
                  aria-hidden
                  className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-sm text-[10px] leading-none text-white"
                  style={on ? { background: m.color } : { border: '1px solid var(--axis)' }}
                >
                  {on ? '✓' : ''}
                </span>
                {m.label}
              </div>
              <div className="text-2xl font-semibold mt-1">{total === null ? '–' : m.format(total)}</div>
            </button>
          );
        })}
      </div>

      <section className="viz-card p-5">
        <LineChart dates={days.map((d) => d.date)} series={series} marker={v.addedOn} markerLabel="▶ Video added" />
        <p className="text-xs mt-2" style={{ color: 'var(--ink-3)' }}>
          {series.length > 1
            ? 'Each line is scaled to its own highest point in these dates, so you can compare shapes. Hover for the real numbers.'
            : 'Click more cards to compare them on the same chart. Hover for daily numbers.'}{' '}
          Search data and YouTube views arrive 2–3 days late. AI answers come from Peec AI&apos;s daily run of the tracked prompts.
        </p>
      </section>
    </main>
  );
}
