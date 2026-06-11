import { afterEach, describe, expect, it, vi } from "vitest";

import { validateLiveAuthEnvironment } from "./auth-live-config";
import { createAuthService, genericAuthenticationError } from "./auth-service.server";
import { validateFirebaseEnvironment } from "./firebase-admin.server";
import {
  createIdentityProvider,
  ProviderAuthenticationError,
  type IdentityProvider,
} from "./identity-platform.server";
import { normalizeReturnTo } from "./return-to";
import { hasTrustedRequestOrigin } from "./request-security.server";
import {
  createAuthSessionManager,
  createFirebaseSessionProvider,
  SESSION_MAX_AGE_SECONDS,
  type AuthSessionManager,
  type FirebaseSessionProvider,
} from "./session.server";
import type { LocalUser, UserRepository } from "./types";
import { normalizeEmail, validateCredentials } from "./validation";

const appOrigin = "https://allergen.example";
const localUser: LocalUser = {
  id: "local-user-1",
  providerUid: "provider-user-1",
  email: "user@example.com",
  normalizedEmail: "user@example.com",
};

function createRepository(
  overrides: Partial<UserRepository> = {},
): UserRepository {
  return {
    upsertProviderUser: vi.fn(async () => localUser),
    findByProviderUid: vi.fn(async () => localUser),
    ...overrides,
  };
}

function createSessionProvider(
  overrides: Partial<FirebaseSessionProvider> = {},
): FirebaseSessionProvider {
  return {
    create: vi.fn(async () => "firebase-session-cookie"),
    verify: vi.fn(async () => ({
      uid: localUser.providerUid,
      auth_time: Math.floor(Date.now() / 1000),
    })),
    ...overrides,
  };
}

function requestWithSessionCookie(setCookie: string, path = "/"): Request {
  return new Request(`${appOrigin}${path}`, {
    headers: {
      Cookie: setCookie.split(";")[0] ?? "",
    },
  });
}

const originalEnvironment = {
  apiKey: process.env.IDENTITY_PLATFORM_API_KEY,
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  emulatorHost: process.env.FIREBASE_AUTH_EMULATOR_HOST,
  nodeEnv: process.env.NODE_ENV,
  kService: process.env.K_SERVICE,
};

function restoreEnvironmentVariable(
  name: keyof NodeJS.ProcessEnv,
  value: string | undefined,
) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

afterEach(() => {
  vi.restoreAllMocks();

  restoreEnvironmentVariable(
    "IDENTITY_PLATFORM_API_KEY",
    originalEnvironment.apiKey,
  );
  restoreEnvironmentVariable(
    "GOOGLE_CLOUD_PROJECT",
    originalEnvironment.projectId,
  );
  restoreEnvironmentVariable(
    "FIREBASE_AUTH_EMULATOR_HOST",
    originalEnvironment.emulatorHost,
  );
  restoreEnvironmentVariable("NODE_ENV", originalEnvironment.nodeEnv);
  restoreEnvironmentVariable("K_SERVICE", originalEnvironment.kService);
});

describe("credential validation", () => {
  it("normalizes email and accepts password lengths 10 through 128", () => {
    expect(normalizeEmail("  User.Name@Example.COM ")).toBe(
      "user.name@example.com",
    );
    expect(validateCredentials("USER@example.com", "a".repeat(10))).toEqual({
      ok: true,
      credentials: {
        email: "user@example.com",
        password: "a".repeat(10),
      },
    });
    expect(validateCredentials("user@example.com", "a".repeat(128)).ok).toBe(
      true,
    );
  });

  it("returns Polish field errors for invalid email and password boundaries", () => {
    expect(validateCredentials("not-an-email", "a".repeat(9))).toEqual({
      ok: false,
      errors: {
        email: "Podaj poprawny adres e-mail.",
        password: "Hasło musi mieć od 10 do 128 znaków.",
      },
    });
    expect(validateCredentials("user@example.com", "a".repeat(129))).toEqual({
      ok: false,
      errors: {
        password: "Hasło musi mieć od 10 do 128 znaków.",
      },
    });
  });
});

describe("returnTo validation", () => {
  it.each([
    ["/", "/"],
    ["/destination?city=Warsaw#results", "/destination?city=Warsaw#results"],
    ["https://evil.example", "/"],
    ["//evil.example/path", "/"],
    ["/login?returnTo=/destination", "/"],
    ["/login/nested", "/"],
    ["/register", "/"],
    ["/logout", "/"],
    ["/api/current-pollen", "/"],
    ["/unknown-page", "/"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeReturnTo(input, appOrigin)).toBe(expected);
  });
});

