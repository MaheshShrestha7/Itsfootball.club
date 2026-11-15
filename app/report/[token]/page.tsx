'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import CupReportPaper from '@/components/CupReportPaper';
import { isCupReport, type CupReport } from '@/lib/cup-report';
import { formatDate } from '@/lib/dates';
import { loadSharedCupReport } from '@/lib/use-match-reviews';

// A tournament report behind a share link (migration 20261174). The token in the address is the
// only key. It shows the copy the coach saved when they shared it: the squad version, which has no
// minutes and none of the coach's notes for next time.

interface Shared { report: CupReport; sharedAt: string; club: { name: string; slug: string; logo_url?: string | null; primary_color?: string | null } }

export default function SharedReportPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === 'string' ? params.token : '';
  // undefined: still loading. null: nothing behind this link.
  const [shared, setShared] = useState<Shared | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    void loadSharedCupReport(token).catch(() => null).then(hit => {
      if (live) setShared(hit && isCupReport(hit.report) ? { report: hit.report, sharedAt: hit.shared_at, club: hit.club } : null);
    });
    return () => { live = false; };
  }, [token]);

  return (
    <main style={{ minHeight: '100vh', padding: 'clamp(1rem, 4vw, 2.5rem) clamp(0.75rem, 3vw, 2rem)' }}>
      {shared === undefined ? (
        <p role="status" style={{ textAlign: 'center', color: 'var(--color-muted)' }}>Opening the report…</p>
      ) : shared === null ? (
        <div className="glass-panel" style={{ maxWidth: 460, margin: '12vh auto 0', padding: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.3rem', margin: '0 0 0.5rem' }}>This report isn&apos;t shared any more</h1>
          <p style={{ margin: '0 0 1.25rem', color: 'var(--color-muted)' }}>The link may have been stopped, or part of it is missing. Ask the coach who sent it for a new one.</p>
          <Link href="/" className="btn btn-secondary btn-sm">itsfootball.club</Link>
        </div>
      ) : (
        <>
          <CupReportPaper
            report={shared.report}
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
