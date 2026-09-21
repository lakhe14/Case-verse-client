/** Minimal inline-SVG bar chart — no chart library. */
export default function BarChart({ data, xKey, yKey, height = 180, format = (v) => v }) {
  if (!data?.length) return <p className="muted small">No data.</p>;
  const max = Math.max(...data.map((d) => Number(d[yKey]) || 0), 1);
  // Keep bars a sane width when there are only a handful of data points.
  const slots = Math.max(data.length, 10);
  const barW = 100 / slots;

  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
      {data.map((d, i) => {
        const v = Number(d[yKey]) || 0;
        const h = (v / max) * (height - 24);
        return (
          <g key={i}>
            <rect
              x={i * barW + barW * 0.15}
              y={height - 20 - h}
              width={barW * 0.7}
              height={h}
              fill="var(--brand)"
              rx="0.6"
            >
              <title>{`${d[xKey]}: ${format(v)}`}</title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}
