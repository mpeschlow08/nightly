import Link from "next/link";

import { submitBusinessQuestionAction } from "@/app/owner/intelligence/actions";
import {
  getOwnerBusinessConversationMessages,
  getOwnerBusinessConversations,
} from "@/lib/venue-intelligence/service";

function safeNumber(value: string | string[] | undefined) {
  if (!value || Array.isArray(value)) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.floor(parsed);
}

export default async function OwnerIntelligenceAskPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const selectedConversationId = safeNumber(params.conversation);

  const conversations = await getOwnerBusinessConversations();
  const activeConversationId = selectedConversationId ?? conversations[0]?.id ?? null;
  const messages = activeConversationId ? await getOwnerBusinessConversationMessages(activeConversationId) : [];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.14),_transparent_36%),radial-gradient(circle_at_80%_0%,_rgba(56,189,248,0.12),_transparent_30%),linear-gradient(140deg,_#04070b_0%,_#0b1220_52%,_#101827_100%)] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-[1.75rem] border border-white/10 bg-zinc-950/80 p-5 backdrop-blur-xl">
          <p className="text-xs uppercase tracking-[0.3em] text-teal-200/75">Ask Nightly</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Business Copilot</h1>
          <p className="mt-2 text-sm text-zinc-400">Responses are grounded in your venue data and include confidence/provenance context.</p>
          <div className="mt-5 space-y-2">
            {conversations.length === 0 ? <p className="text-sm text-zinc-500">No conversations yet.</p> : null}
            {conversations.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/owner/intelligence/ask?conversation=${conversation.id}`}
                className={`block rounded-xl border px-3 py-2 text-sm ${conversation.id === activeConversationId ? "border-teal-300/40 bg-teal-500/15 text-teal-100" : "border-white/10 bg-white/5 text-zinc-200"}`}
              >
                <p className="font-medium">{conversation.title}</p>
                <p className="mt-1 text-xs text-zinc-400">#{conversation.id} • {conversation.status}</p>
              </Link>
            ))}
          </div>
          <div className="mt-5">
            <Link href="/owner/intelligence/overview" className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-200">Back to Intelligence</Link>
          </div>
        </aside>

        <section className="rounded-[1.75rem] border border-white/10 bg-zinc-950/80 p-6 backdrop-blur-xl">
          <h2 className="text-xl font-semibold text-white">Ask a business question</h2>
          <p className="mt-2 text-sm text-zinc-400">Examples: Which event needs support this week? What inventory items are at risk tonight? Should we adjust ticket pricing?</p>

          <form action={submitBusinessQuestionAction} className="mt-5 grid gap-3">
            <input type="hidden" name="conversationId" value={activeConversationId ?? ""} />
            <textarea
              name="question"
              rows={4}
              required
              minLength={3}
              maxLength={1200}
              placeholder="Type your question for Nightly…"
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white"
            />
            <div>
              <button type="submit" className="rounded-full border border-fuchsia-300/35 bg-fuchsia-500/15 px-5 py-3 text-sm font-medium text-fuchsia-100">Generate answer</button>
            </div>
          </form>

          <div className="mt-8 space-y-3">
            {messages.length === 0 ? <p className="text-sm text-zinc-500">No messages yet. Ask your first question.</p> : null}
            {messages.map((message) => (
              <article key={message.id} className={`rounded-2xl border p-4 ${message.role === "assistant" ? "border-teal-300/20 bg-teal-500/10" : "border-white/10 bg-black/20"}`}>
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">{message.role}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-100">{message.content}</p>
                <p className="mt-2 text-xs text-zinc-500">Provider: {message.providerUsed ?? "deterministic"} • Model: {message.modelVersion ?? "n/a"}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
