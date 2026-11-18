'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import SeasonReviewPaper from '@/components/SeasonReviewPaper';
import { CLUB, isSeasonReview, type SeasonReview } from '@/lib/season-review';
import { formatDate } from '@/lib/dates';
import { loadSharedSeasonReview, type SharedClub } from '@/lib/use-season-review';

// A season review behind a share link (migration 20261179). The token in the address is the only
// key. It shows the copy the committee saved, which has none of their notes, and the money summary
// only if they left it in. Parents can pick their own team.

interface Shared { report: SeasonReview; sharedAt: string; club: SharedClub }

export default function SharedSeasonReviewPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === 'string' ? params.token : '';
  // undefined: still loading. null: nothing behind this link.
  const [shared, setShared] = useState<Shared | null | undefined>(undefined);
  const [team, setTeam] = useState(CLUB);

  useEffect(() => {
    let live = true;
    void loadSharedSeasonReview(token).catch(() => null).then(hit => {
      if (live) setShared(hit && isSeasonReview(hit.report) ? { report: { ...hit.report, committee: false }, sharedAt: hit.shared_at, club: hit.club } : null);
    });
    return () => { live = false; };
  }, [token]);

  return (
    <main style={{ minHeight: '100vh', padding: 'clamp(1rem, 4vw, 2.5rem) clamp(0.75rem, 3vw, 2rem)' }}>
      {shared === undefined ? (
        <p role="status" style={{ textAlign: 'center', color: 'var(--color-muted)' }}>Opening the review…</p>
      ) : shared === null ? (
        <div className="glass-panel" style={{ maxWidth: 460, margin: '12vh auto 0', padding: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.3rem', margin: '0 0 0.5rem' }}>This review isn&apos;t shared any more</h1>
          <p style={{ margin: '0 0 1.25rem', color: 'var(--color-muted)' }}>The link may have been stopped, or part of it is missing. Ask the club for a new one.</p>
          <Link href="/" className="btn btn-secondary btn-sm">itsfootball.club</Link>
        </div>
      ) : (
        <>
          {shared.report.teams.length > 1 && (
            <nav aria-label="Team" style={{ maxWidth: 860, margin: '0 auto 1rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {[{ id: CLUB, name: 'Whole club' }, ...shared.report.teams].map(t => (
                <button key={t.id} type="button" className={`btn btn-sm ${team === t.id ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={team === t.id} onClick={() => setTeam(t.id)}>{t.name}</button>
              ))}
            </nav>
          )}
          <SeasonReviewPaper
            review={shared.report}
            team={team}
            colour={shared.club.primary_color}
            logoUrl={shared.club.logo_url}
            footer={`Shared by ${shared.club.name || shared.report.club} on ${formatDate(shared.sharedAt)}`}
          />
          <p style={{ maxWidth: 860, margin: '1rem auto 0', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>Print or save as PDF</button>
            {shared.club.slug && <Link href={`/${shared.club.slug}`} className="btn btn-secondary btn-sm">Visit {shared.club.name}</Link>}
          </p>
        </>
      )}
    </main>
  );
}
