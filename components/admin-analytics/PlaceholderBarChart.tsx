type PlaceholderBarChartProps = {
  values: number[];
  max?: number;
  barClassName?: string;
};

export default function PlaceholderBarChart({
  values,
  max = 100,
  barClassName = "bg-gradient-to-t from-cyan-500/50 to-violet-400/70",
}: PlaceholderBarChartProps) {
  return (
    <div className="h-56 rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex h-full items-end gap-2">
        {values.map((value, index) => {
          const height = `${Math.max(8, Math.min(100, (value / (max || 1)) * 100))}%`;

          return (
            <div key={`bar-${index}`} className="flex-1">
              <div className="relative h-full rounded-xl border border-white/5 bg-white/5 p-1">
                <div className={`absolute bottom-1 left-1 right-1 rounded-lg ${barClassName}`} style={{ height }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
