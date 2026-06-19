export type LocalUser = {
  id: string;
  providerUid: string;
  email: string;
  normalizedEmail: string;
};

export type ProviderIdentity = {
  providerUid: string;
  email: string;
};

export type ProviderAuthentication = ProviderIdentity & {
  idToken: string;
};

export interface UserRepository {
  upsertProviderUser(identity: ProviderIdentity): Promise<LocalUser>;
  findByProviderUid(providerUid: string): Promise<LocalUser | null>;
}
