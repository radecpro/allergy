import { createProductionAuthDependencies } from "~/domain/auth/dependencies.server";

import { createSymptomCheckRepository } from "./symptom-check-repository.server";

export function createProductionSymptomCheckDependencies() {
  const auth = createProductionAuthDependencies();

  return {
    appOrigin: auth.appOrigin,
    sessions: auth.sessions,
    repository: createSymptomCheckRepository(),
  };
}
