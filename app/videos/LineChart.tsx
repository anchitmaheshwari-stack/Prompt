'use client';

import { useEffect, useId, useRef, useState } from 'react';

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

type Pt = { x: number; y: number };

const fmtDate = (d: string, long = false) =>
  new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', {
    ...(long ? { weekday: 'short' } : {}),
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

/** Monotone cubic curve through the points (Fritsch–Carlson): smooth, but never overshoots the data. */
function smoothPath(p: Pt[]) {
  if (p.length < 2) return '';
  if (p.length === 2) return `M${p[0].x},${p[0].y}L${p[1].x},${p[1].y}`;
  const n = p.length;
  const dx = p.slice(1).map((q, i) => q.x - p[i].x);
  const slope = p.slice(1).map((q, i) => (q.y - p[i].y) / dx[i]);
  const m = p.map((_, i) => {
    if (i === 0) return slope[0];
    if (i === n - 1) return slope[n - 2];
    const a = slope[i - 1];
    const b = slope[i];
    return a * b <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / a + (dx[i] + 2 * dx[i - 1]) / b);
  });
  let d = `M${p[0].x.toFixed(1)},${p[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${(p[i].x + h).toFixed(1)},${(p[i].y + m[i] * h).toFixed(1)} ${(p[i + 1].x - h).toFixed(1)},${(p[i + 1].y - m[i + 1] * h).toFixed(1)} ${p[i + 1].x.toFixed(1)},${p[i + 1].y.toFixed(1)}`;
  }
  return d;
}

const EASE = '140ms cubic-bezier(0.22, 1, 0.36, 1)';

/**
 * One series: drawn on its real scale. Several series: each is scaled to its own range in the selected
 * dates (0–100%) so lines of very different size can be compared on one axis; the tooltip shows real values.
 */
