import {
  ProviderAuthenticationError,
  type IdentityProvider,
} from "./identity-platform.server";
import type { AuthSessionManager } from "./session.server";
import type { LocalUser, UserRepository } from "./types";
import type { ValidatedCredentials } from "./validation";

export const genericAuthenticationError =
  "Nie udało się uwierzytelnić. Sprawdź dane lub spróbuj ponownie później.";

export type AuthenticationResult =
  | { ok: true; user: LocalUser; setCookie: string }
  | { ok: false; error: string; status: 400 | 429 | 503 };

export type AuthFailureEvent = {
  event: "auth_failure";
  operation: "register" | "signIn";
  stage: "provider" | "repository" | "session";
  category: string;
};

export interface AuthServiceLogger {
  error(event: AuthFailureEvent): void;
}

const defaultLogger: AuthServiceLogger = {
  error(event) {
    console.error(JSON.stringify(event));
  },
};

export interface AuthService {
  register(credentials: ValidatedCredentials): Promise<AuthenticationResult>;
  signIn(credentials: ValidatedCredentials): Promise<AuthenticationResult>;
}

export function createAuthService(
  provider: IdentityProvider,
  repository: UserRepository,
  sessions: AuthSessionManager,
  logger: AuthServiceLogger = defaultLogger,
): AuthService {
  async function authenticate(
    operation: "register" | "signIn",
    credentials: ValidatedCredentials,
  ): Promise<AuthenticationResult> {
    let providerUser;

    try {
      providerUser = await provider[operation](
        credentials.email,
        credentials.password,
      );
    } catch (error) {
      if (error instanceof ProviderAuthenticationError) {
        const status =
          error.code === "throttled"
            ? 429
            : error.code === "unavailable" || error.code === "configuration"
              ? 503
              : 400;

        if (status !== 400) {
          logger.error({
            event: "auth_failure",
            operation,
            stage: "provider",
            category: error.code,
          });
        }

        return { ok: false, error: genericAuthenticationError, status };
      }

      logger.error({
        event: "auth_failure",
        operation,
        stage: "provider",
        category: "unexpected",
      });
      return { ok: false, error: genericAuthenticationError, status: 503 };
    }

    let user: LocalUser;

    try {
      user = await repository.upsertProviderUser(providerUser);
    } catch {
      logger.error({
        event: "auth_failure",
        operation,
        stage: "repository",
        category: "unavailable",
      });
      return { ok: false, error: genericAuthenticationError, status: 503 };
    }

    try {
      const setCookie = await sessions.createSessionHeader(providerUser.idToken);
      return { ok: true, user, setCookie };
    } catch {
      logger.error({
        event: "auth_failure",
        operation,
        stage: "session",
        category: "unavailable",
      });
      return { ok: false, error: genericAuthenticationError, status: 503 };
    }
  }

  return {
    register(credentials) {
      return authenticate("register", credentials);
    },
    signIn(credentials) {
      return authenticate("signIn", credentials);
    },
  };
}
