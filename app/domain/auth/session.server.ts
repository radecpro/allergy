import type { Auth, DecodedIdToken } from "firebase-admin/auth";
import { createCookie, redirect } from "react-router";

import { normalizeReturnTo } from "./return-to";
import type { LocalUser, UserRepository } from "./types";

export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const RECENT_AUTH_MAX_AGE_SECONDS = 5 * 60;
const SESSION_COOKIE_NAME = "__allergen_finder_session";

export type SessionIdentity = Pick<DecodedIdToken, "uid" | "auth_time">;

export interface FirebaseSessionProvider {
  create(idToken: string): Promise<string>;
  verify(sessionCookie: string, checkRevoked: boolean): Promise<SessionIdentity>;
}

export type SessionLookupResult = {
  user: LocalUser | null;
  headers: Headers;
};

export interface AuthSessionManager {
  createSessionHeader(idToken: string): Promise<string>;
  getOptionalUser(request: Request): Promise<SessionLookupResult>;
  getRevocationAwareUser(request: Request): Promise<SessionLookupResult>;
  requireUser(request: Request): Promise<LocalUser>;
  destroySessionHeader(): Promise<string>;
}

type SessionReadMode = "optional" | "revocation-aware";

const invalidSessionErrorCodes = new Set([
  "auth/argument-error",
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/invalid-id-token",
  "auth/session-cookie-expired",
  "auth/session-cookie-revoked",
  "auth/user-disabled",
  "auth/user-not-found",
]);

function hasErrorCode(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  );
}

function isInvalidSessionError(error: unknown): boolean {
  return hasErrorCode(error) && invalidSessionErrorCodes.has(error.code);
}

function isSecureCookieEnvironment(): boolean {
  return process.env.NODE_ENV === "production" || Boolean(process.env.K_SERVICE);
}

function createSessionCookieDefinition() {
  return createCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
    secure: isSecureCookieEnvironment(),
  });
}

export function createFirebaseSessionProvider(
  auth: Auth,
  now: () => number = Date.now,
): FirebaseSessionProvider {
  return {
    async create(idToken) {
      const decodedToken = await auth.verifyIdToken(idToken);
      const authenticatedAt = decodedToken.auth_time;
      const currentSeconds = Math.floor(now() / 1000);

      if (
        typeof authenticatedAt !== "number" ||
        currentSeconds - authenticatedAt > RECENT_AUTH_MAX_AGE_SECONDS
      ) {
        throw new Error("A recent authentication is required.");
      }

      return auth.createSessionCookie(idToken, {
        expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
      });
    },

    async verify(sessionCookie, checkRevoked) {
      return auth.verifySessionCookie(sessionCookie, checkRevoked);
    },
  };
}

export function createAuthSessionManager(
  provider: FirebaseSessionProvider,
  repository: UserRepository,
  appOrigin: string,
): AuthSessionManager {
  const cookie = createSessionCookieDefinition();

  async function clearedSessionHeaders(): Promise<Headers> {
    return new Headers({
      "Set-Cookie": await cookie.serialize("", { maxAge: 0 }),
    });
  }

  async function readUser(
    request: Request,
    mode: SessionReadMode,
  ): Promise<SessionLookupResult> {
    const cookieHeader = request.headers.get("Cookie");
    const hasSessionCookie = cookieHeader
      ?.split(";")
      .some((entry) => entry.trim().startsWith(`${SESSION_COOKIE_NAME}=`));
    const sessionCookie = await cookie.parse(cookieHeader);

    if (typeof sessionCookie !== "string" || sessionCookie.length === 0) {
      return {
        user: null,
        headers: hasSessionCookie
          ? await clearedSessionHeaders()
          : new Headers(),
      };
    }

    let identity: SessionIdentity;

    try {
      identity = await provider.verify(
        sessionCookie,
        mode === "revocation-aware",
      );
    } catch (error) {
      if (!isInvalidSessionError(error)) {
        if (mode === "optional") {
          return { user: null, headers: new Headers() };
        }

        throw error;
      }

      return {
        user: null,
        headers: await clearedSessionHeaders(),
      };
    }

    let user: LocalUser | null;

    try {
      user = await repository.findByProviderUid(identity.uid);
    } catch (error) {
      if (mode === "optional") {
        return { user: null, headers: new Headers() };
      }

      throw error;
    }

    if (!user) {
      return {
        user: null,
        headers: await clearedSessionHeaders(),
      };
    }

    return { user, headers: new Headers() };
  }

  return {
    async createSessionHeader(idToken) {
      const sessionCookie = await provider.create(idToken);
      return cookie.serialize(sessionCookie);
    },

    getOptionalUser(request) {
      return readUser(request, "optional");
    },

    getRevocationAwareUser(request) {
      return readUser(request, "revocation-aware");
    },

    async requireUser(request) {
      const result = await readUser(request, "revocation-aware");

      if (result.user) {
        return result.user;
      }

      const requestUrl = new URL(request.url);
      const returnTo = normalizeReturnTo(
        `${requestUrl.pathname}${requestUrl.search}`,
        appOrigin,
      );
      const loginUrl = new URL("/login", appOrigin);
      loginUrl.searchParams.set("returnTo", returnTo);

      throw redirect(`${loginUrl.pathname}${loginUrl.search}`, {
        headers: result.headers,
      });
    },

    destroySessionHeader() {
      return cookie.serialize("", { maxAge: 0 });
    },
  };
}
