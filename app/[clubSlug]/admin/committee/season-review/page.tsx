'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Check, Copy, Download, Link2, Lock, Plus, Printer, RefreshCw, Trash2 } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import SeasonReviewPaper from '@/components/SeasonReviewPaper';
import ReviewSaveNote from '@/components/admin/ReviewSaveNote';
import { seasonOptions, type AgmExpense, type AgmPayment } from '@/lib/agm-report';
import { expenseSeason, paymentSeason } from '@/lib/finance';
import { fetchPaged } from '@/lib/paged';
import { getSupabaseClient } from '@/lib/supabase/client';
import { siteToday } from '@/lib/member-prices';
import { formatDate } from '@/lib/dates';
import { SITE_URL } from '@/lib/slugs';
import { clubTeamsOf, juniorMemberIds, teamLabel } from '@/lib/teams';
import {
  AWARD_SUGGESTIONS, buildSeasonReview, CLUB, MAX_AWARDS, MAX_THANKS, seasonMoney, seasonSpan, sharedCopy,
  type SeasonExtras, type SeasonMoney,
} from '@/lib/season-review';
import { loadSeasonRecords, useSeasonExtras, useSeasonReviewReady, useSeasonShare, type SeasonRecords } from '@/lib/use-season-review';
import { drawSeasonCard, type SeasonCardFormat } from '@/lib/season-card';

const MAX_ROWS = 100000;

/**
 * Admin > Committee > Season review: the season for members, parents and sponsors. The share card
 * sits first, because that's what gets posted. Then the awards and names only the committee can add,
 * then the review itself, for the whole club or one team, ready to print or share by link.
 */
