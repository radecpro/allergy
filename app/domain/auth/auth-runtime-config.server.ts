export type AuthRuntimeConfig = {
  projectId: string;
  emulatorHost?: string;
};

function isDeployedEnvironment(): boolean {
  return process.env.NODE_ENV === "production" || Boolean(process.env.K_SERVICE);
}

function validateEmulatorHost(value: string): string {
  if (value.includes("://")) {
    throw new Error(
      "FIREBASE_AUTH_EMULATOR_HOST must use host:port without a protocol.",
    );
  }

  const url = new URL(`http://${value}`);

  if (
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== "" ||
    url.host !== value
  ) {
    throw new Error(
      "FIREBASE_AUTH_EMULATOR_HOST must use host:port without a path.",
    );
  }

  return value;
}

export function validateAuthRuntimeEnvironment(): AuthRuntimeConfig {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;

  if (!projectId) {
    throw new Error("GOOGLE_CLOUD_PROJECT is required.");
  }

  if (emulatorHost && isDeployedEnvironment()) {
    throw new Error(
      "FIREBASE_AUTH_EMULATOR_HOST is not allowed in a deployed environment.",
    );
  }

  return {
    projectId,
    emulatorHost: emulatorHost
      ? validateEmulatorHost(emulatorHost)
      : undefined,
  };
}
