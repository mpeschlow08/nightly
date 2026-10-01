import Link from "next/link";

type Props = { eyebrow: string; title: string; description: string; children: React.ReactNode };

export default function AccountPageShell({ eyebrow, title, description, children }: Props) {
  return (
    <main className="nightly-page mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/profile" className="text-sm text-[color:var(--text-secondary)] hover:text-white">Back to Profile</Link>
      <section className="nightly-card-hero mt-4 rounded-[1.7rem] p-5 sm:p-7">
        <p className="nightly-eyebrow">{eyebrow}</p>
        <h1 className="nightly-display nightly-accent-heading mt-2">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">{description}</p>
      </section>
      <section className="mt-5">{children}</section>
    </main>
  );
}
