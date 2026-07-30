"use client";

import { useMemo, useState } from "react";

type LineupItem = {
  id: number;
  label: string;
};

type EventLineupOrderClientProps = {
  eventId: number;
  items: LineupItem[];
  action: (formData: FormData) => void;
};

function arrayMove<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export default function EventLineupOrderClient({ eventId, items, action }: EventLineupOrderClientProps) {
  const [order, setOrder] = useState(items);
  const [draggingId, setDraggingId] = useState<number | null>(null);

  const orderedIds = useMemo(() => order.map((item) => item.id).join(","), [order]);

  if (items.length === 0) {
    return <p className="text-xs text-zinc-400">No lineup slots yet.</p>;
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {order.map((item, index) => (
          <li
            key={item.id}
            draggable
            onDragStart={() => setDraggingId(item.id)}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (draggingId == null || draggingId === item.id) {
                return;
              }

              const fromIndex = order.findIndex((candidate) => candidate.id === draggingId);
              const toIndex = order.findIndex((candidate) => candidate.id === item.id);

              if (fromIndex === -1 || toIndex === -1) {
                return;
              }

              setOrder(arrayMove(order, fromIndex, toIndex));
              setDraggingId(null);
            }}
            className="cursor-grab rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-100 active:cursor-grabbing"
          >
            <span className="text-zinc-400">{index + 1}.</span> {item.label}
          </li>
        ))}
      </ul>

      <form action={action} className="flex items-center gap-2">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="orderedLineupIds" value={orderedIds} />
        <button
          type="submit"
          className="rounded-full border border-cyan-300/40 bg-cyan-500/20 px-3 py-1.5 text-xs uppercase tracking-[0.14em] text-cyan-100"
        >
          Save lineup order
        </button>
      </form>
    </div>
  );
}
