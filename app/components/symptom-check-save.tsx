import { useEffect, useState } from "react";
import {
  useFetcher,
  useNavigate,
  useRouteLoaderData,
  useSearchParams,
} from "react-router";

import type { SaveSymptomCheckActionData } from "~/domain/symptom-checks/symptom-check-route-handlers.server";
import {
  clearPendingSymptomCheck,
  createPendingSymptomCheck,
  loadPendingSymptomCheck,
  storePendingSymptomCheck,
} from "~/domain/symptom-checks/pending-snapshot";
import type {
  PendingSymptomCheck,
} from "~/domain/symptom-checks/pending-snapshot";
import type { SymptomCheckSnapshot } from "~/domain/symptom-checks/types";
import type { RootLoaderData } from "~/root";

import { SymptomCheckSummary } from "./symptom-check-summary";

type SymptomCheckSaveProps = {
  snapshot: SymptomCheckSnapshot | null;
  disabled: boolean;
};

export function SymptomCheckSave({
  snapshot,
  disabled,
}: SymptomCheckSaveProps) {
  const rootData = useRouteLoaderData("root") as RootLoaderData | undefined;
  const fetcher = useFetcher<SaveSymptomCheckActionData>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [pending, setPending] = useState<PendingSymptomCheck | null>(null);
  const [localError, setLocalError] = useState("");
  const viewer = rootData?.viewer ?? null;

  useEffect(() => {
    if (searchParams.get("save") !== "pending") {
      return;
    }

    const restored = loadPendingSymptomCheck(window.sessionStorage);
    setPending(restored);
    setLocalError(
      restored
        ? ""
        : "Oczekujący zapis wygasł lub nie można go odczytać. Wykonaj sprawdzenie ponownie.",
    );
  }, [searchParams]);

  function submit(
    savedSnapshot: SymptomCheckSnapshot,
    requestId: string,
    source: "direct" | "pending",
  ) {
    fetcher.submit(
      {
        requestId,
        source,
        snapshot: JSON.stringify(savedSnapshot),
      },
      { method: "post", action: "/" },
    );
  }

  function handleSave() {
    if (!snapshot || disabled) {
      return;
    }

    const requestId = window.crypto.randomUUID();

    if (viewer) {
      submit(snapshot, requestId, "direct");
      return;
    }

    const pendingSave = createPendingSymptomCheck(requestId, snapshot);

    if (!storePendingSymptomCheck(window.sessionStorage, pendingSave)) {
      setLocalError(
        "Przeglądarka nie pozwala zachować oczekującego zapisu. Zaloguj się i spróbuj ponownie.",
      );
      return;
    }

    window.location.assign(
      `/login?returnTo=${encodeURIComponent("/?save=pending")}`,
    );
  }

  function cancelPending() {
    clearPendingSymptomCheck(window.sessionStorage);
    setPending(null);
    setLocalError("");
    navigate("/", { replace: true });
  }

  const error = fetcher.data?.error ?? localError;

  if (pending && viewer) {
    return (
      <section className="grid gap-4 rounded-md border border-emerald-300 bg-emerald-50 p-4">
        <div>
          <h3 className="font-semibold text-emerald-950">
            Dokończ zapisywanie sprawdzenia
          </h3>
          <p className="mt-1 text-sm leading-6 text-emerald-900">
            Sprawdź dane i potwierdź. Rekord powstanie dopiero po tej operacji.
          </p>
        </div>
        <SymptomCheckSummary snapshot={pending.snapshot} compact />
        {error ? (
          <p role="alert" className="text-sm text-rose-800">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={fetcher.state !== "idle"}
            onClick={() =>
              submit(pending.snapshot, pending.requestId, "pending")
            }
            className="rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {fetcher.state === "idle" ? "Potwierdź zapis" : "Zapisuję..."}
          </button>
          <button
            type="button"
            onClick={cancelPending}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800"
          >
            Anuluj
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={handleSave}
        disabled={!snapshot || disabled || fetcher.state !== "idle"}
        className="rounded-md bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {fetcher.state === "idle" ? "Zapisz sprawdzenie" : "Zapisuję..."}
      </button>
      <p className="text-xs leading-5 text-slate-600">
        Zapis nastąpi tylko po wybraniu tego przycisku
        {viewer ? "." : " i zalogowaniu się."}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-rose-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
