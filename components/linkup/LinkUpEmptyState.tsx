type Props = {
  title: string;
  description: string;
};

export default function LinkUpEmptyState({ title, description }: Props) {
  return (
    <div className="nightly-card rounded-[1.15rem] border border-dashed border-fuchsia-300/30 bg-fuchsia-500/8 p-5 text-center">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-300">{description}</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button type="button" className="nightly-btn-primary min-h-11 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 text-sm font-semibold text-white">
          Add by Friend Code
        </button>
        <button type="button" className="nightly-btn-secondary min-h-11 rounded-full border border-white/20 bg-white/5 px-4 text-sm font-semibold text-zinc-100">
          Scan Friend QR
        </button>
      </div>
    </div>
  );
}
