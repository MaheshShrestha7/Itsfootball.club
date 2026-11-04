'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ClipboardCheck, DollarSign, Globe, RefreshCw, Users, Wallet } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import { formatMoney, PAYMENT_KIND_LABEL } from '@/lib/finance';
import { clubTeamsOf, hasMultipleTeams } from '@/lib/teams';
import { clubResult } from '@/lib/fixtures';
import { formatEndDate } from '@/lib/sponsors';
import { DATE_LOCALE } from '@/lib/dates';
import LocalTime from '@/components/LocalTime';
import {
  PERIOD_OPTIONS, barHeights, fillBuckets, matchesForTeam, membersSummary, opponentLine, overviewBuckets,
  overviewRange, pageName, pct, seasonRecord, sponsorsSummary, upcomingGames, type Bucket, type OverviewPeriod,
} from '@/lib/club-overview';
import type { ClubMember } from '@/lib/supabase/types';

/** The detail screens behind the cards, kept in the URL as ?view= */
export const OVERVIEW_VIEWS = ['', 'games', 'members', 'sponsors', 'money', 'traffic'] as const;
export type OverviewView = typeof OVERVIEW_VIEWS[number];

interface Reply { match_id: string; available: number; maybe: number; unavailable: number; pending: number; pending_ids: string[] }
interface Waiting {
  id: string; kind: string; method: string; status: string; amount_cents: number; payer_name: string | null; description: string | null;
  member_id: string | null; sponsor_id: string | null; invoice_number: number | null; due_on: string | null; created_at: string;
}
interface OverviewData {
  currency: string;
  availability: Reply[] | null;
  sponsors: { paid_cents: number; unpaid_count: number; unpaid_cents: number; next_due: string | null; views: number; clicks: number; by_sponsor: { sponsor_id: string; views: number; clicks: number }[] } | null;
  money: {
    in_cents: number; paid_count: number; out_cents: number; expense_count: number; waiting_cents: number; waiting_count: number;
    refunded_count: number; refunded_cents: number; by_kind: Record<string, number>; by_method: Record<string, number>;
    daily: { d: string; in: number; out: number }[]; waiting: Waiting[];
  } | null;
  traffic: { visits: number; visitors: number; pages: { path: string; n: number }[]; daily: { d: string; n: number }[]; scans: number; tickets: number; checked_in: number; ticket_events: number } | null;
}

interface Props {
  club: { id: string; slug: string; name: string };
  view: OverviewView;
  onView: (v: OverviewView) => void;
  /** Shown instead of the cards while migration 20261150 hasn't run */
  fallback: React.ReactNode;
}

const n = (v: number | null | undefined) => (Number(v) || 0).toLocaleString(DATE_LOCALE);
const plural = (count: number, one: string, many = `${one}s`) => `${n(count)} ${count === 1 ? one : many}`;
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?';
const shortDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short' });

// The money mix, grouped the way a committee talks about it
const MIX: { id: string; label: string; kinds: string[] }[] = [
  { id: 'members', label: 'Memberships', kinds: ['membership_signup', 'membership_renewal'] },
  { id: 'sponsors', label: 'Sponsors', kinds: ['sponsorship'] },
  { id: 'tickets', label: 'Tickets', kinds: ['event_ticket'] },
  { id: 'shop', label: 'Shop', kinds: ['shop_order'] },
  { id: 'other', label: 'Other', kinds: ['income_other'] },
];
const METHOD: Record<string, string> = { stripe: 'Card', bank_transfer: 'Bank transfer', cash: 'Cash', other: 'Other' };

