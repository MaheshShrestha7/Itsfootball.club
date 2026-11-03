'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { platformApi } from '@/components/admin/platform/api';
import { askText, confirmAction, notify } from '@/components/ConfirmDialog';
import type { AccountStatus } from '@/lib/supabase/types';
import { KeyRound, Link2, ShieldOff, LogOut, AtSign, Ban, Trash2, CheckCircle2 } from 'lucide-react';

interface Props {
  userId: string;
  name: string;
  showToast: (msg: string) => void;
  /** After a delete or email change, the list needs reloading */
  onChanged: () => void;
}

/** "Fix their account" on the People tab (POST /api/platform/users). */
export default function AccountActions({ userId, name, showToast, onChanged }: Props) {
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await platformApi<AccountStatus>(`users?id=${userId}`);
    if (res.error) { setError(res.error); setStatus(null); } else { setError(''); setStatus(res); }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action);
    const res = await platformApi<{ message?: string }>('users', { userId, action, ...extra });
    setBusy(null);
    if (res.error) { notify('That didn\'t work', res.error); return false; }
    showToast(`âœ“ ${res.message || 'Done'}`);
    return true;
  };

  const run = async (action: string, confirm?: { title: string; message: string; label: string; danger?: boolean }) => {
    if (confirm && !(await confirmAction({ title: confirm.title, message: confirm.message, confirmLabel: confirm.label, danger: confirm.danger }))) return;
    if (await act(action)) { if (action === 'delete') onChanged(); else load(); }
  };

  const changeEmail = async () => {
    const next = await askText({ title: `Change ${name}'s sign-in email`, message: 'Only do this when you are sure it is them. Their old address gets a notice.', label: 'New email', placeholder: 'name@example.com', required: true, confirmLabel: 'Change email' });
    if (next && (await act('change_email', { email: next }))) { load(); onChanged(); }
  };

  const owned = status?.owned || [];
  const actions: { key: string; label: string; cta: string; desc: string; icon: React.ElementType; onClick: () => void; danger?: boolean; disabled?: string }[] = [
    { key: 'signin_link', label: 'Email a sign-in link', cta: 'Send link', desc: 'One-time link to their inbox. For a forgotten password.', icon: Link2, onClick: () => run('signin_link') },
    { key: 'password_reset', label: 'Email a password reset', cta: 'Send reset', desc: 'They choose a new password from the link.', icon: KeyRound, onClick: () => run('password_reset') },
    {
      key: 'reset_2fa', label: 'Reset two-step sign-in', cta: 'Reset', desc: 'Removes their authenticator app. For a lost phone.', icon: ShieldOff,
      disabled: status && !status.two_step ? 'Two-step is off' : undefined,
      onClick: () => run('reset_2fa', { title: 'Reset two-step sign-in?', message: `${name} can then sign in with just a password until they set it up again. Only do this once you're sure it's them.`, label: 'Reset' }),
    },
    { key: 'sign_out', label: 'Sign out everywhere', cta: 'Sign out', desc: 'Ends every session. For a lost or shared device.', icon: LogOut, onClick: () => run('sign_out', { title: 'Sign them out everywhere?', message: 'Every device has to sign in again within the hour.', label: 'Sign out' }) },
    { key: 'change_email', label: 'Change sign-in email', cta: 'Change', desc: 'Moves the account to a new address straight away.', icon: AtSign, onClick: changeEmail },
    status?.banned
      ? { key: 'unblock', label: 'Unblock', cta: 'Unblock', desc: 'They can sign in again.', icon: CheckCircle2, onClick: () => run('unblock') }
      : { key: 'block', label: 'Block account', cta: 'Block', desc: 'Can\'t sign in until unblocked. Club data stays.', icon: Ban, danger: true, onClick: () => run('block', { title: `Block ${name}?`, message: 'They are signed out and can\'t sign in again until you unblock them.', label: 'Block', danger: true }) },
    {
      key: 'delete', label: 'Delete account', cta: 'Delete', icon: Trash2, danger: true,
      desc: owned.length ? `Owns ${owned.map(c => c.name).join(', ')}: make someone else Owner first.` : 'Memberships are unlinked; club records and payments stay.',
      disabled: owned.length ? 'Owns a club' : undefined,
      onClick: () => run('delete', { title: `Delete ${name}'s account?`, message: 'This can\'t be undone. Their club records stay, unlinked from the account.', label: 'Delete account', danger: true }),
    },
  ];

  return (
    <div className="mc-card">
      <div className="mc-card-h" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h3>Fix their account</h3>
        {status && (
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <span className={`mc-flag ${status.email_confirmed_at ? 'ok' : 'warn'}`}>{status.email_confirmed_at ? 'Email confirmed' : 'Email not confirmed'}</span>
            <span className={`mc-flag ${status.two_step ? 'ok' : ''}`}>{status.two_step ? 'Two-step on' : 'Two-step off'}</span>
            {status.banned && <span className="mc-flag bad">Blocked</span>}
          </span>
        )}
      </div>
      {error && <p className="mc-muted" role="alert">{error}</p>}
      <div className="mc-acts-grid">
        {actions.map(a => {
          const Icon = a.icon;
          return (
            <div key={a.key} className="mc-act">
              <b><Icon size={14} /> {a.label}</b>
              <p>{a.desc}</p>
              <button
                type="button"
                className={`mc-pill-btn${a.danger ? ' danger' : ' ghost'}`}
                disabled={!!busy || !!a.disabled || !status}
                title={a.disabled}
                onClick={a.onClick}
              >
                {busy === a.key ? 'Workingâ€¦' : a.cta}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
