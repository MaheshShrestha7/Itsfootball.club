'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Check, Copy, Link2, Lock, Printer, RefreshCw } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import CupReportPaper from '@/components/CupReportPaper';
import { buildCupReport, cupReportText } from '@/lib/cup-report';
import { formatDate, formatShortDay } from '@/lib/dates';
import { SITE_URL } from '@/lib/slugs';
import { juniorMemberIds, juniorPublicName } from '@/lib/teams';
import { gameWhen, useCupGames } from '@/lib/use-cup-games';
import { useCupShare, useCupSummary } from '@/lib/use-match-reviews';

/**
 * Admin > Match Centre > Tournament report: the cup review as one page to print, save as a PDF or
 * share. Two versions: everything for coaches and committee, and one for the squad that leaves out
 * minutes and the notes for next time. Only the squad version can be shared with a link.
 */
export default function CupReportPage({ params, searchParams }: {
  params: Promise<{ clubSlug: string }>;
  searchParams: Promise<{ event?: string; tournament?: string; team?: string }>;
}) {
  const { clubSlug } = use(params);
  const { event: eventId, tournament: tournamentId, team: askedTeam } = use(searchParams);
  const { matchEvents, members, clubTeams, clubTeamMembers, getMatchAvailabilities } = useClub();
  const { club, cupName, team, games, reviews, lines, cup, query, ourName, loaded } = useCupGames(clubSlug, { event: eventId, tournament: tournamentId, team: askedTeam });
  // Read only here: the summary is written on the cup review
  const { summary, by } = useCupSummary(club.id, cup, '');
  const sharing = useCupShare(club.id, cup);
  const [squad, setSquad] = useState(false);
  const [copied, setCopied] = useState<'text' | 'link' | null>(null);

  const reports = useMemo(() => {
    const juniors = juniorMemberIds(members, clubTeams, clubTeamMembers, { includeU18: club.junior_includes_u18 !== false });
    const juniorNames = new Set(members.filter(m => juniors.has(m.id)).map(m => m.full_name));
    const fullName = (id: string) => members.find(m => m.id === id)?.full_name || 'A player';
    const said = new Set(games.flatMap(m => getMatchAvailabilities(m.id).filter(a => a.status === 'available').map(a => a.member_id)));
    const base = {
      club: club.name, cup: cupName || '', team: team?.name, ourName, games, events: matchEvents,
      linesByMatch: lines, reviews: reviews || {}, summary, by: by || undefined,
      when: gameWhen, day: (m: { match_date: string }) => formatShortDay(m.match_date), available: said.size || undefined,
    };
    return {
      coach: buildCupReport({ ...base, coach: true, nameOf: fullName, eventName: n => n }),
      // Children's names are shortened ("Leo B."), as on the public site
      squad: buildCupReport({
        ...base, coach: false,
        nameOf: id => (juniors.has(id) ? juniorPublicName(fullName(id)) : fullName(id)),
        eventName: n => (juniorNames.has(n) ? juniorPublicName(n) : n),
      }),
      hasJuniors: juniors.size > 0,
    };
  }, [members, clubTeams, clubTeamMembers, club.junior_includes_u18, club.name, cupName, team, ourName, games, matchEvents, lines, reviews, summary, by, getMatchAvailabilities]);

  if (!cupName || !team) {
    return (
      <div className="rv-page">
        <div className="admin-head"><div><h1>Tournament report</h1></div></div>
        <div className="admin-panel admin-empty">
          <p>Open a tournament report from a cup review.</p>
          <Link href={`/${club.slug}/admin/match-center`} className="btn btn-secondary btn-sm">Back</Link>
        </div>
      </div>
    );
  }

  const report = squad ? reports.squad : reports.coach;
  const link = sharing.share ? `${SITE_URL}/report/${sharing.share.token}` : '';
  const copy = (what: 'text' | 'link', text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    });
  };
  const reviewNote = `${report.reviews} of ${report.games.length} match ${report.games.length === 1 ? 'review' : 'reviews'}`;

  return (
    <div className="rv-page">
      <div className="admin-head">
        <div>
          <Link href={`/${club.slug}/admin/match-center/cup-review?${query}`} className="rv-crumb"><ArrowLeft size={14} aria-hidden="true" /> {cupName} review</Link>
          <h1>Tournament report</h1>
          <p>Made from your match reviews and your cup summary. The words are yours and the numbers come from Match Centre.</p>
        </div>
      </div>

      <div className="admin-toolbar">
        <div>
          <div className="admin-chips" role="group" aria-label="Who is it for">
            <button data-view-ok type="button" className="admin-chip" aria-pressed={!squad} onClick={() => setSquad(false)}>For coaches and committee</button>
            <button data-view-ok type="button" className="admin-chip" aria-pressed={squad} onClick={() => setSquad(true)}>For the squad</button>
          </div>
          <p className="rv-private" style={{ margin: 'var(--space-2xs) 0 0' }}>
            {squad
              ? 'Leaves out minutes and your notes for next time, so you can hand it to players and parents.'
              : <><Lock size={13} aria-hidden="true" /> Has everything, including minutes and your notes for next time.</>}
          </p>
        </div>
        <div className="admin-toolbar-end">
          <button data-view-ok type="button" className="btn btn-secondary btn-sm" onClick={() => copy('text', cupReportText(report))}>
            {copied === 'text' ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copied === 'text' ? 'Copied' : 'Copy as text'}
          </button>
          <button data-view-ok type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
            <Printer size={14} aria-hidden="true" /> Print or save as PDF
          </button>
        </div>
      </div>

      <div className="rv-stack">
        {reviews === null && (
          <p className="rv-flag" role="alert">
            <AlertTriangle size={15} aria-hidden="true" />
            <span>The reviews can&apos;t be opened right now, so the report is missing them. Check your connection and reload the page.</span>
          </p>
        )}

        {sharing.ready && (
          <section className="admin-panel" aria-labelledby="rv-share">
            <div className="admin-panel-head">
              <h2 id="rv-share">Share with a link</h2>
              {sharing.share && <span className="admin-meta">Shared copy saved {formatDate(sharing.share.sharedAt)}</span>}
            </div>
            <div className="rv-pad">
              <p className="rv-facts">
                <span>
                  Anyone with the link can read the squad version without signing in. It never shows minutes or your notes for next time.
                  {reports.hasJuniors ? ' Children’s names from the stats are shortened, so check your own notes for full names before you share.' : ''}
                  {' '}The link shows a saved copy, so later changes only appear after you update it.
                </span>
              </p>
              {sharing.share ? (
                <>
                  <input className="form-input" readOnly value={link} aria-label="Share link" onFocus={e => e.currentTarget.select()} />
                  <div className="mc-next-actions">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => copy('link', link)}>
                      {copied === 'link' ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {copied === 'link' ? 'Copied' : 'Copy link'}
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" disabled={sharing.busy || !loaded || reviews === null} onClick={() => void sharing.save(reports.squad)}>
                      <RefreshCw size={14} aria-hidden="true" /> Update the shared copy
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" disabled={sharing.busy} onClick={() => void sharing.stop()}>Stop sharing</button>
                  </div>
                </>
              ) : (
                <div className="mc-next-actions">
                  <button type="button" className="btn btn-primary btn-sm" disabled={sharing.busy || !loaded || reviews === null} onClick={() => { setSquad(true); void sharing.save(reports.squad); }}>
                    <Link2 size={14} aria-hidden="true" /> Create share link
                  </button>
                </div>
              )}
              {sharing.failed && <p className="rv-flag" role="alert"><AlertTriangle size={15} aria-hidden="true" /><span>That didn&apos;t save. Check your connection and try again.</span></p>}
            </div>
          </section>
        )}

        <CupReportPaper
          report={report}
          colour={club.primary_color}
          logoUrl={club.logo_url}
          footer={`Made on ${formatDate(new Date().toISOString())} from ${reviewNote}${report.summary ? ' and the coach’s summary' : ''}`}
        />
      </div>
    </div>
  );
}
