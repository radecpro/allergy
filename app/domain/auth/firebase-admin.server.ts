import { applicationDefault, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

import { validateAuthRuntimeEnvironment } from "./auth-runtime-config.server";

export const validateFirebaseEnvironment = validateAuthRuntimeEnvironment;

function initializeFirebaseApp(): App {
  const existingApp = getApps()[0];

  if (existingApp) {
    return existingApp;
  }

  const { projectId, emulatorHost } = validateAuthRuntimeEnvironment();

  return initializeApp(
    emulatorHost
      ? { projectId }
      : {
          projectId,
          credential: applicationDefault(),
        },
  );
}

export function getFirebaseAuth(): Auth {
  return getAuth(initializeFirebaseApp());
}
