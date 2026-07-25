import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getRoleDestination,
  getUserRole,
  type SelectableUserRole,
} from "@/app/lib/user-roles";
import { selectUserRole } from "./actions";

const roleCards: Array<{
  role: SelectableUserRole;
  title: string;
  subtitle: string;
  buttonLabel: string;
  accent: string;
}> = [
  {
    role: "consumer",
    title: "I'm Going Out",
    subtitle: "Discover nightlife, friends, AI recommendations, and Premium.",
    buttonLabel: "Continue as Consumer",
    accent: "from-cyan-400/60 via-sky-400/30 to-cyan-500/10",
  },
  {
    role: "dj",
    title: "I'm a DJ",
    subtitle:
      "Create a professional profile, upload sample mixes, manage bookings, and get discovered by venues.",
    buttonLabel: "Continue as DJ",
    accent: "from-fuchsia-400/60 via-rose-400/30 to-fuchsia-500/10",
  },
  {
    role: "owner",
    title: "I Own or Manage a Venue",
    subtitle: "Manage venues, events, analytics, staff, and bookings.",
    buttonLabel: "Continue as Venue Owner",
    accent: "from-amber-300/70 via-orange-300/35 to-amber-500/10",
  },
];

type SelectRolePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function hasChangeRoleFlag(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.includes("1");
  }

  return value === "1";
}

export default async function SelectRolePage({ searchParams }: SelectRolePageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const query = await searchParams;
  const isRoleSwitchFlow = hasChangeRoleFlag(query.changeRole);

  const existingRole = await getUserRole(userId);

  if (existingRole && !isRoleSwitchFlow) {
    redirect(getRoleDestination(existingRole));
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[linear-gradient(135deg,_#03060b_0%,_#080d17_45%,_#0d1424_100%)] px-4 py-10 text-zinc-100 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,_rgba(34,211,238,0.2),_transparent_33%),radial-gradient(circle_at_100%_0%,_rgba(244,114,182,0.17),_transparent_26%),radial-gradient(circle_at_50%_100%,_rgba(251,191,36,0.12),_transparent_32%)]" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="max-w-3xl">
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-200/85">Nightly Membership</p>
          <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl lg:text-5xl">Choose your Nightly role.</h1>
          <p className="mt-4 text-base leading-7 text-zinc-300 sm:text-lg">
            Your role tailors the full platform experience, from discovery to bookings and business tools.
          </p>
          {isRoleSwitchFlow ? (
            <p className="mt-5 rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
              Choose how you want to use Nightly. You can switch account types here.
            </p>
          ) : null}
        </header>

        <section className="grid gap-5 lg:grid-cols-3">
          {roleCards.map((card) => (
            <form
              key={card.role}
              action={selectUserRole}
              className="group relative flex h-full flex-col rounded-[1.75rem] border border-white/10 bg-zinc-950/70 p-6 shadow-[0_22px_80px_rgba(3,7,15,0.55)] backdrop-blur-xl"
            >
              <div className={`absolute inset-x-5 top-0 h-px bg-gradient-to-r ${card.accent}`} />
              <input type="hidden" name="role" value={card.role} />

              <div className="inline-flex w-fit rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.25em] text-zinc-300">
                {card.role}
              </div>

              <h2 className="mt-5 text-2xl font-semibold text-white">{card.title}</h2>
              <p className="mt-3 flex-1 text-sm leading-7 text-zinc-300">{card.subtitle}</p>

              <button
                type="submit"
                className="mt-6 rounded-full border border-white/20 bg-white/[0.08] px-4 py-3 text-sm font-medium text-white transition hover:border-cyan-300/50 hover:bg-cyan-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
              >
                {card.buttonLabel}
              </button>
            </form>
          ))}
        </section>
      </div>
    </main>
  );
}