export default function SeasonReviewPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const {
    clubs, selectClubBySlug, members, playerStats, matches, events, sponsors, news, gallery, seasons, getActiveSeason,
    clubTeams, clubTeamMembers, clubScoreProfiles, availabilities,
  } = useClub();
  const { user, can } = useAuth();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const clubSeasons = useMemo(() => seasons.filter(s => s.club_id === club.id), [seasons, club.id]);
  const options = useMemo(() => seasonOptions(clubSeasons, matches.filter(m => m.club_id === club.id)), [clubSeasons, matches, club.id]);
  const active = getActiveSeason(club.id)?.name?.trim();
  const [picked, setPicked] = useState<string | null>(null);
  const season = picked ?? (options.some(o => o.name === active) ? active! : options[0]?.name ?? '');
  const idx = options.findIndex(o => o.name === season);
  const info = options[idx];
  const previous = options[idx + 1]?.name ?? null;
  const nextSeason = idx > 0 ? options[idx - 1] : null;

  const [team, setTeam] = useState<string>(CLUB);
  const [now] = useState(() => Date.now());
  const [committee, setCommittee] = useState(false);
  const ready = useSeasonReviewReady();
  const { extras, change, ready: extrasReady, failed: extrasFailed, saveState, retry } = useSeasonExtras(ready ? club.id : undefined, ready ? season : undefined, user?.full_name || '');
  const sharing = useSeasonShare(ready ? club.id : undefined, ready ? season : undefined);
  const [copied, setCopied] = useState(false);

  // Records the club context doesn't hold, read once per season
  const span = info ? seasonSpan(info) : null;
  const clubMatches = useMemo(() => matches.filter(m => m.club_id === club.id), [matches, club.id]);
  const seasonMatchIds = useMemo(() => clubMatches.filter(m => m.season === season).map(m => m.id), [clubMatches, season]);
  const seasonEventIds = useMemo(() => events.filter(e => e.club_id === club.id && (e.season ? e.season === season : !!span && new Date(e.start_time).getTime() >= span.from && new Date(e.start_time).getTime() <= span.to)).map(e => e.id), [events, club.id, season, span]);
  const sponsorIds = useMemo(() => sponsors.filter(s => s.club_id === club.id && !s.event_id).map(s => s.id), [sponsors, club.id]);
  const [records, setRecords] = useState<{ key: string; data: SeasonRecords } | null>(null);
  const recordsKey = `${club.id}:${season}:${seasonMatchIds.length}:${seasonEventIds.length}:${sponsorIds.length}`;
  useEffect(() => {
    if (!season) return;
    let live = true;
    void loadSeasonRecords({
      clubId: club.id, matchIds: seasonMatchIds, eventIds: seasonEventIds, sponsorIds,
      from: span ? new Date(span.from).toISOString() : null, to: span ? new Date(span.to).toISOString() : null, committee: true,
    }).then(data => { if (live) setRecords({ key: recordsKey, data }); });
    return () => { live = false; };
    // recordsKey sums up the ids, so the read runs once per season and not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordsKey]);

  // The money summary: only for people who can see Finance, by the AGM report's rules
  const seesMoney = can(club.id, 'finance');
  const [ledger, setLedger] = useState<{ payments: AgmPayment[]; expenses: AgmExpense[]; currency: string; opening: { amount_cents: number; as_at: string } | null; budgets: { season: string; kind: string; amount_cents: number }[] } | null>(null);
  useEffect(() => {
    const db = getSupabaseClient();
    if (!db || !seesMoney) return;
    let live = true;
    void (async () => {
      const [payments, expenses, settings, opening, budgets] = await Promise.all([
        fetchPaged<AgmPayment>((f, t) => db.from('payments').select('*').eq('club_id', club.id).order('id').range(f, t), MAX_ROWS),
        fetchPaged<AgmExpense>((f, t) => db.from('expenses').select('*').eq('club_id', club.id).order('id').range(f, t), MAX_ROWS),
        db.from('club_payment_settings').select('currency').eq('club_id', club.id).maybeSingle(),
        db.from('club_opening_balance').select('amount_cents, as_at').eq('club_id', club.id).maybeSingle(),
        db.from('budgets').select('season, kind, amount_cents').eq('club_id', club.id),
      ]);
      // A total from a partial read would be wrong without anyone knowing, so a failed read shows no money
      if (!live || payments.error || expenses.error) return;
      setLedger({
        payments: payments.data, expenses: expenses.data, currency: settings.data?.currency || 'AUD',
        opening: opening.error ? null : opening.data, budgets: budgets.error ? [] : budgets.data || [],
      });
    })().catch(() => null);
    return () => { live = false; };
  }, [club.id, seesMoney]);

  const money: SeasonMoney | null = useMemo(() => {
    if (!ledger || !info) return null;
    return seasonMoney({
      payments: ledger.payments.map(p => ({ ...p, season: paymentSeason(p, clubSeasons) })),
      expenses: ledger.expenses.map(e => ({ ...e, season: expenseSeason(e, clubSeasons) })),
      season: info, previous, currency: ledger.currency, opening: ledger.opening, today: siteToday(),
    });
  }, [ledger, info, previous, clubSeasons]);
  const sponsorCents = useMemo(() => {
    if (!ledger) return null;
    return ledger.payments.filter(p => p.kind === 'sponsorship' && p.status === 'paid' && paymentSeason(p, clubSeasons) === season).reduce((a, p) => a + p.amount_cents, 0);
  }, [ledger, clubSeasons, season]);

  const teams = useMemo(() => clubTeamsOf(clubTeams, club.id), [clubTeams, club.id]);
  const clubMembers = useMemo(() => members.filter(m => m.club_id === club.id), [members, club.id]);
  const juniors = useMemo(() => juniorMemberIds(clubMembers, teams, clubTeamMembers), [clubMembers, teams, clubTeamMembers]);
  const data = records?.key === recordsKey ? records.data : null;

  const review = useMemo(() => {
    if (!info || !data) return null;
    const budget = nextSeason && ledger ? ledger.budgets.filter(b => b.season === nextSeason.name && b.kind === 'expense').reduce((a, b) => a + b.amount_cents, 0) : null;
    return buildSeasonReview({
      club, season: info, seasonNames: [...options].reverse().map(o => o.name),
      teams, teamMembers: clubTeamMembers.filter(r => r.club_id === club.id), members: clubMembers, juniorIds: juniors,
      matches: clubMatches, statLines: data.statLines, playerStats, events, attendees: data.attendees, ticketPayments: data.ticketPayments,
      clubScore: clubScoreProfiles, sponsors, sponsorCounts: data.sponsorCounts, sponsorCents,
      availabilities: availabilities.filter(a => a.club_id === club.id), eventNotes: data.eventNotes,
      news, gallery, money, extras: extrasReady ? extras : { ...extras, awards: [], thanks: [] },
      next: { season: nextSeason?.name ?? null, events: events.filter(e => e.club_id === club.id), matches: clubMatches, budgetCents: budget },
      committee: true, currency: ledger?.currency || 'AUD', now,
    });
  }, [info, data, nextSeason, ledger, club, options, teams, clubTeamMembers, clubMembers, juniors, clubMatches, playerStats, events, clubScoreProfiles, sponsors, sponsorCents, availabilities, news, gallery, money, extras, extrasReady, now]);

  const shown = review && !committee ? sharedCopy(review, { hideMoney: extras.hide_money, hideReplies: extras.hide_replies }) : review;
  const view = shown && (shown.views[team] ? team : CLUB);

  // The story card follows the team picked below
  const cardInput = (v: string) => ({
    club, season, subtitle: v === CLUB ? 'The whole club, in numbers' : shown!.teams.find(t => t.id === v)?.name || '',
    card: shown!.views[v].card, sponsors: shown!.sponsors?.count || 0, site: (club.custom_domain || `itsfootball.club/${club.slug}`).replace(/^https?:\/\//, ''),
  });
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const cardKey = shown && view !== null ? JSON.stringify([shown.views[view].card, view, club.primary_color, club.logo_url]) : '';
  useEffect(() => {
    if (!shown || view === null) return;
    let live = true;
    let url: string | null = null;
    void drawSeasonCard(cardInput(view), 'story').then(blob => {
      url = URL.createObjectURL(blob);
      if (live) setCardUrl(url); else URL.revokeObjectURL(url);
    }).catch(() => null);
    return () => { live = false; if (url) URL.revokeObjectURL(url); };
    // cardKey holds everything the card shows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardKey]);
  const download = async (format: SeasonCardFormat) => {
    if (!shown || view === null) return;
    const blob = await drawSeasonCard(cardInput(view), format).catch(() => null);
    if (!blob) return;
    const name = `${club.slug}-season-${season}${view !== CLUB ? `-${teamLabel(teams.find(t => t.id === view) || { name: 'team' }).toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : ''}-${format}.png`.replace(/[^a-z0-9.-]+/gi, '-');
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: `${club.name}: season ${season}` }); return; } catch { /* closed, or not allowed: download instead */ }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const link = sharing.share ? `${SITE_URL}/report/s/${sharing.share.token}` : '';
  const shareCopy = review ? sharedCopy({ ...review }, { hideMoney: extras.hide_money, hideReplies: extras.hide_replies }) : null;
  const copyLink = () => { void navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };

  const set = (next: Partial<SeasonExtras>) => change({ ...extras, ...next });
  const staffCount = clubTeamMembers.filter(r => r.club_id === club.id && r.team_role !== 'player' && r.is_active !== false).length;
  const committeeCount = clubMembers.filter(m => m.is_executive && (!m.executive_season || m.executive_season === season)).length;

  return (
    <div className="rv-page">
      <div className="admin-head">
        <div>
          <Link href={`/${club.slug}/admin/committee`} className="rv-crumb"><ArrowLeft size={14} aria-hidden="true" /> Committee</Link>
          <h1>Season review</h1>
          <p>Your season for members, parents and sponsors. Post the card, share the link, or print it for presentation night.</p>
        </div>
        <div className="admin-head-actions">
          {options.length > 0 && (
            <select data-view-ok className="form-select" style={{ width: 'auto' }} aria-label="Season" value={season} onChange={e => { setPicked(e.target.value); setTeam(CLUB); }}>
              {options.map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
            </select>
          )}
          <button data-view-ok type="button" className="btn btn-primary btn-sm" disabled={!review} onClick={() => window.print()}>
            <Printer size={14} aria-hidden="true" /> Print or save as PDF
          </button>
        </div>
      </div>

      {!options.length ? (
        <div className="admin-panel admin-empty"><p>Add a season in Seasons, then come back for its review.</p></div>
      ) : !shown || view === null ? (
        <p className="text-note" role="status">Adding up the season…</p>
      ) : (
        <div className="rv-stack">
          <section className="admin-panel sr-share" aria-labelledby="sr-card">
            <div className="sr-share-card">
              {cardUrl ? <img src={cardUrl} alt={`Story card: ${club.name} season ${season} in numbers`} /> : <div className="sr-card-wait" aria-hidden="true" />}
            </div>
            <div className="sr-share-copy">
              <h2 id="sr-card">Share the season</h2>
              <p className="text-meta">Sized for Facebook and Instagram stories. Pick a team below and the card changes, so each team can post its own.</p>
              <div className="mc-next-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => void download('story')}><Download size={14} aria-hidden="true" /> Story (9:16)</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => void download('post')}><Download size={14} aria-hidden="true" /> Post (4:5)</button>
              </div>
              {ready && sharing.ready && (
                <div className="sr-link">
                  <h3>Share with a link</h3>
                  <p className="text-meta">Anyone with the link can read the review without signing in. It leaves out the committee&apos;s notes{extras.hide_money ? ' and the money summary' : ''}. The link shows a saved copy, so later changes appear after you update it.</p>
                  {sharing.share ? (
                    <>
                      <input className="form-input" readOnly value={link} aria-label="Share link" onFocus={e => e.currentTarget.select()} />
                      <div className="mc-next-actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={copyLink}>{copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copied ? 'Copied' : 'Copy link'}</button>
                        <button type="button" className="btn btn-secondary btn-sm" disabled={sharing.busy || !shareCopy} onClick={() => shareCopy && void sharing.save(shareCopy)}><RefreshCw size={14} aria-hidden="true" /> Update the shared copy</button>
                        <button type="button" className="btn btn-secondary btn-sm" disabled={sharing.busy} onClick={() => void sharing.stop()}>Stop sharing</button>
                      </div>
                      <span className="text-meta">Saved {formatDate(sharing.share.sharedAt)}</span>
                    </>
                  ) : (
                    <div className="mc-next-actions">
                      <button type="button" className="btn btn-secondary btn-sm" disabled={sharing.busy || !shareCopy || !extrasReady} onClick={() => shareCopy && void sharing.save(shareCopy)}><Link2 size={14} aria-hidden="true" /> Create share link</button>
                    </div>
                  )}
                  {sharing.failed && <p className="rv-flag" role="alert"><AlertTriangle size={15} aria-hidden="true" /><span>That didn&apos;t save. Check your connection and try again.</span></p>}
                </div>
              )}
            </div>
          </section>

          {!ready && (
            <p className="rv-flag"><AlertTriangle size={15} aria-hidden="true" /><span>Season awards, extra names to thank and the share link turn on once the database update for the Season review (migration 20261179) has run.</span></p>
          )}
          {ready && extrasFailed && (
            <p className="rv-flag" role="alert"><AlertTriangle size={15} aria-hidden="true" /><span>The awards and names can&apos;t be opened right now. Check your connection and reload the page.</span></p>
          )}

          {ready && (
            <div className="rv-two sr-setup">
              <section className="admin-panel" aria-labelledby="sr-awards">
                <div className="admin-panel-head"><h2 id="sr-awards">Season awards</h2><span className="rv-private"><Lock size={13} aria-hidden="true" /> Saves as you type</span></div>
                <div className="rv-pad">
                  <p className="text-meta" style={{ margin: 0 }}>Chosen or voted by your club. The review never works these out from stats.</p>
                  <datalist id="sr-award-names">{AWARD_SUGGESTIONS.map(a => <option key={a} value={a} />)}</datalist>
                  <datalist id="sr-people">{clubMembers.map(m => <option key={m.id} value={m.full_name} />)}</datalist>
                  {extras.awards.map((a, k) => (
                    <div key={k} className="sr-award-row">
                      <input className="form-input" list="sr-award-names" aria-label="Award" placeholder="Award, e.g. Best and Fairest" maxLength={60} disabled={!extrasReady}
                        value={a.award} onChange={e => set({ awards: extras.awards.map((x, j) => (j === k ? { ...x, award: e.target.value } : x)) })} />
                      <input className="form-input" list="sr-people" aria-label="Winner" placeholder="Winner" maxLength={80} disabled={!extrasReady}
                        value={a.name} onChange={e => {
                          const hit = clubMembers.find(m => m.full_name === e.target.value);
                          set({ awards: extras.awards.map((x, j) => (j === k ? { ...x, name: e.target.value, member_id: hit?.id ?? null } : x)) });
                        }} />
                      {teams.length > 1 && (
                        <select className="form-select" aria-label="Team" disabled={!extrasReady} value={a.team_id || ''}
                          onChange={e => set({ awards: extras.awards.map((x, j) => (j === k ? { ...x, team_id: e.target.value || null } : x)) })}>
                          <option value="">Whole club</option>
                          {teams.map(t => <option key={t.id} value={t.id}>{teamLabel(t)}</option>)}
                        </select>
                      )}
                      <button type="button" className="btn btn-ghost btn-sm" aria-label={`Remove ${a.award || 'award'}`} disabled={!extrasReady}
                        onClick={() => set({ awards: extras.awards.filter((_, j) => j !== k) })}><Trash2 size={14} aria-hidden="true" /></button>
                    </div>
                  ))}
                  <div className="mc-next-actions">
                    <button type="button" className="btn btn-secondary btn-sm" disabled={!extrasReady || extras.awards.length >= MAX_AWARDS}
                      onClick={() => set({ awards: [...extras.awards, { award: extras.awards.length ? '' : 'Best and Fairest', name: '', member_id: null, team_id: team !== CLUB ? team : null }] })}>
                      <Plus size={14} aria-hidden="true" /> Add an award
                    </button>
                  </div>
                  <p className="text-meta" style={{ margin: 0 }}>Awards need a name and a winner to show. Juniors are shown as &quot;Sam T.&quot;, the same as on the club site.</p>
                </div>
              </section>

              <section className="admin-panel" aria-labelledby="sr-thanks">
                <div className="admin-panel-head"><h2 id="sr-thanks">Who to thank</h2></div>
                <div className="rv-pad">
                  <p className="text-meta" style={{ margin: 0 }}>
                    {staffCount === 1 ? '1 coach or team staff member comes' : `${staffCount} coaches and team staff come`} from Club Teams and {committeeCount === 1 ? '1 committee member' : `${committeeCount} committee members`} from Committee. Add anyone else by name, like canteen helpers.
                  </p>
                  {extras.thanks.map((t, k) => (
                    <div key={k} className="sr-thanks-row">
                      <input className="form-input" aria-label="Name" placeholder="Name" maxLength={80} disabled={!extrasReady} value={t.name}
                        onChange={e => set({ thanks: extras.thanks.map((x, j) => (j === k ? { ...x, name: e.target.value } : x)) })} />
                      <input className="form-input" aria-label="What they did" placeholder="What they did, e.g. canteen" maxLength={60} disabled={!extrasReady} value={t.role}
                        onChange={e => set({ thanks: extras.thanks.map((x, j) => (j === k ? { ...x, role: e.target.value } : x)) })} />
                      <button type="button" className="btn btn-ghost btn-sm" aria-label={`Remove ${t.name || 'name'}`} disabled={!extrasReady}
                        onClick={() => set({ thanks: extras.thanks.filter((_, j) => j !== k) })}><Trash2 size={14} aria-hidden="true" /></button>
                    </div>
                  ))}
                  <div className="mc-next-actions">
                    <button type="button" className="btn btn-secondary btn-sm" disabled={!extrasReady || extras.thanks.length >= MAX_THANKS}
                      onClick={() => set({ thanks: [...extras.thanks, { name: '', role: '' }] })}><Plus size={14} aria-hidden="true" /> Add a name</button>
                  </div>
                  <h3 className="sr-sub">What&apos;s in the shared review</h3>
                  {seesMoney && (
                    <label className="sr-switch">
                      <span>Money summary<small>Income, spending and fees. Turn off before sharing outside the club.</small></span>
                      <input type="checkbox" role="switch" checked={!extras.hide_money} disabled={!extrasReady} onChange={e => set({ hide_money: !e.target.checked })} />
                    </label>
                  )}
                  <label className="sr-switch">
                    <span>Availability replies<small>How many players answered for games, and how fast.</small></span>
                    <input type="checkbox" role="switch" checked={!extras.hide_replies} disabled={!extrasReady} onChange={e => set({ hide_replies: !e.target.checked })} />
                  </label>
                  <ReviewSaveNote state={saveState} retry={retry} />
                </div>
              </section>
            </div>
          )}

          <div className="sr-bar">
            <div>
              <span className="sr-bar-label">Who is it for</span>
              <div className="admin-chips" role="group" aria-label="Who is it for">
                <button type="button" data-view-ok className="admin-chip" aria-pressed={!committee} onClick={() => setCommittee(false)}>Members and sponsors</button>
                <button type="button" data-view-ok className="admin-chip" aria-pressed={committee} onClick={() => setCommittee(true)}>Committee</button>
              </div>
            </div>
            {shown.teams.length > 1 && (
              <div>
                <span className="sr-bar-label">Team</span>
                <div className="admin-chips" role="group" aria-label="Team">
                  <button type="button" data-view-ok className="admin-chip" aria-pressed={view === CLUB} onClick={() => setTeam(CLUB)}>Whole club</button>
                  {shown.teams.map(t => <button key={t.id} type="button" data-view-ok className="admin-chip" aria-pressed={view === t.id} onClick={() => setTeam(t.id)}>{t.name}</button>)}
                </div>
              </div>
            )}
          </div>

          <SeasonReviewPaper review={shown} team={view} colour={club.primary_color} logoUrl={club.logo_url}
            footer={`Made on ${formatDate(new Date().toISOString())} from Match Centre, memberships, events, sponsors${money ? ' and finance' : ''}`} />
          {seesMoney && <p className="text-meta" style={{ textAlign: 'center' }}>Bringing this to the AGM? The treasurer&apos;s figures are in the <Link href={`/${club.slug}/admin/finance/agm`}>AGM report</Link>.</p>}
        </div>
      )}
    </div>
  );
}
