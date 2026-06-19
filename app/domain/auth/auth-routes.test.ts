import { describe, expect, it, vi } from "vitest";

import { createRootLoader } from "~/root";
import { loader as logoutLoader } from "~/routes/logout";

import {
  createAuthPageHandlers,
  createLogoutAction,
  type AuthRouteDependencies,
} from "./auth-route-handlers.server";
import type { AuthService } from "./auth-service.server";
import type {
  AuthSessionManager,
  SessionLookupResult,
} from "./session.server";
import type { LocalUser } from "./types";

const appOrigin = "https://allergen.example";
const localUser: LocalUser = {
  id: "local-user-1",
  providerUid: "provider-user-1",
  email: "user@example.com",
  normalizedEmail: "user@example.com",
};

function sessionResult(
  user: LocalUser | null,
  setCookie?: string,
): SessionLookupResult {
  return {
    user,
    headers: setCookie
      ? new Headers({ "Set-Cookie": setCookie })
      : new Headers(),
  };
}

function createSessions(
  overrides: Partial<AuthSessionManager> = {},
): AuthSessionManager {
  return {
    createSessionHeader: vi.fn(async () => "created-session"),
    getOptionalUser: vi.fn(async () => sessionResult(null)),
    getRevocationAwareUser: vi.fn(async () => sessionResult(null)),
    requireUser: vi.fn(async () => localUser),
    destroySessionHeader: vi.fn(async () => "destroyed-session"),
    ...overrides,
  };
}

function createAuthService(
  overrides: Partial<AuthService> = {},
): AuthService {
  return {
    register: vi.fn(async () => ({
      ok: true as const,
      user: localUser,
      setCookie: "registered-session",
    })),
    signIn: vi.fn(async () => ({
      ok: true as const,
      user: localUser,
      setCookie: "signed-in-session",
    })),
    ...overrides,
  };
}

function createDependencies(
  overrides: Partial<AuthRouteDependencies> = {},
): AuthRouteDependencies {
  return {
    appOrigin,
    authService: createAuthService(),
    sessions: createSessions(),
    originValidator: () => true,
    ...overrides,
  };
}

function authRequest(
  path: string,
  body: Record<string, string>,
  headers: HeadersInit = { Origin: appOrigin },
) {
  return new Request(`${appOrigin}${path}`, {
    method: "POST",
    headers,
    body: new URLSearchParams(body),
  });
}

