'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { AlertTriangle, Bell, Lock, Shield, Trash2, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useClub } from '@/lib/club-context';
import { getAccessToken, getSupabaseClient } from '@/lib/supabase/client';
import { isEventClub } from '@/lib/public-tournaments';
import { DEFAULT_CREST } from '@/lib/crest';
import { SITE_URL, authReturnUrl, isPlatformHost } from '@/lib/slugs';
import type { Club } from '@/lib/supabase/types';
import { confirmAction, notify } from '@/components/ConfirmDialog';
import { uploadImage } from '@/components/ImageUploadZone';
import TwoStepSignIn from '@/components/TwoStepSignIn';
import PushToggle from '@/components/PushToggle';
import { AuthAlert, EmailField, PasswordField } from '@/components/auth/AuthBits';

// One place for a person's own account: profile, sign-in & security, their clubs, notifications and
// deleting the account. Served at /account (itsfootball.club) and /{club}/account (inside a club's
// site, so it works on a club's own domain without signing in again). Everything here is the
// person's own Supabase auth user or rows keyed on their confirmed email: no club data is changed.

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner', admin: 'Club admin', staff: 'Staff', player: 'Player', member: 'Member', supporter: 'Supporter',
};

const SECTIONS = [
  { id: 'profile', label: 'Profile', short: 'Profile', icon: UserIcon },
  { id: 'security', label: 'Sign-in & security', short: 'Security', icon: Lock },
  { id: 'clubs', label: 'My clubs', short: 'Clubs', icon: Shield },
  { id: 'notifications', label: 'Notifications', short: 'Notifications', icon: Bell },
] as const;

function friendlyError(message: string | undefined): string {
  const m = (message || '').toLowerCase();
  if (m.includes('same') && m.includes('password')) return 'That is already your password. Choose a different one.';
  if (m.includes('weak') || m.includes('at least')) return 'Choose a longer password: at least 8 characters.';
  if (m.includes('already') && (m.includes('registered') || m.includes('exists'))) return 'Another account already uses that email address.';
  if (m.includes('invalid') && m.includes('email')) return 'That email address doesn\'t look right.';
  if (m.includes('nonce') || m.includes('otp') || m.includes('expired')) return 'That code didn\'t match or has expired. Ask for a new one.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a minute and try again.';
  return message || 'Something went wrong. Please try again.';
}

function Avatar({ url, name, size }: { url?: string | null; name: string; size: number }) {
  return url ? (
    <img src={url} alt="" width={size} height={size} className="account-avatar" style={{ width: size, height: size }} />
  ) : (
    <span className="account-avatar" aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name.substring(0, 1).toUpperCase()}
    </span>
  );
}

interface Props {
  /** The club whose site this is shown inside (/{club}/account) */
  club?: Club;
  /** Signed out: what the Sign in button does */
  onSignIn?: () => void;
  signInHref?: string;
}

