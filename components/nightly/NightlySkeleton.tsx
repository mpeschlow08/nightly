type NightlySkeletonProps = {
  className: string;
  delayMs?: number;
};

export default function NightlySkeleton({ className, delayMs }: NightlySkeletonProps) {
  return (
    <div
      className={`${className} animate-pulse rounded bg-white/10`}
      style={delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
      aria-hidden="true"
    />
  );
}
