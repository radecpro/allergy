import { createAuthService } from "./auth-service.server";
import { validateAuthRuntimeEnvironment } from "./auth-runtime-config.server";
import { getFirebaseAuth } from "./firebase-admin.server";
import { createIdentityProvider } from "./identity-platform.server";
import { getAppOrigin } from "./request-security.server";
import {
  createAuthSessionManager,
  createFirebaseSessionProvider,
  type FirebaseSessionProvider,
} from "./session.server";
import { createUserRepository } from "./user-repository.server";
import type { UserRepository } from "./types";

export function createProductionAuthDependencies() {
  validateAuthRuntimeEnvironment();
  const appOrigin = getAppOrigin();
  const repository: UserRepository = {
    upsertProviderUser(identity) {
      return createUserRepository().upsertProviderUser(identity);
    },
    findByProviderUid(providerUid) {
      return createUserRepository().findByProviderUid(providerUid);
    },
  };
  const firebaseSessions: FirebaseSessionProvider = {
    create(idToken) {
      return createFirebaseSessionProvider(getFirebaseAuth()).create(idToken);
    },
    verify(sessionCookie, checkRevoked) {
      return createFirebaseSessionProvider(getFirebaseAuth()).verify(
        sessionCookie,
        checkRevoked,
      );
    },
  };
  const sessions = createAuthSessionManager(
    firebaseSessions,
    repository,
    appOrigin,
  );

  return {
    appOrigin,
    authService: createAuthService(
      createIdentityProvider(),
      repository,
      sessions,
    ),
    sessions,
  };
}
