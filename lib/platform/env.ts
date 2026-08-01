type AppEnv = "development" | "test" | "preview" | "staging" | "production";

type Scope = "server" | "public";

type VarRule = {
  key: string;
  scope: Scope;
  description: string;
  requiredIn: AppEnv[];
  optionalIn?: AppEnv[];
  secret?: boolean;
};

type VarStatus = {
  key: string;
  scope: Scope;
  configured: boolean;
  required: boolean;
  description: string;
  secret: boolean;
};

export type EnvGroupStatus = {
  group: string;
  variables: VarStatus[];
};

export type EnvValidationResult = {
  environment: AppEnv;
  ok: boolean;
  groups: EnvGroupStatus[];
  missingRequired: string[];
};

const ENVIRONMENTS = ["development", "test", "preview", "staging", "production"] as const;

const RULES: Record<string, VarRule[]> = {
  core: [
    { key: "NODE_ENV", scope: "server", description: "Runtime mode", requiredIn: [], optionalIn: ["development", "test", "preview", "staging", "production"] },
    { key: "APP_ENV", scope: "server", description: "Deployment environment label", requiredIn: ["preview", "staging", "production"], optionalIn: ["development", "test"] },
    { key: "NEXT_PUBLIC_APP_ENV", scope: "public", description: "Client environment label", requiredIn: ["preview", "staging", "production"], optionalIn: ["development", "test"] },
    { key: "DATABASE_URL", scope: "server", description: "Primary Postgres connection", requiredIn: ["development", "test", "preview", "staging", "production"], secret: true },
    { key: "OWNER_PORTAL_AUTHORIZED_USER_IDS", scope: "server", description: "Allowed Clerk user ids for owner portal bootstrap access", requiredIn: [], optionalIn: ["development", "test", "preview", "staging", "production"] },
  ],
  clerk: [
    { key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", scope: "public", description: "Clerk publishable key", requiredIn: ["development", "preview", "staging", "production"] },
    { key: "CLERK_SECRET_KEY", scope: "server", description: "Clerk secret key", requiredIn: ["development", "preview", "staging", "production"], secret: true },
    { key: "CLERK_WEBHOOK_SECRET", scope: "server", description: "Clerk webhook signing secret", requiredIn: ["preview", "staging", "production"], optionalIn: ["development", "test"], secret: true },
  ],
  blob: [
    { key: "PUBLIC_BLOB_STORE_ID", scope: "server", description: "Blob store id", requiredIn: ["preview", "staging", "production"], optionalIn: ["development", "test"] },
    { key: "PUBLIC_BLOB_READ_WRITE_TOKEN", scope: "server", description: "Blob upload token", requiredIn: ["preview", "staging", "production"], optionalIn: ["development", "test"], secret: true },
  ],
  maps: [
    { key: "GOOGLE_PLACES_API_KEY", scope: "server", description: "Google Places API key", requiredIn: ["preview", "staging", "production"], optionalIn: ["development", "test"], secret: true },
  ],
  payments: [
    { key: "PAYMENT_PROVIDER", scope: "server", description: "Payment provider adapter key", requiredIn: [], optionalIn: ["development", "test", "preview", "staging", "production"] },
    { key: "STRIPE_SECRET_KEY", scope: "server", description: "Stripe secret key", requiredIn: [], optionalIn: ["development", "test", "preview", "staging", "production"], secret: true },
    { key: "STRIPE_WEBHOOK_SECRET", scope: "server", description: "Stripe webhook secret", requiredIn: [], optionalIn: ["development", "test", "preview", "staging", "production"], secret: true },
  ],
  ai: [
    { key: "VENUE_INTELLIGENCE_AI_PROVIDER", scope: "server", description: "Venue intelligence provider", requiredIn: [], optionalIn: ["development", "test", "preview", "staging", "production"] },
    { key: "VENUE_INTELLIGENCE_AI_KEY", scope: "server", description: "Venue intelligence provider key", requiredIn: [], optionalIn: ["development", "test", "preview", "staging", "production"], secret: true },
    { key: "VENUE_OS_AI_PROVIDER", scope: "server", description: "VenueOS AI provider", requiredIn: [], optionalIn: ["development", "test", "preview", "staging", "production"] },
  ],
  notifications: [
    { key: "EMAIL_PROVIDER", scope: "server", description: "Email provider key", requiredIn: [], optionalIn: ["development", "test", "preview", "staging", "production"] },
    { key: "PUSH_PROVIDER", scope: "server", description: "Push provider key", requiredIn: [], optionalIn: ["development", "test", "preview", "staging", "production"] },
    { key: "SMS_PROVIDER", scope: "server", description: "SMS provider key", requiredIn: [], optionalIn: ["development", "test", "preview", "staging", "production"] },
    { key: "REALTIME_PROVIDER", scope: "server", description: "Realtime provider key", requiredIn: [], optionalIn: ["development", "test", "preview", "staging", "production"] },
  ],
  security: [
    { key: "TICKET_TOKEN_SECRET", scope: "server", description: "Ticket signature secret", requiredIn: ["preview", "staging", "production"], optionalIn: ["development", "test"], secret: true },
    { key: "SOCIAL_TOKEN_SECRET", scope: "server", description: "Social token secret", requiredIn: ["preview", "staging", "production"], optionalIn: ["development", "test"], secret: true },
  ],
  operations: [
    { key: "JOB_SCHEDULER_PROVIDER", scope: "server", description: "Background scheduler provider", requiredIn: [], optionalIn: ["development", "test", "preview", "staging", "production"] },
    { key: "WALLET_PASS_PROVIDER", scope: "server", description: "Wallet pass provider", requiredIn: [], optionalIn: ["development", "test", "preview", "staging", "production"] },
    { key: "CAMERA_LIVE_PROVIDER", scope: "server", description: "Camera/live adapter provider", requiredIn: [], optionalIn: ["development", "test", "preview", "staging", "production"] },
  ],
};

function normalizeEnv(value?: string): AppEnv {
  const raw = (value ?? process.env.APP_ENV ?? process.env.NODE_ENV ?? "development").toLowerCase();

  if (ENVIRONMENTS.includes(raw as AppEnv)) {
    return raw as AppEnv;
  }

  if (raw === "prod") return "production";
  if (raw === "dev") return "development";

  return "development";
}

function hasValue(value: string | undefined) {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  const lower = trimmed.toLowerCase();

  if (
    lower.startsWith("<") ||
    lower.includes("example") ||
    lower.startsWith("your_") ||
    lower.startsWith("replace-with-") ||
    lower === "changeme"
  ) {
    return false;
  }

  return true;
}

export function getEnvironment() {
  return normalizeEnv();
}

export function validateEnvironment(inputEnv?: AppEnv): EnvValidationResult {
  const environment = inputEnv ?? normalizeEnv();
  const groups: EnvGroupStatus[] = [];
  const missingRequired: string[] = [];

  for (const [group, rules] of Object.entries(RULES)) {
    const variables = rules.map((rule) => {
      const required = rule.requiredIn.includes(environment);
      const configured = hasValue(process.env[rule.key]);

      if (required && !configured) {
        missingRequired.push(rule.key);
      }

      return {
        key: rule.key,
        scope: rule.scope,
        configured,
        required,
        description: rule.description,
        secret: Boolean(rule.secret),
      };
    });

    groups.push({ group, variables });
  }

  return {
    environment,
    ok: missingRequired.length === 0,
    groups,
    missingRequired,
  };
}

export function assertEnvironment() {
  const report = validateEnvironment();

  if (!report.ok) {
    throw new Error(
      `Environment validation failed. Missing required variables: ${report.missingRequired.join(", ")}`
    );
  }

  return report;
}

export function getEnvironmentConfigurationStatus() {
  const report = validateEnvironment();

  return {
    environment: report.environment,
    ok: report.ok,
    groups: report.groups.map((group) => ({
      group: group.group,
      configured: group.variables.filter((variable) => variable.configured).length,
      required: group.variables.filter((variable) => variable.required).length,
      missingRequired: group.variables
        .filter((variable) => variable.required && !variable.configured)
        .map((variable) => variable.key),
      variables: group.variables.map((variable) => ({
        key: variable.key,
        scope: variable.scope,
        required: variable.required,
        configured: variable.configured,
        description: variable.description,
      })),
    })),
  };
}
