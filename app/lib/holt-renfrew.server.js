// app/lib/holt-renfrew.server.js
//
// Called from the existing orders/create webhook. If the order carries the
// "HR Receipt" note attribute written by the POS extension, this adds:
//   - order tag        HR-<receipt>          (what the POS lookup searches on)
//   - order metafield  gm_hr.receipt_number  (clean copy for NetSuite / reports)
//
// Requires write_orders scope (you already have it for the refund flow).
// Keep the constants identical to extensions/hr-receipt/src/hr.js.

export const HR_ATTR_KEY = "HR Receipt";
export const HR_TAG_PREFIX = "HR-";
export const HR_METAFIELD = { namespace: "gm_hr", key: "receipt_number" };
const HR_MIN_LEN = 4;
const HR_MAX_LEN = 30;

export function normalizeHrReceipt(raw) {
  if (!raw) return "";
  return String(raw).trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

const TAG_AND_METAFIELD = `#graphql
  mutation HrTagOrder($id: ID!, $tags: [String!]!, $metafields: [MetafieldsSetInput!]!) {
    tagsAdd(id: $id, tags: $tags) {
      userErrors { field message }
    }
    metafieldsSet(metafields: $metafields) {
      userErrors { field message }
    }
  }
`;

/**
 * @param {object} admin   - the `admin` returned by authenticate.webhook(request)
 * @param {object} payload - the orders/create webhook payload (REST shape)
 * @returns {Promise<{tagged: boolean, receipt?: string, reason?: string}>}
 */
export async function tagHoltRenfrewOrder(admin, payload) {
  if (!admin) return { tagged: false, reason: "no admin session on webhook" };

  const attr = (payload?.note_attributes ?? []).find((a) => a?.name === HR_ATTR_KEY);
  const receipt = normalizeHrReceipt(attr?.value);
  if (!receipt) return { tagged: false, reason: "no HR Receipt attribute" };
  if (receipt.length < HR_MIN_LEN || receipt.length > HR_MAX_LEN) {
    console.warn(`[HR] order ${payload?.name}: receipt "${receipt}" failed length check, tagging anyway`);
  }

  const orderGid = payload.admin_graphql_api_id || `gid://shopify/Order/${payload.id}`;
  const tag = `${HR_TAG_PREFIX}${receipt}`.slice(0, 40); // Shopify tag limit

  const res = await admin.graphql(TAG_AND_METAFIELD, {
    variables: {
      id: orderGid,
      tags: [tag],
      metafields: [
        {
          ownerId: orderGid,
          namespace: HR_METAFIELD.namespace,
          key: HR_METAFIELD.key,
          type: "single_line_text_field",
          value: receipt,
        },
      ],
    },
  });
  const json = await res.json();

  const errs = [
    ...(json?.data?.tagsAdd?.userErrors ?? []),
    ...(json?.data?.metafieldsSet?.userErrors ?? []),
    ...(json?.errors ?? []),
  ];
  if (errs.length) {
    console.error(`[HR] order ${payload?.name}: tag/metafield errors`, JSON.stringify(errs));
    return { tagged: false, receipt, reason: errs.map((e) => e.message).join("; ") };
  }

  console.log(`[HR] order ${payload?.name} tagged ${tag}`);
  return { tagged: true, receipt };
}
