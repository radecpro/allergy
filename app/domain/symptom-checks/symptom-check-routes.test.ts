import { describe, expect, it, vi } from "vitest";
import { redirect } from "react-router";

import type { LocalUser } from "~/domain/auth/types";

import { buildCurrentSymptomSnapshot } from "./snapshot";
import {
  createSymptomCheckDetailAction,
  createSaveSymptomCheckAction,
  createSymptomCheckDetailLoader,
  createSymptomCheckListLoader,
} from "./symptom-check-route-handlers.server";
import {
  SymptomCheckRequestConflictError,
} from "./symptom-check-repository.server";
import type {
  SymptomCheckRecord,
  SymptomCheckRepository,
} from "./types";

const appOrigin = "https://allergen.example";
const requestId = "123e4567-e89b-42d3-a456-426614174000";
const checkId = "223e4567-e89b-42d3-a456-426614174000";
const user: LocalUser = {
  id: "323e4567-e89b-42d3-a456-426614174000",
  providerUid: "provider-user",
  email: "user@example.test",
  normalizedEmail: "user@example.test",
};
const snapshot = buildCurrentSymptomSnapshot({
  city: { placeId: "warsaw", label: "Warszawa, Polska" },
  symptoms: [
    { symptomId: "blocked-nose", intensity: "high" },
    { symptomId: "watery-eyes", intensity: "low" },
  ],
  pollenActivity: { "grass-pollen": "high" },
  completedAt: new Date("2026-06-11T12:00:00.000Z"),
});
const record: SymptomCheckRecord = {
  id: checkId,
  snapshot,
  createdAt: "2026-06-11T12:01:00.000Z",
  updatedAt: "2026-06-11T12:01:00.000Z",
};

function createRepository(): SymptomCheckRepository {
  return {
    createForOwner: vi.fn(async () => record),
    listForOwner: vi.fn(async () => []),
    findForOwner: vi.fn(async () => record),
    updateForOwner: vi.fn(async () => record),
    deleteForOwner: vi.fn(async () => checkId),
  };
}

function saveRequest(
  values: Record<string, string> = {},
  headers: HeadersInit = { Origin: appOrigin },
) {
  return new Request(`${appOrigin}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body: new URLSearchParams({
      requestId,
      source: "direct",
      snapshot: JSON.stringify(snapshot),
      ...values,
    }),
  });
}

function detailRequest(
  values: Record<string, string> = {},
  headers: HeadersInit = { Origin: appOrigin },
) {
  return new Request(`${appOrigin}/history/${checkId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body: new URLSearchParams(values),
  });
}

