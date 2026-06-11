const getPagePaths = new Set(["/", "/destination"]);
const forbiddenPrefixes = ["/login", "/register", "/logout", "/api"];

export function normalizeReturnTo(
  value: FormDataEntryValue | string | null | undefined,
  appOrigin: string,
): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  let trustedOrigin: URL;
  let destination: URL;

  try {
    trustedOrigin = new URL(appOrigin);
    destination = new URL(value, trustedOrigin);
  } catch {
    return "/";
  }

  if (destination.origin !== trustedOrigin.origin) {
    return "/";
  }

  if (
    forbiddenPrefixes.some(
      (prefix) =>
        destination.pathname === prefix ||
        destination.pathname.startsWith(`${prefix}/`),
    )
  ) {
    return "/";
  }

  if (!getPagePaths.has(destination.pathname)) {
    return "/";
  }

  return `${destination.pathname}${destination.search}${destination.hash}`;
}
