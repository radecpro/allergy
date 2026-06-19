import type { ProviderAuthentication } from "./types";
import { validateAuthRuntimeEnvironment } from "./auth-runtime-config.server";

export type ProviderErrorCode =
  | "invalid-credentials"
  | "account-conflict"
  | "disabled"
  | "throttled"
  | "unavailable"
  | "configuration";

export class ProviderAuthenticationError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    options?: ErrorOptions,
  ) {
    super("Identity provider authentication failed.", options);
    this.name = "ProviderAuthenticationError";
  }
}

export interface IdentityProvider {
  register(email: string, password: string): Promise<ProviderAuthentication>;
  signIn(email: string, password: string): Promise<ProviderAuthentication>;
}

type IdentityToolkitResponse = {
  localId?: string;
  email?: string;
  idToken?: string;
  error?: {
    message?: string;
  };
};

function getProviderBaseUrl(): string {
  const { emulatorHost } = validateAuthRuntimeEnvironment();

  if (emulatorHost) {
    return `http://${emulatorHost}/identitytoolkit.googleapis.com/v1`;
  }

  return "https://identitytoolkit.googleapis.com/v1";
}

function mapProviderError(status: number, message: string | undefined) {
  if (
    message?.startsWith("INVALID_LOGIN_CREDENTIALS") ||
    message?.startsWith("EMAIL_NOT_FOUND") ||
    message?.startsWith("INVALID_PASSWORD")
  ) {
    return "invalid-credentials" as const;
  }

  if (message?.startsWith("EMAIL_EXISTS")) {
    return "account-conflict" as const;
  }

  if (message?.startsWith("USER_DISABLED")) {
    return "disabled" as const;
  }

  if (status === 429 || message?.startsWith("TOO_MANY_ATTEMPTS_TRY_LATER")) {
    return "throttled" as const;
  }

  if (status >= 500) {
    return "unavailable" as const;
  }

  return "configuration" as const;
}

async function authenticate(
  operation: "accounts:signUp" | "accounts:signInWithPassword",
  email: string,
  password: string,
  fetchImplementation: typeof fetch,
): Promise<ProviderAuthentication> {
  const apiKey = process.env.IDENTITY_PLATFORM_API_KEY;

  if (!apiKey) {
    throw new ProviderAuthenticationError("configuration");
  }

  const endpoint =
    `${getProviderBaseUrl()}/${operation}?key=${encodeURIComponent(apiKey)}`;
  let response: Response;

  try {
    response = await fetchImplementation(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    });
  } catch (error) {
    throw new ProviderAuthenticationError("unavailable", { cause: error });
  }

  let payload: IdentityToolkitResponse;

  try {
    payload = (await response.json()) as IdentityToolkitResponse;
  } catch (error) {
    throw new ProviderAuthenticationError("unavailable", { cause: error });
  }

  if (!response.ok) {
    throw new ProviderAuthenticationError(
      mapProviderError(response.status, payload.error?.message),
    );
  }

  if (!payload.localId || !payload.email || !payload.idToken) {
    throw new ProviderAuthenticationError("unavailable");
  }

  return {
    providerUid: payload.localId,
    email: payload.email,
    idToken: payload.idToken,
  };
}

export function createIdentityProvider(
  fetchImplementation: typeof fetch = fetch,
): IdentityProvider {
  return {
    register(email, password) {
      return authenticate(
        "accounts:signUp",
        email,
        password,
        fetchImplementation,
      );
    },
    signIn(email, password) {
      return authenticate(
        "accounts:signInWithPassword",
        email,
        password,
        fetchImplementation,
      );
    },
  };
}
