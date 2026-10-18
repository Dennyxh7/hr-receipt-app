import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import "@shopify/ui-extensions/preact";
import {
  ORDER_CARD_FIELDS,
  adminGraphql,
  findOrdersByHr,
  hrFromTags,
  normalizeHrReceipt,
  numericIdFromGid,
  validateHrReceipt,
} from "./hr.js";

export default async () => {
  render(<FindModal />, document.body);
};

const RECENT_POS_Q = `#graphql
  query HrRecentPos($q: String!) {
    orders(first: 50, query: $q, sortKey: CREATED_AT, reverse: true) {
      nodes { ${ORDER_CARD_FIELDS} }
    }
  }
`;

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    });
  } catch { return iso; }
}

function FindModal() {
  const [value, setValue] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null); // null = untouched
  const [label, setLabel] = useState("");

  useEffect(() => {
    const unsub = shopify.scanner.scannerData.current.subscribe((scan) => {
      if (!scan?.data) return;
      const v = normalizeHrReceipt(scan.data);
      setValue(v);
      runSearch(v);
      try { shopify.scanner.hideCameraScanner(); } catch {}
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openScanner() {
    try { shopify.scanner.showCameraScanner(); }
    catch { shopify.toast.show("Camera scanner not available on this device"); }
  }

  function openOrder(order) {
    navigation.navigate(`shopify:point-of-sale/orders/${numericIdFromGid(order.id)}`);
  }

  async function runSearch(raw) {
    const v = normalizeHrReceipt(raw ?? value);
    const invalid = validateHrReceipt(v);
    if (invalid) { setErr(invalid); return; }
    setErr(null);
    setBusy(true);
    setResults(null);
    try {
      const nodes = await findOrdersByHr(v);
      setResults(nodes);
      setLabel(`Orders with HR receipt ${v}`);
      if (nodes.length === 1) openOrder(nodes[0]);
    } catch (e) {
      setErr(`Lookup failed: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  async function loadRecent() {
    setErr(null);
    setBusy(true);
    setResults(null);
    try {
      const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
      const data = await adminGraphql(RECENT_POS_Q, { q: `source_name:pos created_at:>=${since}` });
      setResults((data?.orders?.nodes ?? []).filter((o) => hrFromTags(o.tags)));
      setLabel("Recent HR orders (last 14 days)");
    } catch (e) {
      setErr(`Could not load recent orders: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <s-page heading="Find Holt Renfrew order">
      <s-scroll-box>
        <s-section>
          <s-stack direction="block" gap="base">
            <s-text>
              Type or scan the Holt Renfrew receipt number. The matching Shopify order opens so you can use Return or Exchange.
            </s-text>
            <s-text-field
              label="Holt Renfrew receipt #"
              value={value}
              placeholder="e.g. 0123456789"
              disabled={busy}
              onInput={(e) => setValue(e.currentTarget.value)}
              onChange={(e) => setValue(e.currentTarget.value)}
            />
            {err && <s-banner tone="critical" heading={err} />}
            <s-stack direction="inline" gap="base">
              <s-button variant="primary" onClick={() => runSearch()} loading={busy}>Find order</s-button>
              <s-button onClick={openScanner} disabled={busy}>Scan</s-button>
              <s-button onClick={loadRecent} disabled={busy}>Recent HR orders</s-button>
            </s-stack>

            {results && (
              <s-stack direction="block" gap="base">
                <s-heading>{label}</s-heading>
                {results.length === 0 && (
                  <s-banner tone="warning" heading="No order found">
                    Double-check the number. If the HR receipt was never added, find the order under Orders by customer or receipt number, then use “Add / edit HR receipt #” in its ⋯ menu.
                  </s-banner>
                )}
                {results.map((o) => {
                  const total = o.totalPriceSet?.shopMoney;
                  const items = (o.lineItems?.nodes ?? [])
                    .map((li) => `${li.quantity}× ${li.sku || li.title}`)
                    .join(", ");
                  return (
                    <s-box key={o.id} padding="base" borderWidth="base" borderRadius="base">
                      <s-stack direction="block" gap="small-200">
                        <s-stack direction="inline" gap="base" justifyContent="space-between">
                          <s-heading>{o.name}</s-heading>
                          <s-text>{total ? `${total.currencyCode} ${Number(total.amount).toFixed(2)}` : ""}</s-text>
                        </s-stack>
                        <s-text tone="subdued">
                          HR {hrFromTags(o.tags) || "—"} · {fmtDate(o.createdAt)}
                          {o.customer?.displayName ? ` · ${o.customer.displayName}` : ""}
                        </s-text>
                        <s-text tone="subdued">{items}</s-text>
                        <s-text tone="subdued">{o.displayFinancialStatus} · {o.displayFulfillmentStatus}</s-text>
                        <s-button variant="primary" onClick={() => openOrder(o)}>Open order</s-button>
                      </s-stack>
                    </s-box>
                  );
                })}
              </s-stack>
            )}
          </s-stack>
        </s-section>
      </s-scroll-box>
    </s-page>
  );
}
