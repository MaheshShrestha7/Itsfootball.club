'use client';

import React, { use, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import { CLUB_FEATURES, configWithFeaturesOff, featuresOff, type ClubFeatureKey } from '@/lib/club-features';
import Switch from '@/components/admin/Switch';

// Admin -> Club settings -> Features: turn parts of the club site off (clubs.config.features_off).
// Everything starts on. Off only hides: no data is deleted, and turning it on brings it all back.
export default function AdminFeaturesPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, updateClubBranding, saveNow } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const off = featuresOff(club);
  const [saving, setSaving] = useState<ClubFeatureKey | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const pending = useRef<{ key: ClubFeatureKey; on: boolean } | null>(null);

  // "Saved" only once the database has it (the save runs after the change is in state)
  useEffect(() => {
    const done = pending.current;
    if (!done) return;
    pending.current = null;
    saveNow().then(saved => {
      setSaving(null);
      const label = CLUB_FEATURES.find(f => f.key === done.key)?.label;
      setFlash(saved
        ? { ok: true, text: `${label} is ${done.on ? 'on' : 'off'}.` }
        : { ok: false, text: `${label} couldn't be saved. Check your connection and try again.` });
    });
  }, [club?.config, saveNow]);

  if (!club) return null;

  const toggle = async (key: ClubFeatureKey, on: boolean) => {
    setSaving(key);
    setFlash(null);
    // Merged into the club's latest settings, so a change made elsewhere (Mission Control) isn't lost
    const { data } = await getSupabaseClient()?.from('clubs').select('config').eq('id', club.id).maybeSingle() ?? { data: null };
    const base = data?.config ?? club.config;
    const current = featuresOff({ config: base });
    const next = on ? current.filter(k => k !== key) : [...current.filter(k => k !== key), key];
    pending.current = { key, on };
    updateClubBranding(club.id, { config: configWithFeaturesOff(base, next) });
  };

  return (
    <div style={{ maxWidth: '960px' }}>
      <div className="admin-head">
        <div>
          <h1>Features</h1>
          <p>Switch off the parts of the site {club.name} doesn&apos;t use. They leave the menus and their pages close. Nothing is deleted, so you can switch them back on any time.</p>
        </div>
      </div>

      {flash && (
        <div role="status" className={`admin-flash${flash.ok ? '' : ' is-error'}`}>
          {flash.ok ? <CheckCircle2 size={16} aria-hidden="true" /> : <AlertTriangle size={16} aria-hidden="true" />}
          <span>{flash.text}</span>
        </div>
      )}

      <section className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: '0.25rem' }}>Club features</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          {off.length === 0 ? 'Everything is on.' : `${CLUB_FEATURES.length - off.length} of ${CLUB_FEATURES.length} on.`}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {CLUB_FEATURES.map((f, i) => {
            const on = !off.includes(f.key);
            return (
              <div key={f.key} style={{ padding: '0.9rem 0', borderTop: i ? '1px solid var(--border-subtle)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {f.label}
                    {!on && <span className="admin-pill">Off</span>}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{on ? 'Switch off to hide: ' : 'Hidden: '}{f.hides}</div>
                </div>
                <Switch label={f.label} checked={on} disabled={saving !== null} onChange={v => toggle(f.key, v)} />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
