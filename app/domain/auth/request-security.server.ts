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

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function isLocalhostAliasMatch(left: URL, right: URL): boolean {
  return (
    left.protocol === right.protocol &&
    left.port === right.port &&
    isLoopbackHostname(left.hostname) &&
    isLoopbackHostname(right.hostname)
  );
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
    const parsedOrigin = parseOriginHeader(origin);

    if (parsedOrigin === trustedOrigin) {
      return true;
    }

    try {
      return isLocalhostAliasMatch(new URL(parsedOrigin ?? ""), new URL(trustedOrigin));
    } catch {
      return false;
    }
  }

  const referer = request.headers.get("Referer");
  if (referer === null) {
    return false;
  }

  const parsedReferer = parseRefererOrigin(referer);

  if (parsedReferer === trustedOrigin) {
    return true;
  }

  try {
    return isLocalhostAliasMatch(
      new URL(parsedReferer ?? ""),
      new URL(trustedOrigin),
    );
  } catch {
    return false;
  }
}