describe("authentication route actions", () => {
  it("registers and redirects with a session cookie", async () => {
    const dependencies = createDependencies();
    const response = await createAuthPageHandlers(
      "register",
      dependencies,
    ).action(
      authRequest("/register", {
        email: " USER@example.com ",
        password: "long-enough-password",
        returnTo: "/destination",
      }),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/destination");
    expect(response.headers.get("Set-Cookie")).toBe("registered-session");
    expect(dependencies.authService.register).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "long-enough-password",
    });
  });

  it("signs in and repairs local identity through the service boundary", async () => {
    const dependencies = createDependencies();
    const response = await createAuthPageHandlers(
      "signIn",
      dependencies,
    ).action(
      authRequest("/login", {
        email: "user@example.com",
        password: "long-enough-password",
        returnTo: "/",
      }),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Set-Cookie")).toBe("signed-in-session");
    expect(dependencies.authService.signIn).toHaveBeenCalledOnce();
  });

  it("returns field validation before calling the auth service", async () => {
    const dependencies = createDependencies();
    const response = await createAuthPageHandlers(
      "register",
      dependencies,
    ).action(
      authRequest("/register", {
        email: "bad",
        password: "short",
        returnTo: "/",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.errors).toEqual({
      email: "Podaj poprawny adres e-mail.",
      password: "Hasło musi mieć od 10 do 128 znaków.",
    });
    expect(dependencies.authService.register).not.toHaveBeenCalled();
  });

  it("returns a generic provider failure without exposing account existence", async () => {
    const dependencies = createDependencies({
      authService: createAuthService({
        register: vi.fn(async () => ({
          ok: false as const,
          error:
            "Nie udało się uwierzytelnić. Sprawdź dane lub spróbuj ponownie później.",
          status: 400 as const,
        })),
      }),
    });
    const response = await createAuthPageHandlers(
      "register",
      dependencies,
    ).action(
      authRequest("/register", {
        email: "user@example.com",
        password: "long-enough-password",
        returnTo: "/",
      }),
    );
    const payload = await response.json();

    expect(payload.formError).not.toMatch(/istnieje|zarejestrowan/i);
  });

  it("rejects untrusted origin evidence before auth or session work", async () => {
    const originValidator = vi.fn(() => false);
    const dependencies = createDependencies({ originValidator });
    const response = await createAuthPageHandlers(
      "signIn",
      dependencies,
    ).action(
      authRequest(
        "/login",
        {
          email: "user@example.com",
          password: "long-enough-password",
          returnTo: "/",
        },
        {},
      ),
    );

    expect(response.status).toBe(403);
    expect(dependencies.authService.signIn).not.toHaveBeenCalled();
    expect(dependencies.sessions.createSessionHeader).not.toHaveBeenCalled();
  });

  it("uses the production origin validator before auth side effects", async () => {
    const dependencies = createDependencies({ originValidator: undefined });
    const response = await createAuthPageHandlers(
      "signIn",
      dependencies,
    ).action(
      authRequest(
        "/login",
        {
          email: "user@example.com",
          password: "long-enough-password",
          returnTo: "/",
        },
        { Origin: `${appOrigin}/path` },
      ),
    );

    expect(response.status).toBe(403);
    expect(dependencies.authService.signIn).not.toHaveBeenCalled();
  });

  it("preserves a generic message while returning an infrastructure status", async () => {
    const dependencies = createDependencies({
      authService: createAuthService({
        signIn: vi.fn(async () => ({
          ok: false as const,
          error:
            "Nie udało się uwierzytelnić. Sprawdź dane lub spróbuj ponownie później.",
          status: 503 as const,
        })),
      }),
    });
    const response = await createAuthPageHandlers(
      "signIn",
      dependencies,
    ).action(
      authRequest("/login", {
        email: "user@example.com",
        password: "long-enough-password",
        returnTo: "/",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.formError).not.toMatch(/baza|firebase|konfigurac/i);
  });

  it.each([
    "https://evil.example/path",
    "//evil.example/path",
    "/login?returnTo=/destination",
    "/register",
    "/logout",
    "/api/current-pollen",
  ])("falls back to root for unsafe returnTo %s", async (returnTo) => {
    const response = await createAuthPageHandlers(
      "signIn",
      createDependencies(),
    ).action(
      authRequest("/login", {
        email: "user@example.com",
        password: "long-enough-password",
        returnTo,
      }),
    );

    expect(response.headers.get("Location")).toBe("/");
  });

  it("rejects direct non-POST invocation", async () => {
    const response = await createAuthPageHandlers(
      "signIn",
      createDependencies(),
    ).action(new Request(`${appOrigin}/login`));

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
  });

  it("rejects unsupported or oversized request bodies before auth work", async () => {
    const dependencies = createDependencies();
    const unsupported = await createAuthPageHandlers(
      "signIn",
      dependencies,
    ).action(
      new Request(`${appOrigin}/login`, {
        method: "POST",
        headers: {
          Origin: appOrigin,
          "Content-Type": "application/json",
        },
        body: "{}",
      }),
    );
    const oversized = await createAuthPageHandlers(
      "signIn",
      dependencies,
    ).action(
      authRequest("/login", {
        email: "user@example.com",
        password: "a".repeat(5_000),
        returnTo: "/",
      }),
    );

    expect(unsupported.status).toBe(415);
    expect(oversized.status).toBe(413);
    expect(dependencies.authService.signIn).not.toHaveBeenCalled();
  });
});

describe("authentication route loaders", () => {
  it("uses revocation-aware identity before redirecting an authenticated user", async () => {
    const sessions = createSessions({
      getRevocationAwareUser: vi.fn(async () => sessionResult(localUser)),
    });
    const response = await createAuthPageHandlers(
      "signIn",
      createDependencies({ sessions }),
    ).loader(new Request(`${appOrigin}/login?returnTo=/destination`));

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/destination");
    expect(sessions.getRevocationAwareUser).toHaveBeenCalledOnce();
  });

  it("clears an invalid cookie and leaves the form usable", async () => {
    const sessions = createSessions({
      getRevocationAwareUser: vi.fn(async () =>
        sessionResult(null, "expired-session"),
      ),
    });
    const response = await createAuthPageHandlers(
      "register",
      createDependencies({ sessions }),
    ).loader(new Request(`${appOrigin}/register?returnTo=/destination`));

    expect(response.status).toBe(200);
    expect(response.headers.get("Set-Cookie")).toBe("expired-session");
    await expect(response.json()).resolves.toEqual({
      returnTo: "/destination",
    });
  });
});

describe("root and logout routes", () => {
  it.each(["/", "/destination"])(
    "returns guest viewer state without redirecting %s",
    async (path) => {
      const sessions = createSessions();
      const response = await createRootLoader(sessions)(
        new Request(`${appOrigin}${path}`),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ viewer: null });
      expect(sessions.getOptionalUser).toHaveBeenCalledOnce();
    },
  );

  it("signs out only through POST and preserves a safe return path", async () => {
    const sessions = createSessions();
    const response = await createLogoutAction(
      createDependencies({ sessions }),
    )(
      authRequest("/logout", {
        returnTo: "/destination",
      }),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/destination");
    expect(response.headers.get("Set-Cookie")).toBe("destroyed-session");
  });

  it.each([
    new Headers(),
    { Origin: "null" },
    { Origin: "https://evil.example" },
    { Origin: `${appOrigin}/path` },
  ])(
    "rejects an untrusted logout POST before clearing the cookie",
    async (headers) => {
      const sessions = createSessions();
      const dependencies = createDependencies({
        sessions,
        originValidator: undefined,
      });
      const response = await createLogoutAction(dependencies)(
        authRequest("/logout", { returnTo: "/" }, headers),
      );

      expect(response.status).toBe(403);
      expect(sessions.destroySessionHeader).not.toHaveBeenCalled();
    },
  );

  it("exposes no state-changing GET logout", async () => {
    const response = await logoutLoader();

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
  });
});
