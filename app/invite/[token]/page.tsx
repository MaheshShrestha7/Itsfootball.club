'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Check, Lock } from 'lucide-react';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';
import Captcha, { captchaError, type CaptchaHandle } from '@/components/Captcha';
import { AuthAlert, InboxSent } from '@/components/auth/AuthBits';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseClient } from '@/lib/supabase/client';
import { authReturnUrl } from '@/lib/slugs';

// An Owner / Club Admin invite from Mission Control (migration 20261160). The link's token is the
// only key: the page shows what it's for, signs the person in with the invited email (a one-time
// link also creates the account), and accepts. The database checks the email matches.

interface Invite {
  club_name: string;
  club_slug: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  role: 'owner' | 'admin';
  email: string;
  state: 'open' | 'expired' | 'accepted' | 'cancelled' | 'closed';
  expires_at: string;
  accepted_by_me: boolean;
}

const roleName = (r: Invite['role']) => (r === 'owner' ? 'Owner' : 'Club Admin');

function Crest({ invite }: { invite: Invite }) {
  const initials = invite.club_name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'FC';
  return invite.logo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={invite.logo_url} alt="" width={64} height={64} style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 14, display: 'block', margin: '0 auto 0.9rem' }} />
  ) : (
    <div aria-hidden="true" style={{
      width: 64, height: 64, borderRadius: 14, margin: '0 auto 0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: invite.primary_color || 'var(--club-primary)', border: `3px solid ${invite.secondary_color || 'rgba(255,255,255,0.4)'}`,
      color: '#fff', fontWeight: 900, fontSize: '1.3rem',
    }}>{initials}</div>
  );
}

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === 'string' ? params.token : '';
  const router = useRouter();
  const { user, isLoading: authLoading, logout, refreshRoles } = useAuth();

  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<CaptchaHandle>(null);

  const load = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client || token.length < 32) {
      setLoading(false);
      return;
    }
    const { data } = await client.rpc('get_club_admin_invite', { p_token: token });
    setInvite(((Array.isArray(data) ? data[0] : data) as Invite | null) || null);
    setLoading(false);
  }, [token]);

  // Again once signed in, so "accepted by me" is right
  useEffect(() => { load(); }, [load, user?.id]);

  const sendLink = async () => {
    if (!invite) return;
    setError(null);
    const client = getSupabaseClient();
    if (!client) return setError('Sign-in is unavailable right now.');
    const notReady = captchaError(captchaToken);
    if (notReady) return setError(notReady);
    setSending(true);
    const { error: err } = await client.auth.signInWithOtp({
      email: invite.email,
      options: { emailRedirectTo: authReturnUrl(window.location.origin, `/invite/${token}`), captchaToken: captchaToken || undefined },
    });
    setSending(false);
    captcha.current?.reset();
    if (err) {
      const m = err.message.toLowerCase();
      return setError(m.includes('captcha') ? 'The security check failed or expired. Please try again.'
        : m.includes('rate') ? 'Too many requests. Please wait a minute and try again.' : 'Could not send the sign-in link. Please try again.');
    }
    setSentTo(invite.email);
  };

  const accept = async () => {
    const client = getSupabaseClient();
    if (!client || !invite) return;
    setError(null);
    setAccepting(true);
    const { data, error: err } = await client.rpc('accept_club_admin_invite', { p_token: token });
    if (err) {
      setAccepting(false);
      setError(err.message);
      load();
      return;
    }
    const row = (Array.isArray(data) ? data[0] : data) as { club_slug: string } | null;
    await refreshRoles();
    setAccepting(false);
    setAccepted(true);
    setTimeout(() => router.push(`/${row?.club_slug || invite.club_slug}/admin`), 1800);
  };

  const signedInAs = user?.email?.toLowerCase() || '';
  const emailMatches = !!invite && signedInAs === invite.email;

  let body: React.ReactNode;
  if (loading || authLoading) {
    body = <p className="text-meta" style={{ textAlign: 'center', margin: 0 }}>Loading the invite…</p>;
  } else if (!invite) {
    body = (
      <>
        <h1 className="invite-title">This invite link isn&rsquo;t valid</h1>
        <p className="invite-lead">It may have been mistyped, or replaced by a newer invite. Ask the person who invited you to send a new one.</p>
      </>
    );
  } else if (accepted || (invite.state === 'accepted' && invite.accepted_by_me)) {
    body = (
      <>
        <Crest invite={invite} />
        <h1 className="invite-title">Welcome to {invite.club_name}</h1>
        <p className="invite-lead">You&rsquo;re now {invite.role === 'owner' ? 'the Owner' : 'a Club Admin'} of {invite.club_name}.{accepted ? ' Taking you to the club admin…' : ''}</p>
        <a className="btn btn-primary" href={`/${invite.club_slug}/admin`} style={{ width: '100%', justifyContent: 'center' }}>Open the club admin</a>
      </>
    );
  } else if (invite.state !== 'open') {
    const why = {
      accepted: 'This invite has already been used.',
      cancelled: 'This invite was cancelled.',
      expired: 'This invite has expired.',
      closed: 'This club is closing, so the invite can’t be used.',
      open: '',
    }[invite.state];
    body = (
      <>
        <Crest invite={invite} />
        <h1 className="invite-title">Run {invite.club_name}</h1>
        <AuthAlert kind="error">{why} Ask the person who invited you to send a new one.</AuthAlert>
      </>
    );
  } else if (sentTo) {
    body = (
      <InboxSent email={sentTo} onResend={sendLink} resendBusy={sending} onChangeEmail={() => setSentTo(null)}
        extra={<>
          <div style={{ marginTop: '1rem' }}><Captcha ref={captcha} onToken={setCaptchaToken} /></div>
          {error && <div style={{ marginTop: '0.75rem' }}><AuthAlert kind="error">{error}</AuthAlert></div>}
        </>}>
        We&apos;ve sent a sign-in link to <strong style={{ color: 'var(--text-primary)' }}>{sentTo}</strong>. Open it on this device and you&apos;ll come back here to accept the invite.
      </InboxSent>
    );
  } else {
    body = (
      <>
        <Crest invite={invite} />
        <h1 className="invite-title">Run {invite.club_name}</h1>
        <p className="invite-lead">You&rsquo;ve been invited to be {invite.role === 'owner' ? 'the' : 'a'} <b style={{ color: 'var(--text-primary)' }}>{roleName(invite.role)}</b> of {invite.club_name} on itsfootball.club.</p>
        <ul className="invite-facts">
          <li><Check size={15} aria-hidden="true" /> {invite.role === 'owner' ? 'Full access to the club’s admin: website, fixtures, money, members.' : 'Access to the club’s admin: website, fixtures, money, members.'}</li>
          <li><Check size={15} aria-hidden="true" /> You don&rsquo;t join the club and there&rsquo;s no membership fee.</li>
          <li><Check size={15} aria-hidden="true" /> Your name won&rsquo;t show in the squad, members or People lists.</li>
        </ul>

        {user && !emailMatches ? (
          <>
            <div className="invite-warn" role="alert">
              <b>This invite is for {invite.email}.</b> You&rsquo;re signed in as {signedInAs || 'another account'}. Sign out and sign back in with the invited email to accept it.
            </div>
            <button type="button" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => logout()}>Sign out and switch account</button>
          </>
        ) : user ? (
          <>
            {error && <div style={{ marginBottom: '0.75rem' }}><AuthAlert kind="error">{error}</AuthAlert></div>}
            <button type="button" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={accepting} onClick={accept}>
              {accepting ? 'Accepting…' : `Accept and become ${invite.role === 'owner' ? 'the Owner' : 'a Club Admin'}`}
            </button>
            <p className="text-meta" style={{ textAlign: 'center', margin: '0.6rem 0 0' }}>Signed in as {signedInAs}</p>
          </>
        ) : (
          <>
            <div className="invite-locked"><Lock size={14} aria-hidden="true" /> {invite.email}</div>
            {error && <div style={{ marginBottom: '0.75rem' }}><AuthAlert kind="error">{error}</AuthAlert></div>}
            <button type="button" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={sending} onClick={sendLink}>
              {sending ? 'Sending…' : 'Email me a sign-in link'}
            </button>
            <p className="text-meta" style={{ textAlign: 'center', margin: '0.6rem 0 0' }}>
              New here? The same link creates your free account. Have a password?{' '}
              <button type="button" className="auth-link" onClick={() => setPasswordOpen(true)}>Sign in with it</button>
            </p>
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}><Captcha ref={captcha} onToken={setCaptchaToken} /></div>
          </>
        )}
      </>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-pitch)' }}>
      <PlatformNavbar />
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1rem' }}>
        <section className="glass-panel invite-card">{body}</section>
      </main>
      <Footer />
      <AuthModal isOpen={passwordOpen} onClose={() => setPasswordOpen(false)} redirectTo={`/invite/${token}`} allowSignup={false} />
      <style>{`
        .invite-card { width: 100%; max-width: 460px; padding: 1.75rem 1.5rem; text-align: center; }
        .invite-title { font-family: var(--font-heading); font-size: 1.45rem; font-weight: 900; margin: 0 0 0.45rem; }
        .invite-lead { color: var(--text-secondary); font-size: 0.92rem; line-height: 1.55; margin: 0 0 1.1rem; }
        .invite-facts { list-style: none; text-align: left; display: flex; flex-direction: column; gap: 0.55rem; margin: 0 0 1.2rem; padding: 0.9rem 1rem; border: 1px solid var(--border-subtle); border-radius: 12px; background: rgba(var(--tint-rgb), 0.03); }
        .invite-facts li { display: flex; gap: 0.55rem; align-items: flex-start; font-size: 0.85rem; color: var(--text-primary); line-height: 1.45; }
        .invite-facts svg { color: var(--c-green); margin-top: 2px; flex-shrink: 0; }
        .invite-locked { display: flex; align-items: center; gap: 0.5rem; justify-content: center; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.8rem; word-break: break-all; }
        .invite-warn { text-align: left; font-size: 0.84rem; line-height: 1.5; padding: 0.8rem 0.95rem; border-radius: 12px; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); color: var(--text-primary); margin-bottom: 1rem; }
        .invite-warn b { color: var(--c-amber); }
      `}</style>
    </div>
  );
}
