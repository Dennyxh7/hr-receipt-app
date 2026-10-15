import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import "@shopify/ui-extensions/preact";
import {
  HR_ATTR_KEY,
  HR_TAG_PREFIX,
  adminGraphql,
  hrTagFor,
  normalizeHrReceipt,
  numericIdFromGid,
  validateHrReceipt,
} from "./hr.js";

export default async () => {
  render(<Modal />, document.body);
};

const ORDER_FIELDS = `#graphql
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

const FIND_BY_TAG = `#graphql
  query HrFindByTag($q: String!) {
    orders(first: 10, query: $q, sortKey: CREATED_AT, reverse: true) {
      nodes { ${ORDER_FIELDS} }
    }
  }
`;

const RECENT_POS = `#graphql
  query HrRecentPos($q: String!) {
    orders(first: 50, query: $q, sortKey: CREATED_AT, reverse: true) {
      nodes { ${ORDER_FIELDS} }
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

function hrFromTags(tags = []) {
  const t = tags.find((x) => x.startsWith(HR_TAG_PREFIX));
  return t ? t.slice(HR_TAG_PREFIX.length) : "";
}

function Modal() {
  // ---- cart state (attach flow) ----
  const [cart, setCart] = useState(shopify.cart.current.value);
  useEffect(() => shopify.cart.current.subscribe(setCart), []);
  const hasItems = (cart?.lineItems?.length ?? 0) > 0;
  const editable = cart?.editable ?? true;
  const existing = cart?.properties?.[HR_ATTR_KEY] || "";

  const [attachValue, setAttachValue] = useState(existing);
  const [attachErr, setAttachErr] = useState(null);
  const [saving, setSaving] = useState(false);

  // ---- lookup state (find flow) ----
  const [findValue, setFindValue] = useState("");
  const [findErr, setFindErr] = useState(null);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState(null); // null = untouched, [] = none
  const [resultsLabel, setResultsLabel] = useState("");

  // ---- scanner: route scans into whichever field was last focused ----
  const scanTarget = useRef(hasItems ? "attach" : "find");
  useEffect(() => {
    const unsub = shopify.scanner.scannerData.current.subscribe((scan) => {
      const data = scan?.data;
      if (!data) return;
      const v = normalizeHrReceipt(data);
      if (scanTarget.current === "attach") setAttachValue(v);
      else { setFindValue(v); runSearch(v); }
      try { shopify.scanner.hideCameraScanner(); } catch {}
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openScanner(target) {
    scanTarget.current = target;
    try { shopify.scanner.showCameraScanner(); }
    catch { shopify.toast.show("Camera scanner not available on this device"); }
  }

  // ---- attach to current sale ----
  async function saveToCart() {
    const v = normalizeHrReceipt(attachValue);
    const err = validateHrReceipt(v);
    if (err) { setAttachErr(err); return; }
    setAttachErr(null);
    setSaving(true);
    try {
      await shopify.cart.addCartProperties({ [HR_ATTR_KEY]: v });
      shopify.toast.show(`HR receipt ${v} attached`);
      window.close();
    } catch (e) {
      setAttachErr(`Could not save to cart: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  }

  async function removeFromCart() {
    setSaving(true);
    try {
      await shopify.cart.removeCartProperties([HR_ATTR_KEY]);
      setAttachValue("");
      shopify.toast.show("HR receipt removed from sale");
    } catch (e) {
      setAttachErr(`Could not remove: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  }

  // ---- find order by HR receipt ----
  async function runSearch(raw) {
    const v = normalizeHrReceipt(raw ?? findValue);
    const err = validateHrReceipt(v);
    if (err) { setFindErr(err); return; }
    setFindErr(null);
    setSearching(true);
    setResults(null);
    try {
      const data = await adminGraphql(FIND_BY_TAG, { q: `tag:${hrTagFor(v)}` });
      const nodes = data?.orders?.nodes ?? [];
      setResults(nodes);
      setResultsLabel(`Orders with HR receipt ${v}`);
      if (nodes.length === 1) {
        // Single match → go straight to the native order screen.
        openOrder(nodes[0]);
      }
    } catch (e) {
      setFindErr(`Lookup failed: ${e?.message || e}`);
    } finally {
      setSearching(false);
    }
  }

  async function loadRecent() {
    setFindErr(null);
    setSearching(true);
    setResults(null);
    try {
      const since = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
      const data = await adminGraphql(RECENT_POS, { q: `source_name:pos created_at:>=${since}` });
      const nodes = (data?.orders?.nodes ?? []).filter((o) => hrFromTags(o.tags));
      setResults(nodes);
      setResultsLabel("Recent HR orders (last 14 days)");
    } catch (e) {
      setFindErr(`Could not load recent orders: ${e?.message || e}`);
    } finally {
      setSearching(false);
    }
  }

  function openOrder(order) {
    const id = numericIdFromGid(order.id);
    // Native POS order details → staff use the built-in Return / Exchange buttons.
    navigation.navigate(`shopify:point-of-sale/orders/${id}`);
  }

  return (
    <s-page heading="HR Receipt">
      <s-scroll-box>
        <s-stack direction="block" gap="large">

          {/* ================= ATTACH TO CURRENT SALE ================= */}
          {hasItems && (
            <s-section heading="Attach to this sale">
              <s-stack direction="block" gap="base">
                <s-text>
                  Enter the receipt number printed on the Holt Renfrew receipt for this sale.
                </s-text>
                {existing && (
                  <s-banner tone="success" heading={`Current: HR ${existing}`} />
                )}
                <s-text-field
                  label="Holt Renfrew receipt #"
                  value={attachValue}
                  placeholder="e.g. 0123456789"
                  disabled={!editable || saving}
                  onFocus={() => (scanTarget.current = "attach")}
                  onInput={(e) => setAttachValue(e.currentTarget.value)}
                  onChange={(e) => setAttachValue(e.currentTarget.value)}
                />
                {attachErr && <s-banner tone="critical" heading={attachErr} />}
                <s-stack direction="inline" gap="base">
                  <s-button variant="primary" onClick={saveToCart} loading={saving} disabled={!editable}>
                    {existing ? "Update receipt #" : "Attach receipt #"}
                  </s-button>
                  <s-button onClick={() => openScanner("attach")} disabled={!editable || saving}>
                    Scan
                  </s-button>
                  {existing && (
                    <s-button tone="critical" onClick={removeFromCart} disabled={!editable || saving}>
                      Remove
                    </s-button>
                  )}
                </s-stack>
                {!editable && (
                  <s-text tone="subdued">Cart is locked right now (checkout in progress).</s-text>
                )}
              </s-stack>
            </s-section>
          )}

          {/* ================= FIND AN HR ORDER ================= */}
          <s-section heading="Find an HR order (return / exchange)">
            <s-stack direction="block" gap="base">
              <s-text>
                Type or scan the Holt Renfrew receipt number. The matching Shopify order opens so you can use Return or Exchange.
              </s-text>
              <s-text-field
                label="Holt Renfrew receipt #"
                value={findValue}
                placeholder="e.g. 0123456789"
                disabled={searching}
                onFocus={() => (scanTarget.current = "find")}
                onInput={(e) => setFindValue(e.currentTarget.value)}
                onChange={(e) => setFindValue(e.currentTarget.value)}
              />
              {findErr && <s-banner tone="critical" heading={findErr} />}
              <s-stack direction="inline" gap="base">
                <s-button variant="primary" onClick={() => runSearch()} loading={searching}>
                  Find order
                </s-button>
                <s-button onClick={() => openScanner("find")} disabled={searching}>
                  Scan
                </s-button>
                <s-button onClick={loadRecent} disabled={searching}>
                  Recent HR orders
                </s-button>
              </s-stack>

              {results && (
                <s-stack direction="block" gap="base">
                  <s-heading>{resultsLabel}</s-heading>
                  {results.length === 0 && (
                    <s-banner
                      tone="warning"
                      heading="No order found"
                    >
                      Double-check the number. If the sale was rung up without an HR receipt,
                      search by customer name from the POS Orders screen instead.
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
                            <s-text>
                              {total ? `${total.currencyCode} ${Number(total.amount).toFixed(2)}` : ""}
                            </s-text>
                          </s-stack>
                          <s-text tone="subdued">
                            HR {hrFromTags(o.tags) || "—"} · {fmtDate(o.createdAt)}
                            {o.customer?.displayName ? ` · ${o.customer.displayName}` : ""}
                          </s-text>
                          <s-text tone="subdued">{items}</s-text>
                          <s-text tone="subdued">
                            {o.displayFinancialStatus} · {o.displayFulfillmentStatus}
                          </s-text>
                          <s-button variant="primary" onClick={() => openOrder(o)}>
                            Open order
                          </s-button>
                        </s-stack>
                      </s-box>
                    );
                  })}
                </s-stack>
              )}
            </s-stack>
          </s-section>

        </s-stack>
      </s-scroll-box>
    </s-page>
  );
}
