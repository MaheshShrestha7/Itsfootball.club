// CSV reading shared by the member and fixture imports

// Full CSV parser: tokenizes the whole text (not line-by-line) so a quoted cell
// containing an embedded newline (e.g. a multi-line pasted address) stays one field
// instead of splitting into two malformed rows.
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
    } else if (char === ',') {
      row.push(field.trim());
      field = '';
      i++;
    } else if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field.trim());
      field = '';
      rows.push(row);
      row = [];
      i++;
    } else {
      field += char;
      i++;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  // Drop blank trailing/interior lines produced by the tokenizer
  return rows.filter(r => !(r.length === 1 && r[0] === ''));
}
