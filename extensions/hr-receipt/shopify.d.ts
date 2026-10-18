import '@shopify/ui-extensions';

//@ts-ignore
declare module './src/Tile.jsx' {
  const shopify: import('@shopify/ui-extensions/pos.home.tile.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/FindModal.jsx' {
  const shopify: import('@shopify/ui-extensions/pos.home.modal.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/PostPurchaseBlock.jsx' {
  const shopify: import('@shopify/ui-extensions/pos.purchase.post.block.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/AttachModal.jsx' {
  const shopify:
    | import('@shopify/ui-extensions/pos.purchase.post.action.render').Api
    | import('@shopify/ui-extensions/pos.order-details.action.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/OrderMenuItem.jsx' {
  const shopify: import('@shopify/ui-extensions/pos.order-details.action.menu-item.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/Block.jsx' {
  const shopify: import('@shopify/ui-extensions/pos.order-details.block.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/hr.js' {
  const shopify:
    | import('@shopify/ui-extensions/pos.home.modal.render').Api
    | import('@shopify/ui-extensions/pos.purchase.post.block.render').Api
    | import('@shopify/ui-extensions/pos.purchase.post.action.render').Api
    | import('@shopify/ui-extensions/pos.order-details.action.render').Api
    | import('@shopify/ui-extensions/pos.order-details.block.render').Api;
  const globalThis: { shopify: typeof shopify };
}
