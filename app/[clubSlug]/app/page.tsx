'use client';

import React, { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Radio, ClipboardCheck, Layers, QrCode, CalendarDays, Trophy, Calendar, Flag, Users, Shield, UserCheck, Award,
  BellRing, Flame, Wallet, ShoppingBag, DollarSign, Palette, Sparkles, FileText, Images, BarChart3, Mail, KeyRound,
  LayoutDashboard, CreditCard, Newspaper, UserPlus, Check, HelpCircle, X, Download,
} from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isPlayerMember } from '@/lib/supabase/types';
import { DEFAULT_CREST } from '@/lib/crest';
import LocalTime from '@/components/LocalTime';

type Icon = React.ComponentType<{ size?: number }>;
interface Tile { label: string; href: string; icon: Icon; note?: string }

// Staff tools in the order a matchday club reaches for them; each person sees the ones their roles open
const STAFF_TOOLS: { area: string; label: string; path: string; icon: Icon }[] = [
  { area: 'match-center', label: 'Live match', path: 'match-center', icon: Radio },
  { area: 'availability', label: 'Availability', path: 'availability', icon: ClipboardCheck },
  { area: 'lineup', label: 'Lineups', path: 'lineup/draft', icon: Layers },
  { area: 'scanner', label: 'Gate scanner', path: 'scanner', icon: QrCode },
  { area: 'inquiries', label: 'Inbox', path: 'inquiries', icon: Mail },
  { area: 'members', label: 'Approvals', path: 'members', icon: UserCheck },
  { area: 'finance', label: 'Finance', path: 'finance', icon: Wallet },
  { area: 'shop', label: 'Shop orders', path: 'shop', icon: ShoppingBag },
  { area: 'events', label: 'Events', path: 'events', icon: Calendar },
  { area: 'matches', label: 'Fixtures', path: 'matches', icon: CalendarDays },
  { area: 'squad', label: 'Squad', path: 'squad', icon: Users },
  { area: 'teams', label: 'Teams', path: 'teams', icon: Shield },
  { area: 'tournaments', label: 'Tournaments', path: 'tournaments', icon: Trophy },
  { area: 'seasons', label: 'Seasons', path: 'seasons', icon: Flag },
  { area: 'committee', label: 'Committee', path: 'committee', icon: Award },
  { area: 'emails', label: 'Emails', path: 'emails', icon: BellRing },
  { area: 'gamification', label: 'ClubScore', path: 'gamification', icon: Flame },
  { area: 'sponsors', label: 'Sponsors', path: 'sponsors', icon: DollarSign },
  { area: 'content', label: 'News', path: 'content', icon: FileText },
  { area: 'gallery', label: 'Gallery', path: 'gallery', icon: Images },
  { area: 'hero-slider', label: 'Home slider', path: 'hero-slider', icon: Sparkles },
  { area: 'branding', label: 'Branding', path: 'branding', icon: Palette },
  { area: 'analytics', label: 'Analytics', path: 'analytics', icon: BarChart3 },
  { area: 'roles', label: 'Roles', path: 'roles', icon: KeyRound },
];
const MAX_TOOLS = 8;

type Answer = 'available' | 'maybe' | 'unavailable';
const ANSWERS: { value: Answer; label: string; icon: Icon; color: string }[] = [
  { value: 'available', label: 'In', icon: Check, color: '#10B981' },
  { value: 'maybe', label: 'Maybe', icon: HelpCircle, color: '#F59E0B' },
  { value: 'unavailable', label: 'Out', icon: X, color: '#EF4444' },
];

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

// Server and browser agree on the first render (LocalTime), then it shows in the viewer's own time
const WHEN: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' };

function TileGrid({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="app-tiles">
      {tiles.map(t => {
        const I = t.icon;
        return (
          <Link key={t.href + t.label} href={t.href} className="app-tile">
            <I size={22} />
            <span>{t.label}</span>
            {t.note && <small>{t.note}</small>}
          </Link>
        );
      })}
    </div>
  );
}