describe("request origin protection", () => {
  it("accepts an exact Origin match", () => {
    const request = new Request(`${appOrigin}/login`, {
      method: "POST",
      headers: { Origin: appOrigin },
    });

    expect(hasTrustedRequestOrigin(request, appOrigin)).toBe(true);
  });

  it("uses Referer only when Origin is absent", () => {
    const trusted = new Request(`${appOrigin}/login`, {
      method: "POST",
      headers: { Referer: `${appOrigin}/source?step=1` },
    });
    const originWins = new Request(`${appOrigin}/login`, {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        Referer: `${appOrigin}/source`,
      },
    });

    expect(hasTrustedRequestOrigin(trusted, appOrigin)).toBe(true);
    expect(hasTrustedRequestOrigin(originWins, appOrigin)).toBe(false);
  });

  it.each([
    [{}, false],
    [{ Origin: "null" }, false],
    [{ Origin: "not a url" }, false],
    [{ Origin: "https://evil.example" }, false],
    [{ Origin: `${appOrigin}/path` }, false],
    [{ Origin: `https://user@allergen.example` }, false],
    [{ Referer: "not a url" }, false],
    [{ Referer: "https://evil.example/path" }, false],
  ])("rejects untrusted source headers", (headers, expected) => {
    const request = new Request(`${appOrigin}/login`, {
      method: "POST",
      headers,
    });

    expect(hasTrustedRequestOrigin(request, appOrigin)).toBe(expected);
  });
});

describe("Identity Platform adapter", () => {
  it("returns only the application-owned success contract", async () => {
    process.env.IDENTITY_PLATFORM_API_KEY = "test-api-key";
    process.env.GOOGLE_CLOUD_PROJECT = "allergen-test";
    const fetchMock = vi.fn(async () =>
      Response.json({
        localId: "provider-user-1",
        email: "Canonical@Example.com",
        idToken: "id-token",
        refreshToken: "must-not-escape",
      }),
    );
    const provider = createIdentityProvider(fetchMock as typeof fetch);

    await expect(
      provider.signIn("user@example.com", "long-enough-password"),
    ).resolves.toEqual({
      providerUid: "provider-user-1",
      email: "Canonical@Example.com",
      idToken: "id-token",
    });
  });

  it.each([
    ["INVALID_LOGIN_CREDENTIALS", "invalid-credentials"],
    ["EMAIL_EXISTS", "account-conflict"],
    ["USER_DISABLED", "disabled"],
    ["TOO_MANY_ATTEMPTS_TRY_LATER", "throttled"],
  ])("maps provider error %s into %s", async (message, expectedCode) => {
    process.env.IDENTITY_PLATFORM_API_KEY = "test-api-key";
    process.env.GOOGLE_CLOUD_PROJECT = "allergen-test";
    const fetchMock = vi.fn(async () =>
      Response.json({ error: { message } }, { status: 400 }),
    );
    const provider = createIdentityProvider(fetchMock as typeof fetch);

    await expect(
      provider.register("user@example.com", "long-enough-password"),
    ).rejects.toMatchObject({ code: expectedCode });
  });
});

describe("authentication orchestration", () => {
  it("calls provider, repository, and session creation in order", async () => {
    const order: string[] = [];
    const provider: IdentityProvider = {
      register: vi.fn(async () => {
        order.push("provider");
        return {
          providerUid: localUser.providerUid,
          email: localUser.email,
          idToken: "id-token",
        };
      }),
      signIn: vi.fn(async () => {
        order.push("provider");
        return {
          providerUid: localUser.providerUid,
          email: localUser.email,
          idToken: "id-token",
        };
      }),
    };
    const repository = createRepository({
      upsertProviderUser: vi.fn(async () => {
        order.push("repository");
        return localUser;
      }),
    });
    const sessions = {
      createSessionHeader: vi.fn(async () => {
        order.push("session");
        return "serialized-cookie";
      }),
    } as unknown as AuthSessionManager;
    const service = createAuthService(provider, repository, sessions);

    await expect(
      service.signIn({
        email: localUser.email,
        password: "long-enough-password",
      }),
    ).resolves.toEqual({
      ok: true,
      user: localUser,
      setCookie: "serialized-cookie",
    });
    expect(order).toEqual(["provider", "repository", "session"]);
  });

  it("does not issue a session cookie when local persistence fails", async () => {
    const provider: IdentityProvider = {
      register: vi.fn(async () => ({
        providerUid: localUser.providerUid,
        email: localUser.email,
        idToken: "id-token",
      })),
      signIn: vi.fn(async () => ({
        providerUid: localUser.providerUid,
        email: localUser.email,
        idToken: "id-token",
      })),
    };
    const repository = createRepository({
      upsertProviderUser: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    });
    const createSessionHeader = vi.fn(async () => "must-not-be-created");
    const sessions = {
      createSessionHeader,
    } as unknown as AuthSessionManager;
    const logger = { error: vi.fn() };
    const service = createAuthService(provider, repository, sessions, logger);

    await expect(
      service.register({
        email: localUser.email,
        password: "long-enough-password",
      }),
    ).resolves.toEqual({
      ok: false,
      error: genericAuthenticationError,
      status: 503,
    });
    expect(createSessionHeader).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith({
      event: "auth_failure",
      operation: "register",
      stage: "repository",
      category: "unavailable",
    });
  });

  it("uses the same generic Polish error for account conflicts and credentials", async () => {
    const provider: IdentityProvider = {
      register: vi.fn(async () => {
        throw new ProviderAuthenticationError("account-conflict");
      }),
      signIn: vi.fn(async () => {
        throw new ProviderAuthenticationError("invalid-credentials");
      }),
    };
    const service = createAuthService(
      provider,
      createRepository(),
      {} as AuthSessionManager,
    );
    const credentials = {
      email: localUser.email,
      password: "long-enough-password",
    };

    expect(await service.register(credentials)).toEqual({
      ok: false,
      error: genericAuthenticationError,
      status: 400,
    });
    expect(await service.signIn(credentials)).toEqual({
      ok: false,
      error: genericAuthenticationError,
      status: 400,
    });
  });
});

