const BASE_URL = import.meta.env.BASE_URL || "/";

export function appPath(path = ""): string {
  const normalizedBase = BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`;
  const normalizedPath = path.replace(/^\/+/, "");
  return normalizedPath ? `${normalizedBase}${normalizedPath}` : normalizedBase;
}

export function isSecurePushContext(): boolean {
  if (typeof window === "undefined") return false;
  if (window.isSecureContext) return true;

  const { protocol, hostname } = window.location;
  return (
    protocol === "https:" ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}
