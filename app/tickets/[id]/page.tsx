import Link from "next/link";
import { notFound } from "next/navigation";

import { getTicketById } from "../lib/data";
import { issueTicketToken } from "@/lib/ticketing/token";
import { getTicketStatusLabel, getTicketStatusTone } from "@/lib/ticketing/lifecycle";
import type { TicketStatus } from "@/lib/ticketing/types";

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ticketId = Number(id);

  if (!Number.isFinite(ticketId)) {
    notFound();
  }

  const ticket = await getTicketById(ticketId);

  if (!ticket) {
    notFound();
  }

  let qrToken: string | null = null;
  try {
    qrToken = issueTicketToken(ticket.tokenId);
  } catch {
    qrToken = null;
  }

  return (
    <section className="rounded-[1.7rem] border border-white/10 bg-zinc-950/80 p-6 shadow-[0_0_70px_rgba(8,145,178,0.12)] backdrop-blur-xl sm:p-8">
      <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">Ticket Detail</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{ticket.eventTitle}</h1>
      <p className="mt-2 text-sm text-zinc-300">{ticket.venueName} • {new Date(ticket.eventStartsAt).toLocaleString()}</p>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Status</p>
          <p className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs ${getTicketStatusTone(ticket.status as TicketStatus)}`}>{getTicketStatusLabel(ticket.status as TicketStatus)}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Transfer</p>
          <p className="mt-2 text-lg font-medium text-white">{ticket.transferStatus}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Zone</p>
          <p className="mt-2 text-lg font-medium text-white">{ticket.accessZone ?? "General admission"}</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Order</p>
          <p className="mt-2 text-lg font-medium text-white">{ticket.orderNumber}</p>
        </article>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">Holder</p>
          <p className="mt-3 text-sm text-white">{ticket.holderName ?? "Unassigned"}</p>
          <p className="mt-1 text-sm text-zinc-400">{ticket.holderEmail ?? "No email on file"}</p>
          <p className="mt-4 text-xs text-zinc-500">Product: {ticket.productName} ({ticket.productType})</p>
        </article>
        <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-zinc-400">QR Token</p>
          <p className="mt-3 break-all rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-zinc-200">{qrToken ?? ticket.tokenId}</p>
          <p className="mt-3 text-xs text-zinc-500">Door staff validate the signed token, not the raw order record.</p>
        </article>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/tickets" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
          Back to tickets
        </Link>
        <Link href={`/events/${ticket.eventSlug}`} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:border-cyan-400/40 hover:bg-cyan-400/10">
          View event
        </Link>
      </div>
    </section>
  );
}
