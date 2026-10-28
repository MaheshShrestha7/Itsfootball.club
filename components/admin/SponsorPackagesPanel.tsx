'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { sponsorTierLabel } from '@/lib/sponsors';
import type { SponsorshipPackage, SponsorTier } from '@/lib/supabase/types';
import PriceList from './PriceList';

const TIERS: SponsorTier[] = ['platinum', 'gold', 'silver', 'bronze', 'grassroots'];

/** The club's sponsorship packages (what /{club}/sponsor offers), on the Sponsors page so whoever
 *  looks after sponsors can set them up without Finance access */
export default function SponsorPackagesPanel({ club }: { club: { id: string; slug: string } }) {
  const db = getSupabaseClient();
  const [packages, setPackages] = useState<SponsorshipPackage[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const flash = (type: 'ok' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const load = useCallback(async () => {
    if (!db) return;
    const { data } = await db.from('sponsorship_packages').select('*').eq('club_id', club.id).order('sort_order');
    setPackages((data || []) as SponsorshipPackage[]);
  }, [db, club.id]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="stack">
      {feedback && (
        <p role="status" style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: feedback.type === 'ok' ? 'var(--c-green)' : 'var(--c-red)' }}>{feedback.text}</p>
      )}
      <PriceList<SponsorshipPackage>
        title="Sponsorship packages" table="sponsorship_packages" rows={packages} db={db} clubId={club.id} flash={flash} load={load}
        blank={{ name: 'New package', price_cents: 0, tier: 'gold' as SponsorTier }}
        extra={(row, set) => (
          <select className="form-select" style={{ width: 190 }} aria-label="Tier" value={row.tier} onChange={e => set({ tier: e.target.value as SponsorTier })}>
            {TIERS.map(t => <option key={t} value={t}>{sponsorTierLabel(t)}</option>)}
          </select>
        )}
        extraLabel="Tier"
        textField="benefits"
      />
      <p className="text-note" style={{ margin: 0 }}>
        Businesses pick a package on your public page: <a href={`/${club.slug}/sponsor`}>/{club.slug}/sponsor</a>.
        A price of 0 shows as &ldquo;Price on request&rdquo;: there&apos;s no payment, and their message comes to your Inbox.
      </p>
    </div>
  );
}
