import { headers } from "next/headers";

export type RequestContext = {
  requestId: string;
  correlationId: string;
  route?: string;
  actorClerkUserId?: string | null;
};

export const REQUEST_ID_HEADER = "x-request-id";
export const CORRELATION_ID_HEADER = "x-correlation-id";

export function generateRequestId() {
  return crypto.randomUUID();
}

export async function getRequestContext(route?: string): Promise<RequestContext> {
  const h = await headers();
  const requestId = h.get(REQUEST_ID_HEADER) ?? generateRequestId();
  const correlationId = h.get(CORRELATION_ID_HEADER) ?? requestId;

  return {
    requestId,
    correlationId,
    route,
  };
}
