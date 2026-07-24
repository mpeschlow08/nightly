import { useId } from "react";

type PlaceholderLineChartProps = {
  points: number[];
  min?: number;
  max?: number;
  strokeClassName?: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function PlaceholderLineChart({
  points,
  min = 0,
  max = 100,
  strokeClassName = "stroke-cyan-300",
}: PlaceholderLineChartProps) {
  const id = useId();
  const width = 100;
  const height = 44;

  const normalized = points.map((value) => {
    const bounded = clamp(value, min, max);
    return (bounded - min) / (max - min || 1);
  });

  const polyline = normalized
    .map((value, index) => {
      const x = (index / Math.max(1, normalized.length - 1)) * width;
      const y = height - value * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="h-56 rounded-2xl border border-white/10 bg-black/25 p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none" role="img" aria-label="Placeholder line chart">
        <defs>
          <linearGradient id={`line-fill-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(0,179,255,0.28)" />
            <stop offset="100%" stopColor="rgba(0,179,255,0.02)" />
          </linearGradient>
        </defs>

        {Array.from({ length: 5 }).map((_, index) => {
          const y = (index / 4) * height;
          return (
            <line
              key={`grid-${index}`}
              x1="0"
              y1={y}
              x2={width}
              y2={y}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="0.4"
              strokeDasharray="1 1"
            />
          );
        })}

        <polygon points={`${polyline} ${width},${height} 0,${height}`} fill={`url(#line-fill-${id})`} />
        <polyline
          points={polyline}
          fill="none"
          strokeWidth="1.2"
          className={strokeClassName}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
