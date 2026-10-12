'use client';

import { useEffect, useRef, useState } from 'react';

export type Series = {
  key: string;
  label: string;
  /** CSS colour, e.g. var(--series-1). Follows the metric, never its position in the selection. */
  color: string;
  values: (number | null)[];
  format: (v: number) => string;
  /** Lower is better (search position): drawn so that "up" still means better. */
  invert?: boolean;
  /** Per-point footnote for the tooltip, e.g. "estimate". */
  notes?: (string | undefined)[];
};

type Props = {
  dates: string[];
  series: Series[];
  /** Date to mark with a vertical rule and shade to the right of (the day the video went in). */
  marker?: string;
  markerLabel?: string;
  height?: number;
};

const fmtDate = (d: string, long = false) =>
  new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', {
    ...(long ? { weekday: 'short' } : {}),
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

/**
 * One series: drawn on its real scale. Several series: each is scaled to its own range in the selected
 * dates (0–100%) so lines of very different size can be compared on one axis; the tooltip shows real values.
 */
export default function LineChart({ dates, series, marker, markerLabel, height = 300 }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const single = series.length === 1;
  const endLabels = series.length <= 4;
  const pad = { l: 48, r: endLabels ? 112 : 20, t: 26, b: 30 };
  const n = dates.length;
  const plotH = height - pad.t - pad.b;

  // Each series' own min/max over the selected dates.
  const ranges = series.map((s) => {
    const nums = s.values.filter((v): v is number => v !== null);
    return { min: Math.min(...nums), max: Math.max(...nums), has: nums.length > 0 };
  });

  // Single series: real scale (from 0, or from the best value for an inverted metric).
  const sMin = single && series[0].invert ? Math.max(0, Math.floor(ranges[0].min)) : 0;
  const sMax = single ? niceMax(Math.max(1, ranges[0].has ? ranges[0].max : 1)) : 1;

  /** 0 = bottom, 1 = top. */
  const norm = (si: number, v: number) => {
    const s = series[si];
    if (single) {
      const t = (v - sMin) / (sMax - sMin || 1);
      return s.invert ? 1 - t : t;
    }
    const { min, max } = ranges[si];
    if (s.invert) return max === min ? 0.5 : (max - v) / (max - min);
    return max > 0 ? v / max : 0;
  };

  const x = (i: number) => pad.l + (n > 1 ? (i * (width - pad.l - pad.r)) / (n - 1) : (width - pad.l - pad.r) / 2);
  const y = (t: number) => pad.t + plotH * (1 - t);

  const ticks = [0, 0.5, 1];
  const tickLabel = (t: number) => {
    if (!single) return `${Math.round(t * 100)}%`;
    const v = series[0].invert ? sMax - t * (sMax - sMin) : sMin + t * (sMax - sMin);
    return series[0].format(v);
  };
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor((width - pad.l - pad.r) / 64))));
  const mi = marker ? dates.indexOf(marker) : -1;

  const nearest = (clientX: number) => {
    const px = clientX - wrap.current!.getBoundingClientRect().left;
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    return best;
  };

  // Line-end labels, nudged apart so they don't overlap.
  const ends = series
    .map((s, si) => {
      let i = s.values.length - 1;
      while (i >= 0 && s.values[i] === null) i--;
      return i >= 0 ? { si, i, y: y(norm(si, s.values[i]!)) } : null;
    })
    .filter((e): e is { si: number; i: number; y: number } => e !== null)
    .sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 14) ends[k].y = ends[k - 1].y + 14;

  const anyData = ranges.some((r) => r.has);

  return (
    <div
      ref={wrap}
      className="relative outline-none focus-visible:ring-2 focus-visible:ring-[var(--series-1)] rounded-lg"
      tabIndex={0}
      role="img"
      aria-label={`${series.map((s) => s.label).join(', ')} per day. Use left and right arrow keys to read values.`}
      onPointerMove={(e) => n && setHover(nearest(e.clientX))}
      onPointerLeave={() => setHover(null)}
      onFocus={() => n && setHover((p) => p ?? n - 1)}
      onBlur={() => setHover(null)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') setHover((p) => Math.max(0, (p ?? n) - 1));
        if (e.key === 'ArrowRight') setHover((p) => Math.min(n - 1, (p ?? -1) + 1));
      }}
    >
      <svg width={width} height={height} className="block">
        {mi >= 0 && <rect x={x(mi)} y={pad.t} width={Math.max(0, width - pad.r - x(mi))} height={plotH} fill="var(--series-1-wash)" />}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
            <text x={pad.l - 8} y={y(t) + 4} fontSize={11} textAnchor="end" fill="var(--ink-3)" className="viz-num">
              {tickLabel(t)}
            </text>
          </g>
        ))}
        {dates.map((d, i) =>
          i === n - 1 || (i % labelEvery === 0 && n - 1 - i >= Math.max(1, labelEvery * 0.6)) ? (
            <text key={d} x={x(i)} y={height - 8} fontSize={11} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fill="var(--ink-3)">
              {fmtDate(d)}
            </text>
          ) : null,
        )}
        {mi >= 0 && (
          <g>
            <line x1={x(mi)} x2={x(mi)} y1={pad.t - 8} y2={height - pad.b} stroke="var(--ink-2)" />
            {markerLabel && (
              <text x={x(mi) + 6} y={pad.t - 10} fontSize={11} fill="var(--ink-2)" fontWeight={600}>
                {markerLabel}
              </text>
            )}
          </g>
        )}
        {series.map((s, si) => {
          // Runs of consecutive values: a missing day is a gap, not a drop to zero.
          const runs: { i: number; v: number }[][] = [];
          s.values.forEach((v, i) => {
            if (v === null) return;
            const last = runs.at(-1);
            if (last && last.at(-1)!.i === i - 1) last.push({ i, v });
            else runs.push([{ i, v }]);
          });
          return (
            <g key={s.key}>
              {runs.map((run, k) =>
                run.length > 1 ? (
                  <path
                    key={k}
                    d={run.map((p, j) => `${j ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(norm(si, p.v)).toFixed(1)}`).join(' ')}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                ) : (
                  <circle key={k} cx={x(run[0].i)} cy={y(norm(si, run[0].v))} r={3} fill={s.color} />
                ),
              )}
            </g>
          );
        })}
        {endLabels &&
          ends.map((e) => (
            <text key={series[e.si].key} x={x(e.i) + 8} y={e.y + 4} fontSize={11} fill="var(--ink-2)">
              <tspan fill={series[e.si].color}>●</tspan> {series[e.si].label}
            </text>
          ))}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} stroke="var(--axis)" />
            {series.map((s, si) =>
              s.values[hover] === null ? null : (
                <circle key={s.key} cx={x(hover)} cy={y(norm(si, s.values[hover]!))} r={5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
              ),
            )}
          </g>
        )}
        {!anyData && (
          <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={13} fill="var(--ink-3)">
            No data for the selected dates yet
          </text>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-lg px-3 py-2 text-sm shadow-lg"
          style={{ left: Math.min(Math.max(x(hover) + 12, 0), width - 220), background: 'var(--surface)', border: '1px solid var(--border)', minWidth: 200 }}
        >
          <div className="text-xs mb-1" style={{ color: 'var(--ink-3)' }}>
            {fmtDate(dates[hover], true)}
            {marker && dates[hover] === marker ? ' · video added' : ''}
          </div>
          {series.map((s) => {
            const v = s.values[hover];
            const note = s.notes?.[hover];
            return (
              <div key={s.key} className="flex items-center gap-2 py-0.5">
                <span className="inline-block w-3 h-0.5 rounded shrink-0" style={{ background: s.color }} />
                <span className="font-semibold viz-num">{v === null ? '–' : s.format(v)}</span>
                <span className="text-xs" style={{ color: 'var(--ink-2)' }}>
                  {s.label}
                  {note ? ` (${note})` : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function niceMax(v: number) {
  if (v <= 1) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