describe("save symptom-check action", () => {
  it.each([
    [{ Origin: appOrigin }, 302],
    [{ Referer: `${appOrigin}/` }, 302],
    [{}, 403],
    [{ Origin: "null" }, 403],
    [{ Origin: "not a url" }, 403],
    [{ Origin: "https://evil.example" }, 403],
  ])("handles source headers %#", async (headers, expectedStatus) => {
    const repository = createRepository();
    const action = createSaveSymptomCheckAction({
      appOrigin,
      sessions: { requireUser: vi.fn(async () => user) },
      repository,
      now: () => new Date("2026-06-11T12:01:00.000Z"),
    });
    const response = await action(saveRequest({}, headers));

    expect(response.status).toBe(expectedStatus);
    expect(repository.createForOwner).toHaveBeenCalledTimes(
      expectedStatus === 302 ? 1 : 0,
    );
  });

  it("uses the authenticated owner and derives direct completion time", async () => {
    const repository = createRepository();
    const action = createSaveSymptomCheckAction({
      appOrigin,
      sessions: { requireUser: vi.fn(async () => user) },
      repository,
      originValidator: () => true,
      now: () => new Date("2026-06-11T12:05:00.000Z"),
    });
    const response = await action(saveRequest());

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      `/history/${checkId}?saved=1&requestId=${requestId}`,
    );
    expect(repository.createForOwner).toHaveBeenCalledWith(
      user.id,
      requestId,
      expect.objectContaining({
        completedAt: "2026-06-11T12:05:00.000Z",
        symptoms: [
          { symptomId: "blocked-nose", intensity: "high" },
          { symptomId: "watery-eyes", intensity: "low" },
        ],
      }),
      expect.any(String),
    );
  });

  it("preserves mixed intensities from a pending authentication handoff", async () => {
    const repository = createRepository();
    const action = createSaveSymptomCheckAction({
      appOrigin,
      sessions: { requireUser: vi.fn(async () => user) },
      repository,
      originValidator: () => true,
      now: () => new Date("2026-06-11T12:05:00.000Z"),
    });

    const response = await action(saveRequest({ source: "pending" }));

    expect(response.status).toBe(302);
    expect(repository.createForOwner).toHaveBeenCalledWith(
      user.id,
      requestId,
      expect.objectContaining({
        completedAt: "2026-06-11T12:00:00.000Z",
        symptoms: [
          { symptomId: "blocked-nose", intensity: "high" },
          { symptomId: "watery-eyes", intensity: "low" },
        ],
      }),
      expect.any(String),
    );
  });

  it("propagates signed-out redirects before repository work", async () => {
    const repository = createRepository();
    const action = createSaveSymptomCheckAction({
      appOrigin,
      sessions: {
        requireUser: vi.fn(async () => {
          throw redirect("/login?returnTo=%2F", {
            headers: { "Set-Cookie": "cleared-session" },
          });
        }),
      },
      repository,
      originValidator: () => true,
    });

    try {
      await action(saveRequest());
      throw new Error("Expected authentication redirect.");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(302);
      expect((error as Response).headers.get("Location")).toBe(
        "/login?returnTo=%2F",
      );
      expect((error as Response).headers.get("Set-Cookie")).toBe(
        "cleared-session",
      );
    }
    expect(repository.createForOwner).not.toHaveBeenCalled();
  });

  it("rejects invalid data before repository work", async () => {
    const repository = createRepository();
    const action = createSaveSymptomCheckAction({
      appOrigin,
      sessions: { requireUser: vi.fn(async () => user) },
      repository,
      originValidator: () => true,
    });
    const response = await action(saveRequest({ snapshot: "{bad-json" }));

    expect(response.status).toBe(400);
    expect(repository.createForOwner).not.toHaveBeenCalled();
  });

  it("returns a safe conflict for request-ID reuse", async () => {
    const repository = createRepository();
    vi.mocked(repository.createForOwner).mockRejectedValue(
      new SymptomCheckRequestConflictError(),
    );
    const action = createSaveSymptomCheckAction({
      appOrigin,
      sessions: { requireUser: vi.fn(async () => user) },
      repository,
      originValidator: () => true,
    });

    const response = await action(saveRequest());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error:
        "Ten identyfikator zapisu został już użyty. Odśwież zapis i spróbuj ponownie.",
    });
  });

  it("rejects non-POST and oversized requests", async () => {
    const repository = createRepository();
    const action = createSaveSymptomCheckAction({
      appOrigin,
      sessions: { requireUser: vi.fn(async () => user) },
      repository,
      originValidator: () => true,
    });

    expect(
      (
        await action(
          new Request(appOrigin, {
            method: "GET",
          }),
        )
      ).status,
    ).toBe(405);
    expect(
      (
        await action(
          new Request(appOrigin, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Content-Length": "20000",
            },
            body: "a=1",
          }),
        )
      ).status,
    ).toBe(413);
  });
});

