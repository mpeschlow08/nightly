type ErrorLike = {
  code?: string;
  message?: string;
  cause?: unknown;
};

function hasMissingEventsTableSignal(error: unknown, seen: Set<unknown>): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  if (seen.has(error)) {
    return false;
  }

  seen.add(error);

  const candidate = error as ErrorLike;

  if (candidate.code === "42P01") {
    return true;
  }

  if (candidate.code === "42703") {
    return true;
  }

  if (
    typeof candidate.message === "string" &&
    candidate.message.toLowerCase().includes('relation "events" does not exist')
  ) {
    return true;
  }

  if (
    typeof candidate.message === "string" &&
    candidate.message.toLowerCase().includes('relation "venue_business_hours" does not exist')
  ) {
    return true;
  }

  if (
    typeof candidate.message === "string" &&
    candidate.message.toLowerCase().includes("column") &&
    candidate.message.toLowerCase().includes("does not exist")
  ) {
    return true;
  }

  return hasMissingEventsTableSignal(candidate.cause, seen);
}

export function isTableMissingError(error: unknown) {
  return hasMissingEventsTableSignal(error, new Set());
}
