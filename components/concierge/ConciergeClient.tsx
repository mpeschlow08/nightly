"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import EventDiscoveryCard from "@/components/home/EventDiscoveryCard";
import VenueDiscoveryCard from "@/components/home/VenueDiscoveryCard";
import type { ExploreDataPayload, HomeDataPayload } from "@/lib/consumer/types";
import type {
  ConciergeApiPayload,
  ConciergeRecommendationPack,
  ConciergeStarterPrompt,
  ConciergeThreadMessage,
  ConciergeThreadPayload,
} from "@/lib/concierge/types";

type ConciergeClientProps = {
  homeData: HomeDataPayload;
  exploreData: ExploreDataPayload;
  starterPrompts: ConciergeStarterPrompt[];
};

type ConversationMessage = Pick<ConciergeThreadMessage, "id" | "role" | "content" | "createdAtIso" | "metadata"> & {
  intent?: ConciergeThreadMessage["intent"];
};

const SESSION_STORAGE_KEY = "nightly.concierge.sessionKey";

type RecommendationKind = "venues" | "events";

function createSessionKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `session_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function formatTimeLabel(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function recordDiscoveryEvent(input: {
  event: "recommendation_click" | "recommendation_save" | "recommendation_share" | "recommendation_impression";
  recommendationType: string;
  itemId: number | string;
  explanationCategory?: string;
}) {
  void fetch("/api/discovery/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    keepalive: true,
  });
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-[1.15rem] border border-cyan-300/20 bg-cyan-500/8 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.24)]">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 motion-safe:animate-pulse" />
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-200/80 motion-safe:animate-pulse [animation-delay:120ms]" />
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-100/80 motion-safe:animate-pulse [animation-delay:240ms]" />
          <span className="ml-2 text-xs uppercase tracking-[0.22em] text-cyan-100/80">Crafting your answer</span>
        </div>
      </div>
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex justify-start">
        <div className="w-[78%] rounded-[1.15rem] border border-white/10 bg-white/[0.04] p-4">
          <div className="h-2.5 w-20 rounded-full bg-white/10" />
          <div className="mt-4 h-3 w-5/6 rounded-full bg-white/10" />
          <div className="mt-2 h-3 w-2/3 rounded-full bg-white/10" />
        </div>
      </div>
      <div className="flex justify-end">
        <div className="w-[70%] rounded-[1.15rem] border border-white/10 bg-white/[0.06] p-4">
          <div className="h-2.5 w-16 rounded-full bg-white/10 ml-auto" />
          <div className="mt-4 h-3 w-full rounded-full bg-white/10" />
          <div className="mt-2 h-3 w-3/4 rounded-full bg-white/10" />
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const assistant = message.role === "assistant";

  return (
    <div className={`flex ${assistant ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] rounded-[1.15rem] border px-4 py-3 text-sm leading-7 shadow-[0_12px_40px_rgba(0,0,0,0.24)] ${
          assistant
            ? "border-cyan-300/20 bg-cyan-500/8 text-zinc-100"
            : "border-white/10 bg-white/6 text-white"
        }`}
      >
        <div className="flex items-center justify-between gap-4 text-[10px] uppercase tracking-[0.24em] text-zinc-400">
          <span>{assistant ? "Concierge" : "You"}</span>
          <span>{formatTimeLabel(message.createdAtIso)}</span>
        </div>
        <p className="mt-2 whitespace-pre-line text-sm text-zinc-100">{message.content}</p>
        {assistant ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.metadata.followUps?.slice(0, 3).map((prompt) => (
              <span
                key={prompt}
                className="rounded-full border border-cyan-300/20 bg-cyan-500/10 px-3 py-1 text-[11px] text-cyan-100"
              >
                {prompt}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RecommendationShelf({
  title,
  subtitle,
  variant,
  venueCards,
  eventCards,
  onBuildMyNight,
}: {
  title: string;
  subtitle: string;
  variant: RecommendationKind;
  venueCards: ConciergeRecommendationPack["recommendedVenues"];
  eventCards: ConciergeRecommendationPack["recommendedEvents"];
  onBuildMyNight: (message: string) => void;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(() => new Set());

  function toggleSave(key: string, itemId: number | string, type: string, explanationCategory?: string) {
    setSavedKeys((current) => {
      const next = new Set(current);
      const nextSaved = !next.has(key);

      if (nextSaved) {
        next.add(key);
        recordDiscoveryEvent({
          event: "recommendation_save",
          recommendationType: type,
          itemId,
          explanationCategory,
        });
      } else {
        next.delete(key);
        recordDiscoveryEvent({
          event: "recommendation_click",
          recommendationType: type,
          itemId,
          explanationCategory,
        });
      }

      return next;
    });
  }

  async function shareItem(titleText: string, href: string, itemId: number | string, type: string, explanationCategory?: string) {
    const shareText = `${titleText} on Nightly`;
    recordDiscoveryEvent({
      event: "recommendation_share",
      recommendationType: type,
      itemId,
      explanationCategory,
    });

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: titleText, text: shareText, url: new URL(href, window.location.origin).toString() });
        return;
      } catch {
        // Fall through to clipboard.
      }
    }

    await navigator.clipboard.writeText(`${shareText} ${new URL(href, window.location.origin).toString()}`);
  }

  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-[#060912] p-4 shadow-[0_20px_80px_rgba(0,0,0,0.28)] sm:p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/80">{title}</p>
          <p className="mt-1 text-sm text-zinc-300">{subtitle}</p>
        </div>
        <Link href="/discover" className="text-xs uppercase tracking-[0.2em] text-cyan-200/80 hover:text-cyan-100">
          Browse more
        </Link>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {variant === "venues" ? (
          <div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {venueCards.length > 0 ? (
                venueCards.map((venue, index) => {
                  const key = `venue-${venue.id}`;
                  const expanded = expandedKey === key;

                  return (
                    <div key={venue.id} className="space-y-2">
                      <VenueDiscoveryCard venue={venue} animationDelayMs={index * 40} />
                      <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] px-3 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setExpandedKey(expanded ? null : key)}
                            className="text-left text-[11px] uppercase tracking-[0.22em] text-cyan-100/90"
                          >
                            Why this recommendation?
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleSave(key, venue.id, "venue", venue.recommendationReasonCode)}
                            className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] transition ${
                              savedKeys.has(key)
                                ? "border-emerald-300/35 bg-emerald-500/15 text-emerald-100"
                                : "border-white/12 bg-white/[0.04] text-zinc-200 hover:border-cyan-300/40 hover:bg-cyan-500/10"
                            }`}
                          >
                            {savedKeys.has(key) ? "Saved" : "Save"}
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {venue.recommendationBadges?.slice(0, 2).map((badge) => (
                            <span key={badge} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-zinc-300">
                              {badge}
                            </span>
                          ))}
                          <button
                            type="button"
                            onClick={() => void shareItem(venue.name, venue.href, venue.id, "venue", venue.recommendationReasonCode)}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-zinc-300 transition hover:border-cyan-300/40 hover:bg-cyan-500/10"
                          >
                            Share
                          </button>
                        </div>
                        {expanded ? (
                          <p className="mt-2 text-xs leading-6 text-zinc-300">
                            {venue.recommendationReason ?? "This pick is ranked by your current vibe, live signals, and neighborhood fit."}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[1.35rem] border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm text-zinc-400 sm:col-span-2 xl:col-span-3">
                  No venue matches yet. Try a different neighborhood, a more specific vibe, or tap Build My Night.
                </div>
              )}
            </div>
          </div>
        ) : null}

        {variant === "events" ? (
          <div>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {eventCards.length > 0 ? (
                eventCards.map((event, index) => {
                  const key = `event-${event.id}`;
                  const expanded = expandedKey === key;

                  return (
                    <div key={event.id} className="space-y-2">
                      <EventDiscoveryCard
                        href={event.href}
                        name={event.name}
                        venueName={event.venueName}
                        neighborhood={event.neighborhood}
                        startTime={event.startTimeLabel}
                        cover={event.cover}
                        ticketStatus={event.ticketStatus}
                        imageUrl={event.imageUrl}
                        isLive={event.isLive}
                        reason={event.recommendationReason}
                        animationDelayMs={index * 40}
                      />
                      <div className="rounded-[1.15rem] border border-white/10 bg-white/[0.03] px-3 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setExpandedKey(expanded ? null : key)}
                            className="text-left text-[11px] uppercase tracking-[0.22em] text-cyan-100/90"
                          >
                            Why this recommendation?
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleSave(key, event.id, "event", event.recommendationReasonCode)}
                            className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] transition ${
                              savedKeys.has(key)
                                ? "border-emerald-300/35 bg-emerald-500/15 text-emerald-100"
                                : "border-white/12 bg-white/[0.04] text-zinc-200 hover:border-cyan-300/40 hover:bg-cyan-500/10"
                            }`}
                          >
                            {savedKeys.has(key) ? "Saved" : "Save"}
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {event.recommendationBadges?.slice(0, 2).map((badge) => (
                            <span key={badge} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-zinc-300">
                              {badge}
                            </span>
                          ))}
                          <button
                            type="button"
                            onClick={() => void shareItem(event.name, event.href, event.id, "event", event.recommendationReasonCode)}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-zinc-300 transition hover:border-cyan-300/40 hover:bg-cyan-500/10"
                          >
                            Share
                          </button>
                          <button
                            type="button"
                            onClick={() => onBuildMyNight(event.name)}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-zinc-300 transition hover:border-cyan-300/40 hover:bg-cyan-500/10"
                          >
                            Build My Night
                          </button>
                        </div>
                        {expanded ? (
                          <p className="mt-2 text-xs leading-6 text-zinc-300">
                            {event.recommendationReason ?? "This event is aligned with your current intent, timing, and the city pulse."}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[1.35rem] border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm text-zinc-400 sm:col-span-2 xl:col-span-3">
                  No event matches yet. Ask for tonight, live now, or a genre. Build My Night can help, too.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function ConciergeClient({ homeData, exploreData, starterPrompts }: ConciergeClientProps) {
  const [sessionKey] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) {
      return stored;
    }

    const nextKey = createSessionKey();
    window.localStorage.setItem(SESSION_STORAGE_KEY, nextKey);
    return nextKey;
  });
  const [thread, setThread] = useState<ConciergeThreadPayload | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [recommendations, setRecommendations] = useState<ConciergeRecommendationPack | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [statusLabel, setStatusLabel] = useState("Connecting to concierge");
  const [errorLabel, setErrorLabel] = useState<string | null>(null);
  const nextMessageId = useRef(1);
  const pendingMessageRef = useRef<string | null>(null);

  const currentPrompts = recommendations?.followUps?.length
    ? recommendations.followUps.map((prompt) => ({ label: prompt, message: prompt }))
    : starterPrompts;
  const conciergeInventory = `${exploreData.venues.length} venues / ${exploreData.events.length} events`;

  useEffect(() => {
    if (!sessionKey) {
      return;
    }

    let ignore = false;

    async function loadThread() {
      try {
        setStatusLabel("Loading your thread");
        const response = await fetch(`/api/concierge?sessionKey=${encodeURIComponent(sessionKey)}`);
        const payload = (await response.json()) as ConciergeApiPayload & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load concierge thread");
        }

        if (ignore) {
          return;
        }

        setThread(payload.thread);
        setMessages(payload.thread.messages);
        setRecommendations(payload.recommendations);

        if (payload.thread.messages.length === 0) {
          setMessages([
            {
              id: 0,
              role: "assistant",
              content: "I’m ready when you are. Ask for live now, low-key, a specific genre, or a crew night.",
              createdAtIso: new Date().toISOString(),
              metadata: {
                followUps: starterPrompts.map((prompt) => prompt.message),
                cityPulse: homeData.cityPulse,
              },
              intent: "general",
            },
          ]);
        }

        setStatusLabel(payload.thread.title);
        setErrorLabel(null);
      } catch (error) {
        console.error(error);
        if (!ignore) {
          setMessages([
            {
              id: 0,
              role: "assistant",
              content: "I could not load your saved thread, but you can still ask me for a vibe and I’ll build a new one.",
              createdAtIso: new Date().toISOString(),
              metadata: { followUps: starterPrompts.map((prompt) => prompt.message), cityPulse: homeData.cityPulse },
              intent: "general",
            },
          ]);
          setStatusLabel("Offline fallback");
          setErrorLabel("I could not load your saved thread, so Nightly is using a lightweight fallback.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadThread();

    return () => {
      ignore = true;
    };
  }, [homeData.cityPulse, sessionKey, starterPrompts]);

  async function sendMessage(nextMessage: string) {
    const trimmed = nextMessage.trim();

    if (!trimmed || !sessionKey) {
      return;
    }

    setIsSending(true);
    setErrorLabel(null);
    pendingMessageRef.current = trimmed;
    const optimisticMessage: ConversationMessage = {
      id: nextMessageId.current++,
      role: "user",
      content: trimmed,
      createdAtIso: new Date().toISOString(),
      metadata: {},
    };

    setMessages((current) => [...current, optimisticMessage]);

    try {
      const response = await fetch("/api/concierge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionKey, message: trimmed }),
      });

      const payload = (await response.json()) as ConciergeApiPayload & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to send concierge message");
      }

      setThread(payload.thread);
      setMessages(payload.thread.messages);
      setRecommendations(payload.recommendations);
      setStatusLabel(payload.thread.title);
      setMessage("");
      setErrorLabel(null);
      pendingMessageRef.current = null;
    } catch (error) {
      console.error(error);
      const failedMessage = pendingMessageRef.current;
      pendingMessageRef.current = null;
      setMessages((current) => current.filter((entry) => entry.content !== failedMessage || entry.role !== "user"));
      setErrorLabel("That answer did not land. Your message is preserved, and you can try again.");
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: "I hit a snag answering that. Try again and I’ll narrow it from the saved thread.",
          createdAtIso: new Date().toISOString(),
          metadata: { followUps: starterPrompts.map((prompt) => prompt.message) },
          intent: "general",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function buildMyNight(defaultPrompt?: string) {
    const prompt = defaultPrompt ?? currentPrompts[0]?.message ?? "Build my night";
    setMessage(prompt);
    void sendMessage(prompt);
  }

  const visibleMessages = messages.length > 0 ? messages : [];

  const cityPulse = recommendations?.cityPulse ?? homeData.cityPulse;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_32%),radial-gradient(circle_at_92%_6%,_rgba(168,85,247,0.12),_transparent_24%),linear-gradient(180deg,_#04070b_0%,_#070b12_58%,_#0b1120_100%)] text-zinc-100">
      <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
          <div className="rounded-[2rem] border border-white/10 bg-[#060912]/90 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:p-7">
            <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-200/80">Nightly AI Concierge</p>
            <h1 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight text-white sm:text-5xl">
              Ask for the exact night you want, and I’ll narrow the city.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">
              Live now, low-key, genre-specific, crew-friendly, or date-night polished. The concierge uses the same Nightly discovery engine as Home and Explore, then keeps your thread saved.
            </p>

            <div className="mt-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {currentPrompts.map((prompt) => (
                <button
                  key={prompt.label}
                  type="button"
                  onClick={() => buildMyNight(prompt.message)}
                  className="shrink-0 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-xs text-zinc-200 transition hover:border-cyan-300/40 hover:bg-cyan-500/10 hover:text-white"
                >
                  {prompt.label}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => buildMyNight()}
                disabled={isSending}
                className="rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Build My Night
              </button>
              <button
                type="button"
                onClick={() => buildMyNight("What is open now with a live crowd?")}
                disabled={isSending}
                className="rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-cyan-300/40 hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Live tonight
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/80">City pulse</p>
                <h2 className="mt-2 text-xl font-semibold text-white">{cityPulse?.headline ?? "Nightly city pulse"}</h2>
                <p className="mt-2 text-sm leading-7 text-zinc-300">{cityPulse?.summary ?? homeData.heroSummary.subtitle}</p>
                <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                  Discovery inventory: {conciergeInventory}
                </p>
              </div>

              <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-4">
                <p className="text-[11px] uppercase tracking-[0.24em] text-cyan-200/80">Thread status</p>
                <h2 className="mt-2 text-xl font-semibold text-white">{statusLabel}</h2>
                <p className="mt-2 text-sm leading-7 text-zinc-300">
                  {thread?.messages.length ? `${thread.messages.length} saved messages` : "Your thread is ready to start."}
                </p>
                <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-zinc-500">Saved thread keeps your vibe between visits.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[#060912]/90 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-200/80">Conversation</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Nightly Concierge</h2>
              </div>
              <Link href="/discover" className="rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.2em] text-zinc-200 transition hover:border-cyan-300/40 hover:bg-cyan-500/10 hover:text-white">
                Explore
              </Link>
            </div>

            <div className="mt-5 max-h-[33rem] space-y-3 overflow-y-auto pr-1">
              {isLoading ? (
                <MessageSkeleton />
              ) : (
                visibleMessages.map((entry) => <MessageBubble key={entry.id} message={entry} />)
              )}
              {isSending ? <TypingIndicator /> : null}
            </div>

            {errorLabel ? (
              <div className="mt-4 rounded-[1.15rem] border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
                <div className="flex items-start justify-between gap-3">
                  <p>{errorLabel}</p>
                  <button type="button" onClick={() => setErrorLabel(null)} className="text-[11px] uppercase tracking-[0.2em] text-amber-100/80">
                    Dismiss
                  </button>
                </div>
              </div>
            ) : null}

            <form
              className="mt-5 rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-3"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage(message);
              }}
            >
              <label className="sr-only" htmlFor="concierge-message">
                Ask the Nightly Concierge
              </label>
              <textarea
                id="concierge-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Ask for live now, a low-key date spot, or a specific genre..."
                rows={3}
                className="w-full resize-none rounded-[1rem] border border-white/10 bg-[#02050a] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-500 focus:border-cyan-300/40"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <p suppressHydrationWarning className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">Saved thread key: {sessionKey ? sessionKey.slice(0, 8) : "..."}</p>
                  <p className="mt-1 text-[11px] text-zinc-500">Press Enter to send, Shift+Enter for a new line.</p>
                </div>
                <button
                  type="submit"
                  disabled={isSending || !message.trim()}
                  className="rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSending ? "Building..." : "Ask concierge"}
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <RecommendationShelf
            title="Best venue matches"
            subtitle="The concierge ranks venues using the same discovery engine as Home and Explore."
            variant="venues"
            venueCards={recommendations?.recommendedVenues ?? homeData.recommended.slice(0, 3)}
            eventCards={[]}
            onBuildMyNight={buildMyNight}
          />
          <RecommendationShelf
            title="Event matches"
            subtitle="Event picks are pulled from the live discovery layer and current city momentum."
            variant="events"
            venueCards={[]}
            eventCards={recommendations?.recommendedEvents ?? homeData.eventsStartingSoon.slice(0, 3)}
            onBuildMyNight={buildMyNight}
          />
        </section>
      </main>
    </div>
  );
}