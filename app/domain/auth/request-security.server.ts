function parseConfiguredOrigin(value: string): string {
  const url = new URL(value);

  if (
    url.origin === "null" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error("APP_ORIGIN must be an absolute origin without a path.");
  }

  return url.origin;
}

function parseOriginHeader(value: string): string | null {
  if (value === "null") {
    return null;
  }

  try {
    const url = new URL(value);

    if (
      url.origin === "null" ||
      url.username !== "" ||
      url.password !== "" ||
      url.pathname !== "/" ||
      url.search !== "" ||
      url.hash !== ""
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function parseRefererOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    return url.origin === "null" ? null : url.origin;
  } catch {
    return null;
  }
}

export function getAppOrigin(): string {
  const value = process.env.APP_ORIGIN;

  if (!value) {
    throw new Error("APP_ORIGIN is required.");
  }

  return parseConfiguredOrigin(value);
}

export function hasTrustedRequestOrigin(
  request: Request,
  appOrigin = getAppOrigin(),
): boolean {
  let trustedOrigin: string;

  try {
    trustedOrigin = parseConfiguredOrigin(appOrigin);
  } catch {
    return false;
  }

  const origin = request.headers.get("Origin");

  if (origin !== null) {
    return parseOriginHeader(origin) === trustedOrigin;
  }

  const referer = request.headers.get("Referer");
  return referer !== null && parseRefererOrigin(referer) === trustedOrigin;
}