describe("symptom-check detail action", () => {
  it.each([
    ["GET", 405],
    ["POST", 403],
  ])("rejects %s and bad origins before persistence", async (method, expectedStatus) => {
    const repository = createRepository();
    const action = createSymptomCheckDetailAction({
      appOrigin,
      sessions: { requireUser: vi.fn(async () => user) },
      repository,
      originValidator: () => false,
    });
    const response = await action(
      new Request(`${appOrigin}/history/${checkId}`, {
        method,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }),
      checkId,
    );

    expect(response.status).toBe(expectedStatus);
    expect(repository.updateForOwner).not.toHaveBeenCalled();
    expect(repository.deleteForOwner).not.toHaveBeenCalled();
  });

  it("rejects unsupported content type and bounded bodies before parsing", async () => {
    const repository = createRepository();
    const action = createSymptomCheckDetailAction({
      appOrigin,
      sessions: { requireUser: vi.fn(async () => user) },
      repository,
      originValidator: () => true,
    });

    expect(
      (
        await action(
          new Request(`${appOrigin}/history/${checkId}`, {
            method: "POST",
            headers: { "Content-Type": "text/plain", Origin: appOrigin },
          }),
          checkId,
        )
      ).status,
    ).toBe(415);
    expect(
      (
        await action(
          new Request(`${appOrigin}/history/${checkId}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "Content-Length": "20000",
              Origin: appOrigin,
            },
            body: "a=1",
          }),
          checkId,
        )
      ).status,
    ).toBe(413);
    expect(repository.updateForOwner).not.toHaveBeenCalled();
    expect(repository.deleteForOwner).not.toHaveBeenCalled();
  });

  it("propagates signed-out redirects before repository work", async () => {
    const repository = createRepository();
    const action = createSymptomCheckDetailAction({
      appOrigin,
      sessions: {
        requireUser: vi.fn(async () => {
          throw redirect(`/login?returnTo=%2Fhistory%2F${checkId}`, {
            headers: { "Set-Cookie": "cleared-session" },
          });
        }),
      },
      repository,
      originValidator: () => true,
    });

    try {
      await action(detailRequest({ intent: "delete" }), checkId);
      throw new Error("Expected authentication redirect.");
    } catch (error) {
      const response = error as Response;
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(
        `/login?returnTo=%2Fhistory%2F${checkId}`,
      );
      expect(response.headers.get("Set-Cookie")).toBe("cleared-session");
    }
    expect(repository.updateForOwner).not.toHaveBeenCalled();
    expect(repository.deleteForOwner).not.toHaveBeenCalled();
  });

  it.each([
    ["not-a-uuid", 404],
    [undefined, 404],
  ])("treats invalid identifiers as private 404s", async (candidate, expectedStatus) => {
    const repository = createRepository();
    const action = createSymptomCheckDetailAction({
      appOrigin,
      sessions: { requireUser: vi.fn(async () => user) },
      repository,
      originValidator: () => true,
    });

    try {
      await action(detailRequest({ intent: "delete" }), candidate);
      throw new Error("Expected a not-found response.");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(expectedStatus);
      expect((error as Response).headers.get("Cache-Control")).toBe(
        "private, no-store",
      );
    }
    expect(repository.updateForOwner).not.toHaveBeenCalled();
    expect(repository.deleteForOwner).not.toHaveBeenCalled();
  });

  it.each([
    [
      "update",
      new URLSearchParams({
        intent: "update",
        symptoms: "not-json",
      }),
      400,
    ],
    [
      "update-empty",
      new URLSearchParams({
        intent: "update",
        symptoms: JSON.stringify([]),
      }),
      400,
    ],
    [
      "update-duplicate",
      new URLSearchParams({
        intent: "update",
        symptoms: JSON.stringify([
          { symptomId: "sneezing", intensity: "high" },
          { symptomId: "sneezing", intensity: "low" },
        ]),
      }),
      400,
    ],
    [
      "update-extra",
      new URLSearchParams({
        intent: "update",
        symptoms: JSON.stringify([
          { symptomId: "sneezing", intensity: "high" },
        ]),
        city: "Warszawa, Polska",
      }),
      400,
    ],
    [
      "unknown",
      new URLSearchParams({
        intent: "archive",
      }),
      400,
    ],
  ])(
    "rejects %s update payloads before persistence",
    async (_label, body, expectedStatus) => {
      const repository = createRepository();
      const action = createSymptomCheckDetailAction({
        appOrigin,
        sessions: { requireUser: vi.fn(async () => user) },
        repository,
        originValidator: () => true,
      });

      const response = await action(
        new Request(`${appOrigin}/history/${checkId}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: appOrigin },
          body,
        }),
        checkId,
      );

      expect(response.status).toBe(expectedStatus);
      expect(repository.updateForOwner).not.toHaveBeenCalled();
      expect(repository.deleteForOwner).not.toHaveBeenCalled();
    },
  );

  it("uses the authenticated owner and redirects to detail after update", async () => {
    const repository = createRepository();
    const updatedRecord = {
      ...record,
      snapshot: buildCurrentSymptomSnapshot({
        city: record.snapshot.city,
        symptoms: [{ symptomId: "sneezing", intensity: "low" }],
        pollenActivity: record.snapshot.pollenActivity,
        completedAt: new Date(record.snapshot.completedAt),
      }),
    };
    vi.mocked(repository.updateForOwner).mockResolvedValue(updatedRecord);
    const action = createSymptomCheckDetailAction({
      appOrigin,
      sessions: { requireUser: vi.fn(async () => user) },
      repository,
      originValidator: () => true,
    });
    const response = await action(
      detailRequest({
        intent: "update",
        symptoms: JSON.stringify([
          { symptomId: "sneezing", intensity: "low" },
        ]),
      }),
      checkId,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      `/history/${checkId}?updated=1`,
    );
    expect(repository.updateForOwner).toHaveBeenCalledWith(user.id, checkId, [
      { symptomId: "sneezing", intensity: "low" },
    ]);
  });

  it("uses the authenticated owner and redirects to history after delete", async () => {
    const repository = createRepository();
    vi.mocked(repository.deleteForOwner).mockResolvedValue(checkId);
    const action = createSymptomCheckDetailAction({
      appOrigin,
      sessions: { requireUser: vi.fn(async () => user) },
      repository,
      originValidator: () => true,
    });
    const response = await action(
      detailRequest({ intent: "delete" }),
      checkId,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/history?deleted=1");
    expect(repository.deleteForOwner).toHaveBeenCalledWith(user.id, checkId);
  });

  it.each([
    ["update", "missing"],
    ["delete", "foreign"],
  ])("returns the same private 404 for missing and foreign %s targets", async (intent, kind) => {
    const repository = createRepository();
    vi.mocked(repository.updateForOwner).mockResolvedValue(null);
    vi.mocked(repository.deleteForOwner).mockResolvedValue(null);
    const action = createSymptomCheckDetailAction({
      appOrigin,
      sessions: { requireUser: vi.fn(async () => user) },
      repository,
      originValidator: () => true,
    });

    try {
      await action(
        detailRequest(
          intent === "update"
            ? {
                intent,
                symptoms: JSON.stringify([
                  { symptomId: "sneezing", intensity: "low" },
                ]),
              }
            : { intent },
        ),
        kind === "missing" ? "not-a-uuid" : checkId,
      );
      throw new Error("Expected a not-found response.");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(404);
      expect((error as Response).headers.get("Cache-Control")).toBe(
        "private, no-store",
      );
    }
  });
});

describe("symptom-check detail loader", () => {
  it("scopes lookup to the authenticated owner and sets private caching", async () => {
    const repository = createRepository();
    const loader = createSymptomCheckDetailLoader({
      appOrigin,
      sessions: { requireUser: vi.fn(async () => user) },
      repository,
    });
    const response = await loader(
      new Request(
        `${appOrigin}/history/${checkId}?saved=1&requestId=${requestId}`,
      ),
      checkId,
    );

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(repository.findForOwner).toHaveBeenCalledWith(user.id, checkId);
    await expect(response.json()).resolves.toEqual({
      record,
      saved: true,
      requestId,
    });
  });

  it.each([undefined, "not-a-uuid", checkId])(
    "uses the same 404 for invalid, missing, and foreign identifiers",
    async (candidate) => {
      const repository = createRepository();
      vi.mocked(repository.findForOwner).mockResolvedValue(null);
      const loader = createSymptomCheckDetailLoader({
        appOrigin,
        sessions: { requireUser: vi.fn(async () => user) },
        repository,
      });

      try {
        await loader(
          new Request(`${appOrigin}/history/${candidate ?? ""}`),
          candidate,
        );
        throw new Error("Expected a not-found response.");
      } catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
        expect((error as Response).headers.get("Cache-Control")).toBe(
          "private, no-store",
        );
      }
    },
  );

  it("preserves signed-out redirects and does not query persistence", async () => {
    const repository = createRepository();
    const loader = createSymptomCheckDetailLoader({
      appOrigin,
      sessions: {
        requireUser: vi.fn(async () => {
          throw redirect(`/login?returnTo=%2Fhistory%2F${checkId}`, {
            headers: { "Set-Cookie": "cleared-session" },
          });
        }),
      },
      repository,
    });

    try {
      await loader(new Request(`${appOrigin}/history/${checkId}`), checkId);
      throw new Error("Expected authentication redirect.");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(302);
      expect((error as Response).headers.get("Location")).toBe(
        `/login?returnTo=%2Fhistory%2F${checkId}`,
      );
      expect((error as Response).headers.get("Set-Cookie")).toBe(
        "cleared-session",
      );
    }
    expect(repository.findForOwner).not.toHaveBeenCalled();
  });
});

