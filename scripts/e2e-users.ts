import { config } from "dotenv";
import { createHash } from "node:crypto";

import { and, eq, gt, isNull, or } from "drizzle-orm";

config({ path: ".env.local" });

type E2EIdentityKey = "consumer" | "dj" | "owner" | "admin" | "limitedAdmin" | "door";

type E2EIdentitySpec = {
  key: E2EIdentityKey;
  envKey: string;
  dbRole: "consumer" | "dj" | "owner" | "admin";
  clerkFirstName: string;
  clerkLastName: string;
};

type ClerkUser = {
  id: string;
  email_addresses?: Array<{ email_address?: string }>;
};

type EnsureClerkResult = {
  key: E2EIdentityKey;
  email: string;
  clerkUserId: string | null;
  status: "existing" | "created" | "missing" | "manual";
  detail?: string;
};

const E2E_SPECS: E2EIdentitySpec[] = [
  { key: "consumer", envKey: "E2E_CONSUMER_EMAIL", dbRole: "consumer", clerkFirstName: "E2E", clerkLastName: "Consumer" },
  { key: "dj", envKey: "E2E_DJ_EMAIL", dbRole: "dj", clerkFirstName: "E2E", clerkLastName: "DJ" },
  { key: "owner", envKey: "E2E_OWNER_EMAIL", dbRole: "owner", clerkFirstName: "E2E", clerkLastName: "Owner" },
  { key: "admin", envKey: "E2E_ADMIN_EMAIL", dbRole: "admin", clerkFirstName: "E2E", clerkLastName: "Admin" },
  { key: "limitedAdmin", envKey: "E2E_LIMITED_ADMIN_EMAIL", dbRole: "admin", clerkFirstName: "E2E", clerkLastName: "LimitedAdmin" },
  { key: "door", envKey: "E2E_DOOR_EMAIL", dbRole: "consumer", clerkFirstName: "E2E", clerkLastName: "Door" },
];

const ADMIN_PERMISSIONS = [
  "users:view",
  "users:modify",
  "users:suspend",
  "venues:view",
  "venues:approve",
  "venues:suspend",
  "djs:view",
  "djs:approve",
  "events:view",
  "events:moderate",
  "bookings:view",
  "bookings:override",
  "tickets:view",
  "tickets:override",
  "payments:view",
  "refunds:approve",
  "disputes:view",
  "disputes:resolve",
  "fraud:view",
  "fraud:resolve",
  "reports:view",
  "content:moderate",
  "support:view",
  "support:resolve",
  "analytics:view",
  "revenue:view",
  "subscriptions:view",
  "flags:manage",
  "jobs:manage",
  "health:view",
  "announcements:publish",
  "exports:create",
  "audit:view",
  "support_view:use",
  "roles:manage",
] as const;

const LIMITED_ADMIN_PERMISSIONS = [
  "users:view",
  "venues:view",
  "djs:view",
  "events:view",
  "bookings:view",
  "tickets:view",
  "analytics:view",
  "health:view",
  "audit:view",
] as const;

function getEnvironmentLabel() {
  return (process.env.APP_ENV ?? process.env.NODE_ENV ?? "development").toLowerCase();
}

function assertSafeEnvironment() {
  const env = getEnvironmentLabel();
  if (["production", "preview", "staging"].includes(env)) {
    throw new Error(`e2e user operations are disabled in ${env} environment`);
  }
}

function validEmail(value: string | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) {
    return null;
  }

  return trimmed;
}

function getConfiguredIdentities() {
  return E2E_SPECS.map((spec) => ({
    ...spec,
    email: validEmail(process.env[spec.envKey]),
  }));
}

function tokenHash(input: string, length = 10) {
  return createHash("sha256").update(input).digest("hex").slice(0, length);
}

function buildHandle(prefix: string, email: string) {
  return `${prefix}_${tokenHash(email, 12)}`;
}

function buildFriendCode(email: string) {
  return `FRIEND-${tokenHash(`friend:${email}`, 8).toUpperCase()}`;
}

function buildFriendQrToken(email: string) {
  return `qr_${tokenHash(`friend_qr:${email}`, 24)}`;
}

function clerkBaseUrl() {
  return (process.env.CLERK_API_URL ?? "https://api.clerk.com/v1").replace(/\/$/, "");
}

