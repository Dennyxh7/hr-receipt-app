import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import "@shopify/ui-extensions/preact";
import { orderGidFor, readHrFromOrder } from "./hr.js";

export default async () => {
  render(<Block />, document.body);
};

// Shown on Orders > order details. Lets staff confirm the HR number against
// the paper receipt before doing a Return / Exchange.
function Block() {
  const [state, setState] = useState({ loading: true, receipt: "", error: null });

  useEffect(() => {
    const orderId = shopify.order?.id;
    if (!orderId) { setState({ loading: false, receipt: "", error: null }); return; }
    let cancelled = false;
    readHrFromOrder(orderGidFor(orderId))
      .then((o) => !cancelled && setState({ loading: false, receipt: o.receipt, error: null }))
      .catch((e) => !cancelled && setState({ loading: false, receipt: "", error: e?.message || String(e) }));
    return () => { cancelled = true; };
  }, []);

  return (
    <s-pos-block>
      <s-box padding="base">
        {state.loading ? (
          <s-text tone="subdued">Checking Holt Renfrew receipt…</s-text>
        ) : state.error ? (
          <s-text tone="critical">HR receipt lookup failed: {state.error}</s-text>
        ) : state.receipt ? (
          <s-stack direction="block" gap="small-200">
            <s-text tone="subdued">Holt Renfrew receipt</s-text>
            <s-heading>{state.receipt}</s-heading>
            <s-text tone="subdued">Confirm this matches the paper receipt before refunding.</s-text>
          </s-stack>
        ) : (
          <s-banner tone="warning" heading="No Holt Renfrew receipt on this order">
            Use “Add / edit HR receipt #” in the ⋯ menu to attach it.
          </s-banner>
        )}
      </s-box>
    </s-pos-block>
  );
}
