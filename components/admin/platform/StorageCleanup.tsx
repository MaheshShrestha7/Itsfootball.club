'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { platformApi } from '@/components/admin/platform/api';
import { confirmAction, notify } from '@/components/ConfirmDialog';
import { HardDrive, Trash2 } from 'lucide-react';

interface Folder { clubId: string; name: string | null; files: number; bytes: number }

const size = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Photos and files still in storage for clubs that have been deleted (GET/POST /api/platform/storage). */
export default function StorageCleanup({ showToast }: { showToast: (msg: string) => void }) {
  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [canDelete, setCanDelete] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await platformApi<{ folders: Folder[]; canDelete: boolean; note?: string }>('storage');
    if (res.error) { setNote(res.error); setFolders([]); return; }
    setFolders(res.folders);
    setCanDelete(res.canDelete);
    setNote(res.note || '');
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (f: Folder) => {
    const label = f.name || 'this deleted club';
    if (!(await confirmAction({
      title: `Delete ${label}'s files?`,
      message: `${f.files} ${f.files === 1 ? 'file' : 'files'} (${size(f.bytes)}): logos, photos and other uploads. This can't be undone. Payment receipts are kept.`,
      confirmLabel: 'Delete files',
      danger: true,
    }))) return;
    setBusy(f.clubId);
    const res = await platformApi<{ deleted?: number }>('storage', { clubId: f.clubId });
    setBusy(null);
    if (res.error) notify('Not all files were deleted', res.error);
    else showToast(`✓ Deleted ${res.deleted} files`);
    load();
  };

  return (
    <div className="mc-card">
      <div className="mc-card-h"><h3>Files left by deleted clubs</h3><HardDrive size={16} color="var(--mc-ink-3)" /></div>
      <p className="mc-muted" style={{ marginTop: 0 }}>
        Logos, photos and other uploads stay in storage after a club is deleted. Payment receipts are always kept, for accounting.
        {!canDelete && folders?.length ? ' Only Super admins can delete them.' : ''}
      </p>
      {note && <p className="mc-muted" role="status">{note}</p>}
      {folders === null && <p className="mc-muted">Looking…</p>}
      {folders?.length === 0 && !note && <p className="mc-muted">None. Storage only holds files of clubs that exist.</p>}
      {folders?.map(f => (
        <div key={f.clubId} className="mc-sig">
          <div className="body">
            <b>{f.name || 'Deleted club'}</b>
            <p className="num">{f.files} {f.files === 1 ? 'file' : 'files'} · {size(f.bytes)} · <code style={{ fontSize: 11 }}>clubs/{f.clubId}/</code></p>
          </div>
          {canDelete && (
            <button type="button" className="mc-pill-btn danger" disabled={!!busy || f.files === 0} onClick={() => remove(f)}>
              <Trash2 size={13} /> {busy === f.clubId ? 'Deleting…' : 'Delete files'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