/** The club app's home: what this person does at the club, by role (visitor, member, player, staff) */
export default function ClubAppHome({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, matches, events, members } = useClub();
  const { user, isLoading, can, isClubSuperUser, hasClubAdminAccess, getClubAccess, getUserRoleForClub } = useAuth();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const base = `/${club.slug}`;

  const me = user ? members.find(m => m.club_id === club.id && m.user_id === user.id) : undefined;
  const approved = !!me && (me.membership_status || 'approved') === 'approved';
  const player = approved && isPlayerMember(me!);
  const staff = !!user && hasClubAdminAccess(club.id);
  const superUser = !!user && isClubSuperUser(club.id);

  // Who they are here, as chips
  const chips = [
    ...(getUserRoleForClub(club.id) === 'owner' ? ['Owner'] : superUser ? ['Club Admin'] : getClubAccess(club.id)?.roleNames || []),
    ...(player ? ['Player'] : approved ? ['Member'] : []),
    ...(me && !approved ? ['Application pending'] : []),
  ];

  // Live now, then what's coming up
  const now = Date.now();
  const live = matches.find(m => m.club_id === club.id && (m.status === 'live' || m.status === 'halftime'));
  const upcoming = (() => {
    const ms = matches
      .filter(m => m.club_id === club.id && m.status === 'upcoming' && new Date(m.match_date).getTime() >= now - 86400000)
      .map(m => ({ kind: 'match' as const, id: m.id, title: `${m.home_team_name} v ${m.away_team_name}`, at: m.match_date, where: m.venue }));
    const es = events
      .filter(e => e.club_id === club.id && new Date(e.start_time).getTime() >= now)
      .map(e => ({ kind: 'event' as const, id: e.id, title: e.title, at: e.start_time, where: e.location }));
    return [...ms, ...es].sort((a, b) => a.at.localeCompare(b.at)).slice(0, 4);
  })();

  // My availability answers (signed-in members answer here; the email link still works too)
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const loadAnswers = useCallback(async () => {
    const db = getSupabaseClient();
    if (!db || !approved) return;
    const { data } = await db.rpc('my_availability', { p_club_id: club.id });
    const next: Record<string, Answer> = {};
    ((data || []) as { match_id: string | null; event_id: string | null; status: string }[]).forEach(r => {
      if (r.status !== 'pending') next[(r.match_id || r.event_id)!] = r.status as Answer;
    });
    setAnswers(next);
  }, [club.id, approved]);
  useEffect(() => { loadAnswers(); }, [loadAnswers]);

  const answer = async (item: { kind: 'match' | 'event'; id: string }, value: Answer) => {
    const db = getSupabaseClient();
    if (!db) return;
    setSaving(item.id);
    setAnswerError(null);
    setAnswers(a => ({ ...a, [item.id]: value })); // shown straight away; reverted below if it fails
    const { error } = await db.rpc('set_my_availability', {
      p_club_id: club.id,
      p_match_id: item.kind === 'match' ? item.id : null,
      p_event_id: item.kind === 'event' ? item.id : null,
      p_status: value,
    });
    setSaving(null);
    if (error) {
      setAnswerError('Your answer was not saved. Please try again.');
      loadAnswers();
    }
  };

  // Install: Android/desktop Chrome offer a prompt; iPhone needs Share -> Add to Home Screen
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(true);
  useEffect(() => {
    setStandalone(window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);
    const onPrompt = (e: Event) => { e.preventDefault(); setInstallEvent(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const tools: Tile[] = STAFF_TOOLS
    .filter(t => (t.area === 'roles' ? superUser : can(club.id, t.area) || (t.area === 'shop' && can(club.id, 'shop-orders'))))
    .map(t => ({ label: t.label, href: `${base}/admin/${t.path}`, icon: t.icon }));

  const clubTiles: Tile[] = approved
    ? [
        { label: 'My pass', href: `${base}/member`, icon: CreditCard },
        { label: 'Fixtures', href: `${base}#fixtures`, icon: CalendarDays },
        { label: 'Tournaments', href: `${base}/tournaments`, icon: Trophy },
        { label: 'Shop', href: `${base}/shop`, icon: ShoppingBag },
        { label: 'News', href: `${base}#news`, icon: Newspaper },
        { label: 'Gallery', href: `${base}/gallery`, icon: Images },
      ]
    : [
        { label: me ? 'My application' : user ? 'Join the club' : 'Join or sign in', href: `${base}/member`, icon: UserPlus },
        { label: 'Fixtures', href: `${base}#fixtures`, icon: CalendarDays },
        { label: 'News', href: `${base}#news`, icon: Newspaper },
        { label: 'Shop', href: `${base}/shop`, icon: ShoppingBag },
        { label: 'Gallery', href: `${base}/gallery`, icon: Images },
      ];

  const canAnswer = (kind: 'match' | 'event') => (kind === 'match' ? player : approved);

  return (
    <div className="container app-home" style={{ padding: '1.25rem 1rem 2rem', maxWidth: '760px', margin: '0 auto' }}>
      {/* Who and where */}
      <div className="row" style={{ gap: '0.85rem', marginBottom: '1.25rem' }}>
        <img src={club.logo_url || DEFAULT_CREST} alt="" width={52} height={52} style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover', border: '2px solid var(--club-primary)' }} />
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            {user ? `Hi ${user.full_name.split(' ')[0]}` : `Welcome to ${club.short_name || club.name}`}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.3rem' }}>
            {(chips.length ? chips : [isLoading ? '…' : user ? 'Not a member yet' : 'Visitor']).map(c => (
              <span key={c} className="badge" style={{ fontSize: '0.68rem' }}>{c}</span>
            ))}
          </div>
        </div>
      </div>

      {live && (
        <Link href={`${base}/match/${live.id}`} className="glass-panel app-live">
          <span className="badge badge-live">LIVE</span>
          <strong>{live.home_team_name} {live.home_score ?? 0} – {live.away_score ?? 0} {live.away_team_name}</strong>
          <span className="text-meta">Follow the match →</span>
        </Link>
      )}

      {/* Coming up, with an answer for members */}
      <section style={{ marginBottom: '1.5rem' }}>
        <h2 className="app-heading">Coming up</h2>
        {upcoming.length === 0 && <p className="text-meta">Nothing scheduled yet.</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {upcoming.map(item => (
            <div key={item.id} className="glass-panel" style={{ padding: '0.85rem 1rem' }}>
              <Link href={item.kind === 'match' ? `${base}/match/${item.id}` : `${base}/events/${item.id}`} style={{ display: 'block', color: 'inherit' }}>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{item.title}</div>
                <div className="text-meta"><LocalTime value={item.at} format="both" options={WHEN} />{item.where ? ` · ${item.where}` : ''}</div>
              </Link>
              {canAnswer(item.kind) && (
                <div role="group" aria-label={`Are you available for ${item.title}?`} className="app-answers">
                  {ANSWERS.map(a => {
                    const A = a.icon;
                    const on = answers[item.id] === a.value;
                    return (
                      <button
                        key={a.value}
                        type="button"
                        aria-pressed={on}
                        disabled={saving === item.id}
                        onClick={() => answer(item, a.value)}
                        style={on ? { background: a.color, borderColor: a.color, color: '#fff' } : undefined}
                      >
                        <A size={15} /> {a.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
        {answerError && <p role="alert" style={{ color: 'var(--c-red)', fontSize: '0.85rem', marginTop: '0.5rem' }}>{answerError}</p>}
      </section>

      {staff && tools.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 className="app-heading">Your tools</h2>
          <TileGrid
            tiles={[
              ...tools.slice(0, MAX_TOOLS),
              ...(tools.length > MAX_TOOLS ? [{ label: 'All admin tools', href: `${base}/admin`, icon: LayoutDashboard, note: `${tools.length - MAX_TOOLS} more` }] : []),
            ]}
          />
        </section>
      )}

      <section style={{ marginBottom: '1.5rem' }}>
        <h2 className="app-heading">{approved ? 'Your club' : club.name}</h2>
        <TileGrid tiles={clubTiles} />
      </section>

      {!standalone && (
        <div className="glass-panel" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Download size={18} />
          <span style={{ flex: 1, minWidth: 200, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            {installEvent
              ? `Install the ${club.short_name || club.name} app for one-tap access.`
              : 'Add this page to your home screen for one-tap access: on iPhone tap Share, then Add to Home Screen.'}
          </span>
          {installEvent && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => installEvent.prompt().then(() => setInstallEvent(null))}>
              Install
            </button>
          )}
        </div>
      )}
    </div>
  );
}
