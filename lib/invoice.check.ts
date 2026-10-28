// Run: npx esbuild lib/invoice.check.ts --bundle --platform=node --log-level=warning | node   (part of `npm run check`)
import assert from 'node:assert/strict';
import { cleanAbn, formatAbn, gstIncludedCents, invoiceIsTax, invoiceLabel, invoiceTaxDetails } from './invoice';

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

// SPE-5: a payment keeps the GST registration it was paid under; old payments use today's settings
const now = { gst_registered: true, abn: '51824753556' };
assert.deepEqual(invoiceTaxDetails({ invoice_gst_registered: false, invoice_abn: null }, now), { taxInvoice: false, abn: null });
assert.deepEqual(invoiceTaxDetails({ invoice_gst_registered: true, invoice_abn: '51 824 753 556' }, { gst_registered: false, abn: null }), { taxInvoice: true, abn: '51824753556' });
assert.deepEqual(invoiceTaxDetails({}, now), { taxInvoice: true, abn: '51824753556' });
assert.deepEqual(invoiceTaxDetails({ invoice_gst_registered: null }, null), { taxInvoice: false, abn: null });
assert.equal(invoiceIsTax({ invoice_gst_registered: true, invoice_abn: '12345678901' }, now), false); // no valid ABN, no tax invoice

console.log('invoice: ABN check, GST, numbers and kept tax details OK');
