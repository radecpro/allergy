import { createProductionAuthDependencies } from "~/domain/auth/dependencies.server";

import { createSymptomCheckRepository } from "./symptom-check-repository.server";

export function createProductionSymptomCheckDependencies() {
  return {
    sessions: createProductionAuthDependencies().sessions,
    repository: createSymptomCheckRepository(),
  };
}
