// The look shared by reports printed on white paper (AGM report, audit pack). The report goes inside
// <article className="agm-paper">, with PAPER_PRINT_CSS in a <style> tag so only the paper prints.
import type { CSSProperties } from 'react';

export const ink = '#0f172a';
export const muted = '#64748b';
export const rule = '1px solid #e2e8f0';
export const heavy = '2px solid #0f172a';
export const cell: CSSProperties = { padding: '0.4rem 0.5rem 0.4rem 0', borderBottom: rule, verticalAlign: 'top' };
// A set width, so the figures line up from one table to the next
export const num: CSSProperties = { ...cell, width: '20%', textAlign: 'right', whiteSpace: 'nowrap', paddingRight: 0, paddingLeft: '0.75rem', fontVariantNumeric: 'tabular-nums' };
export const totalCell: CSSProperties = { ...cell, fontWeight: 800, borderBottom: heavy };
export const totalNum: CSSProperties = { ...num, fontWeight: 800, borderBottom: heavy };
export const heading: CSSProperties = { fontSize: '1.05rem', fontWeight: 800, color: ink, margin: '1.75rem 0 0.5rem', breakAfter: 'avoid' };
export const small: CSSProperties = { color: muted, fontSize: '0.8rem', margin: '0.4rem 0 0' };
export const th: CSSProperties = { ...cell, fontSize: '0.72rem', letterSpacing: '0.04em', color: muted, fontWeight: 700, textAlign: 'left' };
export const thNum: CSSProperties = { ...th, width: '20%', textAlign: 'right', paddingRight: 0, paddingLeft: '0.75rem', whiteSpace: 'nowrap' };
export const paper: CSSProperties = { background: '#fff', color: ink, borderRadius: 14, padding: 'clamp(1.25rem, 5vw, 3rem)', boxShadow: '0 20px 50px rgba(0,0,0,0.35)', fontSize: '0.92rem', lineHeight: 1.45, maxWidth: 860, margin: '0 auto' };

export const PAPER_PRINT_CSS = `
  @media print {
    @page { margin: 14mm; }
    /* color-scheme: the dark theme otherwise paints the page margins black */
    html, body { background: #fff !important; color-scheme: light !important; }
    body::before, body::after { display: none !important; }
    body * { visibility: hidden; }
    .agm-paper, .agm-paper * { visibility: visible; }
    .agm-paper { position: absolute; left: 0; top: 0; width: 100%; box-sizing: border-box; max-width: none !important; box-shadow: none !important; padding: 0 3px !important; border-radius: 0 !important; }
    .agm-paper section, .agm-paper tr { break-inside: avoid; }
  }
`;