export default function AccountSettings({ club, onSignIn, signInHref }: Props) {
  const { user, isLoading, hasClubAdminAccess } = useAuth();
  const { clubs } = useClub();
  // The Supabase user itself: new_email (a change waiting for its link) isn't on the app's profile
  const [authUser, setAuthUser] = useState<User | null>(null);
  const reloadUser = useCallback(async () => {
    const { data } = (await getSupabaseClient()?.auth.getUser()) || { data: { user: null } };
    setAuthUser(data.user);
  }, []);
  useEffect(() => { if (user) void reloadUser(); }, [user, reloadUser]);

  // On a club's own domain another club's pages live on itsfootball.club
  const [customDomain, setCustomDomain] = useState(false);
  useEffect(() => setCustomDomain(!isPlatformHost(window.location.host)), []);
  const clubHref = (slug: string, path: string) =>
    customDomain && slug !== club?.slug ? `${SITE_URL}/${slug}${path}` : `/${slug}${path}`;

  const myClubs = useMemo(() => {
    if (!user) return [];
    return clubs
      .filter(c => !isEventClub(c) && (user.club_roles[c.id] || c.owner_id === user.id))
      .sort((a, b) => (a.id === club?.id ? -1 : b.id === club?.id ? 1 : a.name.localeCompare(b.name)));
  }, [clubs, user, club?.id]);

  const [twoStepOn, setTwoStepOn] = useState<boolean | null>(null);
  const onTwoStep = useCallback((on: boolean) => setTwoStepOn(on), []);
  const adminOf = myClubs.filter(c => hasClubAdminAccess(c.id));

  if (isLoading) {
    return <div className="account-page"><p role="status" className="text-note">Loading your account…</p></div>;
  }
  if (!user) {
    return (
      <div className="account-page">
        <div className="glass-panel" style={{ maxWidth: 460, margin: '3rem auto', padding: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: '0.5rem' }}>Account settings</h1>
          <p className="text-note" style={{ marginBottom: '1.25rem' }}>Sign in to change your name, email, password and two-step sign-in.</p>
          {signInHref
            ? <Link href={signInHref} className="btn btn-primary">Sign in</Link>
            : <button type="button" className="btn btn-primary" onClick={onSignIn}>Sign in</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="account-page">
      <div className="account-head">
        <Avatar url={user.avatar_url} name={user.full_name} size={56} />
        <div className="min-w-0">
          <h1>Account settings</h1>
          <div className="text-note" style={{ overflowWrap: 'anywhere' }}>Signed in as {user.email}</div>
        </div>
      </div>

      <nav className="account-chips" aria-label="Account sections">
        {SECTIONS.map(s => <a key={s.id} href={`#${s.id}`}>{s.short}</a>)}
      </nav>

      <div className="account-grid">
        <nav className="account-nav" aria-label="Account sections">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <a key={id} href={`#${id}`}><Icon size={16} aria-hidden="true" />{label}</a>
          ))}
          <a href="#delete" className="is-danger"><Trash2 size={16} aria-hidden="true" />Delete account</a>
        </nav>

        <div className="min-w-0">
          <ProfileSection name={user.full_name} avatarUrl={user.avatar_url} />

          <section id="security" className="glass-panel account-section" aria-labelledby="account-security">
            <h2 id="account-security"><Lock size={17} aria-hidden="true" />Sign-in &amp; security</h2>
            <EmailRow email={user.email} pending={authUser?.new_email || null} returnPath={club ? `/${club.slug}/account` : '/account'} onChanged={reloadUser} />
            <PasswordRow />
            <div className="account-row"><div style={{ flex: '1 1 100%' }}><TwoStepSignIn embedded onStatus={onTwoStep} /></div></div>
            <SignOutOthersRow />
            {twoStepOn === false && adminOf.length > 0 && (
              <div className="account-nudge" role="note">
                <AlertTriangle size={16} aria-hidden="true" />
                <div>
                  You help run <strong>{adminOf.map(c => c.name).join(', ')}</strong>. Turn on two-step sign-in so nobody else can
                  change club money or members, even if they get hold of your password.
                </div>
              </div>
            )}
          </section>

          <section id="clubs" className="glass-panel account-section" aria-labelledby="account-clubs">
            <h2 id="account-clubs"><Shield size={17} aria-hidden="true" />My clubs</h2>
            {myClubs.length === 0 ? (
              <p className="text-note">You&apos;re not a member of a club yet.</p>
            ) : myClubs.map(c => {
              const role = c.owner_id === user.id ? 'owner' : user.club_roles[c.id];
              const admin = hasClubAdminAccess(c.id);
              return (
                <div key={c.id} className="account-row">
                  <img src={c.logo_url || DEFAULT_CREST} alt="" width={36} height={36} className="account-crest" style={{ borderColor: c.primary_color }} />
                  <div className="account-row-main">
                    <div className="account-row-value" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                      {c.name}
                      {admin && <span className="account-state is-admin">Admin</span>}
                    </div>
                    <div className="account-row-hint">{ROLE_LABEL[role] || 'Member'}</div>
                  </div>
                  <div className="account-actions">
                    {admin && <Link href={clubHref(c.slug, '/admin')} className="btn btn-secondary btn-sm">Admin Room</Link>}
                    <Link href={clubHref(c.slug, '/member')} className="btn btn-secondary btn-sm">Member pass</Link>
                  </div>
                </div>
              );
            })}
            <p className="text-note" style={{ marginTop: '0.5rem' }}>
              Your phone number and emergency contact are kept by each club. Ask a club admin to update them.
            </p>
          </section>

          <NotificationsSection clubs={myClubs} />

          <DeleteAccountSection />
        </div>
      </div>
    </div>
  );
}

