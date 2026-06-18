import { useState } from "react";
import type { CurrentLocationResponse } from "~/domain/current-location/http";
import type { CitySuggestion } from "~/domain/current-location/types";

type CurrentLocationControlProps = {
  onResolve: (city: CitySuggestion) => void;
  disabled?: boolean;
};

type CurrentLocationControlStatus = "idle" | "loading" | "error";

const geolocationOptions: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 7_000,
  maximumAge: 300_000,
};

function messageForGeolocationError(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return "Nie uzyskano zgody na lokalizację. Możesz nadal wpisać miasto ręcznie.";
  }

  if (error.code === error.TIMEOUT) {
    return "Nie udało się ustalić lokalizacji w czasie. Wpisz miasto ręcznie.";
  }

  return "Lokalizacja urządzenia jest chwilowo niedostępna. Wpisz miasto ręcznie.";
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function CurrentLocationControl({
  onResolve,
  disabled = false,
}: CurrentLocationControlProps) {
  const [status, setStatus] = useState<CurrentLocationControlStatus>("idle");
  const [message, setMessage] = useState("");
  const isLoading = status === "loading";

  function resolveCoordinates(position: GeolocationPosition) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8_000);

    fetch("/api/current-location", {
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
          setStatus("idle");
          setMessage("Miasto ustawione na podstawie lokalizacji urządzenia.");
          return;
        }

        setStatus("error");
        setMessage(
          payload.message ||
            "Nie udało się rozpoznać miasta. Możesz wpisać je ręcznie.",
        );
      })
      .catch((error: unknown) => {
        setStatus("error");
        setMessage(
          isAbortError(error)
            ? "Rozpoznawanie miasta trwało zbyt długo. Wpisz miasto ręcznie."
            : "Nie udało się rozpoznać miasta. Możesz wpisać je ręcznie.",
        );
      })
      .finally(() => window.clearTimeout(timeoutId));
  }

  function handleLocateClick() {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setMessage(
        "Ta przeglądarka nie udostępnia lokalizacji. Wpisz miasto ręcznie.",
      );
      return;
    }

    setStatus("loading");
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      resolveCoordinates,
      (error) => {
        setStatus("error");
        setMessage(messageForGeolocationError(error));
      },
      geolocationOptions,
    );
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={handleLocateClick}
        disabled={disabled || isLoading}
        className="h-11 rounded-md border border-emerald-700 bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500"
      >
        {isLoading ? "Ustalam..." : "Użyj lokalizacji"}
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
