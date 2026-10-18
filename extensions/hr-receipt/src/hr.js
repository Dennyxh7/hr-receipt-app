// Shared constants + helpers for the HR Receipt extension (v2, no backend).

export const HR_TAG_PREFIX = "HR-";
export const HR_METAFIELD = { namespace: "gm_hr", key: "receipt_number" };

// Adjust once you know Holt Renfrew's real receipt format.
export const HR_MIN_LEN = 4;
export const HR_MAX_LEN = 30; // tag limit is 40 incl. "HR-" prefix

export function normalizeHrReceipt(raw) {
  if (!raw) return "";
  return String(raw).trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

export function validateHrReceipt(normalized) {
  if (!normalized) return "Enter the Holt Renfrew receipt number.";
  if (normalized.length < HR_MIN_LEN) return `Receipt number looks too short (min ${HR_MIN_LEN}).`;
  if (normalized.length > HR_MAX_LEN) return `Receipt number looks too long (max ${HR_MAX_LEN}).`;
  return null;
}

export const hrTagFor = (n) => `${HR_TAG_PREFIX}${n}`;

export function hrFromTags(tags = []) {
  const t = tags.find((x) => x.startsWith(HR_TAG_PREFIX));
  return t ? t.slice(HR_TAG_PREFIX.length) : "";
}

/** "gid://shopify/Order/123" -> "123" */
export function numericIdFromGid(gid) {
  const m = String(gid || "").match(/\/(\d+)(\?.*)?$/);
  return m ? m[1] : String(gid || "");
}

export const orderGidFor = (numericId) => `gid://shopify/Order/${numericId}`;

/** Minimal Admin GraphQL helper using POS Direct API access. */
export async function adminGraphql(query, variables = {}) {
  const res = await fetch("shopify:admin/api/graphql.json", {
    method: "POST",
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data;
}

// ---------------------------------------------------------------------------
// Read the HR state of one order
// ---------------------------------------------------------------------------
const ORDER_HR_Q = `#graphql
  query HrOrder($id: ID!, $ns: String!, $key: String!) {
    order(id: $id) {
      id
      name
      tags
      metafield(namespace: $ns, key: $key) { value }
    }
  }
`;

export async function readHrFromOrder(orderGid) {
  const data = await adminGraphql(ORDER_HR_Q, {
    id: orderGid,
    ns: HR_METAFIELD.namespace,
    key: HR_METAFIELD.key,
  });
  const o = data?.order;
  if (!o) return { name: "", tags: [], receipt: "" };
  const receipt = o.metafield?.value || hrFromTags(o.tags);
  return { name: o.name, tags: o.tags ?? [], receipt };
}

// ---------------------------------------------------------------------------
// Find orders already carrying an HR number (duplicate check / lookup)
// ---------------------------------------------------------------------------
export const ORDER_CARD_FIELDS = `#graphql
  id
  name
  createdAt
  tags
  displayFinancialStatus
  displayFulfillmentStatus
  totalPriceSet { shopMoney { amount currencyCode } }
  customer { displayName }
  lineItems(first: 10) { nodes { title quantity sku } }
`;

const FIND_BY_TAG_Q = `#graphql
  query HrFindByTag($q: String!) {
    orders(first: 10, query: $q, sortKey: CREATED_AT, reverse: true) {
      nodes { ${ORDER_CARD_FIELDS} }
    }
  }
`;

export async function findOrdersByHr(normalized) {
  const data = await adminGraphql(FIND_BY_TAG_Q, { q: `tag:${hrTagFor(normalized)}` });
  return data?.orders?.nodes ?? [];
}

// ---------------------------------------------------------------------------
// Write the HR number onto an order: replace any old HR- tag, set metafield
// ---------------------------------------------------------------------------
const REMOVE_TAGS_M = `#graphql
  mutation HrTagsRemove($id: ID!, $tags: [String!]!) {
    tagsRemove(id: $id, tags: $tags) { userErrors { field message } }
  }
`;

const WRITE_HR_M = `#graphql
  mutation HrWrite($id: ID!, $tags: [String!]!, $metafields: [MetafieldsSetInput!]!) {
    tagsAdd(id: $id, tags: $tags) { userErrors { field message } }
    metafieldsSet(metafields: $metafields) { userErrors { field message } }
  }
`;

function collectErrors(data) {
  return [
    ...(data?.tagsRemove?.userErrors ?? []),
    ...(data?.tagsAdd?.userErrors ?? []),
    ...(data?.metafieldsSet?.userErrors ?? []),
  ].map((e) => e.message);
}

export async function writeHrToOrder(orderGid, normalized, existingTags = []) {
  const oldHrTags = existingTags.filter((t) => t.startsWith(HR_TAG_PREFIX) && t !== hrTagFor(normalized));
  if (oldHrTags.length) {
    const r = await adminGraphql(REMOVE_TAGS_M, { id: orderGid, tags: oldHrTags });
    const errs = collectErrors(r);
    if (errs.length) throw new Error(errs.join("; "));
  }
  const data = await adminGraphql(WRITE_HR_M, {
    id: orderGid,
    tags: [hrTagFor(normalized)],
    metafields: [
      {
        ownerId: orderGid,
        namespace: HR_METAFIELD.namespace,
        key: HR_METAFIELD.key,
        type: "single_line_text_field",
        value: normalized,
      },
    ],
  });
  const errs = collectErrors(data);
  if (errs.length) throw new Error(errs.join("; "));
  return true;
}
