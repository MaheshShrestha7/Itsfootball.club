'use client';

import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Pencil, Trash2, Plus, X, ExternalLink, EyeOff } from 'lucide-react';
import SponsorLogo from '@/components/SponsorLogo';
import PopupPanel from '@/components/PopupPanel';
import ImageUploadZone from '@/components/ImageUploadZone';
import { confirmAction } from '@/components/ConfirmDialog';
import {
  SPONSOR_CATEGORIES, TournamentSponsor, categoryLabel, defaultPlacement, headerSponsors, inOrder, isPresetCategory,
  moveSponsor, normaliseWebsite, sponsorGroups,
} from '@/lib/tournament-sponsors';
import type { useTournamentSponsors } from '@/lib/use-tournament-sponsors';
import '@/components/tournament/hosted.css';

/** One logo tile: a link to the sponsor's site when it has one */
function Tile({ s, height }: { s: TournamentSponsor; height: number }) {
  // No logo yet: the name itself, so the tile never shows bare initials
  const logo = s.logo_url
    ? <><SponsorLogo src={s.logo_url} name={s.name} height={height} style={{ maxWidth: '100%' }} /><span className="sr-only">{s.name}</span></>
    : <span className="ts-tile-name">{s.name}</span>;
  return s.website_url
    ? <a className="ts-tile" href={s.website_url} target="_blank" rel="noopener noreferrer sponsored" title={s.name}>{logo}</a>
    : <span className="ts-tile" title={s.name}>{logo}</span>;
}

/** The strip under the tournament header: the sponsors the host placed there */
export function TournamentSponsorStrip({ sponsors }: { sponsors: TournamentSponsor[] }) {
  const shown = headerSponsors(sponsors);
  if (!shown.length) return null;
  return (
    <div className="ts-strip" aria-label="Tournament partners">
      <span className="ts-strip-label">In partnership with</span>
      <div className="ts-strip-logos">{shown.map(s => <Tile key={s.id} s={s} height={30} />)}</div>
    </div>
  );
}

/** Every sponsor, grouped by category, highest first; bigger logos for higher categories */
export function TournamentSponsorList({ sponsors }: { sponsors: TournamentSponsor[] }) {
  const groups = sponsorGroups(sponsors);
  if (!groups.length) return null;
  const height = { xl: 56, lg: 46, md: 38, sm: 30 } as const;
  return (
    <aside aria-labelledby="ts-list-title" className="glass-panel ts-list">
      <h2 id="ts-list-title" className="ts-list-title">Tournament sponsors</h2>
      {groups.map(g => (
        <section key={g.category} className="ts-group" data-size={g.size} aria-label={g.title}>
          <h3>{g.title}</h3>
          <div className="ts-group-logos">{g.sponsors.map(s => <Tile key={s.id} s={s} height={height[g.size]} />)}</div>
        </section>
      ))}
    </aside>
  );
}

type Api = ReturnType<typeof useTournamentSponsors>;

