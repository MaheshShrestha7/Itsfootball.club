'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, CalendarDays, CheckCircle2, Circle, Flag, Globe, Handshake, KeyRound, MapPin, Plus, ShoppingBag,
} from 'lucide-react';
import { useClub } from '@/lib/club-context';
import { useAuth } from '@/lib/auth-context';
import { getAccessToken } from '@/lib/supabase/client';
import { useWelcomePack } from '@/lib/use-welcome-pack';
import { isStepDone, type PackStep } from '@/lib/welcome-pack';
import { SITE_URL } from '@/lib/slugs';

const SITE_HOST = SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

const LATER_ICONS: Record<string, React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>> = {
  sponsors: Handshake, shop: ShoppingBag, events: CalendarDays, domain: Globe, twostep: KeyRound,
};

/**
 * "Start here": the admin welcome pack. What each setup step is, where it is in the menu and how
 * to do it, for the steps this person's access lets them do (lib/welcome-pack.ts).
 */
export default function AdminStartPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const { clubs, selectClubBySlug } = useClub();
  const { user, isClubSuperUser } = useAuth();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const { groups, later, facts, ticked, progress, setDone, ready } = useWelcomePack(club);
  const [copied, setCopied] = useState(false);
  const [mail, setMail] = useState<{ state: 'idle' | 'sending' | 'sent' | 'error'; msg?: string }>({ state: 'idle' });

  const isSuper = isClubSuperUser(club.id);
  const firstName = (user?.full_name || '').trim().split(/\s+/)[0];

  const copyLink = async () => {
    const url = `${window.location.origin}/${club.slug}`;
    try { await navigator.clipboard?.writeText(url); } catch { /* still counts as shared */ }
    setDone('share', true);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const emailMe = async () => {
    setMail({ state: 'sending' });
    const token = await getAccessToken();
    const res = await fetch('/api/admin/welcome-pack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ clubId: club.id, ticked: [...ticked] }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setMail(res?.ok ? { state: 'sent', msg: data.to ? `Sent to ${data.to}` : 'Sent' } : { state: 'error', msg: data.error || 'The email could not be sent. Please try again.' });
  };

  const badge = (s: PackStep, done: boolean) => {
    if (done && s.manual && !(s.fact && facts[s.fact])) {
      return <button type="button" className="sh-mark" data-view-ok onClick={() => setDone(s.key, false)}>Done · Undo</button>;
    }
    if (done) return <span className="sh-done">Done</span>;
    if (s.manual) return <button type="button" className="sh-mark" data-view-ok onClick={() => setDone(s.key, true)}>Mark as done</button>;
    return <span className="sh-auto">Ticks itself off</span>;
  };

  return (
    <div className="sh-page">
      <div className="admin-head">
        <div>
          <h1 className="sh-title"><Flag size={22} aria-hidden="true" /> Start here</h1>
          <p>
            Welcome{firstName ? `, ${firstName}` : ''}. {isSuper
              ? <>Here&apos;s how to get {club.name} up and running: what each step is, where to find it, and how to do it.</>
              : <>Here are the setup steps your role looks after at {club.name}: what each one is, where to find it, and how to do it.</>}
            {' '}Do them in any order. Most tick themselves off as you go.
          </p>
        </div>
        <div className="admin-head-actions">
          <button type="button" className="btn btn-secondary btn-sm" data-view-ok onClick={emailMe} disabled={mail.state === 'sending'}>
            {mail.state === 'sending' ? 'Sending…' : 'Email me this guide'}
          </button>
        </div>
      </div>
      {mail.state === 'sent' && <p className="sh-mail-note" role="status">{mail.msg}. Check your inbox.</p>}
      {mail.state === 'error' && <p className="sh-mail-note is-error" role="alert">{mail.msg}</p>}

      {groups.length === 0 ? (
        <section className="admin-panel sh-progress">
          <p>There&apos;s nothing to set up with your access. Your club&apos;s Owner or a Club Admin looks after setup.</p>
        </section>
      ) : (
        <section className="admin-panel sh-progress" aria-label="Setup progress">
          <div>
            <b>{ready ? `${progress.done} of ${progress.total} done` : 'Checking what’s done…'}</b>
            {ready && <span>{progress.next ? `Next up: ${progress.next.title}` : 'All done. Nice work.'}</span>}
          </div>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={ready ? progress.done : 0} aria-label="Setup progress" className="admin-setup-bar">
            <span style={{ transform: `scaleX(${ready && progress.total ? progress.done / progress.total : 0})` }} />
          </div>
        </section>
      )}

      {groups.map((g, gi) => (
        <section key={g.key} className="admin-panel sh-phase" aria-labelledby={`sh-${g.key}`}>
          <div className="admin-panel-head">
            <div>
              <h2 id={`sh-${g.key}`}><span className="sh-n">{gi + 1}</span> {g.title}</h2>
              <p className="admin-meta">{g.sub}</p>
            </div>
          </div>
          <ol className="sh-steps">
            {g.steps.map(s => {
              const done = ready && isStepDone(s, facts, ticked);
              const isShare = s.key === 'share';
              return (
                <li key={s.key} className={done ? 'sh-step is-done' : 'sh-step'}>
                  <div className="sh-step-top">
                    {done ? <CheckCircle2 size={18} className="sh-ico" aria-hidden="true" /> : <Circle size={18} className="sh-ico" aria-hidden="true" />}
                    <div className="sh-step-title">
                      <b>{s.title}{done && <span className="sr-only"> (done)</span>}</b>
                      <p>{s.what}</p>
                    </div>
                    {ready && badge(s, done)}
                  </div>
                  <details open={!done}>
                    <summary>How</summary>
                    <div className="sh-where">
                      <MapPin size={14} aria-hidden="true" />
                      <span>{isShare ? `Your website: ${SITE_HOST}/${club.slug}` : s.where}</span>
                    </div>
                    <ol className="sh-how">{s.how.map(h => <li key={h}>{h}</li>)}</ol>
                    {isShare ? (
                      <button type="button" className="btn btn-secondary btn-sm sh-go" data-view-ok onClick={copyLink}>
                        {copied ? 'Copied' : s.button} <ArrowRight size={14} aria-hidden="true" />
                      </button>
                    ) : (
                      <Link href={s.href(club.slug)} className="btn btn-secondary btn-sm sh-go">
                        {s.button} <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    )}
                  </details>
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      {later.length > 0 && (
        <section className="admin-panel sh-phase" aria-labelledby="sh-later">
          <div className="admin-panel-head">
            <div>
              <h2 id="sh-later"><span className="sh-n"><Plus size={14} aria-hidden="true" /></span> Later, when you&apos;re ready</h2>
              <p className="admin-meta">Nice to have. None of it is needed to get started.</p>
            </div>
          </div>
          <ul className="sh-later">
            {later.map(l => {
              const Icon = LATER_ICONS[l.key] || Plus;
              return (
                <li key={l.key}>
                  <Link href={l.href(club.slug)}>
                    <Icon size={18} aria-hidden={true} />
                    <span>
                      <b>{l.title}</b>
                      <small>{l.what}</small>
                      <small className="sh-where-s">{l.where}</small>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="sh-help">Stuck on a step? Press Contact support in the menu, or reply to your welcome email, and someone from itsfootball.club will help.</p>
    </div>
  );
}
