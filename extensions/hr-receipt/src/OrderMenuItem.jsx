import { render } from "preact";
import "@shopify/ui-extensions/preact";

export default async () => {
  render(<OrderMenuItem />, document.body);
};

// Appears in the "⋯" action menu on Orders > any order.
// Lets staff add/correct the HR receipt number after the fact.
function OrderMenuItem() {
  return (
    <s-button onClick={() => shopify.action.presentModal()}>
      Add / edit HR receipt #
    </s-button>
  );
}
