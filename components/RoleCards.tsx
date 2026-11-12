'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ClipboardList, Heart, Megaphone, Shield, User, UsersRound, X } from 'lucide-react';

// "Find your part": each role opens a short card of real features (every line maps to something built)
const ROLES = [
  {
    tab: 'Coach', Icon: ClipboardList, title: 'Pick your team without chasing the group chat.',
    points: ['Share one link and players tap In or Out', 'Drag who’s in onto the pitch and publish the XI', 'Log goals, cards and subs from the touchline so supporters follow live'],
    cta: { label: 'Start your club free', href: '/create-club' }, faq: { label: 'Coach questions', href: '/faq#managers-coaches' },
  },
  {
    tab: 'Committee', Icon: Shield, title: 'Members and money in one place.',
    points: ['Your own club website with your crest, colours and web address. No developer needed', 'Membership plans paid by card or bank transfer', 'One ledger for income and expenses', 'A QR pass for every member, checked in at the gate or door'],
    cta: { label: 'Start your club free', href: '/create-club' }, faq: { label: 'Committee questions', href: '/faq#club-officials' },
  },
  {
    tab: 'Player', Icon: User, title: 'Your pass and your stats.',
    points: ['Tap In or Out from the link your coach shares', 'A QR member pass for gate or door check-in', 'Your goals and assists on your own player page'],
    cta: { label: 'Find your club', href: '/clubs' }, faq: { label: 'Player questions', href: '/faq#players' },
  },
  {
    tab: 'Parent', Icon: UsersRound, title: 'All your kids, one app.',
    points: ['Tap In or Out for each of your children', 'Pay their membership by card or bank transfer', 'Junior names show as first name and initial in public'],
    cta: { label: 'Find your club', href: '/clubs' }, faq: null,
  },
  {
    tab: 'Supporter', Icon: Heart, title: 'Never miss a goal.',
    points: ['Follow goals, cards and subs live, with no app to install', 'Fixtures, squad, news and events on the club’s own site', 'Fixtures straight into your calendar'],
    cta: { label: 'Find your club', href: '/clubs' }, faq: { label: 'Supporter questions', href: '/faq#supporters' },
  },
  {
    tab: 'Sponsor', Icon: Megaphone, title: 'See what your money did.',
    points: ['Apply on the club’s Sponsor page, free', 'Every time your logo is seen and clicked is tracked', 'A report the club can export for you at renewal time'],
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
            {role.faq && <a href={role.faq.href} className="rc-faq" target="_blank" rel="noopener">{role.faq.label}<span className="sr-only"> (opens in a new tab)</span></a>}
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
