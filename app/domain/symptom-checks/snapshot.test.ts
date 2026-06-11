import { describe, expect, it } from "vitest";

import {
  buildCurrentSymptomSnapshot,
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
    selectedSymptomIds: ["sneezing", "itchy-eyes"],
    intensity: "high",
    pollenActivity: {
      "grass-pollen": "high",
      "tree-pollen": "moderate",
    },
    completedAt,
  });
}

describe("symptom-check snapshot", () => {
  it("copies the current shared intensity onto each symptom", () => {
    expect(validSnapshot().symptoms).toEqual([
      { symptomId: "sneezing", intensity: "high" },
      { symptomId: "itchy-eyes", intensity: "high" },
    ]);
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
    ["unknown ranking version", { rankingVersion: "future-v2" }],
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

    expect(reconstructed.rankedResults[0]).toMatchObject({
      allergenId: "grass-pollen",
      likelihood: "high",
      pollenActivity: "high",
    });
  });

  it("refuses mixed intensities under the current-v1 ranking contract", () => {
    const snapshot = validSnapshot();
    snapshot.symptoms[1] = {
      symptomId: "itchy-eyes",
      intensity: "low",
    };

    expect(() => reconstructSymptomCheck(snapshot)).toThrow(
      "requires one shared symptom intensity",
    );
  });
});
