// Shared constants + helpers for the HR Receipt extension.
// Keep this file in sync with app/lib/holt-renfrew.server.js (same rules).

// Cart/order attribute key. Visible (no underscore) on purpose so it prints on
// the Shopify receipt and shows in admin under "Additional details".
export const HR_ATTR_KEY = "HR Receipt";

// Order tag prefix. Tags are the only free-text field the Admin API can search
// orders by, so this is what the lookup relies on.
export const HR_TAG_PREFIX = "HR-";

// Metafield used as the clean, structured copy (for NetSuite / reporting).
export const HR_METAFIELD = { namespace: "gm_hr", key: "receipt_number" };

/**
 * Normalize whatever staff typed or scanned into a canonical receipt string.
 * - trims, uppercases
 * - strips everything that isn't A-Z / 0-9 / dash
 * Returns "" if nothing usable is left.
 *
 * Adjust MIN/MAX once you know Holt Renfrew's real receipt format.
 */
export const HR_MIN_LEN = 4;
export const HR_MAX_LEN = 30; // tag limit is 40 incl. "HR-" prefix

export function normalizeHrReceipt(raw) {
  if (!raw) return "";
  const cleaned = String(raw).trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return cleaned;
}

export function validateHrReceipt(normalized) {
  if (!normalized) return "Enter the Holt Renfrew receipt number.";
  if (normalized.length < HR_MIN_LEN) return `Receipt number looks too short (min ${HR_MIN_LEN}).`;
  if (normalized.length > HR_MAX_LEN) return `Receipt number looks too long (max ${HR_MAX_LEN}).`;
  return null;
}

export function hrTagFor(normalized) {
  return `${HR_TAG_PREFIX}${normalized}`;
}

/** "gid://shopify/Order/123" -> "123" */
export function numericIdFromGid(gid) {
  if (!gid) return "";
  const m = String(gid).match(/\/(\d+)(\?.*)?$/);
  return m ? m[1] : String(gid);
}

/** Minimal Admin GraphQL helper using POS Direct API access. */
export async function adminGraphql(query, variables = {}) {
  const res = await fetch("shopify:admin/api/graphql.json", {
    method: "POST",
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  return json.data;
}
