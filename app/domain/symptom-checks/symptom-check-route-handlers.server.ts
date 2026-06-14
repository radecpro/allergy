import { redirect } from "react-router";

import { hasTrustedRequestOrigin } from "~/domain/auth/request-security.server";
import type { AuthSessionManager } from "~/domain/auth/session.server";

import {
  fingerprintSymptomCheckSnapshot,
  SymptomCheckRequestConflictError,
} from "./symptom-check-repository.server";
import { isUuid, pendingSnapshotLifetimeMs } from "./pending-snapshot";
import { parseSymptomCheckSnapshot } from "./snapshot";
import type {
  SymptomCheckRecord,
  SymptomCheckRepository,
} from "./types";

const MAX_SAVE_FORM_BYTES = 16_384;

export type SymptomCheckRouteDependencies = {
  appOrigin: string;
  sessions: Pick<AuthSessionManager, "requireUser">;
  repository: SymptomCheckRepository;
  originValidator?: (request: Request, appOrigin: string) => boolean;
  now?: () => Date;
};

export type SaveSymptomCheckActionData = {
  error: string;
};

export type SymptomCheckDetailLoaderData = {
  record: SymptomCheckRecord;
  saved: boolean;
  requestId: string | null;
};

export type SymptomCheckListLoaderData = {
  records: SymptomCheckRecord[];
};

class SaveRequestError extends Error {
  constructor(readonly status: 413 | 415) {
    super("Invalid symptom-check save request.");
  }
}

async function readBoundedForm(request: Request): Promise<URLSearchParams> {
  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0];

  if (contentType?.trim().toLowerCase() !== "application/x-www-form-urlencoded") {
    throw new SaveRequestError(415);
  }

  const contentLength = Number(request.headers.get("Content-Length"));

  if (Number.isFinite(contentLength) && contentLength > MAX_SAVE_FORM_BYTES) {
    throw new SaveRequestError(413);
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

    if (totalBytes > MAX_SAVE_FORM_BYTES) {
      await reader.cancel();
      throw new SaveRequestError(413);
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

function errorResponse(error: string, status: number): Response {
  return Response.json(
    { error } satisfies SaveSymptomCheckActionData,
    { status },
  );
}

function notFoundResponse(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

export function createSaveSymptomCheckAction(
  dependencies: SymptomCheckRouteDependencies,
) {
  const validateOrigin =
    dependencies.originValidator ?? hasTrustedRequestOrigin;

  return async function saveSymptomCheckAction(
    request: Request,
  ): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "POST" },
      });
    }

    if (!validateOrigin(request, dependencies.appOrigin)) {
      return errorResponse(
        "Nie udało się potwierdzić miejsca wysłania formularza. Odśwież stronę i spróbuj ponownie.",
        403,
      );
    }

    const user = await dependencies.sessions.requireUser(request);
    let form: URLSearchParams;

    try {
      form = await readBoundedForm(request);
    } catch (error) {
      if (error instanceof SaveRequestError) {
        return new Response("Invalid request body.", { status: error.status });
      }
      throw error;
    }

    const requestId = form.get("requestId") ?? "";
    const source = form.get("source");
    const snapshotJson = form.get("snapshot");

    if (!isUuid(requestId) || (source !== "direct" && source !== "pending")) {
      return errorResponse("Nie udało się przygotować zapisu. Spróbuj ponownie.", 400);
    }

    let rawSnapshot: unknown;

    try {
      rawSnapshot = JSON.parse(snapshotJson ?? "");
    } catch {
      return errorResponse("Dane zapisu są nieprawidłowe.", 400);
    }

    const now = dependencies.now?.() ?? new Date();
    const parsed = parseSymptomCheckSnapshot(rawSnapshot, {
      now,
      maxAgeMs: source === "pending" ? pendingSnapshotLifetimeMs : undefined,
    });

    if (!parsed) {
      return errorResponse(
        source === "pending"
          ? "Oczekujący zapis wygasł lub jest nieprawidłowy. Wykonaj sprawdzenie ponownie."
          : "Dane zapisu są nieprawidłowe.",
        400,
      );
    }

    const snapshot =
      source === "direct"
        ? { ...parsed, completedAt: now.toISOString() }
        : parsed;
    const idempotencyFingerprint =
      fingerprintSymptomCheckSnapshot(parsed);

    try {
      const record = await dependencies.repository.createForOwner(
        user.id,
        requestId,
        snapshot,
        idempotencyFingerprint,
      );
      const target = new URL(
        `/history/${record.id}`,
        dependencies.appOrigin,
      );
      target.searchParams.set("saved", "1");
      target.searchParams.set("requestId", requestId);
      return redirect(`${target.pathname}${target.search}`);
    } catch (error) {
      if (error instanceof SymptomCheckRequestConflictError) {
        return errorResponse(
          "Ten identyfikator zapisu został już użyty. Odśwież zapis i spróbuj ponownie.",
          409,
        );
      }
      throw error;
    }
  };
}

export function createSymptomCheckDetailLoader(
  dependencies: SymptomCheckRouteDependencies,
) {
  return async function symptomCheckDetailLoader(
    request: Request,
    checkId: string | undefined,
  ): Promise<Response> {
    const user = await dependencies.sessions.requireUser(request);

    if (!checkId || !isUuid(checkId)) {
      throw notFoundResponse();
    }

    const record = await dependencies.repository.findForOwner(user.id, checkId);

    if (!record) {
      throw notFoundResponse();
    }

    const url = new URL(request.url);
    const requestId = url.searchParams.get("requestId");

    return Response.json(
      {
        record,
        saved: url.searchParams.get("saved") === "1",
        requestId: requestId && isUuid(requestId) ? requestId : null,
      } satisfies SymptomCheckDetailLoaderData,
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  };
}

export function createSymptomCheckListLoader(
  dependencies: SymptomCheckRouteDependencies,
) {
  return async function symptomCheckListLoader(
    request: Request,
  ): Promise<Response> {
    const user = await dependencies.sessions.requireUser(request);
    const records = await dependencies.repository.listForOwner(user.id);

    return Response.json(
      { records } satisfies SymptomCheckListLoaderData,
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  };
}
