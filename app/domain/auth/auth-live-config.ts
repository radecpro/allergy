export type LiveAuthEnvironment = {
  optIn: string | undefined;
  target: string | undefined;
  email: string | undefined;
  password: string | undefined;
  projectId: string | undefined;
  productionProjectId: string | undefined;
  finalProjectId: string | undefined;
  allowFinalTarget: string | undefined;
  emulatorHost: string | undefined;
};

export function validateLiveAuthEnvironment(
  environment: LiveAuthEnvironment,
): {
  email: string;
  password: string;
} {
  if (environment.optIn !== "1") {
    throw new Error(
      "AUTH_LIVE_OPT_IN=1 is required for the live auth preflight.",
    );
  }

  if (
    environment.target !== "emulator" &&
    environment.target !== "non-production" &&
    environment.target !== "final-pre-traffic"
  ) {
    throw new Error(
      "AUTH_LIVE_TARGET must be emulator, non-production, or final-pre-traffic.",
    );
  }

  if (!environment.email || !environment.password || !environment.projectId) {
    throw new Error(
      "AUTH_LIVE_EMAIL, AUTH_LIVE_PASSWORD, and GOOGLE_CLOUD_PROJECT are required.",
    );
  }

  if (environment.target === "emulator" && !environment.emulatorHost) {
    throw new Error(
      "FIREBASE_AUTH_EMULATOR_HOST is required for AUTH_LIVE_TARGET=emulator.",
    );
  }

  if (environment.target === "non-production") {
    if (environment.emulatorHost) {
      throw new Error(
        "FIREBASE_AUTH_EMULATOR_HOST must be unset for the non-production runtime preflight.",
      );
    }

    if (!environment.productionProjectId) {
      throw new Error(
        "AUTH_LIVE_PRODUCTION_PROJECT_ID is required for the non-production preflight.",
      );
    }

    if (environment.projectId === environment.productionProjectId) {
      throw new Error("The live auth preflight refuses the production project.");
    }
  }

  if (environment.target === "final-pre-traffic") {
    if (environment.emulatorHost) {
      throw new Error(
        "FIREBASE_AUTH_EMULATOR_HOST must be unset for the final pre-traffic runtime preflight.",
      );
    }

    if (
      !environment.finalProjectId ||
      environment.projectId !== environment.finalProjectId
    ) {
      throw new Error(
        "AUTH_LIVE_FINAL_PROJECT_ID must exactly match GOOGLE_CLOUD_PROJECT.",
      );
    }

    if (environment.allowFinalTarget !== "1") {
      throw new Error(
        "AUTH_LIVE_ALLOW_FINAL_TARGET=1 is required for the final pre-traffic preflight.",
      );
    }
  }

  return {
    email: environment.email,
    password: environment.password,
  };
}
