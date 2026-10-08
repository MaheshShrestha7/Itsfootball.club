// Self-check for shop cart pricing.
// Run: npx esbuild lib/shop.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { describeItems, parseCart, parseSizes, priceCart, clubPhotoKey } from './shop';

const shirt = { id: 'shirt', name: 'Home shirt', price_cents: 4500, sizes: ['S', 'M', 'L'], is_active: true };
const scarf = { id: 'scarf', name: 'Scarf', price_cents: 1500, sizes: [], is_active: true };
const old = { id: 'old', name: 'Old kit', price_cents: 1000, sizes: [], is_active: false };
const free = { id: 'free', name: 'Sticker', price_cents: 0, sizes: [], is_active: true };
const products = [shirt, scarf, old, free];

const ok = priceCart([{ productId: 'shirt', size: 'M', quantity: 2 }, { productId: 'scarf', size: 'ignored', quantity: 1 }], products);
assert.ok(ok.ok);
if (ok.ok) {
  assert.equal(ok.totalCents, 10500);
  assert.deepEqual(ok.items[1], { product_id: 'scarf', name: 'Scarf', size: null, quantity: 1, unit_cents: 1500 });
  assert.equal(describeItems(ok.items), 'Home shirt (M) ×2, Scarf');
}

assert.equal(priceCart([{ productId: 'shirt', size: 'XXL', quantity: 1 }], products).ok, false); // size not offered
assert.equal(priceCart([{ productId: 'shirt', size: '', quantity: 1 }], products).ok, false); // size missing
assert.equal(priceCart([{ productId: 'old', size: '', quantity: 1 }], products).ok, false); // inactive
assert.equal(priceCart([{ productId: 'nope', size: '', quantity: 1 }], products).ok, false); // other club / deleted
assert.equal(priceCart([{ productId: 'scarf', size: '', quantity: 0 }], products).ok, false);
assert.equal(priceCart([{ productId: 'scarf', size: '', quantity: 21 }], products).ok, false);
assert.equal(priceCart([{ productId: 'free', size: '', quantity: 1 }], products).ok, false); // nothing to pay

assert.deepEqual(parseCart('[{"productId":"a","size":"M","quantity":2}]'), [{ productId: 'a', size: 'M', quantity: 2 }]);
assert.equal(parseCart('[]'), null);
assert.equal(parseCart('not json'), null);
assert.equal(parseCart('[{"productId":"a","size":"M","quantity":1.5}]'), null);
assert.equal(parseCart('[{"productId":"a","quantity":1}]'), null);
assert.equal(parseCart(JSON.stringify(new Array(21).fill({ productId: 'a', size: '', quantity: 1 }))), null);
assert.equal(parseCart(null), null);

assert.deepEqual(parseSizes(' S, M ,,L, M'), ['S', 'M', 'L']);
assert.deepEqual(parseSizes(''), []);

const club = '11111111-2222-4333-8444-555555555555';
const photo = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const cdn = 'https://cdn.example.com';
assert.equal(clubPhotoKey(club, `${cdn}/clubs/${club}/shop/${photo}.jpg`), `clubs/${club}/shop/${photo}.jpg`);
assert.equal(clubPhotoKey(club, `https://x.supabase.co/storage/v1/object/public/club-assets/clubs/${club}/shop/${photo}.webp`), `clubs/${club}/shop/${photo}.webp`);
assert.equal(clubPhotoKey(club, `${cdn}/clubs/${club}/logos/${photo}.jpg`), null); // not a shop photo
assert.equal(clubPhotoKey(club, `${cdn}/clubs/99999999-2222-4333-8444-555555555555/shop/${photo}.jpg`), null); // other club
assert.equal(clubPhotoKey(club, `${cdn}/clubs/${club}/shop/${photo}xjpg`), null); // the dot is literal
assert.equal(clubPhotoKey(club, `${cdn}/clubs/${club}/shop/../logos/${photo}.jpg`), null);
assert.equal(clubPhotoKey(club, `${cdn}/clubs/${club}/shop/${photo}.jpg?x=1`), null);
assert.equal(clubPhotoKey('.*', `${cdn}/clubs/${club}/shop/${photo}.jpg`), null); // the club id is never a pattern
assert.equal(clubPhotoKey(club, `${cdn}/clubs/${club}/gallery/${photo}.jpg`, 'gallery'), `clubs/${club}/gallery/${photo}.jpg`);
assert.equal(clubPhotoKey(club, `${cdn}/clubs/${club}/gallery/${photo}.jpg`), null); // a gallery photo is not a shop photo
assert.equal(clubPhotoKey(club, `${cdn}/clubs/${club}/shop/${photo}.jpg`, 'gallery'), null);

console.log('shop: cart pricing, sizes, parsing and photo keys OK');
