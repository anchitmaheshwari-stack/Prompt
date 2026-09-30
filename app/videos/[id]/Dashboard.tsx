'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import LineChart, { type Point } from '../LineChart';
import type { Bar, Dashboard as Data, Day } from '../types';

// ---------- formatting & dates ----------
const int = (v: number) => Math.round(v).toLocaleString('en-IN');
const dec = (v: number) => v.toLocaleString('en-IN', { maximumFractionDigits: 1 });
const pct = (v: number) => `${(v * 100).toFixed(v < 0.1 && v > 0 ? 1 : 0)}%`;
const toDate = (d: string) => new Date(d + 'T00:00:00Z');
const shortDate = (d: string) => toDate(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const addDays = (d: string, n: number) => new Date(toDate(d).getTime() + n * 864e5).toISOString().slice(0, 10);
const maxDate = (a: string, b: string) => (a > b ? a : b);
const minDate = (a: string, b: string) => (a < b ? a : b);

type Period = 'week' | 'month';

function periodStart(d: string, p: Period) {
  if (p === 'month') return d.slice(0, 7) + '-01';
  return addDays(d, -((toDate(d).getUTCDay() + 6) % 7)); // Monday
}
function periodEnd(start: string, p: Period) {
  if (p === 'week') return addDays(start, 6);
  const dt = toDate(start);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

type Bucket = { start: string; end: string; days: Day[]; complete: boolean; label: string; title: string; note?: string };

/** Groups the selected days into weeks (Mon–Sun) or calendar months. */
function bucketize(days: Day[], p: Period, lastFullDay: string): Bucket[] {
  const map = new Map<string, Day[]>();
  for (const d of days) {
    const k = periodStart(d.date, p);
    map.set(k, [...(map.get(k) ?? []), d]);
  }
  return [...map.entries()].map(([start, ds]) => {
    const end = periodEnd(start, p);
    const first = ds[0].date;
    const last = ds.at(-1)!.date;
    const complete = first === start && last === end && end <= lastFullDay;
    const month = toDate(start).toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' });
    return {
      start,
      end,
      days: ds,
      complete,
      label: p === 'week' ? shortDate(start) : month,
      title: p === 'week' ? `Week of ${shortDate(start)} – ${shortDate(end)}` : toDate(start).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
      note: complete ? undefined : `Partial ${p}: ${shortDate(first)}${first === last ? '' : ` – ${shortDate(last)}`} only`,
    };
  });
}

// ---------- metrics ----------
type MetricKey = 'ytTotal' | 'pageViews' | 'plays' | 'playRate' | 'impressions' | 'clicks' | 'position';

const sumOf = (days: Day[], f: (d: Day) => number | null) =>
  days.some((d) => f(d) !== null) ? days.reduce((s, d) => s + (f(d) ?? 0), 0) : null;

type Metric = {
  key: MetricKey;
  label: string;
  hint: string;
  format: (v: number) => string;
  /** Value for a set of days (a week, a month, or the whole selection). */
  agg: (days: Day[], addedOn: string) => number | null;
  invert?: boolean;
};

const live = (days: Day[], a: string) => days.filter((d) => d.date >= a);

const METRICS: Metric[] = [
  {
    key: 'ytTotal', label: 'YouTube views', hint: 'Lifetime YouTube views at the end of the period',
    format: int, agg: (days) => days.filter((d) => d.ytTotal !== null).at(-1)?.ytTotal ?? null,
  },
  {
    key: 'pageViews', label: 'Blog page views', hint: 'Views of the blog post (Mixpanel, www.skydo.com only)',
    format: int, agg: (days) => sumOf(days, (d) => d.pageViews),
  },
  {
    key: 'plays', label: 'Plays on blog', hint: 'Times someone pressed play on the embedded video',
    format: int, agg: (days, a) => sumOf(live(days, a), (d) => d.plays),
  },
  {
    key: 'playRate', label: 'Play rate', hint: 'Plays ÷ blog page views, from the day the video went in',
    format: pct,
    agg: (days, a) => {
      const l = live(days, a);
      const views = sumOf(l, (d) => d.pageViews);
      return views ? (sumOf(l, (d) => d.plays) ?? 0) / views : null;
    },
  },
  {
    key: 'impressions', label: 'Search impressions', hint: 'Times the blog showed in Google results (2–3 day lag)',
    format: int, agg: (days) => sumOf(days, (d) => d.impressions),
  },
  {
    key: 'clicks', label: 'Search clicks', hint: 'Clicks from Google results to the blog',
    format: int, agg: (days) => sumOf(days, (d) => d.clicks),
  },
  {
    key: 'position', label: 'Avg. position', hint: 'Average Google ranking of the blog (lower is better)',
    format: dec, invert: true,
    agg: (days) => {
      const w = days.filter((d) => d.position !== null && d.impressions);
      const imp = w.reduce((s, d) => s + d.impressions!, 0);
      return imp ? w.reduce((s, d) => s + d.position! * d.impressions!, 0) / imp : null;
    },
  },
];

const LOCATION_LABELS: Record<string, string> = {
  EMBEDDED: 'Embedded on websites', WATCH: 'YouTube watch page', SHORTS: 'Shorts feed', CHANNEL: 'Channel page',
  BROWSE: 'Home / browse', SEARCH: 'YouTube search', EXTERNAL_APP: 'External app', MOBILE: 'Mobile', YT_OTHER: 'Other YouTube',
};
const SOURCE_LABELS: Record<string, string> = {
  SHORTS: 'Shorts feed', YT_SEARCH: 'YouTube search', RELATED_VIDEO: 'Suggested videos', EXT_URL: 'External websites',
  SUBSCRIBER: 'Subscribers', YT_CHANNEL: 'Channel page', NO_LINK_OTHER: 'Direct / unknown', PLAYLIST: 'Playlists',
  NOTIFICATION: 'Notifications', YT_OTHER_PAGE: 'Other YouTube pages', END_SCREEN: 'End screens', ADVERTISING: 'Ads',
};

const PRESETS = [
  { key: 'all', label: 'Since blog went live' },
  { key: '4w', label: 'Last 4 weeks', days: 28 },
  { key: '3m', label: 'Last 3 months', days: 91 },
] as const;
type PresetKey = (typeof PRESETS)[number]['key'] | 'custom';

type Tab = 'log' | 'audience' | 'queries';
type ColGroup = 'all' | 'youtube' | 'blog' | 'search';

export default function Dashboard({ data }: { data: Data }) {
  const { video: v, days: allDays } = data;
  const first = allDays[0]?.date ?? v.blogPublished;
  const today = allDays.at(-1)?.date ?? v.addedOn;

  const [preset, setPreset] = useState<PresetKey>('all');
  const [from, setFrom] = useState(first);
  const [to, setTo] = useState(today);
  const [period, setPeriod] = useState<Period>('week');
  const [metricKey, setMetricKey] = useState<MetricKey>('pageViews');
  const [tab, setTab] = useState<Tab>('log');
  const [cols, setCols] = useState<ColGroup>('all');
  const [querySort, setQuerySort] = useState<'clicks' | 'impressions' | 'position'>('impressions');
  const [showHowTo, setShowHowTo] = useState(false);

  const choosePreset = (key: PresetKey) => {
    setPreset(key);
    const p = PRESETS.find((x) => x.key === key);
    if (!p) return;
    setFrom('days' in p ? maxDate(first, addDays(today, -p.days + 1)) : first);
    setTo(today);
  };

  const days = useMemo(() => allDays.filter((d) => d.date >= from && d.date <= to), [allDays, from, to]);
  const buckets = useMemo(() => bucketize(days, period, addDays(today, -1)), [days, period, today]);
  const metric = METRICS.find((m) => m.key === metricKey)!;
  const markerIndex = buckets.findIndex((b) => v.addedOn >= b.start && v.addedOn <= b.end);

  const points: Point[] = buckets.map((b) => ({ label: b.label, title: b.title, value: metric.agg(b.days, v.addedOn), note: b.note, complete: b.complete }));

  const issues = [
    data.health && !data.health.embedFound && 'The video is no longer found on the blog page.',
    data.health && !data.health.videoObjectSchema && 'The blog has no VideoObject schema, so Google is unlikely to show it as a video result.',
  ].filter(Boolean) as string[];

  const queries = [...data.breakdowns.queries].sort((a, b) =>
    querySort === 'position' ? a.position - b.position : b[querySort] - a[querySort],
  );
  const complete = buckets.filter((b) => b.complete);

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <nav className="text-sm mb-5" style={{ color: 'var(--ink-3)' }}>
        <Link href="/videos" className="hover:underline">← All videos</Link>
      </nav>

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-start gap-5 mb-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`https://i.ytimg.com/vi/${v.videoId}/mqdefault.jpg`} alt="" className="w-40 aspect-video rounded-lg object-cover shrink-0" style={{ border: '1px solid var(--border)' }} />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold leading-snug">{v.title}</h1>
          <div className="flex flex-wrap gap-2 mt-3 text-sm">
            <Chip href={v.blogUrl}>Blog post ↗</Chip>
            <Chip href={`https://www.youtube.com/watch?v=${v.videoId}`}>YouTube ↗</Chip>
            <Chip href={data.sheetUrl}>Data sheet ↗</Chip>
          </div>
          <Timeline blog={v.blogPublished} video={v.videoPublished} added={v.addedOn} />
        </div>
        <div className="md:text-right text-sm shrink-0">
          <div style={{ color: 'var(--ink-2)' }}>Updated {data.updatedLabel}</div>
          <div className="flex md:justify-end flex-wrap gap-1.5 mt-2">
            {data.sources.map((s) => (
              <span
                key={s.name}
                title={s.ok ? `${s.name}: connected` : `${s.name}: ${s.detail}`}
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}
              >
                <span aria-hidden style={{ color: s.ok ? 'var(--good)' : 'var(--critical)' }}>{s.ok ? '●' : '▲'}</span>
                {s.name}
                <span className="sr-only">{s.ok ? 'connected' : `error: ${s.detail}`}</span>
              </span>
            ))}
          </div>
          <button onClick={() => setShowHowTo((x) => !x)} className="text-xs underline mt-2" style={{ color: 'var(--ink-3)' }}>
            How do I refresh this?
          </button>
          {showHowTo && (
            <p className="text-xs mt-1 max-w-64 md:ml-auto text-left" style={{ color: 'var(--ink-2)' }}>
              It refreshes automatically every day at 9:00 AM (or when the Mac next wakes). To refresh now, run <code>npm run videos:snapshot</code> in the app folder, then reload this page.
            </p>
          )}
        </div>
      </header>

      {issues.length > 0 && (
        <div className="rounded-xl px-4 py-3 mb-6 flex gap-3 text-sm" style={{ background: 'var(--warning-wash)', border: '1px solid var(--border)' }} role="status">
          <span aria-hidden style={{ color: 'var(--warning)' }}>▲</span>
          <div>
            <div className="font-medium">Needs attention</div>
            <ul className="mt-0.5" style={{ color: 'var(--ink-2)' }}>{issues.map((i) => <li key={i}>{i}</li>)}</ul>
          </div>
        </div>
      )}

      {/* Filters: one row, scope everything below */}
      <div className="viz-card px-4 py-3 mb-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Date range preset">
          {PRESETS.map((p) => (
            <Pill key={p.key} active={preset === p.key} onClick={() => choosePreset(p.key)}>{p.label}</Pill>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label className="flex items-center gap-1.5">
            <span style={{ color: 'var(--ink-3)' }}>From</span>
            <input
              type="date"
              value={from}
              min={first}
              max={to}
              onChange={(e) => { if (e.target.value) { setFrom(e.target.value); setPreset('custom'); } }}
              className="rounded-md px-2 py-1 viz-num"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink-1)' }}
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span style={{ color: 'var(--ink-3)' }}>To</span>
            <input
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={(e) => { if (e.target.value) { setTo(minDate(e.target.value, today)); setPreset('custom'); } }}
              className="rounded-md px-2 py-1 viz-num"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink-1)' }}
            />
          </label>
        </div>
        <div className="flex items-center gap-1 rounded-full p-1 md:ml-auto" style={{ background: 'var(--surface-2)' }} role="radiogroup" aria-label="Compare by">
          {(['week', 'month'] as const).map((p) => (
            <button
              key={p}
              role="radio"
              aria-checked={period === p}
              onClick={() => setPeriod(p)}
              className="rounded-full px-3 py-1 text-sm"
              style={period === p ? { background: 'var(--surface)', color: 'var(--ink-1)', fontWeight: 600, boxShadow: '0 1px 2px rgba(0,0,0,.08)' } : { color: 'var(--ink-2)' }}
            >
              {p === 'week' ? 'Week on week' : 'Month on month'}
            </button>
          ))}
        </div>
      </div>

      {/* Metric tiles double as the chart's metric picker */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-4" role="tablist" aria-label="Metric">
        {METRICS.map((m) => {
          const total = m.agg(days, v.addedOn);
          const [a, b] = complete.slice(-2).map((x) => m.agg(x.days, v.addedOn));
          const ch = complete.length >= 2 && a !== null && b !== null && a !== 0 ? (b - a) / Math.abs(a) : null;
          const good = ch === null || ch === 0 ? null : m.invert ? ch < 0 : ch > 0;
          const active = m.key === metricKey;
          return (
            <button
              key={m.key}
              role="tab"
              aria-selected={active}
              onClick={() => setMetricKey(m.key)}
              title={m.hint}
              className="text-left rounded-xl transition-shadow hover:shadow-sm"
              style={{ background: 'var(--surface)', border: active ? '2px solid var(--series-1)' : '1px solid var(--border)', padding: active ? 11 : 12 }}
            >
              <div className="text-xs truncate" style={{ color: 'var(--ink-2)' }}>{m.label}</div>
              <div className="text-2xl font-semibold mt-1">{total === null ? '–' : m.format(total)}</div>
              <div className="text-[11px] mt-0.5 truncate viz-num" style={{ color: good === null ? 'var(--ink-3)' : good ? 'var(--good-text)' : 'var(--bad-text)' }}>
                {ch !== null ? `${ch > 0 ? '▲' : ch < 0 ? '▼' : '■'} ${Math.abs(ch * 100).toFixed(0)}% vs previous ${period}` : `Needs 2 full ${period}s`}
              </div>
            </button>
          );
        })}
      </div>

      <section className="viz-card p-5 mb-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
          <h2 className="text-base font-semibold">{metric.label} · {period === 'week' ? 'week on week' : 'month on month'}</h2>
          <span className="text-xs" style={{ color: 'var(--ink-3)' }}>{metric.hint}</span>
        </div>
        <LineChart
          points={points}
          label={metric.label}
          format={metric.format}
          markerIndex={markerIndex}
          markerLabel={`▶ Video added ${shortDate(v.addedOn)}`}
          invert={metric.invert}
          periodName={period}
        />
        <p className="text-xs mt-2" style={{ color: 'var(--ink-3)' }}>
          Hover a point to see the {period} and its change vs the previous one. Partial {period}s (the current one, or one cut by your dates) aren&apos;t compared, since they&apos;d exaggerate the change.
        </p>
      </section>

      {/* Detail tabs */}
      <div className="flex gap-1 mb-4 border-b" style={{ borderColor: 'var(--border)' }} role="tablist">
        {([['log', period === 'week' ? 'Weekly log' : 'Monthly log'], ['audience', 'YouTube audience'], ['queries', 'Search queries']] as const).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className="px-3 py-2 text-sm -mb-px"
            style={{ color: tab === k ? 'var(--ink-1)' : 'var(--ink-3)', borderBottom: tab === k ? '2px solid var(--ink-1)' : '2px solid transparent', fontWeight: tab === k ? 600 : 400 }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'log' && <PeriodLog buckets={buckets} addedOn={v.addedOn} cols={cols} setCols={setCols} period={period} />}

      {tab === 'audience' && (
        <div className="grid md:grid-cols-2 gap-4">
          <Panel title="Where viewers came from" empty={!data.breakdowns.trafficSources.length}>
            <BarList rows={data.breakdowns.trafficSources.map((b) => ({ ...b, label: SOURCE_LABELS[b.label] ?? b.label }))} />
          </Panel>
          <Panel title="Where it was watched" empty={!data.breakdowns.locations.length}>
            <BarList rows={data.breakdowns.locations.map((b) => ({ ...b, label: LOCATION_LABELS[b.label] ?? b.label }))} />
          </Panel>
          <Panel title="Websites embedding it" empty={!data.breakdowns.embeds.length}>
            <BarList rows={data.breakdowns.embeds} />
          </Panel>
          <Panel title="How long people watch" empty={!data.breakdowns.retention.length} emptyText="YouTube shows this once the video has enough views.">
            <Retention points={data.breakdowns.retention} />
          </Panel>
        </div>
      )}

      {tab === 'queries' && (
        <div className="viz-card overflow-hidden">
          {queries.length ? (
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}>
                <tr>
                  <th className="text-left font-medium px-4 py-2">Search query</th>
                  {(['clicks', 'impressions', 'position'] as const).map((k) => (
                    <th key={k} className="text-right font-medium px-4 py-2" aria-sort={querySort === k ? (k === 'position' ? 'ascending' : 'descending') : 'none'}>
                      <button onClick={() => setQuerySort(k)} className="hover:underline">
                        {k === 'position' ? 'Position' : k[0].toUpperCase() + k.slice(1)}
                        {querySort === k ? (k === 'position' ? ' ↑' : ' ↓') : ''}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="viz-num">
                {queries.map((q) => (
                  <tr key={q.query} className="hover:bg-[var(--surface-2)]" style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="px-4 py-2">{q.query}</td>
                    <td className="px-4 py-2 text-right">{int(q.clicks)}</td>
                    <td className="px-4 py-2 text-right">{int(q.impressions)}</td>
                    <td className="px-4 py-2 text-right">{dec(q.position)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-5 text-sm" style={{ color: 'var(--ink-3)' }}>No search queries yet.</p>
          )}
          <p className="px-4 py-2 text-xs" style={{ color: 'var(--ink-3)', borderTop: '1px solid var(--border)' }}>
            Since the blog went live. Google hides rare queries, so these don&apos;t add up to the totals.
          </p>
        </div>
      )}
    </main>
  );
}

// ---------- pieces ----------

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className="rounded-full px-3 py-1 text-sm transition-colors"
      style={active ? { background: 'var(--ink-1)', color: 'var(--surface)' } : { color: 'var(--ink-2)', border: '1px solid var(--border)' }}
    >
      {children}
    </button>
  );
}

function Chip({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="rounded-full px-3 py-1 hover:underline" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}>
      {children}
    </a>
  );
}

function Timeline({ blog, video, added }: { blog: string; video: string; added: string }) {
  const steps = [
    { d: blog, label: 'Blog live' },
    { d: video, label: 'Video on YouTube' },
    { d: added, label: 'Video added to blog' },
  ];
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-3 text-xs" style={{ color: 'var(--ink-2)' }}>
      {steps.map((s, i) => (
        <li key={s.label} className="flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: i === 2 ? 'var(--series-1)' : 'var(--ink-3)' }} />
          <span>
            <span style={{ color: 'var(--ink-1)', fontWeight: i === 2 ? 600 : 400 }}>{shortDate(s.d)}</span> {s.label}
          </span>
          {i < steps.length - 1 && <span aria-hidden style={{ color: 'var(--axis)' }}>—</span>}
        </li>
      ))}
    </ol>
  );
}

const GROUPS: { key: ColGroup; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'blog', label: 'Blog' },
  { key: 'search', label: 'Google Search' },
];

function PeriodLog({ buckets, addedOn, cols, setCols, period }: { buckets: Bucket[]; addedOn: string; cols: ColGroup; setCols: (c: ColGroup) => void; period: Period }) {
  const show = (g: ColGroup) => cols === 'all' || cols === g;
  const f = (v: number | null, fmt: (x: number) => string = int) => (v === null ? '–' : fmt(v));
  const m = (k: MetricKey, b: Bucket) => METRICS.find((x) => x.key === k)!.agg(b.days, addedOn);
  const th = 'px-3 py-2 font-medium text-right whitespace-nowrap';
  const td = 'px-3 py-2 text-right whitespace-nowrap';
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3" role="radiogroup" aria-label="Columns">
        {GROUPS.map((g) => (
          <button
            key={g.key}
            role="radio"
            aria-checked={cols === g.key}
            onClick={() => setCols(g.key)}
            className="rounded-md px-2.5 py-1 text-xs"
            style={cols === g.key ? { background: 'var(--surface-2)', color: 'var(--ink-1)', fontWeight: 600 } : { color: 'var(--ink-3)' }}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div className="viz-card overflow-x-auto">
        <table className="w-full text-sm viz-num">
          <thead style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}>
            <tr>
              <th className="px-3 py-2 font-medium text-left sticky left-0" style={{ background: 'var(--surface-2)' }}>{period === 'week' ? 'Week' : 'Month'}</th>
              {show('youtube') && <><th className={th}>YT total views</th><th className={th}>YT views</th><th className={th}>Embedded</th></>}
              {show('blog') && <><th className={th}>Page views</th><th className={th}>Plays</th><th className={th}>Play rate</th><th className={th}>Completed</th></>}
              {show('search') && <><th className={th}>Impressions</th><th className={th}>Clicks</th><th className={th}>CTR</th><th className={th}>Position</th></>}
            </tr>
          </thead>
          <tbody>
            {buckets.length === 0 && (
              <tr><td className="px-3 py-4" colSpan={12} style={{ color: 'var(--ink-3)' }}>No days in the selected range.</td></tr>
            )}
            {[...buckets].reverse().map((b) => {
              const hasVideo = addedOn >= b.start && addedOn <= b.end;
              const imp = m('impressions', b);
              const clicks = m('clicks', b);
              return (
                <tr key={b.start} className="hover:bg-[var(--surface-2)]" style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="px-3 py-2 text-left whitespace-nowrap sticky left-0" style={{ background: 'var(--surface)' }}>
                    {b.title.replace('Week of ', '')}
                    {!b.complete && <span className="ml-2 text-[10px] rounded px-1.5 py-0.5" style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}>partial</span>}
                    {hasVideo && <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: 'var(--series-1)' }}>Video added</span>}
                  </td>
                  {show('youtube') && (
                    <>
                      <td className={td}>{f(m('ytTotal', b))}</td>
                      <td className={td}>{f(sumOf(b.days, (d) => d.ytViews))}</td>
                      <td className={td}>{f(sumOf(b.days, (d) => d.ytEmbedded))}</td>
                    </>
                  )}
                  {show('blog') && (
                    <>
                      <td className={td}>{f(m('pageViews', b))}</td>
                      <td className={td}>{f(m('plays', b))}</td>
                      <td className={td}>{f(m('playRate', b), pct)}</td>
                      <td className={td}>{f(sumOf(live(b.days, addedOn), (d) => d.completions))}</td>
                    </>
                  )}
                  {show('search') && (
                    <>
                      <td className={td}>{f(imp)}</td>
                      <td className={td}>{f(clicks)}</td>
                      <td className={td}>{imp ? pct((clicks ?? 0) / imp) : '–'}</td>
                      <td className={td}>{f(m('position', b), dec)}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs mt-2" style={{ color: 'var(--ink-3)' }}>
        Weeks run Monday–Sunday. “–” means no data for that {period} yet; YouTube Analytics and Google Search arrive 2–3 days late. Mixpanel includes team visits.
      </p>
    </div>
  );
}

function Panel({ title, empty, emptyText, children }: { title: string; empty: boolean; emptyText?: string; children: React.ReactNode }) {
  return (
    <div className="viz-card p-5">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {empty ? <p className="text-sm" style={{ color: 'var(--ink-3)' }}>{emptyText ?? 'Waiting for YouTube Analytics (usually 2–3 days after publishing).'}</p> : children}
    </div>
  );
}

function BarList({ rows }: { rows: Bar[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="group text-sm" title={`${r.label}: ${int(r.value)} (${pct(r.value / total)})`}>
          <div className="flex justify-between gap-3">
            <span className="truncate">{r.label}</span>
            <span className="viz-num shrink-0" style={{ color: 'var(--ink-2)' }}>
              {int(r.value)} <span style={{ color: 'var(--ink-3)' }}>· {pct(r.value / total)}</span>
            </span>
          </div>
          <div className="h-1.5 mt-1 rounded-full" style={{ background: 'var(--surface-2)' }}>
            <div className="h-1.5 rounded-full transition-opacity group-hover:opacity-80" style={{ width: `${(r.value / max) * 100}%`, background: 'var(--series-1)' }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Retention({ points }: { points: { ratio: number; watch: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 400;
  const H = 150;
  const max = Math.max(1, ...points.map((p) => p.watch));
  const x = (r: number) => 8 + r * (W - 16);
  const y = (w: number) => 10 + (1 - w / max) * (H - 30);
  const h = hover !== null ? points[hover] : null;
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="Share of viewers still watching at each point of the video"
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const r = (((e.clientX - rect.left) / rect.width) * W - 8) / (W - 16);
          let best = 0;
          points.forEach((p, i) => { if (Math.abs(p.ratio - r) < Math.abs(points[best].ratio - r)) best = i; });
          setHover(best);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <line x1={8} x2={W - 8} y1={H - 20} y2={H - 20} stroke="var(--axis)" />
        <path d={points.map((p, i) => `${i ? 'L' : 'M'}${x(p.ratio).toFixed(1)},${y(p.watch).toFixed(1)}`).join(' ')} fill="none" stroke="var(--series-1)" strokeWidth={2} />
        {h && <circle cx={x(h.ratio)} cy={y(h.watch)} r={4.5} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />}
        <text x={8} y={H - 5} fontSize={10} fill="var(--ink-3)">Start</text>
        <text x={W - 8} y={H - 5} fontSize={10} fill="var(--ink-3)" textAnchor="end">End</text>
      </svg>
      <p className="text-xs mt-1" style={{ color: 'var(--ink-2)' }}>
        {h ? <><strong className="viz-num">{pct(h.watch)}</strong> still watching at {pct(h.ratio)} of the video</> : 'Hover the line to read it.'}
      </p>
    </div>
  );
}
