type Props = {
  open: boolean;
  title: string;
  summary: string;
  onClose: () => void;
};

export default function ComingSoonModal({ open, title, summary, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-end bg-black/70 p-4 sm:place-items-center" role="dialog" aria-modal="true" aria-label="Coming soon preview">
      <button type="button" className="absolute inset-0" aria-label="Close coming soon preview" onClick={onClose} />
      <div className="nightly-fade-in relative z-10 w-full max-w-sm overflow-hidden rounded-[1.5rem] border border-white/15 bg-[#090d19] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.5)]">
        <p className="text-[11px] uppercase tracking-[0.2em] text-fuchsia-200/80">Nightly Live Preview</p>
        <h3 className="mt-2 text-xl font-semibold text-white">{title}</h3>
        <p className="mt-3 text-sm leading-6 text-zinc-300">{summary}</p>
        <div className="mt-4 rounded-xl border border-fuchsia-300/25 bg-fuchsia-500/10 p-3 text-xs text-fuchsia-100/90">
          This capability is in active development and will roll out after launch.
        </div>
        <button
          type="button"
          onClick={onClose}
          className="nightly-btn-primary mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 text-sm font-semibold text-white"
        >
          Back to Live
        </button>
      </div>
    </div>
  );
}
