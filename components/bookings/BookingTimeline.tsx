import { getBookingStatusLabel } from "@/lib/bookings/lifecycle";
import type { BookingLifecycleStatus } from "@/lib/bookings/types";

export type BookingTimelineEntry = {
  id: number;
  fromStatus: BookingLifecycleStatus | null;
  toStatus: BookingLifecycleStatus;
  actorRole: string | null;
  actorClerkUserId: string;
  note: string | null;
  createdAtIso: string;
};

type BookingTimelineProps = {
  entries: BookingTimelineEntry[];
};

export default function BookingTimeline({ entries }: BookingTimelineProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-zinc-400">No status history yet.</p>;
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-white">{getBookingStatusLabel(entry.toStatus)}</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              {new Date(entry.createdAtIso).toLocaleString()}
            </p>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            {entry.actorRole ?? "system"} • {entry.actorClerkUserId}
          </p>
          {entry.note ? <p className="mt-2 text-sm leading-6 text-zinc-300">{entry.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}
