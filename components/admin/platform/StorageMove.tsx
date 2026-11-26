'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { platformApi } from '@/components/admin/platform/api';
import { confirmAction, notify } from '@/components/ConfirmDialog';
import { ArrowRightLeft, CloudUpload } from 'lucide-react';

interface Bucket { bucket: 'club-assets' | 'receipts'; files: number; bytes: number; inR2: number; missing: string[] }
interface LinkSet { label: 'supabase' | 'r2-api'; old: string; columns: { tbl: string; col: string; rows_found: number }[] }
interface Status { base: string; buckets: Bucket[]; links: LinkSet[]; receiptsSkipped: boolean; canMove: boolean }
interface CopyResult { copied: number; skipped: number; failed: { name: string; error: string }[]; next: string | null }

const size = (b: number) => (b >= 1073741824 ? `${(b / 1073741824).toFixed(2)} GB` : b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(0, Math.round(b / 1024))} KB`);
const BUCKET_LABEL = { 'club-assets': 'Images and uploads', receipts: 'Payment receipts' } as const;
const rowsOf = (l: LinkSet) => l.columns.reduce((n, c) => n + c.rows_found, 0);

/** Copies uploads saved in Supabase Storage to R2, then points saved links at R2 (/api/platform/storage-move). */
export default function StorageMove({ showToast }: { showToast: (msg: string) => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState<{ copied: number; skipped: number; failed: CopyResult['failed'] } | null>(null);
  const [busy, setBusy] = useState<'copy' | 'switch' | null>(null);
  const stop = useRef(false);

  const load = useCallback(async () => {
    const res = await platformApi<Partial<Status> & { note?: string }>('storage-move');
    if (res.error || res.note || !res.buckets) { setNote(res.error || res.note || ''); setStatus(null); return; }
    setNote('');
    setStatus(res as Status);
  }, []);

  useEffect(() => { load(); }, [load]);

  const copy = async () => {
    if (!status) return;
    stop.current = false;
    setBusy('copy');
    const tally = { copied: 0, skipped: 0, failed: [] as CopyResult['failed'] };
    setProgress({ ...tally });
    for (const b of status.buckets.filter(x => x.inR2 < x.files)) {
      let after = '';
      for (;;) {
        if (stop.current) break;
        const res = await platformApi<CopyResult>('storage-move', { action: 'copy', bucket: b.bucket, after });
        if (res.error) { notify('Copying stopped', res.error); stop.current = true; break; }
        tally.copied += res.copied; tally.skipped += res.skipped; tally.failed.push(...res.failed);
        setProgress({ ...tally, failed: [...tally.failed] });
        if (!res.next) break;
        after = res.next;
      }
    }
    setBusy(null);
    if (!stop.current) showToast(`✓ Copied ${tally.copied} files${tally.failed.length ? `, ${tally.failed.length} failed` : ''}`);
    load();
  };

  const switchLinks = async () => {
    if (!status) return;
    const rows = status.links.reduce((n, l) => n + rowsOf(l), 0);
    if (!(await confirmAction({
      title: 'Point saved links at R2?',
      message: `${rows} saved ${rows === 1 ? 'link' : 'links'} will load from ${status.base} instead of Supabase. The Supabase files stay, so old emails and posts keep working.`,
      confirmLabel: 'Switch links',
    }))) return;
    setBusy('switch');
    const res = await platformApi<{ rows: number; sample: number; broken: string[]; missing?: string[] }>('storage-move', { action: 'switch' });
    setBusy(null);
    if (res.error) notify('Links not switched', res.error);
    else if (res.broken.length) notify(`Switched ${res.rows} links, but ${res.broken.length} of ${res.sample} test images didn't load`, res.broken.join('\n'));
    else showToast(`✓ Switched ${res.rows} links. ${res.sample} test images load from R2.`);
    load();
  };

  const assets = status?.buckets.find(b => b.bucket === 'club-assets');
  const toCopy = status?.buckets.reduce((n, b) => n + b.files - b.inR2, 0) ?? 0;
  const linkRows = status?.links.reduce((n, l) => n + rowsOf(l), 0) ?? 0;
  const canSwitch = !!assets && assets.inR2 === assets.files && linkRows > 0;

  return (
    <div className="mc-card">
      <div className="mc-card-h"><h3>Move images to R2</h3><CloudUpload size={16} color="var(--mc-ink-3)" /></div>
      <p className="mc-muted" style={{ marginTop: 0 }}>
        Uploads from before R2 was switched on are still in Supabase. Copy them to R2, then point their saved links at R2.
        The Supabase copies are kept.
      </p>
      {note && <p className="mc-muted" role="status">{note}</p>}
      {!status && !note && <p className="mc-muted">Checking…</p>}
      {status && (
        <>
          {status.buckets.map(b => (
            <div key={b.bucket} className="mc-sig">
              <div className="body">
                <b>{BUCKET_LABEL[b.bucket]}</b>
                <p className="num">{b.inR2} of {b.files} files in R2 ({size(b.bytes)})</p>
              </div>
            </div>
          ))}
          {status.receiptsSkipped && <p className="mc-muted" style={{ fontSize: 12 }}>Receipts stay in Supabase until R2_PRIVATE_BUCKET is set.</p>}
          <div className="mc-sig">
            <div className="body">
              <b>Saved links still pointing at Supabase</b>
              <p className="num">{linkRows === 0 ? 'None' : `${linkRows} in ${status.links.reduce((n, l) => n + l.columns.length, 0)} places`}</p>
            </div>
          </div>
          {progress && (
            <p className="mc-muted num" role="status">
              {busy === 'copy' ? 'Copying… ' : 'Last copy: '}{progress.copied} copied, {progress.skipped} already there
              {progress.failed.length ? `, ${progress.failed.length} failed (${progress.failed.slice(0, 3).map(f => `${f.name}: ${f.error}`).join('; ')})` : ''}
            </p>
          )}
          {status.canMove ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {busy === 'copy'
                ? <button type="button" className="mc-pill-btn" onClick={() => { stop.current = true; }}>Stop</button>
                : <button type="button" className="mc-pill-btn" disabled={!!busy || toCopy === 0} onClick={copy}>
                    <CloudUpload size={13} /> {toCopy ? `Copy ${toCopy} files` : 'All files copied'}
                  </button>}
              <button type="button" className="mc-pill-btn" disabled={!!busy || !canSwitch} onClick={switchLinks}
                title={canSwitch ? undefined : linkRows === 0 ? 'Nothing to switch' : 'Copy every file first'}>
                <ArrowRightLeft size={13} /> {busy === 'switch' ? 'Switching…' : 'Switch links'}
              </button>
            </div>
          ) : <p className="mc-muted">Only Super admins can move files.</p>}
        </>
      )}
    </div>
  );
}
