import { db } from "@/db";
import { auditLogs } from "@/db/schema";

type JsonValue = Record<string, unknown> | Array<unknown> | string | number | boolean | null;

type AuditLogInput = {
  actorClerkUserId: string;
  actorRole?: string | null;
  entityType: string;
  entityId: string | number;
  action: string;
  previousValues?: JsonValue;
  nextValues?: JsonValue;
  metadata?: JsonValue;
};

function toJsonText(value: JsonValue | undefined) {
  if (typeof value === "undefined") {
    return null;
  }

  return JSON.stringify(value);
}

export async function writeAuditLog(input: AuditLogInput) {
  await db.insert(auditLogs).values({
    actorClerkUserId: input.actorClerkUserId,
    actorRole: input.actorRole ?? null,
    entityType: input.entityType,
    entityId: String(input.entityId),
    action: input.action,
    previousValuesJson: toJsonText(input.previousValues),
    nextValuesJson: toJsonText(input.nextValues),
    metadataJson: toJsonText(input.metadata),
  });
}
