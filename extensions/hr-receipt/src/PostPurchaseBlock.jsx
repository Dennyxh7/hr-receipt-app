import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import "@shopify/ui-extensions/preact";
import { orderGidFor, readHrFromOrder } from "./hr.js";

export default async () => {
  render(<PostPurchaseBlock />, document.body);
};

// Shown on the screen right after checkout (where staff print the receipt).
// Staff: print Shopify receipt → key items into HR POS → tap "Add HR receipt #".
function PostPurchaseBlock() {
  const orderId = shopify.order?.id;
  const [state, setState] = useState({ name: shopify.order?.name || "", receipt: "", loading: true });

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    readHrFromOrder(orderGidFor(orderId))
      .then((o) => !cancelled && setState({ name: o.name || state.name, receipt: o.receipt, loading: false }))
      .catch(() => !cancelled && setState((s) => ({ ...s, loading: false })));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  return (
    <s-pos-block>
      <s-button slot="secondary-actions" onClick={() => shopify.action.presentModal()}>
        {state.receipt ? "Edit HR receipt #" : "Add HR receipt #"}
      </s-button>
      <s-stack direction="block" gap="small-200">
        <s-text tone="subdued">Holt Renfrew</s-text>
        <s-text>
          Shopify order <s-text emphasis="strong">{state.name || "…"}</s-text>
          {" — "}
          {state.loading
            ? "checking…"
            : state.receipt
              ? `HR receipt ${state.receipt} attached`
              : "no HR receipt yet"}
        </s-text>
        {!state.loading && !state.receipt && (
          <s-text tone="subdued">
            Ring this sale up on the Holt Renfrew POS, then add the HR receipt number here.
          </s-text>
        )}
      </s-stack>
    </s-pos-block>
  );
}
