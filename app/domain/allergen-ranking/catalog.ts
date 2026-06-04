import { symptomLabels } from "./labels";
import type { AllergenCatalogItem, SymptomCatalogItem } from "./types";

export const allergenCatalog = [
  {
    id: "grass-pollen",
    label: "Pyłki traw",
    symptomIds: [
      "sneezing",
      "runny-nose",
      "itchy-eyes",
      "watery-eyes",
      "scratchy-throat",
    ],
  },
  {
    id: "tree-pollen",
    label: "Pyłki drzew",
    symptomIds: ["sneezing", "runny-nose", "itchy-eyes", "watery-eyes"],
  },
  {
    id: "weed-pollen",
    label: "Pyłki chwastów innych niż ambrozja",
    symptomIds: ["sneezing", "runny-nose", "blocked-nose", "scratchy-throat"],
  },
  {
    id: "ragweed-pollen",
    label: "Pyłki ambrozji",
    symptomIds: [
      "sneezing",
      "runny-nose",
      "blocked-nose",
      "itchy-eyes",
      "scratchy-throat",
    ],
  },
] as const satisfies readonly AllergenCatalogItem[];

export const symptomCatalog = [
  { id: "sneezing", label: symptomLabels.sneezing },
  { id: "runny-nose", label: symptomLabels["runny-nose"] },
  { id: "blocked-nose", label: symptomLabels["blocked-nose"] },
  { id: "itchy-eyes", label: symptomLabels["itchy-eyes"] },
  { id: "watery-eyes", label: symptomLabels["watery-eyes"] },
  { id: "scratchy-throat", label: symptomLabels["scratchy-throat"] },
] as const satisfies readonly SymptomCatalogItem[];