/** The club admin Dashboard's "Club at a glance": five cards in the club's own look, each opening a detail screen. */
export default function ClubOverview({ club, view, onView, fallback }: Props) {
  const { members, matches, sponsors, seasons, clubTeams, getActiveSeason } = useClub();
  const { can } = useAuth();

  const show = {
    games: can(club.id, 'matches') || can(club.id, 'availability') || can(club.id, 'lineup'),
    members: can(club.id, 'members') || can(club.id, 'squad'),
    sponsors: can(club.id, 'sponsors'),
    money: can(club.id, 'finance'),
    traffic: can(club.id, 'analytics'),
  };

  const clubSeasons = useMemo(
    () => seasons.filter(s => s.club_id === club.id).sort((a, b) => b.start_date.localeCompare(a.start_date)),
    [seasons, club.id],
  );
  const active = getActiveSeason ? getActiveSeason(club.id) : undefined;
  const [period, setPeriod] = useState<OverviewPeriod>('season');
  const [seasonId, setSeasonId] = useState<string>('');
  const season = clubSeasons.find(s => s.id === seasonId) || active || clubSeasons[0] || null;
  const range = useMemo(() => overviewRange(period, season), [period, season]);
  const buckets = useMemo(() => overviewBuckets(range), [range]);

  const teams = useMemo(() => clubTeamsOf(clubTeams, club.id), [clubTeams, club.id]);
  const multiTeam = hasMultipleTeams(clubTeams, club.id);
  const [teamId, setTeamId] = useState<string>('');
  const games = useMemo(() => matchesForTeam(matches.filter(m => m.club_id === club.id), clubTeams, teamId || null), [matches, club.id, clubTeams, teamId]);
  const next = useMemo(() => upcomingGames(games, 6), [games]);
  const record = useMemo(() => seasonRecord(games, range), [games, range]);

  const clubMembers = useMemo(() => members.filter(m => m.club_id === club.id), [members, club.id]);
  const people = useMemo(() => membersSummary(clubMembers, range), [clubMembers, range]);
  const byMember = useMemo(() => new Map(clubMembers.map(m => [m.id, m])), [clubMembers]);
  const clubSponsors = useMemo(() => sponsors.filter(s => s.club_id === club.id), [sponsors, club.id]);
  const sponsorSum = useMemo(() => sponsorsSummary(clubSponsors), [clubSponsors]);

  const [data, setData] = useState<OverviewData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [errorText, setErrorText] = useState('');
  const [reload, setReload] = useState(0);
  const matchIds = next.map(m => m.id).join(',');

  // Keyed on the range's values, not the object, so context updates while loading don't refetch
  const fromMs = range.from.getTime(), toMs = range.to.getTime(), seasonName = range.season;
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return; // no database (local preview): the old figures strip shows instead
    let live = true;
    client.rpc('get_club_overview', {
      p_club_id: club.id,
      p_from: new Date(fromMs).toISOString(),
      p_to: new Date(toMs).toISOString(),
      p_season: seasonName,
      p_match_ids: matchIds ? matchIds.split(',') : [],
      p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    }).then(({ data: res, error }) => {
      if (!live) return;
      if (error) {
        // Before migration 20261150 the function doesn't exist: keep the old figures strip
        if (/get_club_overview|function|schema cache/i.test(error.message)) setState('missing');
        else { setState('error'); setErrorText(error.message); }
        return;
      }
      setData(res as OverviewData);
      setState('ready');
    });
    return () => { live = false; };
  }, [club.id, fromMs, toMs, seasonName, matchIds, reload]);

  const currency = data?.currency || 'AUD';
  const money = (cents: number | null | undefined) => formatMoney(Number(cents) || 0, currency).replace(/\.00$/, '');
  const replies = useMemo(() => new Map((data?.availability || []).map(r => [r.match_id, r])), [data]);
  const sponsorName = useMemo(() => new Map(clubSponsors.map(s => [s.id, s.name])), [clubSponsors]);
  const base = `/${club.slug}/admin`;

  if (state === 'missing' || !getSupabaseClient()) return <>{fallback}</>;
  if (!Object.values(show).some(Boolean)) return null;

  // ---------------- Shared pieces ----------------
  const controls = (
    <div className="ov-controls">
      <div className="ov-periods" role="group" aria-label="Time range">
        {PERIOD_OPTIONS.map(o => (
          <button key={String(o.id)} type="button" className="admin-chip" aria-pressed={period === o.id} onClick={() => setPeriod(o.id)}>{o.label}</button>
        ))}
      </div>
      {period === 'season' && clubSeasons.length > 1 && (
        <select className="form-select ov-select" aria-label="Season" value={season?.id || ''} onChange={e => setSeasonId(e.target.value)}>
          {clubSeasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
      <button type="button" className="admin-icon-btn" aria-label="Refresh" title="Refresh" onClick={() => setReload(r => r + 1)}>
        <RefreshCw size={16} aria-hidden="true" className={state === 'loading' ? 'spin' : undefined} />
      </button>
    </div>
  );

  const teamPicker = multiTeam && (
    <select className="form-select ov-select is-small" aria-label="Team" value={teamId} onChange={e => setTeamId(e.target.value)}>
      <option value="">All teams</option>
      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  );

  const bars = (values: number[], label: string, kind: 'in' | 'out' = 'in') => (
    <>
      <div className={kind === 'out' ? 'ov-bars is-out' : 'ov-bars'} role="img" aria-label={label}>
        {barHeights(values).map((h, i) => (
          <span key={i} className={buckets[i]?.now ? 'is-now' : undefined} style={{ height: `${Math.max(4, h)}%` }} title={`${buckets[i]?.label}: ${n(values[i])}`} />
        ))}
      </div>
      <BarAxis buckets={buckets} />
    </>
  );

  const open = (v: OverviewView, label: string) => (
    <button type="button" className="ov-open" onClick={() => { onView(v); window.scrollTo({ top: 0 }); }}>
      {label}<ChevronRight size={14} aria-hidden="true" />
    </button>
  );

  const replyBar = (r: Reply | undefined) => {
    if (!r) return <p className="ov-avail-k">Nobody asked yet</p>;
    const total = r.available + r.maybe + r.unavailable + r.pending || 1;
    return (
      <>
        <div className="ov-avail" aria-hidden="true">
          <i className="a-in" style={{ width: `${pct(r.available, total)}%` }} />
          <i className="a-maybe" style={{ width: `${pct(r.maybe, total)}%` }} />
          <i className="a-out" style={{ width: `${pct(r.unavailable, total)}%` }} />
          <i className="a-none" style={{ width: `${pct(r.pending, total)}%` }} />
        </div>
        <p className="ov-avail-k"><span><b>{r.available}</b> in</span><span><b>{r.maybe}</b> maybe</span><span><b>{r.unavailable}</b> out</span><span><b>{r.pending}</b> no reply</span></p>
      </>
    );
  };

  const moneyMix = (m: NonNullable<OverviewData['money']>) => {
    const parts = MIX.map(x => ({ ...x, cents: x.kinds.reduce((s, k) => s + (Number(m.by_kind[k]) || 0), 0) })).filter(x => x.cents > 0);
    const total = parts.reduce((s, x) => s + x.cents, 0);
    return { parts, total };
  };

  const waitingName = (w: Waiting) => w.payer_name || (w.member_id && byMember.get(w.member_id)?.full_name)
    || (w.sponsor_id && sponsorName.get(w.sponsor_id)) || w.description || PAYMENT_KIND_LABEL[w.kind] || 'Payment';

  const head = (title: string) => (
    <>
      <button type="button" className="ov-back" onClick={() => { onView(''); window.scrollTo({ top: 0 }); }}>
        <ChevronLeft size={16} aria-hidden="true" />Dashboard
      </button>
      <div className="admin-dash-head">
        <div><h1>{title}</h1><p>{range.label}</p></div>
        {controls}
      </div>
    </>
  );
  const problem = state === 'error' && <p className="ov-warn" role="alert">Some numbers could not load: {errorText}</p>;

  // ---------------- Detail screens ----------------
  if (view === 'games' && show.games) {
    const results = games
      .filter(m => m.status === 'completed' && (range.season ? m.season === range.season : new Date(m.match_date) >= range.from))
      .sort((a, b) => b.match_date.localeCompare(a.match_date)).slice(0, 8);
    return (
      <div className="admin-dash">
        {head('Games and availability')}{problem}
        <section className="admin-panel ov-card">
          <div className="admin-panel-head"><h2>Record</h2>{teamPicker || <span className="admin-meta">Club games</span>}</div>
          <Record r={record} />
        </section>
        <section className="admin-panel ov-card">
          <div className="admin-panel-head"><h2>Coming up</h2><span className="admin-meta">{plural(next.length, 'game')}</span></div>
          {next.length === 0 ? <p className="ov-empty">No games scheduled.</p> : (
            <ul className="ov-games">
              {next.map(m => {
                const r = replies.get(m.id);
                const missing = (r?.pending_ids || []).map(id => byMember.get(id)?.full_name).filter(Boolean) as string[];
                return (
                  <li key={m.id}>
                    <div className="t">{opponentLine(m)} <small><LocalTime value={m.match_date} options={{ weekday: 'short', day: 'numeric', month: 'short' }} /></small></div>
                    {data?.availability ? replyBar(r) : null}
                    {missing.length > 0 && <p className="ov-names">No reply: {missing.slice(0, 12).join(', ')}{missing.length > 12 ? ` and ${missing.length - 12} more` : ''}</p>}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="ov-foot">
            <span>Replies come from Player availability</span>
            {can(club.id, 'availability') && <Link href={`${base}/availability`}>Open Player availability<ChevronRight size={14} aria-hidden="true" /></Link>}
          </div>
        </section>
        <section className="admin-panel ov-card">
          <div className="admin-panel-head"><h2>Results</h2><span className="admin-meta">{range.label}</span></div>
          {results.length === 0 ? <p className="ov-empty">No results in this range.</p> : (
            <table className="ov-table">
              <thead><tr><th scope="col">Game</th><th scope="col">Score</th></tr></thead>
              <tbody>
                {results.map(m => { const res = clubResult(m); return (
                  <tr key={m.id}><td>{opponentLine(m)}<small>{shortDate(m.match_date)}</small></td><td>{res.outcome ? `${res.outcome} ` : ''}{res.us} : {res.them}</td></tr>
                ); })}
              </tbody>
            </table>
          )}
          {can(club.id, 'matches') && <div className="ov-foot"><span>All fixtures and results</span><Link href={`${base}/matches`}>Open Fixtures<ChevronRight size={14} aria-hidden="true" /></Link></div>}
        </section>
      </div>
    );
  }

  if (view === 'members' && show.members) {
    const row = (m: ClubMember, sub: string, href: string, go: string) => (
      <li key={m.id}><Link className="ov-row" href={href}><span className="ov-ava" aria-hidden="true">{initials(m.full_name)}</span><span>{m.full_name}<small>{sub}</small></span><span className="ov-go">{go}</span></Link></li>
    );
    return (
      <div className="admin-dash">
        {head('Members')}{problem}
        <section className="admin-panel ov-card">
          <div className="admin-panel-head"><h2>Renewals due in 30 days</h2><span className="admin-meta">{plural(people.renewSoon.length, 'person', 'people')}</span></div>
          {people.renewSoon.length === 0 ? <p className="ov-empty">Nobody&apos;s membership ends in the next 30 days.</p> : (
            <ul className="ov-list">{people.renewSoon.slice(0, 20).map(m => row(m, `${m.membership_tier || 'Member'}, ends ${shortDate(m.membership_expires_at)}`, `${base}/people?tab=passes&member=${m.id}`, 'Open'))}</ul>
          )}
        </section>
        {people.waiting.length > 0 && (
          <section className="admin-panel ov-card">
            <div className="admin-panel-head"><h2>Waiting to join</h2><span className="admin-meta">{plural(people.waiting.length, 'application')}</span></div>
            <ul className="ov-list">{people.waiting.slice(0, 20).map(m => row(m, m.applied_at ? `Applied ${shortDate(m.applied_at)}` : 'Application', `${base}/people?tab=applications&member=${m.id}`, 'Review'))}</ul>
          </section>
        )}
        {people.expired.length > 0 && (
          <section className="admin-panel ov-card">
            <div className="admin-panel-head"><h2>Expired, not renewed</h2><span className="admin-meta">{plural(people.expired.length, 'person', 'people')}</span></div>
            <ul className="ov-list">{people.expired.slice(0, 10).map(m => row(m, `Ended ${shortDate(m.membership_expires_at)}`, `${base}/people?tab=passes&member=${m.id}`, 'Open'))}</ul>
          </section>
        )}
        <section className="admin-panel ov-card">
          <div className="admin-panel-head"><h2>New members</h2><span className="admin-meta">{n(people.added)} in this range</span></div>
          {bars(fillBuckets(buckets, people.joins), 'New members over time')}
          <table className="ov-table">
            <thead><tr><th scope="col">Who</th><th scope="col">Counted</th></tr></thead>
            <tbody>
              <tr><td>Players</td><td>{n(people.players)}</td></tr>
              <tr><td>Supporters and others</td><td>{n(people.others)}</td></tr>
            </tbody>
          </table>
          <div className="ov-foot"><span>Counted as People counts them</span><Link href={`${base}/people`}>Open People<ChevronRight size={14} aria-hidden="true" /></Link></div>
        </section>
      </div>
    );
  }

  if (view === 'sponsors' && show.sponsors) {
    const seen = new Map((data?.sponsors?.by_sponsor || []).map(s => [s.sponsor_id, s]));
    const list = clubSponsors.filter(s => s.is_active !== false || seen.has(s.id))
      .map(s => ({ s, views: seen.get(s.id)?.views || 0, clicks: seen.get(s.id)?.clicks || 0 }))
      .sort((a, b) => b.clicks - a.clicks || b.views - a.views);
    return (
      <div className="admin-dash">
        {head('Sponsors')}{problem}
        <section className="admin-panel ov-card">
          <div className="admin-panel-head"><h2>Summary</h2></div>
          <dl className="ov-strip">
            <div><dt>Paid</dt><dd>{money(data?.sponsors?.paid_cents)}</dd><span className="n">{range.label}</span></div>
            <div><dt>Unpaid</dt><dd className={data?.sponsors?.unpaid_count ? 'warn' : undefined}>{money(data?.sponsors?.unpaid_cents)}</dd><span className="n">{plural(data?.sponsors?.unpaid_count || 0, 'invoice')}</span></div>
            <div><dt>Ending in 30 days</dt><dd className={sponsorSum.endingSoon.length ? 'warn' : undefined}>{sponsorSum.endingSoon.length}</dd><span className="n">{n(sponsorSum.onSite)} on the site</span></div>
          </dl>
        </section>
        <section className="admin-panel ov-card">
          <div className="admin-panel-head"><h2>Each sponsor</h2><span className="admin-meta">Logo views and clicks, {range.label.toLowerCase()}</span></div>
          {list.length === 0 ? <p className="ov-empty">No sponsors yet.</p> : (
            <table className="ov-table">
              <thead><tr><th scope="col">Sponsor</th><th scope="col">Views</th><th scope="col">Clicks</th></tr></thead>
              <tbody>
                {list.map(({ s, views, clicks }) => (
                  <tr key={s.id}><td>{s.name}<small>{s.ends_on ? `Ends ${formatEndDate(s.ends_on)}` : 'No end date'}</small></td><td>{n(views)}</td><td>{n(clicks)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="ov-foot"><span>Full report with placements</span>{can(club.id, 'analytics') ? <Link href={`${base}/analytics?tab=sponsors`}>Sponsor report<ChevronRight size={14} aria-hidden="true" /></Link> : <Link href={`${base}/sponsors`}>Open Sponsors<ChevronRight size={14} aria-hidden="true" /></Link>}</div>
        </section>
      </div>
    );
  }

  if (view === 'money' && show.money && data?.money) {
    const m = data.money;
    const mix = moneyMix(m);
    const methods = Object.entries(m.by_method).sort((a, b) => b[1] - a[1]);
    const paidTotal = methods.reduce((s, [, v]) => s + v, 0);
    return (
      <div className="admin-dash">
        {head('Money')}{problem}
        <section className="admin-panel ov-card">
          <div className="admin-panel-head"><h2>In and out</h2><span className="admin-meta">Paid only</span></div>
          <dl className="ov-strip">
            <div><dt>Money in</dt><dd>{money(m.in_cents)}</dd><span className="n">{plural(m.paid_count, 'payment')}</span></div>
            <div><dt>Money out</dt><dd>{money(m.out_cents)}</dd><span className="n">{plural(m.expense_count, 'expense')}</span></div>
            <div><dt>Balance</dt><dd className={m.in_cents - m.out_cents < 0 ? 'bad' : undefined}>{money(m.in_cents - m.out_cents)}</dd><span className="n">In minus out</span></div>
          </dl>
          {bars(fillBuckets(buckets, m.daily.map(d => ({ at: d.d, n: d.in }))), 'Money in over time')}
          {bars(fillBuckets(buckets, m.daily.map(d => ({ at: d.d, n: d.out }))), 'Money out over time', 'out')}
          <p className="ov-legend"><span><i className="c1" />Money in</span><span><i className="c4" />Money out</span></p>
        </section>
        <section className="admin-panel ov-card">
          <div className="admin-panel-head"><h2>Waiting on you</h2><span className="admin-meta">{money(m.waiting_cents)} across {n(m.waiting_count)}</span></div>
          {m.waiting.length === 0 ? <p className="ov-empty">Nothing waiting. Every payment is paid or closed.</p> : (
            <ul className="ov-list">
              {m.waiting.slice(0, 20).map(w => (
                <li key={w.id}>
                  <Link className="ov-row" href={`${base}/finance?tab=income`}>
                    <span className="ov-ava" aria-hidden="true">{initials(waitingName(w))}</span>
                    <span>{waitingName(w)}<small>{PAYMENT_KIND_LABEL[w.kind] || 'Payment'}, {METHOD[w.method] || w.method}, {w.status === 'awaiting_review' ? 'receipt to check' : w.due_on ? `due ${shortDate(w.due_on)}` : 'not paid yet'}</small></span>
                    <span className="ov-amt">{money(w.amount_cents)}<span className="ov-go">{w.status === 'awaiting_review' ? 'Check' : 'Open'}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="admin-panel ov-card">
          <div className="admin-panel-head"><h2>Where it came from</h2></div>
          {mix.total === 0 ? <p className="ov-empty">No paid income in this range.</p> : (
            <table className="ov-table">
              <thead><tr><th scope="col">Kind</th><th scope="col">Paid</th></tr></thead>
              <tbody>{mix.parts.map(p => <tr key={p.id}><td>{p.label}<div className="bar" style={{ width: `${pct(p.cents, mix.total)}%` }} /></td><td>{money(p.cents)}</td></tr>)}</tbody>
            </table>
          )}
          {methods.length > 0 && (
            <>
              <div className="admin-panel-head ov-subhead"><h2>How it was paid</h2></div>
              <dl className="ov-strip">
                {methods.slice(0, 3).map(([k, v]) => <div key={k}><dt>{METHOD[k] || k}</dt><dd>{money(v)}</dd><span className="n">{pct(v, paidTotal)}%</span></div>)}
              </dl>
            </>
          )}
          <div className="ov-foot"><span>Refunded or failed: {n(m.refunded_count)}</span><Link href={`${base}/finance`}>Open Finance<ChevronRight size={14} aria-hidden="true" /></Link></div>
        </section>
      </div>
    );
  }

  if (view === 'traffic' && show.traffic && data?.traffic) {
    const t = data.traffic;
    return (
      <div className="admin-dash">
        {head('Website and fans')}{problem}
        <section className="admin-panel ov-card">
          <div className="admin-panel-head"><h2>Public page visits</h2><span className="admin-meta">{range.label}</span></div>
          <dl className="ov-strip">
            <div><dt>Visits</dt><dd>{n(t.visits)}</dd><span className="n">Pages opened</span></div>
            <div><dt>Visitors</dt><dd>{n(t.visitors)}</dd><span className="n">Different browsers</span></div>
            <div><dt>Passes scanned</dt><dd>{n(t.scans)}</dd><span className="n">At the gate</span></div>
          </dl>
          {bars(fillBuckets(buckets, t.daily.map(d => ({ at: d.d, n: d.n }))), 'Visits over time')}
          <div style={{ height: 'var(--space-sm)' }} />
        </section>
        <section className="admin-panel ov-card">
          <div className="admin-panel-head"><h2>Most visited</h2></div>
          {t.pages.length === 0 ? <p className="ov-empty">No visits in this range.</p> : (
            <table className="ov-table">
              <thead><tr><th scope="col">Page</th><th scope="col">Visits</th></tr></thead>
              <tbody>{t.pages.map(p => <tr key={p.path}><td>{pageName(p.path, club.slug)}<div className="bar" style={{ width: `${pct(p.n, t.pages[0].n)}%` }} /></td><td>{n(p.n)}</td></tr>)}</tbody>
            </table>
          )}
          <div className="admin-panel-head ov-subhead"><h2>Event tickets</h2></div>
          <dl className="ov-strip">
            <div><dt>Tickets</dt><dd>{n(t.tickets)}</dd><span className="n">{plural(t.ticket_events, 'event')}</span></div>
            <div><dt>Checked in</dt><dd>{n(t.checked_in)}</dd><span className="n">{pct(t.checked_in, t.tickets)}% of tickets</span></div>
            <div><dt>Not yet</dt><dd>{n(t.tickets - t.checked_in)}</dd><span className="n">Includes events to come</span></div>
          </dl>
          <div className="ov-foot"><span>Devices, referrers and more</span><Link href={`${base}/analytics`}>Open Website analytics<ChevronRight size={14} aria-hidden="true" /></Link></div>
        </section>
      </div>
    );
  }

  // ---------------- The cards ----------------
  const m = data?.money;
  const mix = m ? moneyMix(m) : null;
  const t = data?.traffic;
  const sp = data?.sponsors;
  const topSponsors = (sp?.by_sponsor || []).filter(s => s.clicks > 0 || s.views > 0).slice(0, 3);
  const topPage = t?.pages[0];
  const cards = [
    show.games && (
      <section key="games" className="admin-panel ov-card" aria-labelledby="ov-games">
        <div className="admin-panel-head"><h2 id="ov-games"><ClipboardCheck size={18} aria-hidden="true" />Games and availability</h2>{teamPicker || <span className="admin-meta">Club games</span>}</div>
        <Record r={record} />
        {next.length === 0 ? <p className="ov-empty">No games scheduled.</p> : (
          <ul className="ov-games">
            {next.slice(0, 2).map(g => (
              <li key={g.id}>
                <div className="t">{opponentLine(g)} <small><LocalTime value={g.match_date} options={{ weekday: 'short', day: 'numeric', month: 'short' }} /></small></div>
                {data?.availability ? replyBar(replies.get(g.id)) : null}
              </li>
            ))}
          </ul>
        )}
        <div className="ov-foot"><span>{record.played ? plural(record.played, 'game') + ' played' : 'No results yet'}</span>{open('games', 'Open')}</div>
      </section>
    ),
    show.members && (
      <section key="members" className="admin-panel ov-card" aria-labelledby="ov-members">
        <div className="admin-panel-head"><h2 id="ov-members"><Users size={18} aria-hidden="true" />Members</h2><span className="admin-meta">People</span></div>
        <div className="ov-hero"><div className="k">Members</div><div className="v">{n(people.counted)}<small>{plural(people.players, 'player')}</small></div></div>
        <dl className="ov-strip">
          <div><dt>New</dt><dd>{n(people.added)}</dd><span className="n">{range.period === 'season' ? 'This season' : range.label}</span></div>
          <div><dt>Waiting to join</dt><dd className={people.waiting.length ? 'warn' : undefined}>{people.waiting.length}</dd><span className="n">Applications</span></div>
          <div><dt>Renew in 30 days</dt><dd className={people.renewSoon.length ? 'warn' : undefined}>{people.renewSoon.length}</dd><span className="n">{people.expired.length ? `${n(people.expired.length)} already expired` : 'None expired'}</span></div>
        </dl>
        {bars(fillBuckets(buckets, people.joins), 'New members over time')}
        <div className="ov-foot"><span>New members over time</span>{open('members', 'Open')}</div>
      </section>
    ),
    show.sponsors && (
      <section key="sponsors" className="admin-panel ov-card" aria-labelledby="ov-sponsors">
        <div className="admin-panel-head"><h2 id="ov-sponsors"><DollarSign size={18} aria-hidden="true" />Sponsors</h2><span className="admin-meta">Sponsors</span></div>
        {clubSponsors.length === 0 ? (
          <div className="ov-empty"><p>No sponsors yet.</p><Link href={`${base}/sponsors`} className="btn btn-secondary btn-sm">Add a sponsor</Link></div>
        ) : (
          <>
            <div className="ov-hero"><div className="k">Sponsorship paid</div><div className="v">{sp ? money(sp.paid_cents) : '…'}<small>{plural(sponsorSum.onSite, 'sponsor')} on the site</small></div></div>
            <dl className="ov-strip">
              <div><dt>Ending in 30 days</dt><dd className={sponsorSum.endingSoon.length ? 'warn' : undefined}>{sponsorSum.endingSoon.length}</dd><span className="n">{sponsorSum.endingSoon[0] ? sponsorSum.endingSoon[0].name : 'None'}</span></div>
              <div><dt>Unpaid</dt><dd className={sp?.unpaid_count ? 'warn' : undefined}>{n(sp?.unpaid_count)}</dd><span className="n">{sp?.unpaid_count ? `${money(sp.unpaid_cents)}${sp.next_due ? `, due ${shortDate(sp.next_due)}` : ''}` : 'Nothing owed'}</span></div>
              <div><dt>Logo clicks</dt><dd>{n(sp?.clicks)}</dd><span className="n">{n(sp?.views)} views</span></div>
            </dl>
            {topSponsors.length > 0 && (
              <table className="ov-table">
                <thead><tr><th scope="col">Most clicked</th><th scope="col">Clicks</th></tr></thead>
                <tbody>{topSponsors.map(s => <tr key={s.sponsor_id}><td>{sponsorName.get(s.sponsor_id) || 'Sponsor'}<div className="bar" style={{ width: `${pct(s.clicks, topSponsors[0].clicks || 1)}%` }} /></td><td>{n(s.clicks)}</td></tr>)}</tbody>
              </table>
            )}
          </>
        )}
        <div className="ov-foot"><span>Views and clicks per sponsor inside</span>{open('sponsors', 'Open')}</div>
      </section>
    ),
    show.money && m && mix && (
      <section key="money" className="admin-panel ov-card" aria-labelledby="ov-money">
        <div className="admin-panel-head"><h2 id="ov-money"><Wallet size={18} aria-hidden="true" />Money</h2><span className="admin-meta">Finance</span></div>
        <div className="ov-hero"><div className="k">Collected</div><div className="v">{money(m.in_cents)}<small>paid in</small></div></div>
        <dl className="ov-strip is-four">
          <div><dt>Spent</dt><dd>{money(m.out_cents)}</dd><span className="n">{plural(m.expense_count, 'expense')}</span></div>
          <div><dt>Balance</dt><dd className={m.in_cents - m.out_cents < 0 ? 'bad' : undefined}>{money(m.in_cents - m.out_cents)}</dd><span className="n">In minus out</span></div>
          <div><dt>Waiting now</dt><dd className={m.waiting_count ? 'warn' : undefined}>{money(m.waiting_cents)}</dd><span className="n">{m.waiting_count ? `${plural(m.waiting_count, 'payment')} to check or chase` : 'Nothing waiting'}</span></div>
          <div><dt>Refunded or failed</dt><dd>{n(m.refunded_count)}</dd><span className="n">{money(m.refunded_cents)} refunded</span></div>
        </dl>
        {mix.total > 0 && (
          <div className="ov-mix">
            <div className="ov-mix-bar" aria-hidden="true">{mix.parts.map((p, i) => <i key={p.id} className={`c${i + 1}`} style={{ width: `${pct(p.cents, mix.total)}%` }} />)}</div>
            <p className="ov-legend">{mix.parts.map((p, i) => <span key={p.id}><i className={`c${i + 1}`} />{p.label} {money(p.cents)}</span>)}</p>
          </div>
        )}
        {bars(fillBuckets(buckets, m.daily.map(d => ({ at: d.d, n: d.in }))), 'Money in over time')}
        <div className="ov-foot"><span>Card, bank transfer and cash split inside</span>{open('money', 'Open')}</div>
      </section>
    ),
    show.traffic && t && (
      <section key="traffic" className="admin-panel ov-card is-wide" aria-labelledby="ov-traffic">
        <div className="admin-panel-head"><h2 id="ov-traffic"><Globe size={18} aria-hidden="true" />Website and fans</h2><span className="admin-meta">{range.label}</span></div>
        <div className="ov-hero"><div className="k">Public page visits</div><div className="v">{n(t.visits)}<small>{topPage ? `most on ${pageName(topPage.path, club.slug)}` : `${n(t.visitors)} visitors`}</small></div></div>
        <dl className="ov-strip">
          <div><dt>Passes scanned</dt><dd>{n(t.scans)}</dd><span className="n">At the gate</span></div>
          <div><dt>Tickets</dt><dd>{n(t.tickets)}</dd><span className="n">{plural(t.ticket_events, 'event')}</span></div>
          <div><dt>Checked in</dt><dd>{n(t.checked_in)}</dd><span className="n">{t.tickets ? `${pct(t.checked_in, t.tickets)}% of tickets` : 'No tickets yet'}</span></div>
        </dl>
        {bars(fillBuckets(buckets, t.daily.map(d => ({ at: d.d, n: d.n }))), 'Visits over time')}
        <div className="ov-foot"><span>{n(t.visitors)} different visitors</span>{open('traffic', 'Open')}</div>
      </section>
    ),
  ].filter(Boolean);

  return (
    <>
      <div className="ov-head">
        <div><h2>Club at a glance</h2><p>{range.label}. Tap Open on a card to see the people and payments behind it.</p></div>
        {controls}
      </div>
      {problem}
      {state === 'loading' && !data ? <p className="ov-empty" aria-live="polite">Loading the club&apos;s numbers…</p> : (
        <div className="ov-grid">{cards}</div>
      )}
    </>
  );
}

function Record({ r }: { r: ReturnType<typeof seasonRecord> }) {
  return (
    <div className="ov-record">
      <span><b>{r.won}</b>Won</span><span><b>{r.drawn}</b>Drawn</span><span><b>{r.lost}</b>Lost</span>
      <span className="gd"><b>{r.goalsFor} : {r.goalsAgainst}</b>Goals for : against</span>
    </div>
  );
}

function BarAxis({ buckets }: { buckets: Bucket[] }) {
  // Months get a letter each; days and weeks only label the first and last bar
  if (buckets.length === 0) return null;
  if (buckets[0].short) return <div className="ov-axis" aria-hidden="true">{buckets.map((b, i) => <span key={i}>{b.short}</span>)}</div>;
  return (
    <div className="ov-axis is-ends" aria-hidden="true">
      <span>{buckets[0].label.replace('Week of ', '')}</span><span>{buckets[buckets.length - 1].now ? 'Today' : buckets[buckets.length - 1].label.replace('Week of ', '')}</span>
    </div>
  );
}
