'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';

export type PosterPaper = 'A5' | 'A4' | 'A3';
const PAPERS: [PosterPaper, string][] = [['A5', 'Table card'], ['A4', 'Home printer'], ['A3', 'Gate or fence']];

/**
 * A white poster in a popup, with a paper size choice and Print. Printing shows only the poster,
 * scaled by `zoom` to fill the page inside 12mm margins (the popup is a direct child of body, so
 * everything else can be hidden). `children` is the poster; `controls` sit under the paper size.
 */
export default function PrintablePoster({ accent, zoom, onClose, onPrint, controls, children }: {
  accent: string;
  /** Called on each Print press (counted for the sponsors on the poster) */
  onPrint?: () => void;
  /** How much to enlarge the on-screen poster (540px wide) on each paper size */
  zoom: Record<PosterPaper, number>;
  onClose: () => void;
  controls?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [paper, setPaper] = useState<PosterPaper>('A4');
  return createPortal(
    <div
      className="printable-poster-overlay"
      style={{
        position: 'fixed', inset: 0, overflowY: 'auto', overscrollBehavior: 'contain', background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1.5rem',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`
        @media print {
          @page { size: ${paper} portrait; margin: 12mm; }
          :root { color-scheme: light !important; }
          html, body { background: #fff !important; }
          body::before, body::after { display: none !important; }
          body > :not(.printable-poster-overlay) { display: none !important; }
          .printable-poster-overlay { position: static !important; background: none !important; padding: 0 !important; display: block !important; overflow: visible !important; }
          .printable-poster-overlay .no-print { display: none !important; }
          .printable-poster { box-shadow: none !important; border-radius: 0 !important; margin: 0 auto !important; zoom: ${zoom[paper]}; break-inside: avoid; }
        }
      `}</style>
      <div
        className="printable-poster"
        style={{
          margin: 'auto', background: '#FFFFFF', color: '#0F172A', padding: '3rem', borderRadius: '16px', maxWidth: '540px',
          width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }} className="no-print">
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        {children}

        <div className="no-print" style={{ marginBottom: '1.25rem', textAlign: 'left' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.4rem' }}>Paper size</div>
          <div role="group" aria-label="Paper size" style={{ display: 'flex', gap: '0.4rem' }}>
            {PAPERS.map(([size, hint]) => (
              <button key={size} type="button" aria-pressed={paper === size} onClick={() => setPaper(size)}
                style={{ flex: 1, padding: '0.5rem 0.25rem', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem',
                  border: `2px solid ${paper === size ? accent : '#E2E8F0'}`, background: paper === size ? '#F1F5F9' : '#fff', color: '#0F172A' }}>
                {size}
                <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 600, color: '#64748B' }}>{hint}</span>
              </button>
            ))}
          </div>
          {controls}
        </div>

        <div className="no-print" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button type="button" onClick={() => { onPrint?.(); window.print(); }} className="btn btn-primary" style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Printer size={16} />
            <span>Print Poster</span>
          </button>
          <button type="button" onClick={onClose} className="btn btn-secondary">Close</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** A sponsor's logo on a white print tile, or their name when there is no logo */
export function PrintSponsorTile({ name, logoUrl, height = 56, width }: { name: string; logoUrl?: string | null; height?: number; width?: number }) {
  return (
    <div style={{ height, minWidth: width ?? 96, maxWidth: width ? width * 1.6 : 150, padding: '0.4rem 0.75rem', border: '1px solid #E2E8F0', borderRadius: 8,
      display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
      {logoUrl
        ? <img src={logoUrl} alt={name} style={{ maxHeight: height - 16, maxWidth: '100%', objectFit: 'contain' }} />
        : <span style={{ fontWeight: 900, fontSize: Math.max(12, Math.round(height / 4.5)), color: '#0F172A' }}>{name}</span>}
    </div>
  );
}
