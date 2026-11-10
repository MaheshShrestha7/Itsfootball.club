'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Club, InquiryType } from '@/lib/supabase/types';
import { useClub } from '@/lib/club-context';
import { Mail, CheckCircle2, Send, X, Handshake } from 'lucide-react';
import { useDialog } from '@/lib/use-escape-to-close';
import FriendlyInviteFields, { emptyFriendlyForm, friendlyPayload, type FriendlyForm, type VisitorClub } from '@/components/FriendlyInviteFields';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import { FRIENDLY_TYPE, invitableTeams } from '@/lib/friendlies';
import Captcha, { captchaError, type CaptchaHandle } from '@/components/Captcha';

interface ContactModalProps {
  club: Club;
  isOpen: boolean;
  onClose: () => void;
  defaultType?: InquiryType;
  /** What the message is about, e.g. the event page it was sent from. Shown in the club's Inbox. */
  about?: string;
  /** A friendly invitation for this team (the team page's "Invite us to a friendly") */
  defaultTeamId?: string;
}

export default function ContactModal({ club, isOpen, onClose, defaultType = 'General Inquiry', about, defaultTeamId }: ContactModalProps) {
  const { submitInquiry, clubTeams } = useClub();
  // Teams taking friendly invitations (none until migration 20261157, so the choice stays hidden)
  const openTeams = useMemo(() => invitableTeams(clubTeams, club.id), [clubTeams, club.id]);
  const startTeam = openTeams.find(t => t.id === defaultTeamId) || (openTeams.length === 1 ? openTeams[0] : undefined);
  const [friendly, setFriendly] = useState<FriendlyForm>(() => emptyFriendlyForm(startTeam));
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [inquiryType, setInquiryType] = useState<InquiryType>(defaultType);
  const [message, setMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  // Signed in and running another club's fixtures: the invitation can come from that club, so the
  // game can go on both clubs' sites once it's on (checked again by /api/contact)
  const { user, can } = useAuth();
  const [myClubs, setMyClubs] = useState<VisitorClub[]>([]);
  const myClubIds = user ? Object.keys(user.club_roles).filter(id => id !== club.id && can(id, 'matches', 'edit')).sort().join(',') : '';
  useEffect(() => {
    const db = getSupabaseClient();
    if (!isOpen || !myClubIds || !db) return;
    let stale = false;
    db.from('clubs').select('id, name, logo_url').in('id', myClubIds.split(',')).eq('is_active', true).order('name')
      .then(({ data }) => {
        if (stale || !data?.length) return;
        setMyClubs(data as VisitorClub[]);
        // Starts on their club; "Another club" is still there
        setFriendly(f => (f.their_club || f.visitor_club_id ? f : { ...f, visitor_club_id: data[0].id, their_club: data[0].name }));
      });
    return () => { stale = true; };
  }, [isOpen, myClubIds]);
  useEffect(() => {
    if (!isOpen || !user) return;
    setSenderName(n => n || user.full_name || '');
    setSenderEmail(e => e || user.email || '');
  }, [isOpen, user]);

  // Honeypot: hidden from real visitors via CSS + aria-hidden; bots that fill
  // every field they find trip it, and the submission is silently dropped.
  const [website, setWebsite] = useState('');
  // Bot check (Cloudflare Turnstile); renders nothing until the site key is set
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<CaptchaHandle>(null);

  const handleResetAndClose = () => {
    setIsSubmitted(false);
    setSenderName('');
    setSenderEmail('');
    setSenderPhone('');
    setMessage('');
    setWebsite('');
    setFriendly(emptyFriendlyForm(startTeam));
    onClose();
  };

  const dialogRef = useDialog(isOpen, handleResetAndClose);

  if (!isOpen) return null;

  const isFriendly = inquiryType === FRIENDLY_TYPE && openTeams.length > 0;
  // The team the form opened on (or the only open one) once it starts empty
  const friendlyForm = !friendly.team_id && startTeam
    ? { ...emptyFriendlyForm(startTeam), visitor_club_id: friendly.visitor_club_id, their_club: friendly.their_club }
    : friendly;
  const friendlyTeam = openTeams.find(t => t.id === friendlyForm.team_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName || !senderEmail || (!message && !isFriendly)) return;
    if (isFriendly && !friendlyTeam) {
      setSendError('Pick the team you’d like to play.');
      return;
    }
    const notReady = captchaError(captchaToken);
    if (notReady) {
      setSendError(notReady);
      return;
    }

    setSending(true);
    setSendError(null);
    const result = await submitInquiry({
      club_id: club.id,
      sender_name: senderName,
      sender_email: senderEmail,
      sender_phone: senderPhone,
      inquiry_type: isFriendly ? FRIENDLY_TYPE : inquiryType === FRIENDLY_TYPE ? 'General Inquiry' : inquiryType,
      message,
    }, website, about, isFriendly && friendlyTeam
      ? { team_id: friendlyTeam.id, details: friendlyPayload(friendlyForm, friendlyTeam.name), visitor_club_id: friendlyForm.visitor_club_id || undefined }
      : undefined, captchaToken);
    setSending(false);
    captcha.current?.reset();

    if (!result.success) {
      setSendError(result.error || 'Your message could not be sent.');
      return;
    }
    setIsSubmitted(true);
  };

  // Rendered on <body>: the club home's "Get in touch" sits in a scroll-animated section (.club-reveal),
  // and its translate turns position: fixed into "fixed to that section", so the form was squashed
  // into the section and faded with the scroll instead of covering the screen.
  return createPortal(
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 999,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      justifyContent: 'center',
      overflowY: 'auto',
      padding: '1rem',
    }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="contact-modal-title" className="glass-panel" style={{
        margin: 'auto',
        width: '100%',
        maxWidth: '540px',
        background: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-xl)',
        padding: '2rem',
        boxShadow: 'var(--shadow-lg)',
        position: 'relative',
      }}>
        <div className="section-head">
          <div className="row row-loose">
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: club.primary_color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {isFriendly
                ? <Handshake size={18} color="var(--club-primary-contrast, #FFFFFF)" />
                : <Mail size={18} color="var(--club-primary-contrast, #FFFFFF)" />}
            </div>
            <div>
              <h3 id="contact-modal-title" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {isFriendly ? 'Invite us to a friendly' : `Contact ${club.name}`}
              </h3>
              <p className="text-meta">
                {isFriendly ? club.name : about ? `About: ${about}` : 'Questions, trials, sponsorship and anything else'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            aria-label="Close"
            style={{
              background: 'rgba(var(--tint-rgb), 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '44px',
              height: '44px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {isSubmitted ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '2px solid #10B981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto',
            }}>
              <CheckCircle2 size={36} color="var(--c-green)" />
            </div>
            {isFriendly ? (
              <>
                <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  Invitation sent
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>
                  Thanks{senderName.trim() ? `, ${senderName.trim().split(/\s+/)[0]}` : ''}. Your invitation for <strong>{friendlyTeam?.name}</strong> is with {club.name}.
                </p>
                <ol className="fi-next">
                  <li><span>1</span>They check your dates against their games and events.</li>
                  <li><span>2</span>They’ll pick a date, suggest another, or let you know they can’t this time, by email to <strong>{senderEmail}</strong>.</li>
                  <li><span>3</span>Once it’s on, the game appears on their fixtures with its own match page.</li>
                </ol>
              </>
            ) : (
              <>
              <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                Message Sent
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.75rem', lineHeight: 1.6 }}>
                Thanks for getting in touch with <strong>{club.name}</strong>. The committee will read your message and reply to <strong>{senderEmail}</strong>.
              </p>
              </>
            )}
            <button onClick={handleResetAndClose} className="btn btn-primary">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Honeypot field: real visitors never see this (off-screen + aria-hidden) */}
            <div style={{ position: 'absolute', left: '-9999px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' }} aria-hidden="true">
              <label htmlFor="contact-website">Website</label>
              <input
                id="contact-website"
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={e => setWebsite(e.target.value)}
              />
            </div>

            {isFriendly && (
              <>
                {!defaultTeamId && (
                  <div className="form-group">
                    <label htmlFor="contactmodal-inquiry-purpose" className="form-label">What&apos;s it about?</label>
                    <select id="contactmodal-inquiry-purpose" className="form-select" value={inquiryType}
                      onChange={e => setInquiryType(e.target.value as InquiryType)}>
                      <option value="General Inquiry">General question</option>
                      <option value="Player Trial">Playing for the club / trial</option>
                      <option value="Sponsorship">Sponsorship</option>
                      <option value="Youth Academy">Juniors / kids&apos; football</option>
                      <option value="Media Request">Media / press</option>
                      <option value="Friendly Match">Friendly match invitation</option>
                    </select>
                  </div>
                )}
                <FriendlyInviteFields teams={openTeams} value={friendlyForm} onChange={setFriendly} crest={club.logo_url || undefined} lockTeam={!!defaultTeamId} myClubs={myClubs} />
              </>
            )}

            <div className="form-row-2" style={{ gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="contactmodal-your-full-name" className="form-label">Your Full Name *</label>
                <input autoComplete="name" id="contactmodal-your-full-name"
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Leo Hernandez"
                  value={senderName}
                  onChange={e => setSenderName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="contactmodal-email-address" className="form-label">Email Address *</label>
                <input autoComplete="email" id="contactmodal-email-address"
                  type="email"
                  required
                  className="form-input"
                  placeholder="leo@example.com"
                  value={senderEmail}
                  onChange={e => setSenderEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-row-2" style={{ gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="contactmodal-phone-number-optional" className="form-label">Phone Number (Optional)</label>
                <input autoComplete="tel" id="contactmodal-phone-number-optional"
                  type="tel"
                  className="form-input"
                  placeholder="e.g. 0400 000 000"
                  value={senderPhone}
                  onChange={e => setSenderPhone(e.target.value)}
                />
              </div>

              {!isFriendly && (
                <div className="form-group">
                  <label htmlFor="contactmodal-inquiry-purpose" className="form-label">What&apos;s it about?</label>
                  <select id="contactmodal-inquiry-purpose"
                    className="form-select"
                    value={inquiryType}
                    onChange={e => setInquiryType(e.target.value as InquiryType)}
                  >
                    <option value="General Inquiry">General question</option>
                    <option value="Player Trial">Playing for the club / trial</option>
                    <option value="Sponsorship">Sponsorship</option>
                    <option value="Youth Academy">Juniors / kids&apos; football</option>
                    <option value="Media Request">Media / press</option>
                    {(openTeams.length > 0 || inquiryType === FRIENDLY_TYPE) && <option value="Friendly Match">Friendly match invitation</option>}
                  </select>
                  {inquiryType === 'Sponsorship' && (
                    <a href={`/${club.slug}/sponsor`} style={{ display: 'block', marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--club-ink)', fontWeight: 700 }}>
                      See sponsorship packages and sign up online →
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="contactmodal-detailed-message" className="form-label">{isFriendly ? 'Anything else? (optional)' : 'Your Message *'}</label>
              <textarea id="contactmodal-detailed-message"
                required={!isFriendly}
                rows={isFriendly ? 2 : 4}
                maxLength={isFriendly ? 1500 : undefined}
                className="form-textarea"
                placeholder={isFriendly ? 'e.g. what you’re building up for, kit colours' : 'How can the club help?'}
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </div>

            <div style={{ marginTop: '1rem' }}>
              <Captcha ref={captcha} onToken={setCaptchaToken} />
            </div>

            {sendError && (
              <div role="alert" style={{ marginTop: '1rem', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid #EF4444', background: 'rgba(239, 68, 68, 0.12)', color: 'var(--c-red)', fontSize: '0.8rem' }}>
                {sendError}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1.5rem' }}>
              <div className="text-meta" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                Club Office: {club.contact_email}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginLeft: 'auto' }}>
                <button type="button" onClick={handleResetAndClose} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" disabled={sending} className="btn btn-primary btn-sm row">
                  <Send size={14} /> {sending ? 'Sending...' : isFriendly ? 'Send invitation' : 'Send Message'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