function requireClerkSecret() {
  const secret = process.env.CLERK_SECRET_KEY?.trim();
  if (!secret) {
    throw new Error("CLERK_SECRET_KEY is required for this command");
  }

  return secret;
}

async function clerkRequest(path: string, init?: RequestInit) {
  const secret = requireClerkSecret();
  const response = await fetch(`${clerkBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  return response;
}

async function findClerkUserByEmail(email: string): Promise<ClerkUser | null> {
  const query = new URLSearchParams({ email_address: email });
  const response = await clerkRequest(`/users?${query.toString()}`, { method: "GET" });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json() as ClerkUser[];
  return payload[0] ?? null;
}

async function createClerkUser(spec: E2EIdentitySpec, email: string): Promise<EnsureClerkResult> {
  const response = await clerkRequest("/users", {
    method: "POST",
    body: JSON.stringify({
      email_address: [email],
      first_name: spec.clerkFirstName,
      last_name: spec.clerkLastName,
      skip_password_checks: true,
      skip_password_requirement: true,
      public_metadata: {
        nightlyTestUser: true,
        nightlyRole: spec.key,
      },
      private_metadata: {
        nightlyEnvironment: getEnvironmentLabel(),
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return {
      key: spec.key,
      email,
      clerkUserId: null,
      status: "manual",
      detail: detail.slice(0, 500),
    };
  }

  const user = await response.json() as ClerkUser;
  return {
    key: spec.key,
    email,
    clerkUserId: user.id,
    status: "created",
  };
}

async function ensureClerkIdentity(spec: E2EIdentitySpec, email: string): Promise<EnsureClerkResult> {
  const existing = await findClerkUserByEmail(email);
  if (existing?.id) {
    return {
      key: spec.key,
      email,
      clerkUserId: existing.id,
      status: "existing",
    };
  }

  return createClerkUser(spec, email);
}

async function getDb() {
  const [{ db }, schema] = await Promise.all([import("../db"), import("../db/schema")]);
  return { db, schema };
}

async function ensureUserRecord(input: {
  clerkUserId: string;
  role: "consumer" | "dj" | "owner" | "admin";
}) {
  const { db, schema } = await getDb();
  const now = new Date();
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.clerkUserId, input.clerkUserId),
  });

  if (!existing) {
    const [created] = await db.insert(schema.users).values({
      clerkUserId: input.clerkUserId,
      role: input.role,
      accountStatus: "active",
      isOnboarded: true,
      isVerified: true,
      lastLoginAt: now,
      createdAt: now,
      updatedAt: now,
    }).returning();

    return created;
  }

  const [updated] = await db.update(schema.users)
    .set({
      role: input.role,
      accountStatus: "active",
      isOnboarded: true,
      isVerified: true,
      updatedAt: now,
    })
    .where(eq(schema.users.id, existing.id))
    .returning();

  return updated;
}

async function ensureConsumerFixture(user: { id: number; clerkUserId: string }, email: string) {
  const { db, schema } = await getDb();
  const now = new Date();
  const profile = await db.query.socialProfiles.findFirst({
    where: eq(schema.socialProfiles.userId, user.id),
  });

  const displayName = "E2E Consumer";
  const handle = buildHandle("beta_consumer", email);
  const friendCode = buildFriendCode(email);
  const friendQrToken = buildFriendQrToken(email);

  if (!profile) {
    await db.insert(schema.socialProfiles).values({
      userId: user.id,
      clerkUserId: user.clerkUserId,
      displayName,
      handle,
      avatarUrl: "https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=256&h=256&fit=crop",
      bio: "Nightly E2E consumer fixture",
      favoriteGenresJson: JSON.stringify(["House", "Techno"]),
      friendCode,
      friendQrToken,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    await db.update(schema.socialProfiles)
      .set({
        displayName,
        avatarUrl: profile.avatarUrl ?? "https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=256&h=256&fit=crop",
        bio: profile.bio ?? "Nightly E2E consumer fixture",
        updatedAt: now,
      })
      .where(eq(schema.socialProfiles.id, profile.id));
  }

  const preferences = await db.query.socialPreferences.findFirst({
    where: eq(schema.socialPreferences.userId, user.id),
  });

  if (!preferences) {
    await db.insert(schema.socialPreferences).values({
      userId: user.id,
      allowFriendRequests: true,
      allowGroupInvites: true,
      allowMeetRequests: true,
      showActivityFeed: true,
      showPresence: true,
      shareApproximateLocation: false,
      shareExactLocation: false,
      favoriteNightlifeDaysJson: JSON.stringify(["friday", "saturday"]),
      createdAt: now,
      updatedAt: now,
    });
  }

  const privacy = await db.query.privacySettings.findFirst({
    where: eq(schema.privacySettings.userId, user.id),
  });

  if (!privacy) {
    await db.insert(schema.privacySettings).values({
      userId: user.id,
      profileVisibility: "friends",
      presenceVisibility: "friends",
      activityVisibility: "friends",
      locationVisibility: "close_friends",
      allowFriendRequests: true,
      allowMutualFriends: true,
      allowSearchIndexing: true,
      showSharedFriends: true,
      showSocialBadges: true,
      exactLocationShareAllowed: false,
      createdAt: now,
      updatedAt: now,
    });
  }
}

async function ensureDjFixture(user: { id: number; clerkUserId: string }, email: string) {
  const { db, schema } = await getDb();
  const now = new Date();
  const username = buildHandle("beta_dj", email);

  let profile = await db.query.djProfiles.findFirst({
    where: eq(schema.djProfiles.userId, user.id),
  });

  if (!profile) {
    [profile] = await db.insert(schema.djProfiles).values({
      userId: user.id,
      stageName: "E2E Test DJ",
      username,
      bio: "Nightly beta DJ fixture",
      city: "New York",
      genres: ["House", "Afro House"],
      bookingEmail: email,
      isAvailableForBooking: true,
      yearsPerforming: 4,
      rateCents: 150000,
      createdAt: now,
      updatedAt: now,
    }).returning();
  }

  const existingMix = await db.query.djSampleMixes.findFirst({
    where: eq(schema.djSampleMixes.djProfileId, profile.id),
  });

  if (!existingMix) {
    await db.insert(schema.djSampleMixes).values({
      djProfileId: profile.id,
      title: "E2E Featured Mix",
      description: "Fixture mix for beta QA",
      audioUrl: "https://example.com/nightly/e2e/featured-mix.mp3",
      audioFilename: "featured-mix.mp3",
      durationSeconds: 1800,
      isFeatured: true,
      isPublic: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  const availability = await db.query.djAvailability.findFirst({
    where: eq(schema.djAvailability.djProfileId, profile.id),
  });

  if (!availability) {
    const nextFriday = new Date(now);
    nextFriday.setDate(now.getDate() + ((5 - now.getDay() + 7) % 7 || 7));

    await db.insert(schema.djAvailability).values({
      djProfileId: profile.id,
      availabilityDate: nextFriday.toISOString().slice(0, 10),
      startTime: "21:00",
      endTime: "02:00",
      timezone: "America/New_York",
      isBlocked: false,
      genresJson: JSON.stringify(["House", "Afro House"]),
      hourlyPricingCents: 15000,
      nightlyPricingCents: 150000,
      notes: "Nightly e2e fixture availability",
      createdAt: now,
      updatedAt: now,
    });
  }
}

async function ensureOwnerFixture(user: { id: number; clerkUserId: string }) {
  const { db, schema } = await getDb();
  const now = new Date();
  const venueSlug = "nightly-e2e-owner-venue";

  let venue = await db.query.venues.findFirst({
    where: eq(schema.venues.slug, venueSlug),
  });

  if (!venue) {
    [venue] = await db.insert(schema.venues).values({
      name: "Nightly E2E Owner Venue",
      slug: venueSlug,
      city: "New York",
      state: "NY",
      description: "Development-only venue fixture for beta QA",
      googlePlaceId: "e2e_dev_place_nightly",
      publicationStatus: "published",
      verificationStatus: "verified",
      address: "123 Beta Lane",
      phone: "+1-555-0100",
      websiteUrl: "https://example.com/nightly-e2e-owner",
      createdAt: now,
      updatedAt: now,
    }).returning();
  }

  const membership = await db.query.venueMembers.findFirst({
    where: and(
      eq(schema.venueMembers.venueId, venue.id),
      eq(schema.venueMembers.clerkUserId, user.clerkUserId)
    ),
  });

  if (!membership) {
    await db.insert(schema.venueMembers).values({
      venueId: venue.id,
      clerkUserId: user.clerkUserId,
      role: "owner",
      createdAt: now,
    });
  }

  const availability = await db.query.venueAvailability.findFirst({
    where: eq(schema.venueAvailability.venueId, venue.id),
  });

  if (!availability) {
    await db.insert(schema.venueAvailability).values({
      venueId: venue.id,
      availabilityDate: now.toISOString().slice(0, 10),
      startTime: "20:00",
      endTime: "03:00",
      timezone: "America/New_York",
      privateEventAvailable: true,
      tableInventoryJson: JSON.stringify({ standard: 8, vip: 3 }),
      createdAt: now,
      updatedAt: now,
    });
  }

  return venue;
}

async function ensureAdminRoleWithPermissions(key: "super_admin" | "limited_admin", permissions: readonly string[]) {
  const { db, schema } = await getDb();
  const now = new Date();

  let role = await db.query.adminRoles.findFirst({
    where: eq(schema.adminRoles.key, key),
  });

  if (!role) {
    [role] = await db.insert(schema.adminRoles).values({
      key,
      label: key === "super_admin" ? "Super Admin" : "Limited Admin",
      description: key === "super_admin" ? "Full beta admin access" : "Restricted beta admin access",
      isSystem: true,
      createdAt: now,
      updatedAt: now,
    }).returning();
  }

  const existingPermissions = await db
    .select({ permission: schema.adminRolePermissions.permission })
    .from(schema.adminRolePermissions)
    .where(eq(schema.adminRolePermissions.roleId, role.id));

  const existingSet = new Set(existingPermissions.map((item) => item.permission));

  for (const permission of permissions) {
    if (!existingSet.has(permission)) {
      await db.insert(schema.adminRolePermissions).values({
        roleId: role.id,
        permission,
        createdAt: now,
      });
    }
  }

  return role;
}

async function ensureAdminAssignment(clerkUserId: string, roleKey: "super_admin" | "limited_admin", reason: string) {
  const { db, schema } = await getDb();
  const now = new Date();
  const role = await db.query.adminRoles.findFirst({ where: eq(schema.adminRoles.key, roleKey) });

  if (!role) {
    throw new Error(`Missing admin role: ${roleKey}`);
  }

  const active = await db.query.adminAssignments.findFirst({
    where: and(
      eq(schema.adminAssignments.clerkUserId, clerkUserId),
      eq(schema.adminAssignments.roleId, role.id),
      eq(schema.adminAssignments.status, "active"),
      or(isNull(schema.adminAssignments.expiresAt), gt(schema.adminAssignments.expiresAt, now))
    ),
  });

  if (!active) {
    await db.insert(schema.adminAssignments).values({
      clerkUserId,
      roleId: role.id,
      status: "active",
      assignedByClerkUserId: "system_e2e_provisioner",
      reason,
      startsAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }
}

async function ensureDoorFixture(input: {
  user: { id: number; clerkUserId: string };
  ownerVenueId: number;
}) {
  const { db, schema } = await getDb();
  const now = new Date();

  let event = await db.query.events.findFirst({
    where: and(eq(schema.events.venueId, input.ownerVenueId), eq(schema.events.slug, "nightly-e2e-door-event")),
  });

  if (!event) {
    const startsAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    [event] = await db.insert(schema.events).values({
      venueId: input.ownerVenueId,
      slug: "nightly-e2e-door-event",
      title: "Nightly E2E Door Event",
      description: "Development-only event fixture for door scanning",
      eventDate: startsAt,
      startTime: "21:00",
      startsAt,
      timezone: "America/New_York",
      ticketStatus: "on_sale",
      visibility: "public",
      lifecycleStatus: "published",
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    }).returning();
  }

  const assignment = await db.query.doorStaffAssignments.findFirst({
    where: and(
      eq(schema.doorStaffAssignments.eventId, event.id),
      eq(schema.doorStaffAssignments.clerkUserId, input.user.clerkUserId),
      eq(schema.doorStaffAssignments.status, "active")
    ),
  });

  if (!assignment) {
    await db.insert(schema.doorStaffAssignments).values({
      eventId: event.id,
      venueId: event.venueId,
      userId: input.user.id,
      clerkUserId: input.user.clerkUserId,
      permissionJson: JSON.stringify({ scan: true, lookup: true, manualOverride: false }),
      zoneFilterJson: JSON.stringify(["main_floor"]),
      deviceLabel: "E2E Door Device",
      status: "active",
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }
}

async function isTicketScanningFlagEnabled() {
  const { db, schema } = await getDb();
  const env = getEnvironmentLabel();
  const row = await db.query.platformFeatureFlags.findFirst({
    where: and(eq(schema.platformFeatureFlags.key, "feature.ticket_scanning"), eq(schema.platformFeatureFlags.environment, env)),
  });

  if (!row) {
    return false;
  }

  return row.enabled && !row.killSwitch;
}

async function linkIdentityFixtures(results: EnsureClerkResult[]) {
  const resultByKey = new Map(results.map((item) => [item.key, item]));

  const consumer = resultByKey.get("consumer");
  const dj = resultByKey.get("dj");
  const owner = resultByKey.get("owner");
  const admin = resultByKey.get("admin");
  const limitedAdmin = resultByKey.get("limitedAdmin");
  const door = resultByKey.get("door");

  let ownerVenueId: number | null = null;

  for (const entry of results) {
    if (!entry.clerkUserId || entry.status === "manual") {
      continue;
    }

    const spec = E2E_SPECS.find((item) => item.key === entry.key);
    if (!spec) {
      continue;
    }

    const user = await ensureUserRecord({
      clerkUserId: entry.clerkUserId,
      role: spec.dbRole,
    });

    if (entry.key === "consumer") {
      await ensureConsumerFixture(user, entry.email);
    }

    if (entry.key === "dj") {
      await ensureDjFixture(user, entry.email);
    }

    if (entry.key === "owner") {
      const venue = await ensureOwnerFixture(user);
      ownerVenueId = venue.id;
    }

    if (entry.key === "admin") {
      await ensureAdminRoleWithPermissions("super_admin", ADMIN_PERMISSIONS);
      await ensureAdminAssignment(entry.clerkUserId, "super_admin", "Nightly Beta V1 authenticated QA fixture");
    }

    if (entry.key === "limitedAdmin") {
      await ensureAdminRoleWithPermissions("limited_admin", LIMITED_ADMIN_PERMISSIONS);
      await ensureAdminAssignment(entry.clerkUserId, "limited_admin", "Nightly Beta V1 restricted admin QA fixture");
    }
  }

  if (door?.clerkUserId && ownerVenueId && await isTicketScanningFlagEnabled()) {
    const doorUser = await ensureUserRecord({ clerkUserId: door.clerkUserId, role: "consumer" });
    await ensureDoorFixture({ user: doorUser, ownerVenueId });
  }

  if (door?.clerkUserId && !ownerVenueId) {
    throw new Error("door fixture requested but owner fixture is missing");
  }

  const linkedCount = [consumer, dj, owner, admin, limitedAdmin, door].filter((item) => item?.clerkUserId).length;
  console.log(JSON.stringify({ linkedCount, ownerVenueId, ticketScanningFlagEnabled: await isTicketScanningFlagEnabled() }, null, 2));
}

async function verifyIdentityFixtures(results: EnsureClerkResult[]) {
  const { db, schema } = await getDb();
  const failures: string[] = [];
  const now = new Date();

  for (const result of results) {
    if (!result.clerkUserId) {
      failures.push(`${result.key}: missing Clerk identity`);
      continue;
    }

    const user = await db.query.users.findFirst({ where: eq(schema.users.clerkUserId, result.clerkUserId) });
    if (!user) {
      failures.push(`${result.key}: missing users record`);
      continue;
    }

    if (result.key === "consumer") {
      const profile = await db.query.socialProfiles.findFirst({ where: eq(schema.socialProfiles.userId, user.id) });
      if (!profile) failures.push("consumer: missing social profile");
    }

    if (result.key === "dj") {
      const djProfile = await db.query.djProfiles.findFirst({ where: eq(schema.djProfiles.userId, user.id) });
      if (!djProfile) failures.push("dj: missing dj profile");
    }

    if (result.key === "owner") {
      const membership = await db.query.venueMembers.findFirst({ where: eq(schema.venueMembers.clerkUserId, result.clerkUserId) });
      if (!membership) failures.push("owner: missing venue membership");
    }

    if (result.key === "admin") {
      const assignment = await db.query.adminAssignments.findFirst({
        where: and(
          eq(schema.adminAssignments.clerkUserId, result.clerkUserId),
          eq(schema.adminAssignments.status, "active"),
          or(isNull(schema.adminAssignments.expiresAt), gt(schema.adminAssignments.expiresAt, now))
        ),
      });
      if (!assignment) failures.push("admin: missing active assignment");
    }

    if (result.key === "limitedAdmin") {
      const assignment = await db.query.adminAssignments.findFirst({
        where: and(
          eq(schema.adminAssignments.clerkUserId, result.clerkUserId),
          eq(schema.adminAssignments.status, "active"),
          or(isNull(schema.adminAssignments.expiresAt), gt(schema.adminAssignments.expiresAt, now))
        ),
      });
      if (!assignment) failures.push("limitedAdmin: missing active assignment");
    }

    if (result.key === "door") {
      const scanEnabled = await isTicketScanningFlagEnabled();
      if (scanEnabled) {
        const assignment = await db.query.doorStaffAssignments.findFirst({
          where: and(eq(schema.doorStaffAssignments.clerkUserId, result.clerkUserId), eq(schema.doorStaffAssignments.status, "active")),
        });
        if (!assignment) failures.push("door: missing active door assignment");
      }
    }
  }

  if (failures.length > 0) {
    console.error(JSON.stringify({ ok: false, failures }, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({ ok: true, verifiedIdentities: results.length }, null, 2));
}

async function resolveClerkIdentities(mode: "status" | "provision" | "link" | "verify") {
  const identities = getConfiguredIdentities();
  const results: EnsureClerkResult[] = [];

  for (const item of identities) {
    if (!item.email) {
      results.push({ key: item.key, email: "", clerkUserId: null, status: "missing", detail: `missing ${item.envKey}` });
      continue;
    }

    try {
      if (mode === "provision") {
        results.push(await ensureClerkIdentity(item, item.email));
      } else {
        const existing = await findClerkUserByEmail(item.email);
        results.push({
          key: item.key,
          email: item.email,
          clerkUserId: existing?.id ?? null,
          status: existing?.id ? "existing" : "missing",
        });
      }
    } catch (error) {
      results.push({
        key: item.key,
        email: item.email,
        clerkUserId: null,
        status: "manual",
        detail: error instanceof Error ? error.message : "unknown clerk error",
      });
    }
  }

  return results;
}

async function printStatus() {
  const env = getEnvironmentLabel();
  const configured = getConfiguredIdentities();
  const rows = configured.map((item) => ({
    identity: item.key,
    envKey: item.envKey,
    configured: Boolean(item.email),
    email: item.email ?? null,
  }));

  const output: Record<string, unknown> = {
    environment: env,
    canRunProvisioning: !["production", "preview", "staging"].includes(env),
    clerkConfigured: Boolean(process.env.CLERK_SECRET_KEY?.trim()),
    databaseConfigured: Boolean(process.env.DATABASE_URL?.trim()),
    identities: rows,
  };

  if (process.env.CLERK_SECRET_KEY?.trim()) {
    const clerkResults = await resolveClerkIdentities("status");
    output.clerk = clerkResults;
  }

  console.log(JSON.stringify(output, null, 2));
}

function printManualChecklist() {
  console.log("Manual Clerk provisioning checklist:");
  console.log("1. Open Clerk dashboard for the development instance only.");
  console.log("2. Create each missing user with the configured E2E_* email value.");
  console.log("3. Mark each account as test/development in Clerk metadata.");
  console.log("4. Re-run: npm run e2e:users:link and npm run e2e:users:verify");
}

async function main() {
  const command = (process.argv[2] ?? "status").toLowerCase();

  if (command === "status") {
    await printStatus();
    return;
  }

  if (!["provision", "link", "verify"].includes(command)) {
    throw new Error(`unknown command: ${command}`);
  }

  assertSafeEnvironment();

  if (!process.env.CLERK_SECRET_KEY?.trim()) {
    throw new Error("CLERK_SECRET_KEY is required");
  }

  if (!process.env.DATABASE_URL?.trim() && command !== "provision") {
    throw new Error("DATABASE_URL is required for link and verify commands");
  }

  const clerkResults = await resolveClerkIdentities(command === "provision" ? "provision" : "status");
  console.log(JSON.stringify({ clerkResults }, null, 2));

  const hasManual = clerkResults.some((item) => item.status === "manual");

  if (command === "provision" && hasManual) {
    printManualChecklist();
    process.exitCode = 1;
    return;
  }

  if (command === "link") {
    await linkIdentityFixtures(clerkResults.filter((item) => item.email));
    return;
  }

  if (command === "verify") {
    await verifyIdentityFixtures(clerkResults.filter((item) => item.email));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "e2e-users failed");
  process.exitCode = 1;
});