describe("symptom-check list loader", () => {
  it("returns only repository-owned records with private caching", async () => {
    const repository = createRepository();
    vi.mocked(repository.listForOwner).mockResolvedValue([record]);
    const loader = createSymptomCheckListLoader({
      appOrigin,
      sessions: { requireUser: vi.fn(async () => user) },
      repository,
    });
    const response = await loader(new Request(`${appOrigin}/history`));
    const payload = await response.json();

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(repository.listForOwner).toHaveBeenCalledWith(user.id);
    expect(payload).toEqual({ records: [record] });
    expect(JSON.stringify(payload)).not.toContain(user.id);
  });

  it("preserves signed-out redirects and does not list records", async () => {
    const repository = createRepository();
    const loader = createSymptomCheckListLoader({
      appOrigin,
      sessions: {
        requireUser: vi.fn(async () => {
          throw redirect("/login?returnTo=%2Fhistory", {
            headers: { "Set-Cookie": "cleared-session" },
          });
        }),
      },
      repository,
    });

    try {
      await loader(new Request(`${appOrigin}/history`));
      throw new Error("Expected authentication redirect.");
    } catch (error) {
      expect(error).toBeInstanceOf(Response);
      expect((error as Response).status).toBe(302);
      expect((error as Response).headers.get("Location")).toBe(
        "/login?returnTo=%2Fhistory",
      );
      expect((error as Response).headers.get("Set-Cookie")).toBe(
        "cleared-session",
      );
    }
    expect(repository.listForOwner).not.toHaveBeenCalled();
  });
});
