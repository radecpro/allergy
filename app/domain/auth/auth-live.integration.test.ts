import { describe, expect, it } from "vitest";

import { validateLiveAuthEnvironment } from "./auth-live-config";
import { getFirebaseAuth } from "./firebase-admin.server";
import { createIdentityProvider } from "./identity-platform.server";

const { email, password } = validateLiveAuthEnvironment({
  optIn: process.env.AUTH_LIVE_OPT_IN,
  target: process.env.AUTH_LIVE_TARGET,
  email: process.env.AUTH_LIVE_EMAIL,
  password: process.env.AUTH_LIVE_PASSWORD,
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  productionProjectId: process.env.AUTH_LIVE_PRODUCTION_PROJECT_ID,
  finalProjectId: process.env.AUTH_LIVE_FINAL_PROJECT_ID,
  allowFinalTarget: process.env.AUTH_LIVE_ALLOW_FINAL_TARGET,
  emulatorHost: process.env.FIREBASE_AUTH_EMULATOR_HOST,
});

describe("live Firebase runtime preflight", () => {
  it("signs in and proves session creation plus both verification modes", async () => {
    const identity = await createIdentityProvider().signIn(email, password);
    const auth = getFirebaseAuth();
    const sessionCookie = await auth.createSessionCookie(identity.idToken, {
      expiresIn: 5 * 60 * 1000,
    });

    const regularClaims = await auth.verifySessionCookie(sessionCookie, false);
    const revocationCheckedClaims = await auth.verifySessionCookie(
      sessionCookie,
      true,
    );

    expect(regularClaims.uid).toBe(identity.providerUid);
    expect(revocationCheckedClaims.uid).toBe(identity.providerUid);
  });
});
