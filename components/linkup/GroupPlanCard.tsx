import type { GroupPlan } from "@/data/link-up";

type Props = {
  plan: GroupPlan;
};

function statusClass(status: GroupPlan["rsvpStatus"]) {
  if (status === "Confirmed") return "border-emerald-300/35 bg-emerald-500/18 text-emerald-100";
  if (status === "Pending") return "border-violet-300/35 bg-violet-500/18 text-violet-100";
  return "border-amber-300/35 bg-amber-500/18 text-amber-100";
}

export default function GroupPlanCard({ plan }: Props) {
  return (
    <article className="nightly-card rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{plan.groupName}</p>
          <p className="mt-1 text-xs text-zinc-400">Participants: {plan.participantNames.join(", ")}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusClass(plan.rsvpStatus)}`}>
          {plan.rsvpStatus}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-white/10 bg-black/25 p-2.5">
          <dt className="text-zinc-400">Selected Venue</dt>
          <dd className="mt-1 font-medium text-white">{plan.selectedVenue}</dd>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 p-2.5">
          <dt className="text-zinc-400">Planned Time</dt>
          <dd className="mt-1 font-medium text-white">{plan.plannedTime}</dd>
        </div>
      </dl>
    </article>
  );
}
