'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, Copy, X, ArrowRight } from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isPlayerMember } from '@/lib/supabase/types';

const DISMISS_KEY = (clubId: string) => `itsfootball_setup_dismissed_${clubId}`;
const SHARED_KEY = (clubId: string) => `itsfootball_setup_shared_${clubId}`;

function readFlag(key: string): boolean {
  try { return localStorage.getItem(key) === '1'; } catch { return false; }
}
function writeFlag(key: string) {
  try { localStorage.setItem(key, '1'); } catch { /* private mode: it just shows again */ }
}

/**
 * "What to do next" for a new club's dashboard. Each step ticks itself off from the club's data,
 * and the panel goes away once everything is done (or the admin hides it).
 */
export default function GettingStartedChecklist({ clubId, clubSlug }: { clubId: string; clubSlug: string }) {
  const { seasons, clubTeams, clubTeamMembers, members, matches } = useClub();
  const [plansCount, setPlansCount] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [sharedFlag, setShared] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDismissed(readFlag(DISMISS_KEY(clubId)));
    setShared(readFlag(SHARED_KEY(clubId)));
  }, [clubId]);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;
    client.from('membership_plans').select('id', { count: 'exact', head: true }).eq('club_id', clubId)
      .then(({ count }) => setPlansCount(count ?? 0));
  }, [clubId]);

  const clubTeamIds = new Set(clubTeams.filter(t => t.club_id === clubId).map(t => t.id));
  // Someone already applied through the join page: the link is out there
  const shared = sharedFlag || members.some(m => m.club_id === clubId && !!m.applied_at);
  const steps = [
    {
      label: 'Set up your season',
      hint: 'Name it and set the start and end dates.',
      href: `/${clubSlug}/admin/seasons`,
      done: seasons.some(s => s.club_id === clubId),
    },
    {
      label: 'Add membership plans',
      hint: 'What players and supporters pay to join. Found in Finance, Settings.',
      href: `/${clubSlug}/admin/finance?tab=settings`,
      done: (plansCount ?? 0) > 0,
    },
    {
      label: 'Set up your teams',
      hint: 'Seniors, juniors and age groups.',
      href: `/${clubSlug}/admin/teams`,
      done: clubTeamIds.size > 1 || clubTeamMembers.some(tm => clubTeamIds.has(tm.team_id)),
    },
    {
      label: 'Add your players',
      hint: 'One by one, by CSV, or share your join link.',
      href: `/${clubSlug}/admin/members`,
      done: members.some(m => m.club_id === clubId && isPlayerMember(m)),
    },
    {
      label: 'Schedule your first fixture',
      hint: 'It shows on your website straight away.',
      href: `/${clubSlug}/admin/matches`,
      done: matches.some(m => m.club_id === clubId),
    },
  ];

  const allDone = steps.every(s => s.done) && shared;
  // Wait for the plans count so the list doesn't flash for a club that is already set up
  if (dismissed || allDone || plansCount === null) return null;

  const doneCount = steps.filter(s => s.done).length + (shared ? 1 : 0);
  const total = steps.length + 1;

  const shareLink = async () => {
    const url = `${window.location.origin}/${clubSlug}`;
    try { await navigator.clipboard?.writeText(url); } catch { /* still counts as shared */ }
    writeFlag(SHARED_KEY(clubId));
    setShared(true);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const row = (done: boolean, children: React.ReactNode, key: string) => (
    <li key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem', padding: '0.7rem 0.85rem', borderRadius: '10px', background: 'rgba(var(--tint-rgb), 0.03)', border: '1px solid var(--border-subtle)', opacity: done ? 0.7 : 1 }}>
      <span style={{ color: done ? 'var(--c-green)' : 'var(--text-muted)', flexShrink: 0, marginTop: '0.1rem' }}>
        {done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
      </span>
      {children}
    </li>
  );

  return (
    <section className="glass-panel" aria-labelledby="getting-started-title" style={{ padding: '1.5rem', marginBottom: '2rem', borderColor: 'var(--club-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <h2 id="getting-started-title" style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Get your club ready
          </h2>
          <p className="text-meta" style={{ marginTop: '0.25rem' }}>
            {doneCount} of {total} done. Each step ticks itself off when it&apos;s set up.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { writeFlag(DISMISS_KEY(clubId)); setDismissed(true); }}
          className="btn btn-secondary btn-sm"
          aria-label="Hide the getting-started list"
          title="Hide this list"
        >
          <X size={14} /> Hide
        </button>
      </div>

      <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={doneCount} aria-label="Setup progress"
        style={{ height: '6px', borderRadius: '99px', background: 'rgba(var(--tint-rgb), 0.08)', overflow: 'hidden', marginBottom: '1rem' }}>
        <div style={{ width: `${(doneCount / total) * 100}%`, height: '100%', background: 'var(--club-primary)', transition: 'width 0.4s ease' }} />
      </div>

      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
        {steps.map(s => row(s.done, (
          <Link href={s.href} style={{ flex: 1, minWidth: 0, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <span>
              <span style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', textDecoration: s.done ? 'line-through' : 'none' }}>{s.label}</span>
              <span className="text-meta">{s.hint}</span>
            </span>
            {!s.done && <ArrowRight size={16} color="var(--club-ink)" style={{ flexShrink: 0 }} />}
          </Link>
        ), s.label))}
        {row(shared, (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span>
              <span style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', textDecoration: shared ? 'line-through' : 'none' }}>Share your club link</span>
              <span className="text-meta">Send it to players and parents so they can join.</span>
            </span>
            <button type="button" onClick={shareLink} className="btn btn-secondary btn-sm">
              <Copy size={14} /> {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        ), 'share')}
      </ol>
    </section>
  );
}
