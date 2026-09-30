'use client';

import { useEffect, useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { notify } from '@/components/ConfirmDialog';

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

const keyBytes = (b64url: string) =>
  Uint8Array.from(atob(b64url.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

async function call(action: 'status' | 'follow' | 'unfollow', clubId: string, subscription: PushSubscription) {
  const res = await fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, clubId, subscription: subscription.toJSON() }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return !!data.following;
}

/**
 * Bell in the club navbar: follow this club's notifications (match, event and news notices).
 * Only shown where web push works - on iPhone that means the site was added to the Home Screen.
 */
export default function PushToggle({ clubId, clubName }: { clubId: string; clubName: string }) {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!VAPID_KEY || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    let cancelled = false;
    navigator.serviceWorker.getRegistration().then(async reg => {
      if (!reg || cancelled) return;
      setRegistration(reg);
      const sub = await reg.pushManager.getSubscription();
      if (sub && Notification.permission === 'granted') {
        const on = await call('status', clubId, sub).catch(() => false);
        if (!cancelled) setFollowing(on);
      }
    });
    return () => { cancelled = true; };
  }, [clubId]);

  if (!registration) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      if (following) {
        const sub = await registration.pushManager.getSubscription();
        setFollowing(sub ? await call('unfollow', clubId, sub) : false);
        return;
      }
      if ((await Notification.requestPermission()) !== 'granted') {
        await notify('Notifications are blocked', 'Allow notifications for this site in your browser or phone settings, then tap the bell again.');
        return;
      }
      const sub = (await registration.pushManager.getSubscription())
        || (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_KEY!) }));
      setFollowing(await call('follow', clubId, sub));
    } catch (err) {
      await notify('Could not change notifications', err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  const label = following ? `Stop notifications from ${clubName}` : `Get notifications from ${clubName}`;
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={following}
      aria-label={label}
      title={label}
      className="touch-target"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '40px',
        height: '40px',
        flexShrink: 0,
        borderRadius: '10px',
        border: '1px solid var(--border-subtle)',
        background: following ? 'rgba(var(--club-primary-rgb), 0.15)' : 'rgba(var(--tint-rgb), 0.04)',
        color: following ? 'var(--club-primary)' : 'var(--text-secondary)',
        cursor: busy ? 'wait' : 'pointer',
      }}
    >
      {following ? <BellRing size={18} aria-hidden="true" /> : <Bell size={18} aria-hidden="true" />}
    </button>
  );
}
