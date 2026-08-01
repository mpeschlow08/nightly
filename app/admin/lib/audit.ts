import { db } from "@/db";
import { adminAuditEvents, auditLogs } from "@/db/schema";

type JsonValue = Record<string, unknown> | Array<unknown> | string | number | boolean | null;

type AdminAuditInput = {
  actorClerkUserId: string;
  action: string;
  resourceType: string;
  resourceId: string | number;
  scope: string;
  reason: string;
  before?: JsonValue;
  after?: JsonValue;
  metadata?: JsonValue;
  correlationId?: string | null;
  relatedCaseId?: number | null;
};

function toJson(value: JsonValue | undefined) {
  if (typeof value === "undefined") {
    return null;
  }

  return JSON.stringify(value);
}

export async function writeAdminAuditEvent(input: AdminAuditInput) {
  await db.transaction(async (tx) => {
    await tx.insert(adminAuditEvents).values({
      actorClerkUserId: input.actorClerkUserId,
      actorRole: "admin",
      action: input.action,
      resourceType: input.resourceType,
      resourceId: String(input.resourceId),
      scope: input.scope,
      reason: input.reason,
      beforeJson: toJson(input.before),
      afterJson: toJson(input.after),
      metadataJson: toJson(input.metadata) ?? "{}",
      correlationId: input.correlationId ?? null,
      relatedCaseId: input.relatedCaseId ?? null,
    });

    // Also mirror to the existing generic audit stream for backward compatibility.
    await tx.insert(auditLogs).values({
      actorClerkUserId: input.actorClerkUserId,
      actorRole: "admin",
      entityType: input.resourceType,
      entityId: String(input.resourceId),
      action: input.action,
      previousValuesJson: toJson(input.before),
      nextValuesJson: toJson(input.after),
      metadataJson: toJson({
        scope: input.scope,
        reason: input.reason,
        correlationId: input.correlationId ?? null,
        relatedCaseId: input.relatedCaseId ?? null,
        extra: input.metadata,
      }),
    });
  });
}
