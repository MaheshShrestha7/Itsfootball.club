// Sponsorship invoices (SP-F4): the ABN check, the GST included in a price, and invoice numbers.
// Pure, so it can be checked without a browser (lib/invoice.check.ts).

/** An ABN with spaces and dashes taken out, or null unless it is 11 digits that pass the ATO's
 *  checksum (subtract 1 from the first digit, weight the digits 10, 1, 3, 5 ... 19, divisible by 89) */
export function cleanAbn(input: string | null | undefined): string | null {
  const digits = (input || '').replace(/[\s-]/g, '');
  if (!/^\d{11}$/.test(digits)) return null;
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const sum = digits.split('').reduce((acc, d, i) => acc + (Number(d) - (i === 0 ? 1 : 0)) * weights[i], 0);
  return sum % 89 === 0 ? digits : null;
}

/** "51 824 753 556", the way the ATO writes it */
export function formatAbn(abn: string): string {
  const d = abn.replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : abn;
}

/** The GST inside a GST-inclusive price: one eleventh, rounded to the cent */
export function gstIncludedCents(totalCents: number): number {
  return Math.round(totalCents / 11);
}

/** "INV-0042" */
export function invoiceLabel(n: number): string {
  return `INV-${String(n).padStart(4, '0')}`;
}
