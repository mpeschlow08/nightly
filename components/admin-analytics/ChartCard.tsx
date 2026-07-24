import { ReactNode } from "react";

type ChartCardProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export default function ChartCard({ title, subtitle, children }: ChartCardProps) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_22px_50px_rgba(0,0,0,0.32)] backdrop-blur-xl sm:p-6">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">{subtitle}</p>
        <h2 className="mt-2 text-lg font-semibold text-white sm:text-xl">{title}</h2>
      </div>
      {children}
    </article>
  );
}
