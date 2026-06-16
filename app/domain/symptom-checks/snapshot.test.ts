import { describe, expect, it } from "vitest";

import {
  buildCurrentSymptomSnapshot,
  parseSavedSymptomEntries,
  parseSymptomCheckSnapshot,
  reconstructSymptomCheck,
} from "./snapshot";

const completedAt = new Date("2026-06-11T12:00:00.000Z");

function validSnapshot() {
  return buildCurrentSymptomSnapshot({
    city: {
      placeId: "place-warsaw",
      label: "Warszawa, Polska",
    },
    symptoms: [
      { symptomId: "blocked-nose", intensity: "high" },
      { symptomId: "watery-eyes", intensity: "low" },
    ],
    pollenActivity: {
      "grass-pollen": "high",
      "tree-pollen": "moderate",
    },
    completedAt,
  });
}

describe("symptom-check snapshot", () => {
  it("parses valid mixed saved symptom entries", () => {
    expect(
      parseSavedSymptomEntries([
        { symptomId: "blocked-nose", intensity: "high" },
        { symptomId: "watery-eyes", intensity: "low" },
      ]),
    ).toEqual([
      { symptomId: "blocked-nose", intensity: "high" },
      { symptomId: "watery-eyes", intensity: "low" },
    ]);
  });

  it.each([
    ["empty symptoms", []],
    [
      "oversized symptoms",
      Array.from({ length: 12 }, (_, index) => ({
        symptomId:
          index % 2 === 0 ? "blocked-nose" : "watery-eyes",
        intensity: "high",
      })),
    ],
    ["malformed entry", [{ symptomId: "blocked-nose" }]],
    ["unknown symptom", [{ symptomId: "unknown", intensity: "high" }]],
    ["unknown intensity", [{ symptomId: "blocked-nose", intensity: "medium" }]],
    [
      "duplicate symptoms",
      [
        { symptomId: "blocked-nose", intensity: "high" },
        { symptomId: "blocked-nose", intensity: "low" },
      ],
    ],
  ])("rejects %s", (_label, entries) => {
    expect(parseSavedSymptomEntries(entries)).toBeNull();
  });

  it("preserves each symptom intensity", () => {
    expect(validSnapshot().symptoms).toEqual([
      { symptomId: "blocked-nose", intensity: "high" },
      { symptomId: "watery-eyes", intensity: "low" },
    ]);
  });

  it("uses snapshot version 1 with the current-v2 ranking contract", () => {
    expect(validSnapshot()).toMatchObject({
      snapshotVersion: 1,
      rankingVersion: "current-v2",
    });
  });

  it("canonicalizes missing pollen values to unknown", () => {
    expect(validSnapshot().pollenActivity).toEqual({
      "grass-pollen": "high",
      "tree-pollen": "moderate",
      "weed-pollen": "unknown",
      "ragweed-pollen": "unknown",
    });
  });

  it("parses a bounded supported snapshot", () => {
    expect(
      parseSymptomCheckSnapshot(validSnapshot(), {
        now: new Date("2026-06-11T12:01:00.000Z"),
      }),
    ).toEqual(validSnapshot());
  });

  it.each([
    ["empty symptoms", { symptoms: [] }],
    [
      "duplicate symptoms",
      {
        symptoms: [
          { symptomId: "sneezing", intensity: "high" },
          { symptomId: "sneezing", intensity: "low" },
        ],
      },
    ],
    ["unknown snapshot version", { snapshotVersion: 2 }],
    ["legacy ranking version", { rankingVersion: "current-v1" }],
    ["unknown ranking version", { rankingVersion: "future-v3" }],
    ["owner data", { ownerId: "user-1" }],
    [
      "invalid pollen level",
      {
        pollenActivity: {
          ...validSnapshot().pollenActivity,
          "tree-pollen": "none",
        },
      },
    ],
  ])("rejects %s", (_label, override) => {
    expect(
      parseSymptomCheckSnapshot({
        ...validSnapshot(),
        ...override,
      }),
    ).toBeNull();
  });

  it("rejects timestamps outside the pending-draft lifetime", () => {
    expect(
      parseSymptomCheckSnapshot(validSnapshot(), {
        now: new Date("2026-06-11T13:00:01.000Z"),
        maxAgeMs: 60 * 60 * 1_000,
      }),
    ).toBeNull();
  });

  it("rejects timestamps beyond the future skew allowance", () => {
    expect(
      parseSymptomCheckSnapshot(
        {
          ...validSnapshot(),
          completedAt: "2026-06-11T12:06:00.000Z",
        },
        {
          now: completedAt,
          futureSkewMs: 5 * 60 * 1_000,
        },
      ),
    ).toBeNull();
  });

  it("reconstructs ranking from the saved inputs", () => {
    const reconstructed = reconstructSymptomCheck(validSnapshot());

    expect(
      reconstructed.rankedResults.map(({ allergenId, score }) => ({
        allergenId,
        score,
      })),
    ).toEqual([
      { allergenId: "grass-pollen", score: 3 },
      { allergenId: "tree-pollen", score: 2 },
      { allergenId: "weed-pollen", score: 2 },
      { allergenId: "ragweed-pollen", score: 2 },
    ]);
    expect(reconstructed.rankedResults[0]).toMatchObject({
      allergenId: "grass-pollen",
      score: 3,
      matchedSymptoms: [
        {
          symptomId: "watery-eyes",
          intensity: "low",
          intensityLabel: "Niskie",
        },
      ],
    });
  });
});
