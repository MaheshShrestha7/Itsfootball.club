'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ClipboardList, Heart, Megaphone, Shield, User, UsersRound, X } from 'lucide-react';

// "Find your part": each role opens a short card of real features (every line maps to something built)
const ROLES = [
  {
    tab: 'Coach', Icon: ClipboardList, title: 'Pick your team without chasing the group chat.',
    points: ['Players answer In or Out for every game', 'Drag your squad onto the pitch and share the lineup', 'Score the game live from the touchline'],
    cta: { label: 'Start your club free', href: '/create-club' }, faq: { label: 'Coach questions', href: '/faq#managers-coaches' },
  },
  {
    tab: 'Committee', Icon: Shield, title: 'Members and money in one place.',
    points: ['Approve members and collect fees online', 'Log what comes in and goes out in Finance', 'Sponsors, shop orders and messages land in one admin'],
    cta: { label: 'Start your club free', href: '/create-club' }, faq: { label: 'Committee questions', href: '/faq#club-officials' },
  },
  {
    tab: 'Player', Icon: User, title: 'Your pass and your stats.',
    points: ['Tell your coach if you can play, in one tap', 'A QR member pass on your phone', 'Your goals and assists on your own player page'],
    cta: { label: 'Find your club', href: '/clubs' }, faq: { label: 'Player questions', href: '/faq#players' },
  },
  {
    tab: 'Parent', Icon: UsersRound, title: 'All your kids, one app.',
    points: ['Answer In or Out for each of your children', 'Their games, messages and fees together', 'Junior names show as first name and initial in public'],
    cta: { label: 'Find your club', href: '/clubs' }, faq: null,
  },
  {
    tab: 'Supporter', Icon: Heart, title: 'Never miss a goal.',
    points: ['Goals and cards on the match page as they happen', 'No app to install', 'Fixtures straight into your calendar'],
    cta: { label: 'Find your club', href: '/clubs' }, faq: { label: 'Supporter questions', href: '/faq#supporters' },
  },
  {
    tab: 'Sponsor', Icon: Megaphone, title: 'See what your money did.',
    points: ['Apply on the club’s Sponsor page, free', 'Your logo on the club site and match pages', 'The club can send you a report of where you were seen'],
    cta: { label: 'Find a club to back', href: '/clubs' }, faq: { label: 'Sponsor questions', href: '/faq#sponsors' },
  },
] as const;

export default function RoleCards() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [idx, setIdx] = useState(0);
  const role = ROLES[idx];

  return (
    <>
      <div className="mw-roles lp-live-roles" role="group" aria-label="What you get, by role">
        <span>Find your part</span>
        {ROLES.map((r, i) => (
          <button key={r.tab} type="button" className="mw-role" aria-haspopup="dialog"
            onClick={() => { setIdx(i); dialog.current?.showModal(); }}>
            <r.Icon size={16} aria-hidden="true" />{r.tab}
          </button>
        ))}
      </div>

      {/* Native modal dialog sits in the top layer, so scroll-animated parents can't trap it */}
      <dialog ref={dialog} className="rc-dialog" aria-labelledby="rc-title"
        onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
        <div className="rc-card">
          <div className="rc-head">
            <span className="rc-icon"><role.Icon size={20} aria-hidden="true" /></span>
            <span className="rc-for">For {role.tab === 'Committee' ? 'the committee' : role.tab === 'Coach' ? 'coaches' : `${role.tab.toLowerCase()}s`}</span>
            <button type="button" className="rc-close" onClick={() => dialog.current?.close()} aria-label="Close"><X size={18} /></button>
          </div>
          <h3 id="rc-title" className="rc-title">{role.title}</h3>
          <ul className="rc-points">
            {role.points.map(p => <li key={p}><Check size={16} aria-hidden="true" />{p}</li>)}
          </ul>
          <div className="rc-actions">
            <Link href={role.cta.href} className="rc-cta">{role.cta.label}<ArrowRight size={16} aria-hidden="true" /></Link>
            {role.faq && <Link href={role.faq.href} className="rc-faq">{role.faq.label}</Link>}
          </div>
          <nav className="rc-switch" aria-label="Other roles">
            {ROLES.map((r, i) => (
              <button key={r.tab} type="button" className={i === idx ? 'is-on' : ''} aria-pressed={i === idx} onClick={() => setIdx(i)}>
                <r.Icon size={14} aria-hidden="true" />{r.tab}
              </button>
            ))}
          </nav>
        </div>
      </dialog>
    </>
  );
}
