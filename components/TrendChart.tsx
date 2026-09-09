type Props = {
  title: string;
  dates: string[];
  a: number[];
  b: number[];
  labelA: string;
  labelB: string;
};

/** Server-rendered SVG line chart, two series, no client JS. */
export default function TrendChart({ title, dates, a, b, labelA, labelB }: Props) {
  const weeks = dates;
  const W = 560;
  const H = 220;
  const padL = 36;
  const padR = 12;
  const padT = 16;
  const padB = 40;
  const n = weeks.length;
  const max = Math.max(1, ...a, ...b);
  const step = n > 1 ? (W - padL - padR) / (n - 1) : 0;
  const x = (i: number) => padL + i * step;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const path = (s: number[]) => s.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const ticks = [0, Math.round(max / 2), max];
  const fmt = (w: string) => {
    const d = new Date(w);
    return `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
  };
  const colA = '#2563eb';
  const colB = '#dc2626';
  const total = (s: number[]) => s.reduce((sum, v) => sum + v, 0);
  return (
    <figure className="border border-gray-200 rounded-lg p-3 bg-white">
      <figcaption className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={title}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeWidth={1} />
            <text x={padL - 6} y={y(t) + 4} fontSize={10} textAnchor="end" fill="#6b7280">{t}</text>
          </g>
        ))}
        {weeks.map((w, i) => (
          i % 7 === 0 || i === n - 1 ? (
            <g key={w}>
              <line x1={x(i)} x2={x(i)} y1={padT} y2={H - padB} stroke="#f3f4f6" strokeWidth={1} />
              <text x={x(i)} y={H - padB + 14} fontSize={9} textAnchor="end" fill="#6b7280" transform={`rotate(-40 ${x(i)} ${H - padB + 14})`}>
                {fmt(w)}
              </text>
            </g>
          ) : null
        ))}
        <path d={path(a)} fill="none" stroke={colA} strokeWidth={1.5} />
        <path d={path(b)} fill="none" stroke={colB} strokeWidth={1.5} />
        {a.map((v, i) => <circle key={`a${i}`} cx={x(i)} cy={y(v)} r={1.6} fill={colA} />)}
        {b.map((v, i) => <circle key={`b${i}`} cx={x(i)} cy={y(v)} r={1.6} fill={colB} />)}
      </svg>
      <div className="flex gap-4 text-xs text-gray-700 mt-1">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ background: colA }} />{labelA} (total {total(a)})</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ background: colB }} />{labelB} (total {total(b)})</span>
      </div>
    </figure>
  );
}
