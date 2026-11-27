'use client';

import React, { use, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { getAccessToken, getSupabaseClient } from '@/lib/supabase/client';
import { CLUB_FEATURES, CLUBSCORE_FEATURE, SCORE_BY_CHAT_FEATURE, configWithFeaturesOff, featuresOff, type ClubFeature, type ClubFeatureKey } from '@/lib/club-features';
import { getDefaultClubScoreRules } from '@/lib/clubscore-defaults';
import Switch from '@/components/admin/Switch';

// Admin -> Club settings -> Features: turn parts of the club site off (clubs.config.features_off).
// Everything starts on. Off only hides: no data is deleted, and turning it on brings it all back.
// Only the Owner and Club Admins open it (the 'features' area is never granted by a role).
type RowKey = ClubFeatureKey | 'clubscore' | 'chat';

async function chatApi(clubId: string, body?: Record<string, unknown>): Promise<{ ready?: boolean; scoringEnabled?: boolean; error?: string }> {
  try {
    const token = await getAccessToken();
    const res = await fetch(body ? '/api/admin/chat-scoring' : `/api/admin/chat-scoring?clubId=${clubId}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify({ clubId, ...body }) } : {}),
    });
    const json = await res.json().catch(() => ({}));
    return res.ok ? json : { error: json.error || `Request failed (${res.status})` };
  } catch {
    return { error: 'Network error. Check your connection and try again.' };
  }
}

export default function AdminFeaturesPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, updateClubBranding, updateClubScoreRules, clubScoreRules, saveNow } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const off = featuresOff(club);
  const [saving, setSaving] = useState<RowKey | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [query, setQuery] = useState('');
  const pending = useRef<{ key: ClubFeatureKey | 'clubscore'; on: boolean } | null>(null);
  // ClubScore's switch lives in its own rules (clubscore_rules.is_active): off also stops points being awarded
  const clubScoreOn = club ? (clubScoreRules[club.id] || getDefaultClubScoreRules(club.id)).is_active : true;
  // Score by chat keeps its own switch (club_chat_settings.scoring_enabled); null hides the row until its migration runs
  const [chatOn, setChatOn] = useState<boolean | null>(null);
  const clubId = club?.id;
  useEffect(() => {
    if (!clubId) return;
    chatApi(clubId).then(res => setChatOn(res.ready ? !!res.scoringEnabled : null));
  }, [clubId]);

  // "Saved" only once the database has it (the save runs after the change is in state)
  useEffect(() => {
    const done = pending.current;
    if (!done) return;
    pending.current = null;
    saveNow().then(saved => {
      setSaving(null);
      const label = done.key === 'clubscore' ? CLUBSCORE_FEATURE.label : CLUB_FEATURES.find(f => f.key === done.key)?.label;
      setFlash(saved
        ? { ok: true, text: `${label} is ${done.on ? 'on' : 'off'}.` }
        : { ok: false, text: `${label} couldn't be saved. Check your connection and try again.` });
    });
  }, [club?.config, clubScoreOn, saveNow]);

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

  const toggleClubScore = (on: boolean) => {
    setSaving('clubscore');
    setFlash(null);
    pending.current = { key: 'clubscore', on };
    updateClubScoreRules(club.id, { is_active: on });
  };

  const toggleChat = async (on: boolean) => {
    setSaving('chat');
    setFlash(null);
    const res = await chatApi(club.id, { action: 'toggle', on });
    setSaving(null);
    if (!res.error) setChatOn(on);
    setFlash(res.error ? { ok: false, text: res.error } : { ok: true, text: `${SCORE_BY_CHAT_FEATURE.label} is ${on ? 'on' : 'off'}.` });
  };

  const onToggle = (key: RowKey, v: boolean) => (key === 'clubscore' ? toggleClubScore(v) : key === 'chat' ? toggleChat(v) : toggle(key, v));
  const row = (f: ClubFeature) => ({ key: f.key as RowKey, label: f.label, hides: f.hides, on: !off.includes(f.key), own: false });
  const clubRows = [
    ...CLUB_FEATURES.filter(f => !f.home).map(row),
    { key: 'clubscore' as const, label: CLUBSCORE_FEATURE.label, hides: CLUBSCORE_FEATURE.hides, on: clubScoreOn, own: true },
    ...(chatOn === null ? [] : [{ key: 'chat' as const, label: SCORE_BY_CHAT_FEATURE.label, hides: SCORE_BY_CHAT_FEATURE.hides, on: chatOn, own: true }]),
  ];
  const homeRows = CLUB_FEATURES.filter(f => f.home).map(row);
  const count = (rows: typeof clubRows) => {
    const n = rows.filter(r => r.on).length;
    return n === rows.length ? 'Everything is on.' : `${n} of ${rows.length} on.`;
  };
  // Search by name or what it hides ('ticket' finds Events and tickets); every word must match
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (r: (typeof clubRows)[number]) => words.every(w => `${r.label} ${r.hides}`.toLowerCase().includes(w));
  const section = (title: string, note: string, all: typeof clubRows) => {
    const rows = all.filter(matches);
    return rows.length > 0 && (
    <section className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: '0.25rem' }}>{title}</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{note} {count(all)}</p>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((f, i) => (
          <div key={f.key} style={{ padding: '0.9rem 0', borderTop: i ? '1px solid var(--border-subtle)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {f.label}
                {!f.on && <span className="admin-pill">Off</span>}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{f.own ? '' : f.on ? 'Switch off to hide: ' : 'Hidden: '}{f.hides}</div>
            </div>
            <Switch label={f.label} checked={f.on} disabled={saving !== null} onChange={v => onToggle(f.key, v)} />
          </div>
        ))}
      </div>
    </section>
    );
  };
  const found = [...clubRows, ...homeRows].filter(matches).length;

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

      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <Search size={15} color="var(--text-muted)" aria-hidden="true" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
        <input type="search" className="form-input" aria-label="Search features" placeholder="Search features, e.g. shop, sponsors, join"
          value={query} onChange={e => setQuery(e.target.value)} style={{ paddingLeft: '2.1rem' }} />
      </div>
      {found === 0 && (
        <p className="glass-panel" style={{ padding: '1.5rem', color: 'var(--text-secondary)' }}>
          No feature matches &ldquo;{query.trim()}&rdquo;. <button type="button" className="auth-link" onClick={() => setQuery('')}>Clear search</button>
        </p>
      )}
      {section('Club features', 'Pages and tools across the site and the admin area.', clubRows)}
      {section('Home page sections', 'The parts of your club home page under the hero.', homeRows)}
    </div>
  );
}