export default function LineChart({ dates, series, marker, markerLabel, height = 320 }: Props) {
  const gid = useId().replace(/:/g, '');
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);
  // Last hovered point stays put while the overlay fades out.
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const single = series.length === 1;
  const endLabels = series.length <= 4;
  const pad = { l: 48, r: endLabels ? 116 : 20, t: 28, b: 32 };
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

  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const tickLabel = (t: number) => {
    if (!single) return `${Math.round(t * 100)}%`;
    const v = series[0].invert ? sMax - t * (sMax - sMin) : sMin + t * (sMax - sMin);
    return series[0].format(v);
  };
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor((width - pad.l - pad.r) / 64))));
  const mi = marker ? dates.indexOf(marker) : -1;

  const pointAt = (clientX: number) => {
    const px = clientX - wrap.current!.getBoundingClientRect().left;
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    return best;
  };
  const show = (i: number | null) => {
    setHover(i);
    if (i !== null) setShown(i);
  };
  // Re-render only when the pointer crosses into another day; the CSS transitions do the gliding.
  const onMove = (clientX: number) => {
    if (!n) return;
    const i = pointAt(clientX);
    if (i !== hover) show(i);
  };

  // Runs of consecutive values per series: a missing day is a gap, not a drop to zero.
  const runs = series.map((s, si) => {
    const out: Pt[][] = [];
    s.values.forEach((v, i) => {
      if (v === null) return;
      const p = { x: x(i), y: y(norm(si, v)) };
      const last = out.at(-1);
      if (last && s.values[i - 1] !== null && i > 0) last.push(p);
      else out.push([p]);
    });
    return out;
  });

  // Line-end labels, nudged apart so they don't overlap.
  const ends = series
    .map((s, si) => {
      let i = s.values.length - 1;
      while (i >= 0 && s.values[i] === null) i--;
      return i >= 0 ? { si, i, y: y(norm(si, s.values[i]!)) } : null;
    })
    .filter((e): e is { si: number; i: number; y: number } => e !== null)
    .sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 15) ends[k].y = ends[k - 1].y + 15;

  const anyData = ranges.some((r) => r.has);
  const visible = hover !== null;
  const h = Math.min(shown, Math.max(0, n - 1));
  const tipW = 220;
  const tipLeft = Math.min(Math.max(x(h) + 14, 0), width - tipW - 4);
  const tipFlip = x(h) + 14 + tipW > width; // show on the left of the crosshair near the right edge
  const tipX = tipFlip ? Math.max(0, x(h) - tipW - 14) : tipLeft;

  return (
    <div
      ref={wrap}
      className="relative outline-none focus-visible:ring-2 focus-visible:ring-[var(--series-1)] rounded-lg select-none"
      tabIndex={0}
      role="img"
      aria-label={`${series.map((s) => s.label).join(', ')} per day. Use left and right arrow keys to read values.`}
      onPointerMove={(e) => onMove(e.clientX)}
      onPointerLeave={() => show(null)}
      onFocus={() => n && show(hover ?? n - 1)}
      onBlur={() => show(null)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') show(Math.max(0, (hover ?? n) - 1));
        if (e.key === 'ArrowRight') show(Math.min(n - 1, (hover ?? -1) + 1));
      }}
    >
      <svg width={width} height={height} className="block overflow-visible">
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`${gid}-${s.key}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" style={{ stopColor: s.color, stopOpacity: 0.22 }} />
              <stop offset="100%" style={{ stopColor: s.color, stopOpacity: 0 }} />
            </linearGradient>
          ))}
        </defs>

        {mi >= 0 && <rect x={x(mi)} y={pad.t} width={Math.max(0, width - pad.r - x(mi))} height={plotH} fill="var(--series-1-wash)" rx={4} />}

        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeOpacity={t === 0 ? 1 : 0.6} />
            {(t === 0 || t === 0.5 || t === 1) && (
              <text x={pad.l - 10} y={y(t) + 4} fontSize={11} textAnchor="end" fill="var(--ink-3)" className="viz-num">
                {tickLabel(t)}
              </text>
            )}
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
            <line x1={x(mi)} x2={x(mi)} y1={pad.t - 8} y2={height - pad.b} stroke="var(--ink-3)" strokeWidth={1} />
            {markerLabel && (
              <text x={x(mi) + 6} y={pad.t - 12} fontSize={11} fill="var(--ink-2)" fontWeight={600}>
                {markerLabel}
              </text>
            )}
          </g>
        )}

        {/* Lines (with a soft area under a single series). Keyed by metric so a newly added line fades in. */}
        {series.map((s, si) => (
          <g key={s.key} className="viz-line">
            {single &&
              runs[si].map((run, k) =>
                run.length > 1 ? (
                  <path
                    key={`a${k}`}
                    d={`${smoothPath(run)}L${run.at(-1)!.x.toFixed(1)},${y(0).toFixed(1)}L${run[0].x.toFixed(1)},${y(0).toFixed(1)}Z`}
                    fill={`url(#${gid}-${s.key})`}
                  />
                ) : null,
              )}
            {runs[si].map((run, k) =>
              run.length > 1 ? (
                <path key={k} d={smoothPath(run)} fill="none" stroke={s.color} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
              ) : (
                <circle key={k} cx={run[0].x} cy={run[0].y} r={3} fill={s.color} />
              ),
            )}
          </g>
        ))}

        {endLabels &&
          ends.map((e) => (
            <text key={series[e.si].key} x={x(e.i) + 10} y={e.y + 4} fontSize={11} fill="var(--ink-2)" className="viz-line">
              <tspan fill={series[e.si].color}>●</tspan> {series[e.si].label}
            </text>
          ))}

        {/* Hover layer: glides between days and fades in/out. */}
        {n > 0 && (
          <g pointerEvents="none" style={{ opacity: visible ? 1 : 0, transition: `opacity ${EASE}` }}>
            <line
              x1={0} x2={0} y1={pad.t} y2={height - pad.b}
              stroke="var(--axis)" strokeWidth={1}
              style={{ transform: `translateX(${x(h)}px)`, transition: `transform ${EASE}` }}
            />
            {series.map((s, si) =>
              s.values[h] === null ? null : (
                <g key={s.key} style={{ transform: `translate(${x(h)}px, ${y(norm(si, s.values[h]!))}px)`, transition: `transform ${EASE}` }}>
                  <circle r={9} fill={s.color} opacity={0.15} />
                  <circle r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                </g>
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

      {n > 0 && (
        <div
          className="pointer-events-none absolute top-1 left-0 z-10 rounded-xl px-3 py-2.5 text-sm"
          style={{
            width: tipW,
            transform: `translateX(${tipX}px)`,
            opacity: visible ? 1 : 0,
            transition: `transform ${EASE}, opacity ${EASE}`,
            background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
            backdropFilter: 'blur(6px)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
          }}
          aria-hidden={!visible}
        >
          <div className="text-xs mb-1.5" style={{ color: 'var(--ink-3)' }}>
            {fmtDate(dates[h], true)}
            {marker && dates[h] === marker ? ' · video added' : ''}
          </div>
          {series.map((s) => {
            const v = s.values[h];
            const note = s.notes?.[h];
            return (
              <div key={s.key} className="flex items-center gap-2 py-0.5">
                <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="font-semibold viz-num">{v === null ? '–' : s.format(v)}</span>
                <span className="text-xs truncate" style={{ color: 'var(--ink-2)' }}>
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
