'use client';

import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Gift } from 'lucide-react';
import { perkBusiness } from '@/lib/perks';
import { sponsorHref, formatEndDate } from '@/lib/sponsors';
import type { ClubPerk } from '@/lib/supabase/types';

/** The club's member perks: in the member area (with codes and links), or on the verify page for
 *  the business checking a pass (`forBusiness`: what to give, no codes) */
export default function MemberPerks({ perks, clubName, forBusiness = false }: { perks: ClubPerk[]; clubName: string; forBusiness?: boolean }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (perk: ClubPerk) => {
    try { await navigator.clipboard?.writeText(perk.code || ''); setCopied(perk.id); } catch { /* the code is on screen to type */ }
  };
  if (!perks.length) return null;

  return (
    <ul style={{ display: 'grid', gridTemplateColumns: forBusiness ? '1fr' : 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '0.75rem', margin: 0, padding: 0 }}>
      {perks.map(perk => {
        const href = sponsorHref(perk.url || undefined);
        return (
          <li key={perk.id} className="glass-panel" style={{ listStyle: 'none', padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              {perk.logo_url
                ? <img src={perk.logo_url} alt="" width={40} height={40} loading="lazy" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 8, background: '#fff', flexShrink: 0 }} />
                : <Gift size={22} aria-hidden="true" style={{ color: 'var(--club-ink)', flexShrink: 0 }} />}
              <div className="min-w-0">
                <div className="text-meta" style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{perkBusiness(perk, clubName)}</div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{perk.title}</h3>
              </div>
            </div>
            {perk.details && <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>{perk.details}</p>}
            {!forBusiness && (
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem', marginTop: 'auto' }}>
                {perk.code ? (
                  <>
                    <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.95rem', padding: '0.3rem 0.6rem', borderRadius: 6, border: '1px dashed var(--border-medium)', color: 'var(--text-primary)' }}>{perk.code}</code>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(perk)} aria-label={`Copy the code for ${perk.title}`}>
                      {copied === perk.id ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                    </button>
                  </>
                ) : (
                  <span className="text-note">Show your member pass to claim it.</span>
                )}
                {href && (
                  <a href={href} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }}>
                    <ExternalLink size={14} /> Visit
                  </a>
                )}
              </div>
            )}
            {perk.ends_on && <span className="text-meta">Until {formatEndDate(perk.ends_on)}</span>}
          </li>
        );
      })}
    </ul>
  );
}
