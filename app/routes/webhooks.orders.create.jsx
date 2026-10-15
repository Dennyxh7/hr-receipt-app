// app/routes/webhooks.orders.create.jsx
//
// Declared in shopify.app.toml as:
//   [[webhooks.subscriptions]]
//   topics = ["orders/create"]
//   uri = "/webhooks/orders/create"
//
// Only job: if the POS extension put an "HR Receipt" attribute on the order,
// add tag HR-<n> + metafield gm_hr.receipt_number so the POS lookup can find it.

import { authenticate } from "../shopify.server";
import { tagHoltRenfrewOrder } from "../lib/holt-renfrew.server.js";

export const action = async ({ request }) => {
  const { admin, payload, shop, topic } = await authenticate.webhook(request);

  try {
    const result = await tagHoltRenfrewOrder(admin, payload);
    if (!result.tagged && result.reason !== "no HR Receipt attribute") {
      console.warn(`[HR] ${shop} ${topic} ${payload?.name}: ${result.reason}`);
    }
  } catch (e) {
    // Never fail the webhook over tagging — Shopify would retry and eventually
    // mark the endpoint unhealthy. Log it and move on.
    console.error(`[HR] ${shop} ${topic} ${payload?.name}: tagging threw`, e);
  }

  return new Response(null, { status: 200 });
};
