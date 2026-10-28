'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';
import { PACKAGE_INCLUDES, buildPackageIncludes, packageIncludes, sponsorTierLabel } from '@/lib/sponsors';
import type { SponsorshipPackage, SponsorTier } from '@/lib/supabase/types';
import PriceList from './PriceList';

const TIERS: SponsorTier[] = ['platinum', 'gold', 'silver', 'bronze', 'grassroots'];

/** "What's included" (SP-F6): ticks for the fixed places and a box for the club's own extras, one per line */
function IncludesEditor({ row, set }: { row: SponsorshipPackage; set: (patch: Partial<SponsorshipPackage>) => void }) {
  const { places, extras } = packageIncludes(row.includes);
  // The box keeps exactly what's typed (a half-typed blank line included); the list saved is tidied
  const [text, setText] = useState(extras.join('\n'));
  const id = `pkg-extras-${row.id}`;
  return (
    <fieldset style={{ border: 'none', padding: 0, margin: '0.25rem 0 0' }}>
      <legend style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>WHAT&apos;S INCLUDED</legend>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 190px), 1fr))', gap: '0.35rem 1rem' }}>
        {PACKAGE_INCLUDES.map(i => (
          <label key={i.key} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem', color: 'var(--text-secondary)', minHeight: 32, cursor: 'pointer' }}>
            <input type="checkbox" checked={places.includes(i.key)} style={{ width: 17, height: 17 }}
              onChange={e => set({ includes: buildPackageIncludes(e.target.checked ? [...places, i.key] : places.filter(k => k !== i.key), text) })} />
            {i.admin}
          </label>
        ))}
      </div>
      <label className="form-label" htmlFor={id} style={{ marginTop: '0.6rem' }}>Extras (one per line)</label>
      <textarea id={id} className="form-textarea" rows={2} placeholder={'Matchday banner at the ground\nLogo on the training kit'} value={text}
        onChange={e => { setText(e.target.value); set({ includes: buildPackageIncludes(places, e.target.value) }); }} />
    </fieldset>
  );
}

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
  // The ticks need migration 20261134_sponsor_package_includes.sql; hidden until it runs so saves keep working
  const [includesReady, setIncludesReady] = useState(false);
  useEffect(() => {
    db?.from('sponsorship_packages').select('includes').limit(1).then(({ error }) => setIncludesReady(!error));
  }, [db]);

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
        below={includesReady ? (row, set) => <IncludesEditor key={row.id} row={row} set={set} /> : undefined}
      />
      {includesReady && (
        <p className="text-note" style={{ margin: 0 }}>
          The ticks show on your public packages. Where a logo actually appears still follows the sponsor&apos;s tier and Logo size.
        </p>
      )}
      <p className="text-note" style={{ margin: 0 }}>
        Businesses pick a package on your public page: <a href={`/${club.slug}/sponsor`}>/{club.slug}/sponsor</a>.
        A price of 0 shows as &ldquo;Price on request&rdquo;: there&apos;s no payment, and their message comes to your Inbox.
      </p>
    </div>
  );
}
