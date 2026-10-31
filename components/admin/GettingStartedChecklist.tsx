'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, Copy, X } from 'lucide-react';
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
      href: `/${clubSlug}/admin/people`,
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

  return (
    <section className="admin-panel" aria-labelledby="getting-started-title">
      <div className="admin-panel-head">
        <div>
          <h2 id="getting-started-title">Get your club ready</h2>
          <p className="admin-meta">{doneCount} of {total} done. Each step ticks itself off when it&apos;s set up.</p>
        </div>
        <button
          type="button"
          onClick={() => { writeFlag(DISMISS_KEY(clubId)); setDismissed(true); }}
          className="admin-quiet-btn"
          aria-label="Hide the getting-started list"
        >
          <X size={14} aria-hidden="true" /> Hide
        </button>
      </div>

      <div className="admin-setup">
        <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={doneCount} aria-label="Setup progress" className="admin-setup-bar">
          <span style={{ transform: `scaleX(${doneCount / total})` }} />
        </div>

        <ol className="admin-setup-steps">
          {steps.map(s => (
            <li key={s.label} className={s.done ? 'is-done' : undefined}>
              <Link href={s.href}>
                {s.done ? <CheckCircle2 size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}
                <span className="admin-step-text">
                  <b>{s.label}{s.done && <span className="sr-only"> (done)</span>}</b>
                  <small>{s.hint}</small>
                </span>
              </Link>
            </li>
          ))}
          <li className={shared ? 'is-done' : undefined}>
            <div>
              {shared ? <CheckCircle2 size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}
              <span className="admin-step-text">
                <b>Share your club link{shared && <span className="sr-only"> (done)</span>}</b>
                <small>Send it to players and parents so they can join.</small>
              </span>
              <button type="button" onClick={shareLink} className="btn btn-secondary btn-sm">
                <Copy size={14} aria-hidden="true" /> {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          </li>
        </ol>
      </div>
    </section>
  );
}
