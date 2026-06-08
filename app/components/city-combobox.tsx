import { useEffect, useRef, useState } from "react";
import type { CitySearchResponse } from "~/domain/current-location/http";
import type { CitySuggestion } from "~/domain/current-location/types";
import { GoogleAttribution } from "./google-attribution";

const minimumSearchLength = 2;

type AsyncStatus = "idle" | "loading" | "unavailable";

type CityComboboxProps = {
  selectedCity: CitySuggestion | null;
  onSelect: (city: CitySuggestion | null) => void;
  inputId: string;
  listboxId: string;
  label: string;
  helperText: string;
  placeholder: string;
};

function formatSuggestionMeta(suggestion: CitySuggestion): string {
  return [suggestion.adminArea, suggestion.country].filter(Boolean).join(", ");
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function CityCombobox({
  selectedCity,
  onSelect,
  inputId,
  listboxId,
  label,
  helperText,
  placeholder,
}: CityComboboxProps) {
  const [cityQuery, setCityQuery] = useState(selectedCity?.label ?? "");
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [citySearchStatus, setCitySearchStatus] = useState<AsyncStatus>("idle");
  const [citySearchMessage, setCitySearchMessage] = useState("");
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const blurTimeoutRef = useRef<number | null>(null);
  const canSearch = cityQuery.trim().length >= minimumSearchLength;

  useEffect(() => {
    const trimmedQuery = cityQuery.trim();

    if (selectedCity?.label === cityQuery) {
      setSuggestions([]);
      setCitySearchStatus("idle");
      setCitySearchMessage("");
      return;
    }

    if (selectedCity !== null) {
      onSelect(null);
    }

    if (trimmedQuery.length < minimumSearchLength) {
      setSuggestions([]);
      setCitySearchStatus("idle");
      setCitySearchMessage("");
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setCitySearchStatus("loading");
      fetch(`/api/city-search?q=${encodeURIComponent(trimmedQuery)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = (await response.json()) as CitySearchResponse;
          setSuggestions(payload.suggestions);
          setCitySearchStatus(
            payload.status === "ok" || payload.status === "empty"
              ? "idle"
              : "unavailable",
          );
          setCitySearchMessage(payload.message ?? "");
          setIsSuggestionsOpen(true);
        })
        .catch((error: unknown) => {
          if (!isAbortError(error)) {
            setSuggestions([]);
            setCitySearchStatus("unavailable");
            setCitySearchMessage("Wyszukiwanie miast jest chwilowo niedostępne.");
            setIsSuggestionsOpen(true);
          }
        });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [cityQuery, onSelect, selectedCity]);

  function handleCityFocus() {
    if (blurTimeoutRef.current !== null) {
      window.clearTimeout(blurTimeoutRef.current);
    }

    if (canSearch) {
      setIsSuggestionsOpen(true);
    }
  }

  function handleCityBlur() {
    blurTimeoutRef.current = window.setTimeout(() => {
      setIsSuggestionsOpen(false);
    }, 150);
  }

  function handleCitySelect(suggestion: CitySuggestion) {
    onSelect(suggestion);
    setCityQuery(suggestion.label);
    setSuggestions([]);
    setIsSuggestionsOpen(false);
    setCitySearchMessage("");
  }

  return (
    <div className="grid gap-2">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isSuggestionsOpen}
          aria-controls={listboxId}
          value={cityQuery}
          onBlur={handleCityBlur}
          onChange={(event) => {
            setCityQuery(event.target.value);
            setIsSuggestionsOpen(true);
          }}
          onFocus={handleCityFocus}
          placeholder={placeholder}
          className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />

        {isSuggestionsOpen && canSearch ? (
          <div className="absolute z-20 mt-2 max-h-80 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
            <div id={listboxId} role="listbox" className="max-h-64 overflow-y-auto py-1">
              {citySearchStatus === "loading" ? (
                <p className="px-3 py-3 text-sm text-slate-600">Szukam miast...</p>
              ) : null}

              {citySearchStatus !== "loading" &&
              citySearchStatus === "unavailable" ? (
                <p className="px-3 py-3 text-sm text-slate-600">
                  {citySearchMessage || "Sugestie miast są chwilowo niedostępne."}
                </p>
              ) : null}

              {citySearchStatus !== "loading" &&
              citySearchStatus !== "unavailable" &&
              suggestions.length === 0 ? (
                <p className="px-3 py-3 text-sm text-slate-600">
                  Brak pasujących sugestii.
                </p>
              ) : null}

              {suggestions.map((suggestion) => {
                const meta = formatSuggestionMeta(suggestion);

                return (
                  <button
                    key={suggestion.placeId}
                    type="button"
                    role="option"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleCitySelect(suggestion)}
                    className="grid w-full gap-0.5 px-3 py-2 text-left hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none"
                  >
                    <span className="font-medium text-slate-950">
                      {suggestion.mainText}
                    </span>
                    <span className="text-sm text-slate-600">
                      {meta || suggestion.secondaryText || suggestion.label}
                      {suggestion.isPolandPriority ? " · Polska" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
            <GoogleAttribution />
          </div>
        ) : null}
      </div>
      <p className="min-h-5 text-sm text-slate-600">
        {selectedCity ? `Wybrane miasto: ${selectedCity.label}` : helperText}
      </p>
    </div>
  );
}
