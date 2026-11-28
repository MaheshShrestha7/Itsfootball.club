'use client';

import React, { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { newsPath } from '@/lib/slugs';
import { newestFirst } from '@/lib/news';
import { matchReportCards } from '@/lib/match-article';
import { cupWriteupCards } from '@/lib/cup-writeup';
import { plainText } from '@/lib/match-report';
import { tournamentWriteups, writeupSourceFor } from '@/lib/tournament-writeups';
import LocalTime from '@/components/LocalTime';
import CoverImage from '@/components/CoverImage';
import ClubSubPage, { EmptyState, ListSkeleton } from '@/components/ClubSubPage';
import { useUrlParam } from '@/lib/use-url-tab';

const PAGE = 12;

/** /club/news: every article the club has posted, newest first (the home page shows the latest few) */
export default function ClubNewsPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug, news, isHydrated, matches, matchEvents, members, clubTeams, clubTeamMembers, playerStats, activityLogs, events, tournaments, tournamentParticipants, getTournamentStandings } = useClub();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  // The topic is in the URL (?topic=Juniors) so a filtered list can be shared
  const [topic, setTopic] = useUrlParam('topic');
  const tag = topic || 'all';
  const setTag = (t: string) => setTopic(t === 'all' ? '' : t);
  const [shown, setShown] = useState(PAGE);

  // The club's own articles, plus each finished match's report (its card opens the match page)
  const clubNews = useMemo(() => {
    // A hosted tournament's write-ups: group stage, semi-finals, final and round-up (each opens its own page)
    const writeups = tournaments.filter(t => t.club_id === club.id).map(t => ({ t, list: tournamentWriteups(club.slug, t.id,
      writeupSourceFor({ clubSlug: club.slug, tournament: t, matches, matchEvents, participants: tournamentParticipants, getTournamentStandings })) }));
    // Once a tournament has write-ups they stand in for the guest teams' games, so a cup day doesn't fill the
    // list; the club's own teams' games keep their reports
    const covered = new Set(writeups.filter(w => w.list.length).map(w => w.t.id));
    const ours = new Set(tournamentParticipants.filter(p => covered.has(p.tournament_id) && p.team_type === 'internal').map(p => `${p.tournament_id}|${p.name}`));
    const coveredMatch = new Set(matches.filter(m => m.tournament_id && covered.has(m.tournament_id)
      && !ours.has(`${m.tournament_id}|${m.home_team_name}`) && !ours.has(`${m.tournament_id}|${m.away_team_name}`)).map(m => m.id));
    return newestFirst([
    ...news.filter(n => n.club_id === club.id).map(n => ({ ...n, href: newsPath(club.slug, n.slug) })),
    ...matchReportCards({ club, matches, matchEvents, members, clubTeams, clubTeamMembers, playerStats, activityLogs, events })
      .filter(r => !coveredMatch.has(r.id))
      .map(r => ({ id: r.id, href: r.href, title: r.title, summary: r.summary, published_at: r.published_at, cover_image_url: r.cover, tags: ['Match Report'] })),
    // A completed cup's write-up (its card opens the event page)
    ...cupWriteupCards({ club, events, matches, matchEvents, clubTeams })
      .map(r => ({ id: r.id, href: r.href, title: r.title, summary: r.summary, published_at: r.published_at, cover_image_url: r.cover, tags: ['Cup Report'] })),
    ...writeups.flatMap(({ t, list }) => list.map(w => ({ id: `${t.id}:${w.kind}`, href: w.href, title: w.writeup.headline, summary: plainText(w.writeup.lead), published_at: w.at, cover_image_url: t.banner_url || undefined, tags: ['Tournament Report', t.name] }))),
  ]);
  }, [news, club, matches, matchEvents, members, clubTeams, clubTeamMembers, playerStats, activityLogs, events, tournaments, tournamentParticipants, getTournamentStandings]);
  // Tags used on at least two articles: one-off tags would just add noise
  const tags = useMemo(() => {
    const count = new Map<string, number>();
    clubNews.forEach(n => (n.tags || []).forEach(t => count.set(t, (count.get(t) || 0) + 1)));
    return [...count].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  }, [clubNews]);
  const filtered = tag === 'all' ? clubNews : clubNews.filter(n => n.tags?.includes(tag));

  return (
    <ClubSubPage club={club} title="News" width={900} intro={`Match reports, announcements and updates from ${club.name}.`}>

        {tags.length > 0 && (
          <div role="group" aria-label="Topic" className="fixtures-team-chips">
            {['all', ...tags].map(t => (
              <button key={t} type="button" aria-pressed={tag === t} onClick={() => { setTag(t); setShown(PAGE); }}
                className={`btn btn-sm ${tag === t ? 'btn-primary' : 'btn-secondary'}`}>
                {t === 'all' ? 'All news' : t}
              </button>
            ))}
          </div>
        )}

        {!isHydrated ? (
          <ListSkeleton rows={4} height={120} label="Loading news" />
        ) : filtered.length === 0 ? (
          <EmptyState title={tag === 'all' ? 'No news posted yet' : `No news tagged “${tag}”`}
            action={tag !== 'all' ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTag('all')}>Show all news</button> : undefined}>
            {tag === 'all' ? 'Check back soon.' : undefined}
          </EmptyState>
        ) : (
          <div className="stack stack-sm">
            {filtered.slice(0, shown).map(article => (
              <Link key={article.id} href={article.href} className="glass-panel glass-panel-interactive news-list-item">
                <CoverImage
                  width={96} height={96}
                  src={article.cover_image_url || club.banner_url || undefined}
                  alt=""
                  crestUrl={club.logo_url || undefined}
                  style={{ width: '96px', height: '96px', borderRadius: '10px', flexShrink: 0 }}
                />
                <div style={{ minWidth: 0 }}>
                  {!!article.tags?.length && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.3rem' }}>
                      {article.tags.slice(0, 2).map(t => (
                        <span key={t} className="badge" style={{ fontSize: '0.68rem', background: 'rgba(var(--tint-rgb), 0.07)' }}>{t}</span>
                      ))}
                    </div>
                  )}
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.3, margin: '0 0 0.25rem' }}>{article.title}</h2>
                  {article.summary && <p className="text-note news-list-summary" style={{ margin: '0 0 0.25rem' }}>{article.summary}</p>}
                  <span className="text-meta"><LocalTime value={article.published_at} /></span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {filtered.length > shown && (
          <button type="button" className="btn btn-secondary" style={{ marginTop: '1.25rem' }} onClick={() => setShown(n => n + PAGE)}>
            Show older news
          </button>
        )}
    </ClubSubPage>
  );
}
