import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import "@shopify/ui-extensions/preact";
import { HR_ATTR_KEY, HR_METAFIELD, HR_TAG_PREFIX, adminGraphql } from "./hr.js";

export default async () => {
  render(<Block />, document.body);
};

const ORDER_HR = `#graphql
  query HrOrderBlock($id: ID!, $ns: String!, $key: String!) {
    order(id: $id) {
      id
      tags
      customAttributes { key value }
      metafield(namespace: $ns, key: $key) { value }
    }
  }
`;

function Block() {
  const [state, setState] = useState({ loading: true, receipt: "", source: "", error: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const orderId = shopify.order?.id;
        if (!orderId) { setState({ loading: false, receipt: "", source: "", error: null }); return; }
        const data = await adminGraphql(ORDER_HR, {
          id: `gid://shopify/Order/${orderId}`,
          ns: HR_METAFIELD.namespace,
          key: HR_METAFIELD.key,
        });
        const o = data?.order;
        let receipt = o?.metafield?.value || "";
        let source = receipt ? "metafield" : "";
        if (!receipt) {
          const tag = (o?.tags ?? []).find((t) => t.startsWith(HR_TAG_PREFIX));
          if (tag) { receipt = tag.slice(HR_TAG_PREFIX.length); source = "tag"; }
        }
        if (!receipt) {
          const attr = (o?.customAttributes ?? []).find((a) => a.key === HR_ATTR_KEY);
          if (attr?.value) { receipt = attr.value; source = "attribute"; }
        }
        if (!cancelled) setState({ loading: false, receipt, source, error: null });
      } catch (e) {
        if (!cancelled) setState({ loading: false, receipt: "", source: "", error: e?.message || String(e) });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (state.loading) {
    return (
      <s-pos-block>
        <s-box padding="base"><s-text tone="subdued">Checking Holt Renfrew receipt…</s-text></s-box>
      </s-pos-block>
    );
  }

  if (state.error) {
    return (
      <s-pos-block>
        <s-box padding="base"><s-text tone="critical">HR receipt lookup failed: {state.error}</s-text></s-box>
      </s-pos-block>
    );
  }

  return (
    <s-pos-block>
      <s-box padding="base">
        {state.receipt ? (
          <s-stack direction="block" gap="small-200">
            <s-text tone="subdued">Holt Renfrew receipt</s-text>
            <s-heading>{state.receipt}</s-heading>
            <s-text tone="subdued">Confirm this matches the paper receipt before refunding.</s-text>
          </s-stack>
        ) : (
          <s-banner tone="warning" heading="No Holt Renfrew receipt on this order">
            This sale was recorded without an HR receipt number. Match it by customer, date and items.
          </s-banner>
        )}
      </s-box>
    </s-pos-block>
  );
}
