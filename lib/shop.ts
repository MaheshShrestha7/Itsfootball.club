// Club shop: cart pricing shared by the shop page (display) and the payment routes (the real price).
// The server only trusts product ids, sizes and quantities; names and prices come from shop_products.

export const MAX_CART_LINES = 20;
export const MAX_QUANTITY = 20;
export const MAX_PHOTOS = 3;

export interface CartLine { productId: string; size: string; quantity: number }

/** Snapshot stored on the payments row, so later price or name changes never rewrite an order */
export interface OrderItem { product_id: string; name: string; size: string | null; quantity: number; unit_cents: number }

export interface PricedProduct { id: string; name: string; price_cents: number; sizes: string[]; is_active: boolean }

type Priced = { ok: true; items: OrderItem[]; totalCents: number } | { ok: false; error: string };

/** Reads a cart sent as JSON text (it travels in both JSON bodies and multipart forms) */
export function parseCart(raw: unknown): CartLine[] | null {
  if (typeof raw !== 'string' || raw.length > 10_000) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_CART_LINES) return null;
  const lines: CartLine[] = [];
  for (const v of value) {
    if (!v || typeof v !== 'object') return null;
    const { productId, size, quantity } = v as Record<string, unknown>;
    if (typeof productId !== 'string' || typeof size !== 'string' || !Number.isInteger(quantity)) return null;
    lines.push({ productId, size, quantity: quantity as number });
  }
  return lines;
}

export function priceCart(lines: CartLine[], products: PricedProduct[]): Priced {
  const byId = new Map(products.map(p => [p.id, p]));
  const items: OrderItem[] = [];
  for (const line of lines) {
    const p = byId.get(line.productId);
    if (!p || !p.is_active) return { ok: false, error: 'An item in your cart is no longer available.' };
    if (line.quantity < 1 || line.quantity > MAX_QUANTITY) return { ok: false, error: `Quantity must be between 1 and ${MAX_QUANTITY}.` };
    const size = p.sizes.length ? line.size : '';
    if (p.sizes.length && !p.sizes.includes(size)) return { ok: false, error: `Choose a size for ${p.name}.` };
    items.push({ product_id: p.id, name: p.name, size: size || null, quantity: line.quantity, unit_cents: p.price_cents });
  }
  const totalCents = items.reduce((n, i) => n + i.unit_cents * i.quantity, 0);
  if (totalCents <= 0) return { ok: false, error: 'Your cart has nothing to pay.' };
  return { ok: true, items, totalCents };
}

/** "Home shirt (M) ×2, Scarf" */
export function describeItems(items: OrderItem[]): string {
  return items.map(i => `${i.name}${i.size ? ` (${i.size})` : ''}${i.quantity > 1 ? ` ×${i.quantity}` : ''}`).join(', ');
}

/** "S, M, L" typed by an admin -> ['S', 'M', 'L'] */
export function parseSizes(text: string): string[] {
  return Array.from(new Set(text.split(',').map(s => s.trim().slice(0, 24)).filter(Boolean))).slice(0, 20);
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Storage key of an uploaded shop photo of this club, or null for anything else (other clubs, other folders, odd URLs) */
export function shopPhotoKey(clubId: string, url: string): string | null {
  if (!new RegExp(`^${UUID}$`, 'i').test(clubId)) return null;
  return url.match(new RegExp(`/(clubs/${clubId}/shop/${UUID}\\.(?:jpg|png|webp|gif))$`, 'i'))?.[1] ?? null;
}
