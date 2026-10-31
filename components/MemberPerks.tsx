'use client';

import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Gift } from 'lucide-react';
import { perkBusiness } from '@/lib/perks';
import { sponsorHref, formatEndDate } from '@/lib/sponsors';
import type { ClubPerk } from '@/lib/supabase/types';

type Redeemed = { success: boolean; message: string };

/** The club's member perks: in the member area (with codes and links), or on the verify page for
 *  the business checking a pass (`forBusiness`: what to give, no codes, and a Mark as used button
 *  when `redeem` is given) */
export default function MemberPerks({ perks, clubName, forBusiness = false, redeem }: {
  perks: ClubPerk[]; clubName: string; forBusiness?: boolean; redeem?: (perkId: string) => Promise<Redeemed>;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  // Mark as used: 'busy' while it saves, then what the server said
  const [used, setUsed] = useState<Record<string, Redeemed | 'busy'>>({});
  const markUsed = async (perk: ClubPerk) => {
    if (!redeem) return;
    setUsed(u => ({ ...u, [perk.id]: 'busy' }));
    const result = await redeem(perk.id);
    setUsed(u => ({ ...u, [perk.id]: result }));
  };
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
            {forBusiness && redeem && (() => {
              const state = used[perk.id];
              const done = state && state !== 'busy' && state.success;
              return (<>
                {state && state !== 'busy' && (
                  <p role="status" style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: state.success ? 'var(--c-green)' : 'var(--c-red)' }}>{state.success ? '✓ ' : ''}{state.message}</p>
                )}
                {/* Stays after a failed save, so they can try again */}
                {!done && (
                  <button type="button" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }} disabled={state === 'busy'} onClick={() => markUsed(perk)}>
                    <Check size={14} /> {state === 'busy' ? 'Saving…' : 'Mark as used'}
                  </button>
                )}
              </>);
            })()}
            {perk.ends_on && <span className="text-meta">Until {formatEndDate(perk.ends_on)}</span>}
          </li>
        );
      })}
    </ul>
  );
}
