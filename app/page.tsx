import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserRole } from "@/app/lib/user-roles";

export default async function RootPage() {
  const { userId } = await auth();

  if (!userId) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(140deg,_#04070b_0%,_#0a1020_55%,_#101a2f_100%)] px-4 py-10 text-zinc-100 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,_rgba(34,211,238,0.18),_transparent_32%),radial-gradient(circle_at_90%_10%,_rgba(244,114,182,0.14),_transparent_28%)]" />

        <div className="relative mx-auto flex min-h-[80vh] w-full max-w-6xl items-center">
          <section className="w-full rounded-[2rem] border border-white/10 bg-zinc-950/70 p-8 shadow-[0_0_90px_rgba(34,211,238,0.12)] backdrop-blur-xl sm:p-10 lg:p-14">
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Nightly</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Discover, book, and run nightlife from one premium platform.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-300 sm:text-lg">
              Join as a guest, DJ, or venue owner. Nightly personalizes every screen to your role from the first session.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/sign-up"
                className="rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-3 text-sm font-medium text-white transition hover:opacity-90"
              >
                Create account
              </Link>
              <Link
                href="/sign-in"
                className="rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm font-medium text-zinc-100 transition hover:border-cyan-300/50 hover:bg-cyan-300/10"
              >
                Sign in
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const role = await getUserRole(userId);

  if (!role) {
    redirect("/select-role");
  }

  if (role === "consumer") {
    redirect("/home");
  }

  if (role === "dj") {
    redirect("/dj/dashboard");
  }

  if (role === "owner") {
    redirect("/owner/dashboard");
  }

  redirect("/admin");
}