describe("session manager", () => {
  it("serializes a seven-day HTTP-only SameSite=Lax cookie", async () => {
    const manager = createAuthSessionManager(
      createSessionProvider(),
      createRepository(),
      appOrigin,
    );

    const setCookie = await manager.createSessionHeader("id-token");

    expect(setCookie).toContain("__allergen_finder_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain(`Max-Age=${SESSION_MAX_AGE_SECONDS}`);
  });

  it("adds Secure to the cookie in production", async () => {
    process.env.NODE_ENV = "production";
    const manager = createAuthSessionManager(
      createSessionProvider(),
      createRepository(),
      appOrigin,
    );

    await expect(manager.createSessionHeader("id-token")).resolves.toContain(
      "Secure",
    );
  });

  it("requires recent ID-token authentication before session creation", async () => {
    const auth = {
      verifyIdToken: vi.fn(async () => ({
        auth_time: 1_000,
      })),
      createSessionCookie: vi.fn(async () => "session-cookie"),
    };
    const provider = createFirebaseSessionProvider(
      auth as never,
      () => 2_000_000,
    );

    await expect(provider.create("id-token")).rejects.toThrow(
      "recent authentication",
    );
    expect(auth.createSessionCookie).not.toHaveBeenCalled();
  });

  it("uses non-revocation verification for optional viewer and revocation mode for required viewer", async () => {
    const provider = createSessionProvider();
    const manager = createAuthSessionManager(
      provider,
      createRepository(),
      appOrigin,
    );
    const setCookie = await manager.createSessionHeader("id-token");
    const request = requestWithSessionCookie(setCookie);

    await manager.getOptionalUser(request);
    await manager.getRevocationAwareUser(request);

    expect(provider.verify).toHaveBeenNthCalledWith(
      1,
      "firebase-session-cookie",
      false,
    );
    expect(provider.verify).toHaveBeenNthCalledWith(
      2,
      "firebase-session-cookie",
      true,
    );
  });

  it.each(["revoked", "disabled", "expired", "malformed"])(
    "clears a %s session when re-authentication is required",
    async () => {
      const manager = createAuthSessionManager(
        createSessionProvider({
          verify: vi.fn(async () => {
            throw { code: "auth/session-cookie-revoked" };
          }),
        }),
        createRepository(),
        appOrigin,
      );
      const setCookie = await manager.createSessionHeader("id-token");
      const result = await manager.getRevocationAwareUser(
        requestWithSessionCookie(setCookie),
      );

      expect(result.user).toBeNull();
      expect(result.headers.get("Set-Cookie")).toContain("Max-Age=0");
    },
  );

  it("clears a malformed serialized session cookie before provider verification", async () => {
    const provider = createSessionProvider();
    const manager = createAuthSessionManager(
      provider,
      createRepository(),
      appOrigin,
    );
    const result = await manager.getOptionalUser(
      new Request(appOrigin, {
        headers: {
          Cookie: "__allergen_finder_session=corrupt",
        },
      }),
    );

    expect(result.user).toBeNull();
    expect(result.headers.get("Set-Cookie")).toContain("Max-Age=0");
    expect(provider.verify).not.toHaveBeenCalled();
  });

  it("clears a session whose provider user has no local record", async () => {
    const manager = createAuthSessionManager(
      createSessionProvider(),
      createRepository({
        findByProviderUid: vi.fn(async () => null),
      }),
      appOrigin,
    );
    const setCookie = await manager.createSessionHeader("id-token");
    const result = await manager.getRevocationAwareUser(
      requestWithSessionCookie(setCookie),
    );

    expect(result.user).toBeNull();
    expect(result.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("keeps a valid cookie during an optional-viewer infrastructure failure", async () => {
    const manager = createAuthSessionManager(
      createSessionProvider({
        verify: vi.fn(async () => {
          throw new Error("provider unavailable");
        }),
      }),
      createRepository(),
      appOrigin,
    );
    const setCookie = await manager.createSessionHeader("id-token");
    const result = await manager.getOptionalUser(
      requestWithSessionCookie(setCookie),
    );

    expect(result).toEqual({ user: null, headers: new Headers() });
  });

  it("propagates infrastructure failures during revocation-aware checks", async () => {
    const manager = createAuthSessionManager(
      createSessionProvider({
        verify: vi.fn(async () => {
          throw new Error("provider unavailable");
        }),
      }),
      createRepository(),
      appOrigin,
    );
    const setCookie = await manager.createSessionHeader("id-token");

    await expect(
      manager.getRevocationAwareUser(requestWithSessionCookie(setCookie)),
    ).rejects.toThrow("provider unavailable");
  });

  it("returns a stable local user id to future protected operations", async () => {
    const manager = createAuthSessionManager(
      createSessionProvider(),
      createRepository(),
      appOrigin,
    );
    const setCookie = await manager.createSessionHeader("id-token");

    await expect(
      manager.requireUser(requestWithSessionCookie(setCookie, "/history")),
    ).resolves.toEqual(localUser);
  });

  it("redirects missing users through a validated return path", async () => {
    const manager = createAuthSessionManager(
      createSessionProvider(),
      createRepository(),
      appOrigin,
    );

    try {
      await manager.requireUser(
        new Request(`${appOrigin}/destination?city=Warsaw`),
      );
    } catch (response) {
      expect(response).toBeInstanceOf(Response);
      expect((response as Response).headers.get("Location")).toBe(
        "/login?returnTo=%2Fdestination%3Fcity%3DWarsaw",
      );
    }

    try {
      await manager.requireUser(
        new Request(`${appOrigin}/api/current-pollen?placeId=unsafe`),
      );
    } catch (response) {
      expect(response).toBeInstanceOf(Response);
      expect((response as Response).headers.get("Location")).toBe(
        "/login?returnTo=%2F",
      );
    }
  });
});

describe("Firebase environment", () => {
  it("accepts a local emulator with an explicit project id", () => {
    process.env.GOOGLE_CLOUD_PROJECT = "allergen-local";
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
    process.env.NODE_ENV = "development";
    delete process.env.K_SERVICE;

    expect(validateFirebaseEnvironment()).toEqual({
      projectId: "allergen-local",
      emulatorHost: "127.0.0.1:9099",
    });
  });

  it("rejects emulator configuration in production", () => {
    process.env.GOOGLE_CLOUD_PROJECT = "allergen-production";
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
    process.env.NODE_ENV = "production";

    expect(() => validateFirebaseEnvironment()).toThrow(
      "FIREBASE_AUTH_EMULATOR_HOST is not allowed",
    );
  });

  it("rejects deployed emulator configuration before provider network work", async () => {
    process.env.GOOGLE_CLOUD_PROJECT = "allergen-production";
    process.env.IDENTITY_PLATFORM_API_KEY = "test-api-key";
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
    process.env.NODE_ENV = "production";
    const fetchMock = vi.fn();

    await expect(
      createIdentityProvider(fetchMock as typeof fetch).signIn(
        "user@example.com",
        "long-enough-password",
      ),
    ).rejects.toThrow("not allowed in a deployed environment");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses to run the live preflight against the production project", () => {
    expect(() =>
      validateLiveAuthEnvironment({
        optIn: "1",
        target: "non-production",
        email: "smoke@example.test",
        password: "long-enough-password",
        projectId: "allergen-production",
        productionProjectId: "allergen-production",
        finalProjectId: undefined,
        allowFinalTarget: undefined,
        emulatorHost: undefined,
      }),
    ).toThrow("refuses the production project");
  });

  it("requires an exact project and explicit opt-in for a final pre-traffic preflight", () => {
    const environment = {
      optIn: "1",
      target: "final-pre-traffic",
      email: "smoke@example.test",
      password: "long-enough-password",
      projectId: "allergen-mvp",
      productionProjectId: undefined,
      finalProjectId: "allergen-mvp",
      allowFinalTarget: "1",
      emulatorHost: undefined,
    };

    expect(validateLiveAuthEnvironment(environment)).toEqual({
      email: environment.email,
      password: environment.password,
    });
    expect(() =>
      validateLiveAuthEnvironment({
        ...environment,
        finalProjectId: "another-project",
      }),
    ).toThrow("must exactly match");
    expect(() =>
      validateLiveAuthEnvironment({
        ...environment,
        allowFinalTarget: undefined,
      }),
    ).toThrow("AUTH_LIVE_ALLOW_FINAL_TARGET=1");
  });
});
