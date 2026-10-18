import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import "@shopify/ui-extensions/preact";
import {
  findOrdersByHr,
  normalizeHrReceipt,
  orderGidFor,
  readHrFromOrder,
  validateHrReceipt,
  writeHrToOrder,
} from "./hr.js";

export default async () => {
  render(<AttachModal />, document.body);
};

function AttachModal() {
  const orderId = shopify.order?.id;
  const orderGid = orderGidFor(orderId);

  const [order, setOrder] = useState({ name: "", tags: [], receipt: "", loading: true });
  const [value, setValue] = useState("");
  const [err, setErr] = useState(null);
  const [warn, setWarn] = useState(null);
  const [saving, setSaving] = useState(false);

  // Load current order state (name, existing HR number)
  useEffect(() => {
    let cancelled = false;
    readHrFromOrder(orderGid)
      .then((o) => {
        if (cancelled) return;
        setOrder({ ...o, loading: false });
        setValue(o.receipt || "");
      })
      .catch((e) => !cancelled && setErr(`Could not load order: ${e?.message || e}`));
    return () => { cancelled = true; };
  }, [orderGid]);

  // Scanner → field
  useEffect(() => {
    const unsub = shopify.scanner.scannerData.current.subscribe((scan) => {
      if (!scan?.data) return;
      setValue(normalizeHrReceipt(scan.data));
      try { shopify.scanner.hideCameraScanner(); } catch {}
    });
    return unsub;
  }, []);

  function openScanner() {
    try { shopify.scanner.showCameraScanner(); }
    catch { shopify.toast.show("Camera scanner not available on this device"); }
  }

  async function save() {
    const v = normalizeHrReceipt(value);
    const invalid = validateHrReceipt(v);
    if (invalid) { setErr(invalid); return; }
    setErr(null);
    setWarn(null);
    setSaving(true);
    try {
      // Duplicate check: is this HR number already on a different order?
      const dupes = (await findOrdersByHr(v)).filter((o) => o.id !== orderGid);
      if (dupes.length && !warn) {
        setWarn(`HR ${v} is already on ${dupes.map((o) => o.name).join(", ")}. Tap Save again to use it anyway.`);
        setSaving(false);
        return;
      }
      await writeHrToOrder(orderGid, v, order.tags);
      shopify.toast.show(`HR receipt ${v} saved to ${order.name || "order"}`);
      window.close();
    } catch (e) {
      setErr(`Could not save: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <s-page heading="Holt Renfrew receipt">
      <s-scroll-box>
        <s-stack direction="block" gap="large">
          <s-section>
            <s-stack direction="block" gap="base">
              <s-text tone="subdued">Shopify order</s-text>
              <s-heading>{order.loading ? "…" : order.name}</s-heading>
              {order.receipt && !order.loading && (
                <s-banner tone="success" heading={`Current HR receipt: ${order.receipt}`}>
                  Saving a new number replaces it.
                </s-banner>
              )}
            </s-stack>
          </s-section>

          <s-section heading="Holt Renfrew receipt #">
            <s-stack direction="block" gap="base">
              <s-text>
                Enter the receipt number from the Holt Renfrew POS transaction for this order.
              </s-text>
              <s-text-field
                label="Receipt #"
                value={value}
                placeholder="e.g. 0123456789"
                disabled={saving || order.loading}
                onInput={(e) => setValue(e.currentTarget.value)}
                onChange={(e) => setValue(e.currentTarget.value)}
              />
              {warn && <s-banner tone="warning" heading="Possible duplicate">{warn}</s-banner>}
              {err && <s-banner tone="critical" heading={err} />}
              <s-stack direction="inline" gap="base">
                <s-button variant="primary" onClick={save} loading={saving} disabled={order.loading}>
                  {warn ? "Save anyway" : "Save"}
                </s-button>
                <s-button onClick={openScanner} disabled={saving}>Scan</s-button>
                <s-button onClick={() => window.close()} disabled={saving}>Cancel</s-button>
              </s-stack>
            </s-stack>
          </s-section>
        </s-stack>
      </s-scroll-box>
    </s-page>
  );
}
