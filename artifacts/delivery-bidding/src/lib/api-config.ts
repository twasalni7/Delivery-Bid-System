/**
 * Base origin for all API requests.
 * Set VITE_API_URL at build time to point to an external API server
 * (e.g. https://delivery-bid-system-2.onrender.com).
 * Falls back to "" so that relative /api/… paths are used when the
 * frontend and backend are served from the same origin.
 */
export const API_ORIGIN =
  import.meta.env.VITE_API_URL?.replace(/\/+$/, "") ?? "";
