// Run: npx esbuild lib/invoice.check.ts --bundle --platform=node --log-level=warning | node   (part of `npm run check`)
import assert from 'node:assert/strict';
import { cleanAbn, formatAbn, gstIncludedCents, invoiceLabel } from './invoice';

// ABN checksum, with the ATO's own example (51 824 753 556)
assert.equal(cleanAbn('51 824 753 556'), '51824753556');
assert.equal(cleanAbn('51-824-753-556'), '51824753556');
assert.equal(cleanAbn('51824753557'), null); // one digit off
assert.equal(cleanAbn('5182475355'), null); // too short
assert.equal(cleanAbn('abc'), null);
assert.equal(cleanAbn(''), null);
assert.equal(cleanAbn(null), null);
assert.equal(formatAbn('51824753556'), '51 824 753 556');

// GST is 1/11th of a GST-inclusive price
assert.equal(gstIncludedCents(150000), 13636); // $1,500.00 includes $136.36
assert.equal(gstIncludedCents(110000), 10000);
assert.equal(gstIncludedCents(0), 0);

assert.equal(invoiceLabel(42), 'INV-0042');
assert.equal(invoiceLabel(12345), 'INV-12345');

console.log('invoice: ABN check, GST and numbers OK');
