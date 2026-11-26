'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Shield } from 'lucide-react';
import { metaAccount, type SocialAccount } from '@/lib/social-publish';
import { DATE_LOCALE } from '@/lib/dates';

type Choice = { id: string; name: string; instagram: string | null };

const ERRORS: Record<string, string> = {
  cancelled: 'Facebook sign-in was cancelled, so nothing changed.',
  failed: "Facebook didn't let us connect. Try again, and tick the club's Page when Facebook asks.",
};

// Admin > Social media > Accounts: the club's Facebook Page and the Instagram linked to it.
// Facebook sends the admin back with ?meta=<one-time code> (or ?meta_error=), finished here.
export default function SocialAccounts({ clubId, account, reload, canConnect, name }: {
  clubId: string;
  account: SocialAccount | null;
  reload: () => void;
  /** Full News rights: Owner, Club Admin, or a role with full Social media access */
  canConnect: boolean;
  name: string;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [choices, setChoices] = useState<{ nonce: string; pages: Choice[] } | null>(null);

  const finish = async (nonce: string, pageId?: string) => {
    setBusy(true);
    const r = await metaAccount('POST', { clubId, action: 'finish', nonce, pageId, name });
    setBusy(false);
    if (r.error) { setNote(r.error); setChoices(null); return; }
    if (Array.isArray(r.choose)) { setChoices({ nonce, pages: r.choose as Choice[] }); return; }
    setChoices(null);
    setNote('Connected. Posts can now go straight to Facebook and Instagram.');
    reload();
  };

  // Back from Facebook: finish once, and take the code out of the address bar
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const q = new URLSearchParams(window.location.search);
    const nonce = q.get('meta');
    const error = q.get('meta_error');
    if (!nonce && !error) return;
    q.delete('meta');
    q.delete('meta_error');
    window.history.replaceState(null, '', `${window.location.pathname}?${q}`);
    if (error) setNote(ERRORS[error] || ERRORS.failed);
    else if (nonce) void finish(nonce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async () => {
    setBusy(true);
    const r = await metaAccount('POST', { clubId, action: 'start' });
    if (typeof r.url === 'string') { window.location.href = r.url; return; }
    setBusy(false);
    setNote(r.error || 'Something went wrong. Please try again.');
  };
  const disconnect = async () => {
    setBusy(true);
    const r = await metaAccount('DELETE', { clubId });
    setBusy(false);
    setNote(r.error || 'Disconnected. To remove the app from Facebook too, go to Facebook, Settings, Business integrations.');
    reload();
  };

  if (!account) return <p className="text-note" role="status">Loading…</p>;
  const page = account.connected ? account.page : null;

  return (
    <>
      {note && <p className="admin-notice" role="status">{note}</p>}
      {!account.configured ? (
        <p className="admin-empty glass-panel">{account.missing
          ? 'Posting to Facebook and Instagram needs a database update first. Ask the site admin to run it.'
          : "Posting to Facebook and Instagram isn't switched on for this site yet. You can still share every post from your phone."}</p>
      ) : (
        <div className="social-accs">
          <div className="glass-panel social-acc">
            <div className="social-acc-top">
              <span className="social-acc-mark is-fb" aria-hidden="true">f</span>
              <div>
                <h3>Facebook Page</h3>
                <p>{page ? `${page.name}${page.by ? ` · connected by ${page.by}` : ''}${page.at ? `, ${new Date(page.at).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short' })}` : ''}` : 'Not connected'}</p>
              </div>
            </div>
            {page && <span className="admin-pill is-ok">Connected</span>}
            <ul>
              <li>Posts go on the Page as the club, with the graphic and caption.</li>
              <li>You choose which posts go by themselves under When to post. The rest wait for you here.</li>
            </ul>
            {choices && (
              <fieldset className="social-acc-pick">
                <legend>Which Page is the club&apos;s?</legend>
                {choices.pages.map(p => (
                  <button key={p.id} type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void finish(choices.nonce, p.id)}>
                    {p.name}{p.instagram ? ` (Instagram @${p.instagram})` : ''}
                  </button>
                ))}
              </fieldset>
            )}
            {canConnect ? (
              <div className="social-acc-foot">
                <button type="button" className={`btn btn-sm ${page ? 'btn-secondary' : 'btn-primary'}`} disabled={busy} onClick={() => void connect()}>
                  {page ? 'Change Page' : 'Connect with Facebook'}
                </button>
                {page && <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void disconnect()}>Disconnect</button>}
              </div>
            ) : !page && <p className="social-acc-sub">Your club Owner or a Club Admin can connect the Page.</p>}
          </div>
          <div className="glass-panel social-acc">
            <div className="social-acc-top">
              <span className="social-acc-mark is-ig" aria-hidden="true">◎</span>
              <div>
                <h3>Instagram</h3>
                <p>{page?.instagram ? `@${page.instagram}` : page ? 'No Instagram linked to this Page' : 'Comes with the Facebook Page'}</p>
              </div>
            </div>
            {page?.instagram && <span className="admin-pill is-ok">Connected</span>}
            <ul>
              <li>Feed posts, and Stories for Story-size graphics.</li>
              <li>Instagram needs a business or creator account linked to the club&apos;s Facebook Page. Link it in the Instagram app, then press Change Page.</li>
            </ul>
          </div>
        </div>
      )}
      <p className="social-foot"><Shield size={14} aria-hidden="true" /> You sign in on Facebook, never here. We keep a key that only lets us post for the club, stored encrypted. We can&apos;t read your messages or see your password.</p>
    </>
  );
}
