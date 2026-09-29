export type SessionActor = { userId: number; djProfileId: number };
export type SessionVenueActor = { venueId: number | null; role: string };
export const ARTIST_SESSION_MAX_DURATION_MS = 12 * 60 * 60 * 1000;

export function artistSessionLeaseExpiresAt(startedAt: Date): Date | null {
  const startedAtMs = startedAt.getTime();
  return Number.isSafeInteger(startedAtMs) ? new Date(startedAtMs + ARTIST_SESSION_MAX_DURATION_MS) : null;
}

export function canViewOperationalSessions(actor: SessionVenueActor, venueId: number) {
  return actor.venueId === venueId && (actor.role === "owner" || actor.role === "tech_operator");
}

export function mayAccessArtistSession(actor: SessionActor, session: { userId: number; djProfileId: number }) {
  return actor.userId === session.userId && actor.djProfileId === session.djProfileId;
}

export function withinSessionWindow(session: { venueId: number; status: string; startedAt: Date | null; endedAt: Date | null }, input: { venueId: number; start: Date; end: Date }) {
  const active = session.status === "active" && session.endedAt === null;
  const ended = session.status === "ended" && session.endedAt !== null;
  return (active || ended) && session.venueId === input.venueId && session.startedAt !== null &&
    Number.isFinite(session.startedAt.getTime()) && Number.isFinite(input.start.getTime()) && Number.isFinite(input.end.getTime()) &&
    input.end > input.start && input.start >= session.startedAt && (!ended || input.end <= session.endedAt!);
}

export function sourceRole(type: string): "camera" | "program_audio" | "ambient_audio" | null {
  if (type === "ip_camera") return "camera";
  if (type === "mixer_audio") return "program_audio";
  if (type === "ambient_audio") return "ambient_audio";
  return null;
}