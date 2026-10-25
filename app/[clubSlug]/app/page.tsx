'use client';

import React, { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Radio, ClipboardCheck, Layers, QrCode, CalendarDays, Trophy, Calendar, Flag, Users, Shield, UserCheck, Award,
  BellRing, Flame, Wallet, ShoppingBag, DollarSign, Palette, Sparkles, FileText, Images, BarChart3, Mail, KeyRound,
  LayoutDashboard, CreditCard, Newspaper, UserPlus, Check, HelpCircle, X, Download, BookOpen, CalendarPlus, Ticket,
} from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isPlayerMember } from '@/lib/supabase/types';
import { DEFAULT_CREST } from '@/lib/crest';
import LocalTime from '@/components/LocalTime';
import { publicScoreHidden } from '@/lib/teams';
import { clubPlaysIn } from '@/lib/fixtures';
import { matchPath, SITE_URL } from '@/lib/slugs';
import { formatMoney } from '@/lib/finance';
import { useShopOpen } from '@/lib/use-shop-open';
import { useClubSections } from '@/lib/use-club-sections';
import { useMyChildren } from '@/lib/use-my-children';
import MyTickets from '@/components/MyTickets';
import PushToggle from '@/components/PushToggle';

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
  const { clubs, selectClubBySlug, matches, events, members, clubTeams, tournamentParticipants, tournaments } = useClub();
  const { user, isLoading, can, isClubSuperUser, hasClubAdminAccess, getClubAccess, getUserRoleForClub } = useAuth();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const base = `/${club.slug}`;

  const me = user ? members.find(m => m.club_id === club.id && m.user_id === user.id) : undefined;
  const approved = !!me && (me.membership_status || 'approved') === 'approved';
  const player = approved && isPlayerMember(me!);
  const staff = !!user && hasClubAdminAccess(club.id);
  const superUser = !!user && isClubSuperUser(club.id);
  // A parent or guardian: their children here, and the approved ones they answer In/Out for
  const children = useMyChildren(club.id);
  // A member who doesn't play and has no children playing: the app home is about matches, events and tickets
  const supporterOnly = approved && !player && children.length === 0;
  const kids = children.filter(c => (c.membership_status || 'approved') === 'approved');
  // A parent with no membership of their own: the name they gave on their child's form, not the email
  const greetName = (user && user.full_name === user.email.split('@')[0] && children.find(c => c.guardian_name?.trim())?.guardian_name) || user?.full_name || '';

  // Who they are here, as chips
  const chips = [
    ...(getUserRoleForClub(club.id) === 'owner' ? ['Owner'] : superUser ? ['Club Admin'] : getClubAccess(club.id)?.roleNames || []),
    ...(player ? ['Player'] : approved ? ['Member'] : []),
    ...(me && !approved ? ['Application pending'] : []),
    ...(children.length ? [`Parent of ${children.map(c => c.full_name.split(' ')[0]).join(', ')}`] : []),
  ];

  // Live now, then what's coming up
  const now = Date.now();
  const live = matches.find(m => m.club_id === club.id && (m.status === 'live' || m.status === 'halftime'));
  const upcoming = (() => {
    const ours = matches
      // Not other clubs' games in a cup the club hosts: members aren't asked In/Out for those
      .filter(m => m.club_id === club.id && m.status === 'upcoming' && new Date(m.match_date).getTime() >= now - 86400000 && clubPlaysIn(m, tournamentParticipants, club.name))
      .sort((a, b) => a.match_date.localeCompare(b.match_date) || (a.match_time || '').localeCompare(b.match_time || ''));
    const ms = ours
      .filter(m => !m.tournament_id)
      .map(m => ({ kind: 'match' as const, id: m.id, title: `${m.home_team_name} v ${m.away_team_name}`, at: m.match_date, where: m.venue, match: m as typeof m | undefined, gameIds: [m.id], href: matchPath(club.slug, m), price: 0 }));
    // A tournament is one card and one answer for all its games (each player is only asked about
    // their own team's games, below), not a card per game
    const cups = [...new Set(ours.filter(m => m.tournament_id).map(m => m.tournament_id!))].map(tid => {
      const games = ours.filter(m => m.tournament_id === tid);
      const name = tournaments.find(t => t.id === tid)?.name || 'Tournament';
      return { kind: 'match' as const, id: `cup:${tid}`, title: `${name} · ${games.length} game${games.length === 1 ? '' : 's'}`, at: games[0].match_date, where: games[0].venue, match: undefined as typeof games[number] | undefined, gameIds: games.map(g => g.id), href: `${base}/tournaments/${tid}`, price: 0 };
    });
    const es = events
      // A supporter isn't asked about training (players and parents of players are)
      .filter(e => e.club_id === club.id && new Date(e.start_time).getTime() >= now && !(supporterOnly && e.category === 'training'))
      .map(e => ({ kind: 'event' as const, id: e.id, title: e.title, at: e.start_time, where: e.location, match: undefined, gameIds: [e.id], href: `${base}/events/${e.id}`, price: e.ticket_price_cents ?? 0 }));
    return [...ms, ...cups, ...es].sort((a, b) => a.at.localeCompare(b.at)).slice(0, 4);
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

  // The fixtures this player is asked about: their own team's, not every team's (a U12 player isn't
  // asked about First XI games). 'all' when the server can't say (e.g. before its migration runs).
  const [squadMatchIds, setSquadMatchIds] = useState<Set<string> | 'all' | null>(null);
  const upcomingMatchKey = upcoming.filter(u => u.kind === 'match').flatMap(u => u.gameIds).join(',');
  useEffect(() => {
    const db = getSupabaseClient();
    if (!db || !player) return;
    let cancelled = false;
    db.rpc('my_squad_matches', { p_club_id: club.id }).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !Array.isArray(data)) return setSquadMatchIds('all');
      setSquadMatchIds(new Set((data as (string | { my_squad_matches: string })[]).map(r => (typeof r === 'string' ? r : r.my_squad_matches))));
    });
    return () => { cancelled = true; };
  }, [club.id, player, upcomingMatchKey]);

  // The games the player is asked about in an item: one for a fixture, their team's in a tournament
  const myGameIds = (item: { kind: 'match' | 'event'; gameIds: string[] }) =>
    item.kind === 'match' ? item.gameIds.filter(id => squadMatchIds === 'all' || !!squadMatchIds?.has(id)) : item.gameIds;

  // Each child's answers and fixtures (family_availability / family_squad_matches); keys are child:item
  const [kidAnswers, setKidAnswers] = useState<Record<string, Answer>>({});
  const [kidSquad, setKidSquad] = useState<Set<string> | null>(null);
  const kidKey = kids.map(k => k.id).join(',');
  const loadKidAnswers = useCallback(async () => {
    const db = getSupabaseClient();
    if (!db || !kidKey) return;
    const [{ data: given }, { data: squad }] = await Promise.all([
      db.rpc('family_availability', { p_club_id: club.id }),
      db.rpc('family_squad_matches', { p_club_id: club.id }),
    ]);
    const next: Record<string, Answer> = {};
    ((given || []) as { member_id: string; match_id: string | null; event_id: string | null; status: string }[]).forEach(r => {
      if (r.status !== 'pending') next[`${r.member_id}:${r.match_id || r.event_id}`] = r.status as Answer;
    });
    setKidAnswers(next);
    setKidSquad(new Set(((squad || []) as { member_id: string; match_id: string }[]).map(r => `${r.member_id}:${r.match_id}`)));
  }, [club.id, kidKey]);
  useEffect(() => { loadKidAnswers(); }, [loadKidAnswers, upcomingMatchKey]);
  // The games a child is asked about in an item (one for a fixture, their team's games in a tournament)
  const kidGameIds = (kidId: string, item: { kind: 'match' | 'event'; gameIds: string[] }) =>
    item.kind === 'match' ? item.gameIds.filter(id => kidSquad?.has(`${kidId}:${id}`)) : item.gameIds;
  const answerForKid = async (kidId: string, item: { kind: 'match' | 'event'; id: string; gameIds: string[] }, value: Answer) => {
    const db = getSupabaseClient();
    if (!db) return;
    const ids = kidGameIds(kidId, item);
    setSaving(`${kidId}:${item.id}`);
    setAnswerError(null);
    setKidAnswers(a => ({ ...a, ...Object.fromEntries(ids.map(id => [`${kidId}:${id}`, value])) }));
    const results = await Promise.all(ids.map(id => db.rpc('set_child_availability', {
      p_club_id: club.id, p_member_id: kidId,
      p_match_id: item.kind === 'match' ? id : null,
      p_event_id: item.kind === 'event' ? id : null,
      p_status: value,
    })));
    const error = results.find(r => r.error)?.error;
    setSaving(null);
    if (error) {
      setAnswerError('That answer was not saved. Please try again.');
      loadKidAnswers();
    }
  };
  // Which children are asked about an item: their own team's matches, and every free event
  const kidsFor = (item: { kind: 'match' | 'event'; id: string; gameIds: string[]; price: number }) =>
    item.kind === 'match' ? kids.filter(k => kidGameIds(k.id, item).length > 0) : item.price === 0 ? kids : [];

  const answer = async (item: { kind: 'match' | 'event'; id: string; gameIds: string[] }, value: Answer) => {
    const db = getSupabaseClient();
    if (!db) return;
    const ids = myGameIds(item);
    setSaving(item.id);
    setAnswerError(null);
    // shown straight away; reverted below if it fails
    setAnswers(a => ({ ...a, ...Object.fromEntries(ids.map(id => [id, value])) }));
    const results = await Promise.all(ids.map(id => db.rpc('set_my_availability', {
      p_club_id: club.id,
      p_match_id: item.kind === 'match' ? id : null,
      p_event_id: item.kind === 'event' ? id : null,
      p_status: value,
    })));
    const error = results.find(r => r.error)?.error;
    setSaving(null);
    if (error) {
      setAnswerError('Your answer was not saved. Please try again.');
      loadAnswers();
    }
  };

  // Paid events show their price and a ticket link instead of In/Maybe/Out (In reserves nothing)
  const [currency, setCurrency] = useState('AUD');
  const hasPaidEvent = upcoming.some(u => u.price > 0);
  useEffect(() => {
    if (!hasPaidEvent) return;
    getSupabaseClient()?.from('club_payment_settings').select('currency').eq('club_id', club.id).maybeSingle()
      .then(({ data }) => data?.currency && setCurrency(data.currency));
  }, [club.id, hasPaidEvent]);
  const shopOpen = useShopOpen(club.id);
  const sections = useClubSections(club.id);

  // A player's own fixture: home or away, and whether the published line-up has them in it
  const myMatchNote = (m: (typeof matches)[number]) => {
    const lineup = [...(m.home_lineup_coords || []), ...(m.away_lineup_coords || [])];
    const picked = !!me && lineup.some(p => p.member_id === me.id);
    return {
      venue: m.match_type === 'internal' ? null : m.is_club_home ? 'Home' : 'Away',
      lineup: picked ? 'You’re in the starting line-up' : lineup.length ? 'Line-up announced' : 'Team not picked yet',
      picked,
    };
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
        { label: 'Events & tickets', href: `${base}/events`, icon: Ticket },
        ...(sections.tournaments ? [{ label: 'Tournaments', href: `${base}/tournaments`, icon: Trophy }] : []),
        ...(shopOpen ? [{ label: 'Shop', href: `${base}/shop`, icon: ShoppingBag }] : []),
        { label: 'News', href: `${base}#news`, icon: Newspaper },
        ...(sections.gallery ? [{ label: 'Gallery', href: `${base}/gallery`, icon: Images }] : []),
        { label: 'About the club', href: `${base}/about`, icon: BookOpen },
      ]
    : [
        // A parent's family page (passes, fees, messages) rather than Join
        children.length
          ? { label: 'My family', href: `${base}/member`, icon: Users }
          : { label: me ? 'My application' : user ? 'Join the club' : 'Join or sign in', href: `${base}/member`, icon: UserPlus },
        { label: 'Fixtures', href: `${base}#fixtures`, icon: CalendarDays },
        { label: 'Events & tickets', href: `${base}/events`, icon: Ticket },
        { label: 'News', href: `${base}#news`, icon: Newspaper },
        ...(shopOpen ? [{ label: 'Shop', href: `${base}/shop`, icon: ShoppingBag }] : []),
        ...(sections.gallery ? [{ label: 'Gallery', href: `${base}/gallery`, icon: Images }] : []),
        { label: 'About the club', href: `${base}/about`, icon: BookOpen },
      ];

  const canAnswer = (item: { kind: 'match' | 'event'; id: string; gameIds: string[]; price: number }) =>
    item.kind === 'match' ? player && myGameIds(item).length > 0 : approved && item.price === 0;
  // An answer shows as given once every game it covers has it
  const allAnswered = (got: Record<string, Answer>, keys: string[], value: Answer) => keys.length > 0 && keys.every(k => got[k] === value);

  return (
    <div className="container app-home" style={{ padding: '1.25rem 1rem 2rem', maxWidth: '760px', margin: '0 auto' }}>
      {/* Who and where */}
      <div className="row" style={{ gap: '0.85rem', marginBottom: '1.25rem' }}>
        <img src={club.logo_url || DEFAULT_CREST} alt="" width={52} height={52} style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover', border: '2px solid var(--club-primary)' }} />
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.2 }}>
            {user ? `Hi ${greetName.split(' ')[0]}` : `Welcome to ${club.short_name || club.name}`}
          </h1>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.3rem' }}>
            {(chips.length ? chips : [isLoading ? '…' : user ? 'Not a member yet' : 'Visitor']).map(c => (
              <span key={c} className="badge" style={{ fontSize: '0.68rem' }}>{c}</span>
            ))}
          </div>
        </div>
      </div>

      {live && (
        <Link href={matchPath(club.slug, live)} className="glass-panel app-live">
          <span className="badge badge-live">LIVE</span>
          <strong>
            {publicScoreHidden(live, clubTeams)
              ? `${live.home_team_name} v ${live.away_team_name}`
              : `${live.home_team_name} ${live.home_score ?? 0} – ${live.away_score ?? 0} ${live.away_team_name}`}
          </strong>
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
              <Link href={item.href} style={{ display: 'block', color: 'inherit' }}>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{item.title}</div>
                <div className="text-meta"><LocalTime value={item.at} format="both" options={WHEN} />{item.where ? ` · ${item.where}` : ''}</div>
                {item.kind === 'match' && !item.match && canAnswer(item) && (
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                    One answer for your {myGameIds(item).length} game{myGameIds(item).length === 1 ? '' : 's'}
                  </div>
                )}
                {item.match && canAnswer(item) && (() => {
                  const note = myMatchNote(item.match);
                  return (
                    <div className="row" style={{ gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                      {note.venue && <span className="badge" style={{ fontSize: '0.68rem' }}>{note.venue}</span>}
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: note.picked ? 'var(--c-green)' : 'var(--text-secondary)' }}>{note.lineup}</span>
                    </div>
                  );
                })()}
              </Link>
              {kidsFor(item).map(kid => (
                <div key={kid.id} className="app-kid-answer">
                  <span>{kid.full_name.split(' ')[0]}</span>
                  <div role="group" aria-label={`Is ${kid.full_name.split(' ')[0]} available for ${item.title}?`} className="app-answers">
                    {ANSWERS.map(a => {
                      const A = a.icon;
                      const on = allAnswered(kidAnswers, kidGameIds(kid.id, item).map(id => `${kid.id}:${id}`), a.value);
                      return (
                        <button key={a.value} type="button" aria-pressed={on} disabled={saving === `${kid.id}:${item.id}`}
                          onClick={() => answerForKid(kid.id, item, a.value)}
                          style={on ? { background: a.color, borderColor: a.color, color: '#fff' } : undefined}>
                          <A size={15} /> {a.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {item.price > 0 && (
                <div className="row" style={{ gap: '0.6rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{formatMoney(item.price, currency)}</strong>
                  <Link href={`${base}/events/${item.id}`} className="btn btn-primary btn-sm">
                    <Ticket size={15} /> Get ticket
                  </Link>
                </div>
              )}
              {canAnswer(item) && (
                <div role="group" aria-label={`Are you available for ${item.title}?`} className="app-answers">
                  {ANSWERS.map(a => {
                    const A = a.icon;
                    const on = allAnswered(answers, myGameIds(item), a.value);
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
        {/* webcal:// subscribes the phone's calendar (kept up to date); Android and desktop may need the file */}
        <div className="row" style={{ gap: '1rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
          <a href={`${SITE_URL.replace(/^https?:/, 'webcal:')}/${club.slug}/calendar.ics`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', minHeight: '44px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--club-ink)' }}>
            <CalendarPlus size={15} aria-hidden="true" /> Add fixtures &amp; events to my calendar
          </a>
          <a href={`/${club.slug}/calendar.ics`} download style={{ display: 'inline-flex', alignItems: 'center', minHeight: '44px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            or download .ics
          </a>
        </div>
      </section>

      {/* Live-score alerts without an account (only where the browser can do push) */}
      <PushToggle clubId={club.id} clubName={club.short_name || club.name} labelled />

      <MyTickets clubId={club.id} clubSlug={club.slug} />

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
