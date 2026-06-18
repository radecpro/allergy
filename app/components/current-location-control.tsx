import { useState } from "react";
import type { CurrentLocationResponse } from "~/domain/current-location/http";
import type { CitySuggestion } from "~/domain/current-location/types";

type CurrentLocationControlProps = {
  onResolve: (city: CitySuggestion) => void;
  disabled?: boolean;
};

export type CurrentLocationControlStatus = "idle" | "loading" | "error";

type CurrentLocationWorkflow = {
  geolocation?: Geolocation;
  fetchCurrentLocation: typeof fetch;
  onResolve: (city: CitySuggestion) => void;
  onStatus: (status: CurrentLocationControlStatus, message: string) => void;
  createAbortController?: () => AbortController;
  setTimeoutFn?: typeof window.setTimeout;
  clearTimeoutFn?: typeof window.clearTimeout;
};

const geolocationOptions: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 7_000,
  maximumAge: 300_000,
};
const geolocationPermissionDeniedCode = 1;
const geolocationTimeoutCode = 3;

export function messageForGeolocationError(
  error: Pick<GeolocationPositionError, "code">,
): string {
  if (error.code === geolocationPermissionDeniedCode) {
    return "Nie uzyskano zgody na lokalizację. Możesz nadal wpisać miasto ręcznie.";
  }

  if (error.code === geolocationTimeoutCode) {
    return "Nie udało się ustalić lokalizacji w czasie. Wpisz miasto ręcznie.";
  }

  return "Lokalizacja urządzenia jest chwilowo niedostępna. Wpisz miasto ręcznie.";
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function isCurrentLocationButtonDisabled({
  disabled,
  status,
}: {
  disabled: boolean;
  status: CurrentLocationControlStatus;
}): boolean {
  return disabled || status === "loading";
}

export function requestCurrentLocationCity({
  geolocation,
  fetchCurrentLocation,
  onResolve,
  onStatus,
  createAbortController = () => new AbortController(),
  setTimeoutFn = window.setTimeout,
  clearTimeoutFn = window.clearTimeout,
}: CurrentLocationWorkflow): void {
  if (!geolocation) {
    onStatus(
      "error",
      "Ta przeglądarka nie udostępnia lokalizacji. Wpisz miasto ręcznie.",
    );
    return;
  }

  onStatus("loading", "");
  geolocation.getCurrentPosition(
    (position) => {
      const controller = createAbortController();
      const timeoutId = setTimeoutFn(() => controller.abort(), 8_000);

      fetchCurrentLocation("/api/current-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = (await response.json()) as CurrentLocationResponse;

          if (payload.status === "ok" && payload.city) {
            onResolve(payload.city);
            onStatus(
              "idle",
              "Miasto ustawione na podstawie lokalizacji urządzenia.",
            );
            return;
          }

          onStatus(
            "error",
            payload.message ||
              "Nie udało się rozpoznać miasta. Możesz wpisać je ręcznie.",
          );
        })
        .catch((error: unknown) => {
          onStatus(
            "error",
            isAbortError(error)
              ? "Rozpoznawanie miasta trwało zbyt długo. Wpisz miasto ręcznie."
              : "Nie udało się rozpoznać miasta. Możesz wpisać je ręcznie.",
          );
        })
        .finally(() => clearTimeoutFn(timeoutId));
    },
    (error) => {
      onStatus("error", messageForGeolocationError(error));
    },
    geolocationOptions,
  );
}

export function CurrentLocationControl({
  onResolve,
  disabled = false,
}: CurrentLocationControlProps) {
  const [status, setStatus] = useState<CurrentLocationControlStatus>("idle");
  const [message, setMessage] = useState("");
  const isDisabled = isCurrentLocationButtonDisabled({ disabled, status });

  function handleLocateClick() {
    requestCurrentLocationCity({
      geolocation:
        "geolocation" in navigator ? navigator.geolocation : undefined,
      fetchCurrentLocation: fetch,
      onResolve,
      onStatus: (nextStatus, nextMessage) => {
        setStatus(nextStatus);
        setMessage(nextMessage);
      },
    });
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={handleLocateClick}
        disabled={isDisabled}
        className="h-11 rounded-md border border-emerald-700 bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500"
      >
        {status === "loading" ? "Ustalam..." : "Użyj lokalizacji"}
      </button>
      <p
        role={status === "error" ? "alert" : "status"}
        className={`min-h-5 text-sm ${
          status === "error" ? "text-amber-800" : "text-slate-600"
        }`}
      >
        {message}
      </p>
    </div>
  );
}
