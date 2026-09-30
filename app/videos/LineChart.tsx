'use client';

import { useEffect, useRef, useState } from 'react';

export type Point = {
  /** Short x-axis label, e.g. "22 Sep" or "Sep". */
  label: string;
  /** Tooltip heading, e.g. "Week of 22 Sep". */
  title: string;
  value: number | null;
  /** Shown under the value, e.g. "Partial week". */
  note?: string;
  /** Full period: only full periods are compared with the previous one. */
  complete: boolean;
};

type Props = {
  points: Point[];
  label: string;
  format: (v: number) => string;
  /** Index of the point to mark and shade from (the period the video went in). */
  markerIndex?: number;
  markerLabel?: string;
  /** Lower values are better (search position): the y-axis is flipped so "up" still means good. */
  invert?: boolean;
  /** What "previous" means in the tooltip, e.g. "week". */
  periodName: string;
  height?: number;
};

/** Single-series trend line with a snapping crosshair, tooltip (incl. change vs previous period), and keyboard stepping. */
export default function LineChart({ points, label, format, markerIndex = -1, markerLabel, invert, periodName, height = 260 }: Props) {
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

  const pad = { l: 48, r: 24, t: 24, b: 30 };
  const n = points.length;
  const nums = points.map((p) => p.value).filter((v): v is number => v !== null);
  const hasData = nums.length > 0;
  const lo = invert ? Math.max(0, Math.floor(Math.min(...nums, 1))) : 0;
  const max = niceMax(Math.max(1, ...nums));
  const x = (i: number) => pad.l + (n > 1 ? (i * (width - pad.l - pad.r)) / (n - 1) : (width - pad.l - pad.r) / 2);
  const y = (v: number) => {
    const t = (v - lo) / (max - lo || 1);
    return pad.t + (height - pad.t - pad.b) * (invert ? t : 1 - t);
  };

  // Runs of consecutive values, so a period with no data is a gap rather than a drop to zero.
  const runs: { i: number; v: number }[][] = [];
  points.forEach((p, i) => {
    if (p.value === null) return;
    const last = runs.at(-1);
    if (last && last.at(-1)!.i === i - 1) last.push({ i, v: p.value });
    else runs.push([{ i, v: p.value }]);
  });

  const ticks = [lo, lo + (max - lo) / 2, max];
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor((width - pad.l - pad.r) / 72))));

  const nearest = (clientX: number) => {
    const px = clientX - wrap.current!.getBoundingClientRect().left;
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    return best;
  };

  const h = hover;
  const hp = h !== null ? points[h] : null;
  const prevPoint = h !== null && h > 0 ? points[h - 1] : null;
  const comparable = !!hp?.complete && !!prevPoint?.complete;
  const prev = comparable ? prevPoint!.value : null;
  const change = hp?.value != null && prev !== null && prev !== 0 ? (hp.value - prev) / Math.abs(prev) : null;
  const changeGood = change === null || change === 0 ? null : invert ? change < 0 : change > 0;

  return (
    <div
      ref={wrap}
      className="relative outline-none focus-visible:ring-2 focus-visible:ring-[var(--series-1)] rounded-lg"
      tabIndex={0}
      role="img"
      aria-label={`${label} by ${periodName}. Use left and right arrow keys to read values.`}
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
        {markerIndex >= 0 && markerIndex < n && (
          <rect x={x(markerIndex)} y={pad.t} width={Math.max(0, width - pad.r - x(markerIndex))} height={height - pad.t - pad.b} fill="var(--series-1-wash)" />
        )}
        {ticks.map((t, k) => (
          <g key={k}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
            <text x={pad.l - 8} y={y(t) + 4} fontSize={11} textAnchor="end" fill="var(--ink-3)" className="viz-num">{format(t)}</text>
          </g>
        ))}
        {points.map((p, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={height - 8} fontSize={11} textAnchor={n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fill="var(--ink-3)">
              {p.label}
            </text>
          ) : null,
        )}
        {markerIndex >= 0 && markerIndex < n && (
          <g>
            <line x1={x(markerIndex)} x2={x(markerIndex)} y1={pad.t - 8} y2={height - pad.b} stroke="var(--ink-2)" />
            {markerLabel && (
              <text x={x(markerIndex) + (x(markerIndex) > width - 150 ? -6 : 6)} y={pad.t - 10} fontSize={11} fill="var(--ink-2)" fontWeight={600} textAnchor={x(markerIndex) > width - 150 ? 'end' : 'start'}>
                {markerLabel}
              </text>
            )}
          </g>
        )}
        {runs.map((run, k) =>
          run.length > 1 ? (
            <path
              key={k}
              d={run.map((p, j) => `${j ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}
              fill="none"
              stroke="var(--series-1)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null,
        )}
        {/* Points stay visible: with weekly/monthly data there are few of them. */}
        {points.map((p, i) => (p.value === null ? null : <circle key={i} cx={x(i)} cy={y(p.value)} r={4} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />))}
        {h !== null && (
          <g pointerEvents="none">
            <line x1={x(h)} x2={x(h)} y1={pad.t} y2={height - pad.b} stroke="var(--axis)" />
            {hp?.value != null && <circle cx={x(h)} cy={y(hp.value)} r={6} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />}
          </g>
        )}
        {!hasData && (
          <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={13} fill="var(--ink-3)">No data for this metric in the selected dates yet</text>
        )}
      </svg>
      {hp && (
        <div
          className="pointer-events-none absolute top-2 z-10 rounded-lg px-3 py-2 text-sm shadow-lg"
          style={{ left: Math.min(Math.max(x(h!) + 12, 0), width - 190), background: 'var(--surface)', border: '1px solid var(--border)', minWidth: 170 }}
        >
          <div className="text-xs" style={{ color: 'var(--ink-3)' }}>{hp.title}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: 'var(--series-1)' }} />
            <span className="text-base font-semibold viz-num">{hp.value === null ? 'No data' : format(hp.value)}</span>
          </div>
          <div className="text-xs" style={{ color: 'var(--ink-2)' }}>{label}</div>
          {change !== null && (
            <div className="text-xs mt-1 viz-num" style={{ color: changeGood === null ? 'var(--ink-3)' : changeGood ? 'var(--good-text)' : 'var(--bad-text)' }}>
              {change > 0 ? '▲' : change < 0 ? '▼' : '■'} {Math.abs(change * 100).toFixed(0)}% vs previous {periodName}
            </div>
          )}
          {hp.note && <div className="text-[11px] mt-1" style={{ color: 'var(--ink-3)' }}>{hp.note}</div>}
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
