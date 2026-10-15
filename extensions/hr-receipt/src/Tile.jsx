import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import "@shopify/ui-extensions/preact";
import { HR_ATTR_KEY } from "./hr.js";

export default async () => {
  render(<Tile />, document.body);
};

function readState(cart) {
  const lineCount = cart?.lineItems?.length ?? 0;
  const receipt = cart?.properties?.[HR_ATTR_KEY] || "";
  return { lineCount, receipt };
}

function Tile() {
  const [state, setState] = useState(() => readState(shopify.cart.current.value));

  useEffect(() => {
    const unsub = shopify.cart.current.subscribe((cart) => setState(readState(cart)));
    return unsub;
  }, []);

  let subheading;
  if (state.lineCount === 0) {
    subheading = "Find HR order";
  } else if (state.receipt) {
    subheading = `HR ${state.receipt}`;
  } else {
    subheading = "⚠ No HR receipt on sale";
  }

  return (
    <s-tile
      heading="HR Receipt"
      subheading={subheading}
      onClick={() => shopify.action.presentModal()}
    />
  );
}
