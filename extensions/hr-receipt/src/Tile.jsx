import { render } from "preact";
import "@shopify/ui-extensions/preact";

export default async () => {
  render(<Tile />, document.body);
};

function Tile() {
  return (
    <s-tile
      heading="HR Receipt"
      subheading="Find order for return / exchange"
      onClick={() => shopify.action.presentModal()}
    />
  );
}
