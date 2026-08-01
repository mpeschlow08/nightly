export type SocialRealtimeProvider = "pusher" | "ably" | "supabase" | "socketio" | "noop";

export type SocialRealtimeTopic =
  | { kind: "group"; id: number | string }
  | { kind: "conversation"; id: number | string }
  | { kind: "presence"; id: number | string }
  | { kind: "user"; id: number | string };

export type SocialRealtimeEvent = {
  topic: SocialRealtimeTopic;
  name: string;
  payload: Record<string, unknown>;
};

export type SocialRealtimePublishResult = {
  ok: boolean;
  provider: SocialRealtimeProvider;
  channel: string;
  skipped?: boolean;
};

export type SocialRealtimeClientConfig = {
  provider: SocialRealtimeProvider;
  configured: boolean;
  channels: ReturnType<typeof buildSocialRealtimeChannels>;
};

export interface SocialEncryptionAdapter {
  readonly name: string;
  encrypt<T>(payload: T): Promise<T>;
  decrypt<T>(payload: T): Promise<T>;
}

export interface SocialRealtimeAdapter {
  readonly provider: SocialRealtimeProvider;
  readonly configured: boolean;
  channelFor(topic: SocialRealtimeTopic): string;
  publish(event: SocialRealtimeEvent): Promise<SocialRealtimePublishResult>;
  clientConfig(input: { groupId?: number | null; conversationId?: number | null; userId: number }): SocialRealtimeClientConfig;
}

class NoopEncryptionAdapter implements SocialEncryptionAdapter {
  readonly name = "noop";

  async encrypt<T>(payload: T) {
    return payload;
  }

  async decrypt<T>(payload: T) {
    return payload;
  }
}

class BaseRealtimeAdapter implements SocialRealtimeAdapter {
  constructor(public readonly provider: SocialRealtimeProvider, public readonly configured: boolean) {}

  channelFor(topic: SocialRealtimeTopic) {
    return `social.${topic.kind}.${topic.id}`;
  }

  async publish(event: SocialRealtimeEvent): Promise<SocialRealtimePublishResult> {
    return {
      ok: true,
      provider: this.provider,
      channel: this.channelFor(event.topic),
      skipped: !this.configured,
    };
  }

  clientConfig(input: { groupId?: number | null; conversationId?: number | null; userId: number }): SocialRealtimeClientConfig {
    return {
      provider: this.provider,
      configured: this.configured,
      channels: buildSocialRealtimeChannels(input),
    };
  }
}

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function providerConfigured(provider: SocialRealtimeProvider) {
  switch (provider) {
    case "pusher":
      return Boolean(env("PUSHER_APP_ID") && env("PUSHER_KEY") && env("PUSHER_SECRET") && env("PUSHER_CLUSTER"));
    case "ably":
      return Boolean(env("ABLY_API_KEY"));
    case "supabase":
      return Boolean(env("NEXT_PUBLIC_SUPABASE_URL") && env("SUPABASE_SERVICE_ROLE_KEY"));
    case "socketio":
      return Boolean(env("SOCIAL_SOCKETIO_URL") || env("NEXT_PUBLIC_SOCIAL_SOCKETIO_URL"));
    default:
      return false;
  }
}

function resolveProvider(): SocialRealtimeProvider {
  const raw = env("NEXT_PUBLIC_SOCIAL_REALTIME_PROVIDER").toLowerCase();

  if (raw === "pusher" || raw === "ably" || raw === "supabase" || raw === "socketio") {
    return raw;
  }

  return "noop";
}

export function buildSocialRealtimeChannels(input: { groupId?: number | null; conversationId?: number | null; userId: number }) {
  return {
    user: `social.user.${input.userId}`,
    presence: `social.presence.${input.userId}`,
    group: input.groupId ? `social.group.${input.groupId}` : null,
    conversation: input.conversationId ? `social.conversation.${input.conversationId}` : null,
    typingGroup: input.groupId ? `social.group.${input.groupId}.typing` : null,
    typingConversation: input.conversationId ? `social.conversation.${input.conversationId}.typing` : null,
  };
}

export function createSocialRealtimeAdapter(provider = resolveProvider()): SocialRealtimeAdapter {
  return new BaseRealtimeAdapter(provider, providerConfigured(provider));
}

export const socialEncryptionAdapter = new NoopEncryptionAdapter();

export async function emitSocialRealtimeEvent(event: SocialRealtimeEvent) {
  const adapter = createSocialRealtimeAdapter();
  const encryptedPayload = await socialEncryptionAdapter.encrypt(event.payload);

  return adapter.publish({ ...event, payload: encryptedPayload });
}