/** Admin: the tournament's Sponsors tab */
export function TournamentSponsorsAdmin({ clubId, api }: { clubId: string; api: Api }) {
  const { sponsors, save, remove, reorder } = api;
  const [editing, setEditing] = useState<TournamentSponsor | 'new' | null>(null);
  const ordered = inOrder(sponsors);

  const del = async (s: TournamentSponsor) => {
    if (!(await confirmAction({ title: `Remove ${s.name}?`, message: 'They come off this tournament\'s page straight away.', confirmLabel: 'Remove sponsor', danger: true }))) return;
    await remove(s.id);
  };

  return (
    <div>
      <div className="ts-admin-head">
        <p className="ht-lede">These show on this tournament&apos;s public page only, not with the club&apos;s sponsors. The arrows set the order: higher comes first in the header strip and inside its category.</p>
        <button type="button" className="btn btn-sm btn-primary ts-add" onClick={() => setEditing('new')}>
          <Plus size={14} aria-hidden="true" /><span>Add sponsor</span>
        </button>
      </div>

      {ordered.length === 0 ? (
        <p className="ht-hint">No sponsors yet. Add the businesses backing this tournament and they show on its public page.</p>
      ) : (
        <div className="ht-table-wrap">
          <table className="ht-table ts-admin-table">
            <caption className="sr-only">Tournament sponsors, in order</caption>
            <thead><tr><th scope="col">Order</th><th scope="col">Sponsor</th><th scope="col">Category</th><th scope="col">Shows in</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {ordered.map((s, i) => (
                <tr key={s.id}>
                  <td data-label="Order">
                    <span className="ts-order">
                      <span className="ts-order-num">{i + 1}</span>
                      <button type="button" className="ht-icon-btn" aria-label={`Move ${s.name} up`} disabled={i === 0} onClick={() => reorder(moveSponsor(sponsors, s.id, -1))}><ChevronUp size={15} aria-hidden="true" /></button>
                      <button type="button" className="ht-icon-btn" aria-label={`Move ${s.name} down`} disabled={i === ordered.length - 1} onClick={() => reorder(moveSponsor(sponsors, s.id, 1))}><ChevronDown size={15} aria-hidden="true" /></button>
                    </span>
                  </td>
                  <th scope="row">
                    <div className="ts-admin-name">
                      <span className="ts-tile ts-tile-sm" aria-hidden="true">{s.logo_url ? <SponsorLogo src={s.logo_url} name={s.name} height={24} style={{ maxWidth: '100%' }} /> : <span className="ts-tile-name">{s.name.slice(0, 14)}</span>}</span>
                      <span className="min-w-0">
                        <span className="ht-name">{s.name}</span>
                        {s.website_url && <span className="ht-sub ts-site">{s.website_url.replace(/^https?:\/\//, '')}<ExternalLink size={11} aria-hidden="true" /></span>}
                      </span>
                    </div>
                  </th>
                  <td data-label="Category"><span className="ht-state">{categoryLabel(s.category)}</span></td>
                  <td data-label="Shows in">
                    {!s.is_active ? <span className="ht-sub ts-hidden"><EyeOff size={13} aria-hidden="true" />Hidden</span>
                      : s.placement === 'header' ? <span className="ht-state" data-tone="ok">Header strip and list</span>
                      : <span className="ht-sub">List only</span>}
                  </td>
                  <td className="ts-actions">
                    <button type="button" className="ht-icon-btn" aria-label={`Edit ${s.name}`} onClick={() => setEditing(s)}><Pencil size={15} aria-hidden="true" /></button>
                    <button type="button" className="ht-icon-btn is-danger" aria-label={`Remove ${s.name}`} onClick={() => del(s)}><Trash2 size={15} aria-hidden="true" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <SponsorForm clubId={clubId} sponsor={editing === 'new' ? null : editing} nextOrder={ordered.length ? ordered[ordered.length - 1].display_order + 1 : 0}
          onSave={(fields, id) => save(fields, id)} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function SponsorForm({ clubId, sponsor, nextOrder, onSave, onClose }: {
  clubId: string;
  sponsor: TournamentSponsor | null;
  nextOrder: number;
  onSave: (fields: Partial<TournamentSponsor>, id?: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [name, setName] = useState(sponsor?.name || '');
  const [logo, setLogo] = useState(sponsor?.logo_url || '');
  const [website, setWebsite] = useState(sponsor?.website_url || '');
  const startCat = sponsor?.category || 'gold';
  const [category, setCategory] = useState(isPresetCategory(startCat) ? startCat : 'other');
  const [ownCategory, setOwnCategory] = useState(isPresetCategory(startCat) ? '' : startCat);
  const [placement, setPlacement] = useState<'header' | 'list'>(sponsor?.placement || defaultPlacement(startCat));
  const [placementTouched, setPlacementTouched] = useState(!!sponsor);
  const [shown, setShown] = useState(sponsor?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pickCategory = (c: string) => {
    setCategory(c);
    // A new sponsor's placement follows its category until the host picks one
    if (!placementTouched) setPlacement(defaultPlacement(c));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cat = category === 'other' ? ownCategory.trim() : category;
    if (!name.trim()) return setError('Type the sponsor\'s name.');
    if (!cat) return setError('Type a category, for example Food partner.');
    setBusy(true);
    const err = await onSave({
      name: name.trim(), logo_url: logo || null, website_url: normaliseWebsite(website) || null, category: cat.slice(0, 40), placement, is_active: shown,
      ...(sponsor ? {} : { display_order: nextOrder }),
    }, sponsor?.id);
    setBusy(false);
    if (err) setError(`Couldn't save: ${err}`); else onClose();
  };

  return (
    <div className="ht-scrim" onClick={onClose}>
      <PopupPanel onClose={onClose} label={sponsor ? 'Edit sponsor' : 'Add a tournament sponsor'} className="ht-dialog ts-form" onClick={e => e.stopPropagation()}>
        <div className="ht-dialog-head">
          <h3>{sponsor ? `Edit ${sponsor.name}` : 'Add a tournament sponsor'}</h3>
          <button type="button" aria-label="Close" className="ht-x" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </div>
        <form onSubmit={submit} className="ht-fx-form">
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="ts-name" className="form-label">Name *</label>
            <input id="ts-name" className="form-input" value={name} maxLength={120} required onChange={e => setName(e.target.value)} />
          </div>
          <ImageUploadZone clubId={clubId} folder="sponsors" aspectRatio="free" label="Logo" recommendedText="PNG with a see-through background looks best"
            currentImageUrl={logo || undefined} onUploadComplete={setLogo} />
          <fieldset className="ht-fx-status">
            <legend className="form-label">Category</legend>
            <div className="ht-fx-seg ts-seg-wrap">
              {SPONSOR_CATEGORIES.map(c => (
                <button key={c.key} type="button" aria-pressed={category === c.key} onClick={() => pickCategory(c.key)}>{c.label}</button>
              ))}
              <button type="button" aria-pressed={category === 'other'} onClick={() => pickCategory('other')}>Other</button>
            </div>
            {category === 'other' && (
              <input aria-label="Your own category" className="form-input" style={{ marginTop: '0.5rem' }} placeholder="For example Food partner" maxLength={40}
                value={ownCategory} onChange={e => setOwnCategory(e.target.value)} />
            )}
            <p className="ht-hint">The public list goes Platinum, Gold, Silver, Bronze, Media partner, Partner, then your own categories.</p>
          </fieldset>
          <fieldset className="ht-fx-status">
            <legend className="form-label">Where it shows</legend>
            <div className="ht-fx-seg" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <button type="button" aria-pressed={placement === 'header'} onClick={() => { setPlacement('header'); setPlacementTouched(true); }}>Header strip and list</button>
              <button type="button" aria-pressed={placement === 'list'} onClick={() => { setPlacement('list'); setPlacementTouched(true); }}>List only</button>
            </div>
          </fieldset>
          <div className="form-group" style={{ margin: 0 }}>
            <label htmlFor="ts-site" className="form-label">Website</label>
            <input id="ts-site" className="form-input" type="text" inputMode="url" autoComplete="url" placeholder="momohouse.com.au" value={website}
              onChange={e => setWebsite(e.target.value)} onBlur={() => setWebsite(normaliseWebsite(website))} />
          </div>
          <label className="form-check">
            <input type="checkbox" checked={shown} onChange={e => setShown(e.target.checked)} /> Show on the tournament page
          </label>
          {error && <p role="alert" className="ht-error">{error}</p>}
          <div className="ht-fx-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : sponsor ? 'Save' : 'Add sponsor'}</button>
          </div>
        </form>
      </PopupPanel>
    </div>
  );
}
