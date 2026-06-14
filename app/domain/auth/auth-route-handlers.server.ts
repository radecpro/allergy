import { redirect } from "react-router";

import type { AuthService } from "./auth-service.server";
import { normalizeReturnTo } from "./return-to";
import { hasTrustedRequestOrigin } from "./request-security.server";
import type { AuthSessionManager } from "./session.server";
import { validateCredentials } from "./validation";

export type AuthRouteDependencies = {
  appOrigin: string;
  authService: AuthService;
  sessions: AuthSessionManager;
  originValidator?: (request: Request, appOrigin: string) => boolean;
};

export type AuthActionData = {
  errors?: {
    email?: string;
    password?: string;
  };
  formError?: string;
  values?: {
    email: string;
    returnTo: string;
  };
};

const MAX_AUTH_FORM_BYTES = 4_096;

class AuthRequestError extends Error {
  constructor(readonly status: 413 | 415) {
    super("Invalid authentication request.");
  }
}

async function readAuthForm(request: Request): Promise<URLSearchParams> {
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0];

  if (contentType?.trim().toLowerCase() !== "application/x-www-form-urlencoded") {
    throw new AuthRequestError(415);
  }

  const contentLength = Number(request.headers.get("Content-Length"));

  if (Number.isFinite(contentLength) && contentLength > MAX_AUTH_FORM_BYTES) {
    throw new AuthRequestError(413);
  }

  if (!request.body) {
    return new URLSearchParams();
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > MAX_AUTH_FORM_BYTES) {
      await reader.cancel();
      throw new AuthRequestError(413);
    }

    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new URLSearchParams(new TextDecoder().decode(body));
}

export function createAuthPageHandlers(
  mode: "register" | "signIn",
  dependencies: AuthRouteDependencies,
) {
  const validateOrigin =
    dependencies.originValidator ?? hasTrustedRequestOrigin;

  return {
    async loader(request: Request): Promise<Response> {
      const requestUrl = new URL(request.url);
      const returnTo = normalizeReturnTo(
        requestUrl.searchParams.get("returnTo"),
        dependencies.appOrigin,
      );
      const session = await dependencies.sessions.getRevocationAwareUser(request);

      if (session.user) {
        return redirect(returnTo, { headers: session.headers });
      }

      return Response.json(
        { returnTo },
        {
          headers: session.headers,
        },
      );
    },

    async action(request: Request): Promise<Response> {
      if (request.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: "POST" },
        });
      }

      if (!validateOrigin(request, dependencies.appOrigin)) {
        return Response.json(
          {
            formError: "Nie udało się zalogować. Odśwież stronę i spróbuj ponownie.",
          } satisfies AuthActionData,
          { status: 403 },
        );
      }

      let formData: URLSearchParams;

      try {
        formData = await readAuthForm(request);
      } catch (error) {
        if (error instanceof AuthRequestError) {
          return new Response("Invalid request body.", { status: error.status });
        }

        throw error;
      }
      const returnTo = normalizeReturnTo(
        formData.get("returnTo"),
        dependencies.appOrigin,
      );
      const validation = validateCredentials(
        formData.get("email"),
        formData.get("password"),
      );
      const email =
        typeof formData.get("email") === "string"
          ? String(formData.get("email"))
          : "";

      if (!validation.ok) {
        return Response.json(
          {
            errors: validation.errors,
            values: { email, returnTo },
          } satisfies AuthActionData,
          { status: 400 },
        );
      }

      const result = await dependencies.authService[mode](
        validation.credentials,
      );

      if (!result.ok) {
        return Response.json(
          {
            formError: result.error,
            values: { email: validation.credentials.email, returnTo },
          } satisfies AuthActionData,
          { status: result.status },
        );
      }

      return redirect(returnTo, {
        headers: { "Set-Cookie": result.setCookie },
      });
    },
  };
}

export function createLogoutAction(dependencies: AuthRouteDependencies) {
  const validateOrigin =
    dependencies.originValidator ?? hasTrustedRequestOrigin;

  return async function logoutAction(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "POST" },
      });
    }

    if (!validateOrigin(request, dependencies.appOrigin)) {
      return new Response("Forbidden", { status: 403 });
    }

    let formData: URLSearchParams;

    try {
      formData = await readAuthForm(request);
    } catch (error) {
      if (error instanceof AuthRequestError) {
        return new Response("Invalid request body.", { status: error.status });
      }

      throw error;
    }
    const returnTo = normalizeReturnTo(
      formData.get("returnTo"),
      dependencies.appOrigin,
    );

    return redirect(returnTo, {
      headers: {
        "Set-Cookie": await dependencies.sessions.destroySessionHeader(),
      },
    });
  };
}
