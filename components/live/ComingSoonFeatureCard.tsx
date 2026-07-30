import type { ComingSoonFeature } from "@/data/nightly-live";

type Props = {
  feature: ComingSoonFeature;
  onClick: () => void;
};

export default function ComingSoonFeatureCard({ feature, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`nightly-card nightly-card-interactive min-h-[8.8rem] rounded-[1.1rem] border border-white/10 bg-gradient-to-br ${feature.gradientClass} p-4 text-left`}
    >
      <p className="text-sm font-semibold text-white">{feature.title}</p>
      <p className="mt-2 text-xs leading-5 text-zinc-200/90">{feature.summary}</p>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-fuchsia-200/85">Coming Soon</p>
    </button>
  );
}
