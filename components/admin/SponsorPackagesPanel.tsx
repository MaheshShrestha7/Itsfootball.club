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

/** SPP-4: how many of a package the club can sell (one shirt front, one set of naming rights) */
function LimitEditor({ row, set, taken }: { row: SponsorshipPackage; set: (patch: Partial<SponsorshipPackage>) => void; taken: number }) {
  const id = `pkg-limit-${row.id}`;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem 0.75rem', marginBottom: '0.5rem' }}>
      <label htmlFor={id} className="form-label" style={{ margin: 0 }}>How many can you sell?</label>
      <input id={id} type="number" min={1} max={999} step={1} inputMode="numeric" className="form-input" style={{ width: 110 }} placeholder="No limit"
        value={row.max_sponsors ?? ''}
        onChange={e => set({ max_sponsors: e.target.value === '' ? null : Math.min(999, Math.max(1, Math.round(Number(e.target.value)) || 1)) })} />
      <span className="text-meta">
        {row.max_sponsors
          ? `${Math.min(taken, row.max_sponsors)} of ${row.max_sponsors} taken${taken >= row.max_sponsors ? ', shown as Taken on your page' : ''}`
          : `${taken} taken. Blank means no limit.`}
      </span>
    </div>
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
  // SPP-4: "How many can we sell?" needs migration 20261137; hidden until it runs
  const [limitsReady, setLimitsReady] = useState(false);
  const [taken, setTaken] = useState<Map<string, number>>(() => new Map());
  useEffect(() => {
    db?.from('sponsorship_packages').select('max_sponsors').limit(1).then(({ error }) => setLimitsReady(!error));
    db?.rpc('sponsor_package_spots', { p_club_id: club.id })
      .then(({ data }) => setTaken(new Map(((data || []) as { package_id: string; taken: number }[]).map(r => [r.package_id, r.taken]))));
  }, [db, club.id, packages]);

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
        below={includesReady || limitsReady ? (row, set) => (
          <>
            {limitsReady && <LimitEditor row={row} set={set} taken={taken.get(row.id) || 0} />}
            {includesReady && <IncludesEditor key={row.id} row={row} set={set} />}
          </>
        ) : undefined}
      />
      {includesReady && (
        <p className="text-note" style={{ margin: 0 }}>
          The ticks show on your public packages. Where a logo actually appears still follows the sponsor&apos;s tier and Logo size.
        </p>
      )}
      {limitsReady && (
        <p className="text-note" style={{ margin: 0 }}>
          A package with a limit shows how many are left on your page, and can&apos;t be bought once they&apos;re all taken.
          A website sign-up holds one for 48 hours while they pay, or while their invoice is open.
        </p>
      )}
      <p className="text-note" style={{ margin: 0 }}>
        Businesses pick a package on your public page: <a href={`/${club.slug}/sponsor`}>/{club.slug}/sponsor</a>.
        A price of 0 shows as &ldquo;Price on request&rdquo;: there&apos;s no payment, and their message comes to your Inbox.
      </p>
    </div>
  );
}
