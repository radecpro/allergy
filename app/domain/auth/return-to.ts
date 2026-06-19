const getPagePaths = new Set(["/", "/destination", "/history"]);
const forbiddenPrefixes = ["/login", "/register", "/logout", "/api"];
const historyDetailPattern =
  /^\/history\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  if (
    !getPagePaths.has(destination.pathname) &&
    !historyDetailPattern.test(destination.pathname)
  ) {
    return "/";
  }

  if (
    destination.pathname === "/" &&
    destination.search !== "" &&
    destination.search !== "?save=pending"
  ) {
    return "/";
  }

  return `${destination.pathname}${destination.search}${destination.hash}`;
}
