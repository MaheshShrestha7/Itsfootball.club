/** 5 x 7 lamp glyphs for the match page's stadium board (components/StadiumBoard.tsx), one row per string */
const GLYPHS: Record<string, string[]> = {
  0: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '-': ['0000', '0000', '0000', '1111', '0000', '0000', '0000'],
  ':': ['0', '0', '1', '0', '1', '0', '0'],
};

/** A digit made bold the way bitmap fonts do it: each row OR'd with itself one lamp to the right */
const bold = (rows: string[]) => rows.map(r => [...`${r}0`].map((c, k) => (c === '1' || `0${r}`[k] === '1' ? '1' : '0')).join(''));

/** The lamps for one character, as rows of 0/1 (digits bold, the dash and colon as drawn) */
export function lampRows(ch: string): string[] {
  const rows = GLYPHS[ch];
  if (!rows) return [];
  return /\d/.test(ch) ? bold(rows) : rows;
}
