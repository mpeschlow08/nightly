export type SocialCredentialReference = {
  reference: string;
  provider: string;
};

export interface SocialCredentialStore {
  put(input: { venueId: number; platform: string; secret: string }): Promise<SocialCredentialReference>;
  get(reference: string): Promise<{ secret: string; version: number } | null>;
  compareAndSwap(reference: string, expectedVersion: number, secret: string): Promise<boolean>;
  delete(reference: string): Promise<void>;
}

export class UnconfiguredSocialCredentialStore implements SocialCredentialStore {
  async put(): Promise<SocialCredentialReference> {
    throw new Error("credential_store_not_configured");
  }

  async get(): Promise<{ secret: string; version: number } | null> {
    return null;
  }

  async compareAndSwap(): Promise<boolean> {
    throw new Error("credential_store_not_configured");
  }

  async delete(): Promise<void> {
    throw new Error("credential_store_not_configured");
  }
}

let credentialStore: SocialCredentialStore = new UnconfiguredSocialCredentialStore();

export function configureSocialCredentialStore(store: SocialCredentialStore) {
  credentialStore = store;
}

export function getSocialCredentialStore(): SocialCredentialStore {
  return credentialStore;
}