/** Photo and name: the account's own (user metadata), shown in menus and on the member pass */
function ProfileSection({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [busy, setBusy] = useState<'' | 'name' | 'photo'>('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = draft.trim().replace(/\s+/g, ' ');
    if (clean.length < 2 || clean.length > 80) return setError('Enter your name (2 to 80 characters).');
    setBusy('name');
    setError('');
    const { error: err } = (await getSupabaseClient()?.auth.updateUser({ data: { full_name: clean } })) || {};
    setBusy('');
    if (err) return setError(friendlyError(err.message));
    setEditing(false);
  };

  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy('photo');
    try {
      const url = await uploadImage(file, { folder: 'avatar', maxDimension: 400 });
      const { error: err } = (await getSupabaseClient()?.auth.updateUser({ data: { avatar_url: url } })) || {};
      if (err) throw new Error(err.message);
    } catch (err) {
      await notify('Photo not saved', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy('');
    }
  };

  const removePhoto = async () => {
    setBusy('photo');
    const { error: err } = (await getSupabaseClient()?.auth.updateUser({ data: { avatar_url: null } })) || {};
    setBusy('');
    if (err) await notify('Photo not removed', friendlyError(err.message));
  };

  return (
    <section id="profile" className="glass-panel account-section" aria-labelledby="account-profile">
      <h2 id="account-profile"><UserIcon size={17} aria-hidden="true" />Profile</h2>
      <div className="account-row">
        <Avatar url={avatarUrl} name={name} size={44} />
        <div className="account-row-main">
          <div className="account-row-label">Photo</div>
          <div className="account-row-hint">Shown in the menu when you&apos;re signed in.</div>
        </div>
        <div className="account-actions">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickPhoto} />
          {avatarUrl && <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy} onClick={removePhoto}>Remove</button>}
          <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => fileRef.current?.click()}>
            {busy === 'photo' ? 'Saving…' : avatarUrl ? 'Change photo' : 'Add photo'}
          </button>
        </div>
      </div>
      <div className="account-row">
        <div className="account-row-main">
          <div className="account-row-label">Name</div>
          {!editing && <div className="account-row-value">{name}</div>}
          <div className="account-row-hint">Each club keeps the name you joined with. Ask the club to change it there.</div>
        </div>
        {!editing && <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setDraft(name); setError(''); setEditing(true); }}>Edit</button>}
        {editing && (
          <form onSubmit={saveName}>
            <label htmlFor="account-name" className="form-label">Your name</label>
            <input id="account-name" className="form-input" autoComplete="name" value={draft} maxLength={80} autoFocus onChange={e => setDraft(e.target.value)} />
            {error && <AuthAlert kind="error">{error}</AuthAlert>}
            <div className="account-actions" style={{ marginTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={busy === 'name'}>{busy === 'name' ? 'Saving…' : 'Save'}</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

/** Change email: Supabase emails a link (to both addresses when secure email change is on) */
function EmailRow({ email, pending, returnPath, onChanged }: { email: string; pending: string | null; returnPath: string; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = draft.trim().toLowerCase();
    if (!clean || clean === email.toLowerCase()) return setError('Enter a different email address.');
    const client = getSupabaseClient();
    if (!client) return;
    setBusy(true);
    setError('');
    const { error: err } = await client.auth.updateUser(
      { email: clean },
      { emailRedirectTo: authReturnUrl(window.location.origin, returnPath) }
    );
    setBusy(false);
    if (err) return setError(friendlyError(err.message));
    setEditing(false);
    onChanged();
    await notify('Check your inbox', `We've emailed a confirmation link to ${clean}. Your email changes once you open it (check your current inbox too: you may need to confirm there as well).`);
  };

  return (
    <div className="account-row">
      <div className="account-row-main">
        <div className="account-row-label">Email</div>
        <div className="account-row-value">{email}</div>
        <div className="account-row-hint">
          {pending
            ? <>Waiting for you to open the link sent to <strong>{pending}</strong>.</>
            : 'Sign-in links, receipts and club emails go here.'}
        </div>
      </div>
      {!editing && <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setDraft(''); setError(''); setEditing(true); }}>Change</button>}
      {editing && (
        <form onSubmit={save}>
          <EmailField id="account-new-email" label="New email" value={draft} onChange={setDraft} autoFocus
            hint="We'll email a link to confirm it. Nothing changes until you open it." />
          {error && <AuthAlert kind="error">{error}</AuthAlert>}
          <div className="account-actions">
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Sending…' : 'Send confirmation link'}</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Set or change the password. With "secure password change" on, Supabase first wants a code it emails. */
function PasswordRow() {
  const [editing, setEditing] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [nonce, setNonce] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setPassword(''); setConfirm(''); setNonce(null); setError(''); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError('The two passwords don\'t match.');
    const client = getSupabaseClient();
    if (!client) return;
    setBusy(true);
    setError('');
    const { error: err } = await client.auth.updateUser(nonce ? { password, nonce: nonce.trim() } : { password });
    if (err && nonce === null && /reauth/i.test(`${err.code || ''} ${err.message}`)) {
      // Supabase wants proof it's really them: it emails a short code
      const { error: sendErr } = await client.auth.reauthenticate();
      setBusy(false);
      if (sendErr) return setError(friendlyError(sendErr.message));
      setNonce('');
      return;
    }
    setBusy(false);
    if (err) return setError(friendlyError(err.message));
    setEditing(false);
    reset();
    await notify('Password saved', 'You can now sign in with your email and this password, or keep using email links.');
  };

  return (
    <div className="account-row">
      <div className="account-row-main">
        <div className="account-row-label">Password</div>
        <div className="account-row-hint">Signed in with email links only? Add a password to use either.</div>
      </div>
      {!editing && <button type="button" className="btn btn-secondary btn-sm" onClick={() => { reset(); setEditing(true); }}>Set or change password</button>}
      {editing && (
        <form onSubmit={save}>
          <PasswordField id="account-new-password" label="New password" value={password} onChange={setPassword} isNew showStrength />
          <PasswordField id="account-new-password-2" label="Type it again" value={confirm} onChange={setConfirm} isNew />
          {nonce !== null && (
            <div className="auth-field">
              <label htmlFor="account-reauth-code" className="form-label">Code from your email</label>
              <input id="account-reauth-code" className="form-input" inputMode="numeric" autoComplete="one-time-code" value={nonce}
                onChange={e => setNonce(e.target.value.replace(/\s/g, ''))} style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.2em' }} />
              <div className="auth-field-hint">To keep your account safe we&apos;ve emailed you a code. Enter it to save the new password.</div>
            </div>
          )}
          {error && <AuthAlert kind="error">{error}</AuthAlert>}
          <div className="account-actions">
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || (nonce !== null && !nonce)}>{busy ? 'Saving…' : 'Save password'}</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditing(false); reset(); }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

function SignOutOthersRow() {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    const ok = await confirmAction({
      title: 'Sign out everywhere else?',
      message: 'Every other phone, tablet and computer signed in to your account is signed out. This one stays signed in.',
      confirmLabel: 'Sign out others',
    });
    if (!ok) return;
    setBusy(true);
    const { error } = (await getSupabaseClient()?.auth.signOut({ scope: 'others' })) || {};
    setBusy(false);
    await notify(error ? 'Could not sign out other devices' : 'Other devices signed out', error ? friendlyError(error.message) : 'They\'ll need to sign in again.');
  };
  return (
    <div className="account-row">
      <div className="account-row-main">
        <div className="account-row-label">Other devices</div>
        <div className="account-row-hint">Lost a phone or used a shared computer? Sign out everywhere except here.</div>
      </div>
      <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={run}>{busy ? 'Signing out…' : 'Sign out others'}</button>
    </div>
  );
}

/** Each club's emails on/off (the same list its unsubscribe links use), and alerts on this device */
function NotificationsSection({ clubs }: { clubs: Club[] }) {
  const [state, setState] = useState<{ email: string | null; optedOut: Set<string> } | null | 'error'>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const res = await fetch('/api/account/email-prefs', { headers: { Authorization: `Bearer ${await getAccessToken()}` } }).catch(() => null);
      const data = res?.ok ? await res.json().catch(() => null) : null;
      if (live) setState(data ? { email: data.email, optedOut: new Set<string>(data.optedOut || []) } : 'error');
    })();
    return () => { live = false; };
  }, []);

  const toggle = async (clubId: string, subscribed: boolean) => {
    if (!state || state === 'error') return;
    setSaving(clubId);
    const res = await fetch('/api/account/email-prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getAccessToken()}` },
      body: JSON.stringify({ clubId, subscribed }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setSaving(null);
    if (!res?.ok) return notify('Not saved', data.error || 'Please try again.');
    const next = new Set(state.optedOut);
    if (subscribed) next.delete(clubId); else next.add(clubId);
    setState({ ...state, optedOut: next });
  };

  return (
    <section id="notifications" className="glass-panel account-section" aria-labelledby="account-notifications">
      <h2 id="account-notifications"><Bell size={17} aria-hidden="true" />Notifications</h2>
      <p className="text-note">
        {state && state !== 'error' && !state.email
          ? 'Confirm your email address to choose which club emails you get.'
          : 'Sign-in links, receipts and payment emails always go.'}
      </p>
      {state === 'error' && <p className="text-note" style={{ color: 'var(--c-red)' }}>Your email choices couldn&apos;t be loaded. Refresh to try again.</p>}
      {clubs.map(c => {
        const ready = state && state !== 'error' && !!state.email;
        const on = ready ? !state.optedOut.has(c.id) : false;
        return (
          <div key={c.id} className="account-row">
            <div className="account-row-main">
              <div className="account-row-value">{c.name}</div>
              <div className="account-row-hint">News, match and renewal emails</div>
            </div>
            <div className="account-switches">
              {ready && (
                <label className="account-switch-wrap">
                  <span>Email</span>
                  <button type="button" role="switch" aria-checked={on} aria-label={`Emails from ${c.name}`}
                    className={`account-switch ${on ? 'is-on' : ''}`} disabled={saving === c.id} onClick={() => toggle(c.id, !on)} />
                </label>
              )}
              <PushToggle clubId={c.id} clubName={c.name} asSwitch="This device" />
            </div>
          </div>
        );
      })}
    </section>
  );
}

/** Account deletion (the App Store and Google Play require it in the app itself) */
function DeleteAccountSection() {
  const { logout } = useAuth();
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    const ok = await confirmAction({
      title: 'Delete your account?',
      message: 'Your sign-in is removed for good. Clubs keep their own records of your membership, but they are no longer linked to you. This cannot be undone.',
      confirmLabel: 'Delete account',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    const res = await fetch('/api/account', { method: 'DELETE', headers: { Authorization: `Bearer ${await getAccessToken()}` } });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return notify('Account not deleted', data.error || 'Please try again.');
    await notify('Your account has been deleted');
    await logout();
  };

  return (
    <section id="delete" className="glass-panel account-section is-danger" aria-labelledby="account-delete">
      <h2 id="account-delete"><Trash2 size={17} aria-hidden="true" />Delete account</h2>
      <div className="account-row">
        <div className="account-row-main">
          <div className="account-row-hint" style={{ marginTop: 0 }}>
            Your sign-in is removed for good. Clubs keep their own records of your membership, but they&apos;re no longer linked to you.
          </div>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={remove} style={{ color: 'var(--c-red)' }}>
          {busy ? 'Deleting…' : 'Delete account'}
        </button>
      </div>
    </section>
  );
}
