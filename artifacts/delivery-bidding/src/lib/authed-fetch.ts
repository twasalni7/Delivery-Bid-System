/**
 * Returns an object with the Authorization header populated from the stored
 * auth token.  Spread this into the `headers` of any `fetch` call that
 * previously relied on `credentials: "include"` (cookie-based auth).
 *
 * Usage:
 *   fetch(url, { headers: { ...getAuthHeaders() } })
 *   fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, body })
 */
export function getAuthHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem("auth_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    // localStorage unavailable (SSR / private-browsing edge cases)
    return {};
  }
}
