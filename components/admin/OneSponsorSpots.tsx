'use client';

import React, { useState } from 'react';
import { useClub } from '@/lib/club-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import { ONE_SPONSOR_PLACES, oneSponsorFor } from '@/lib/sponsors';
import { useGroundSponsors } from '@/components/GroundSponsors';
import type { Club } from '@/lib/supabase/types';

/** Admin, Sponsors: who goes on the member pass and the Player of the Match graphic. Only sponsors
 *  whose package has that tick are listed; "Biggest sponsor" follows the tier order. The choice is
 *  kept in clubs.config. Hidden until a package has one of the two ticks. */
export default function OneSponsorSpots({ club }: { club: Club }) {
  const pass = useGroundSponsors(club.id, 'member_pass');
  const potm = useGroundSponsors(club.id, 'potm_graphic');
  const { updateClubBranding } = useClub();
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const lists = { member_pass: pass, potm_graphic: potm };
  if (!pass?.length && !potm?.length) return null;

  const choose = async (configKey: string, label: string, value: string) => {
    const config = { ...(club.config || {}), [configKey]: value || undefined };
    setSaving(configKey);
    setMessage(null);
    const { error } = await getSupabaseClient()!.from('clubs').update({ config }).eq('id', club.id);
    setSaving(null);
    if (error) return setMessage({ ok: false, text: `Couldn't save: ${error.message}` });
    updateClubBranding(club.id, { config });
    setMessage({ ok: true, text: `${label} saved.` });
  };

  return (
    <section className="glass-panel" aria-labelledby="one-sponsor-spots" style={{ padding: '1.1rem 1.25rem', marginBottom: '1.5rem' }}>
      <h2 id="one-sponsor-spots" style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>One-sponsor spots</h2>
      <p className="text-meta" style={{ margin: '0.25rem 0 0.9rem' }}>Only sponsors whose package has that tick are listed.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '1rem' }}>
        {ONE_SPONSOR_PLACES.map(({ place, configKey, label, hint }) => {
          const list = lists[place];
          const chosen = club.config?.[configKey];
          const shown = oneSponsorFor(list || [], chosen);
          return (
            <div key={place}>
              <label className="form-label" htmlFor={`spot-${place}`}>{label}</label>
              {list?.length ? (
                <select id={`spot-${place}`} className="form-select" disabled={saving === configKey}
                  value={chosen === 'none' ? 'none' : list.some(s => s.id === chosen) ? String(chosen) : ''}
                  onChange={e => choose(configKey, label, e.target.value)}>
                  <option value="">Biggest sponsor ({list[0].name})</option>
                  {list.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  <option value="none">None</option>
                </select>
              ) : (
                <p className="text-meta" style={{ margin: 0 }}>No package has the &quot;{label}&quot; tick yet.</p>
              )}
              <p className="text-meta" style={{ margin: '0.3rem 0 0' }}>{hint}{list?.length ? ` Showing: ${shown ? shown.name : 'nobody'}.` : ''}</p>
            </div>
          );
        })}
      </div>
      {message && <p role="status" style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: message.ok ? 'var(--c-green)' : 'var(--c-red)' }}>{message.text}</p>}
    </section>
  );
}
