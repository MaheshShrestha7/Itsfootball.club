'use client';

import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Pencil, Trash2, Plus, X, ExternalLink, EyeOff, Gem, Award, Radio, Handshake, Tag, Maximize2, LucideIcon } from 'lucide-react';
import SponsorLogo from '@/components/SponsorLogo';
import PopupPanel from '@/components/PopupPanel';
import ImageUploadZone from '@/components/ImageUploadZone';
import { confirmAction } from '@/components/ConfirmDialog';
import {
  SPONSOR_CATEGORIES, TournamentSponsor, SponsorPlacement, PLACEMENT_LABEL, categoryLabel, defaultPlacement, headerSponsors, inOrder, isPresetCategory,
  moveSponsor, normaliseWebsite, sponsorGroups, titleSponsor, LOGO_SIZES, LogoSize, categorySize, sponsorSize, sizeLabel, logoSpan,
} from '@/lib/tournament-sponsors';
import type { useTournamentSponsors } from '@/lib/use-tournament-sponsors';
import '@/components/tournament/hosted.css';

/** Logo height inside the tile, per size: the list, and the header strip */
const LIST_LOGO: Record<LogoSize, number> = { platinum: 96, gold: 68, silver: 50, bronze: 40, small: 32 };
const STRIP_LOGO: Record<LogoSize, number> = { platinum: 40, gold: 32, silver: 28, bronze: 28, small: 28 };

/** A category's icon: a gem for Platinum, a medal for Gold, Silver and Bronze, otherwise by kind */
const CATEGORY_ICON: Record<string, LucideIcon> = { platinum: Gem, gold: Award, silver: Award, bronze: Award, media: Radio, partner: Handshake };
export function CategoryIcon({ category, size = 16 }: { category: string; size?: number }) {
  const Icon = CATEGORY_ICON[category] || Tag;
  return <Icon size={size} aria-hidden="true" className="ts-cat-icon" data-cat={isPresetCategory(category) ? category : 'other'} />;
}

/** One logo tile: a link to the sponsor's site when it has one */
function Tile({ s, height, style }: { s: TournamentSponsor; height: number; style?: React.CSSProperties }) {
  // No logo yet: the name itself, so the tile never shows bare initials
  const logo = s.logo_url
    ? <><SponsorLogo src={s.logo_url} name={s.name} height={height} style={{ maxWidth: '100%' }} /><span className="sr-only">{s.name}</span></>
    : <span className="ts-tile-name">{s.name}</span>;
  return s.website_url
    ? <a className="ts-tile" data-size={sponsorSize(s)} style={style} href={s.website_url} target="_blank" rel="noopener noreferrer sponsored" title={s.name}>{logo}</a>
    : <span className="ts-tile" data-size={sponsorSize(s)} style={style} title={s.name}>{logo}</span>;
}

/** The main sponsor above the tournament name, as on a poster: logo, name, "presents" */
export function TournamentPresenter({ sponsors }: { sponsors: TournamentSponsor[] }) {
  const s = titleSponsor(sponsors);
  if (!s) return null;
  const body = (
    <>
      {s.logo_url && <span className="ts-presenter-logo"><SponsorLogo src={s.logo_url} name={s.name} height={72} loading="eager" style={{ maxWidth: '100%' }} /></span>}
      <span className="ts-presenter-name">{s.name}</span>
      <span className="ts-presenter-word">presents</span>
    </>
  );
  return s.website_url
    ? <a className="ts-presenter" href={s.website_url} target="_blank" rel="noopener noreferrer sponsored">{body}</a>
    : <div className="ts-presenter">{body}</div>;
}

/** The strip under the tournament header: the sponsors the host placed there */
export function TournamentSponsorStrip({ sponsors }: { sponsors: TournamentSponsor[] }) {
  const shown = headerSponsors(sponsors);
  if (!shown.length) return null;
  return (
    <div className="ts-strip" aria-label="Tournament partners">
      <span className="ts-strip-label">In partnership with</span>
      <div className="ts-strip-logos">{shown.map(s => <Tile key={s.id} s={s} height={STRIP_LOGO[sponsorSize(s)]} />)}</div>
    </div>
  );
}

/** Every sponsor, grouped by category, highest first. Each size is a set share of the row
 *  (Platinum half, Gold a third ...), so higher categories get more room however many there are. */
export function TournamentSponsorList({ sponsors }: { sponsors: TournamentSponsor[] }) {
  const groups = sponsorGroups(sponsors);
  if (!groups.length) return null;
  return (
    <aside aria-labelledby="ts-list-title" className="glass-panel ts-list">
      <h2 id="ts-list-title" className="ts-list-title">Tournament sponsors</h2>
      {groups.map(g => (
        <section key={g.category} className="ts-group" data-size={g.size} aria-label={g.title}>
          <h3><CategoryIcon category={g.category} />{g.title}</h3>
          <div className="ts-group-logos">
            {g.sponsors.map(s => {
              const size = sponsorSize(s);
              const span = logoSpan(size, g.size);
              const style = { '--span': span.desk, '--span-phone': span.phone } as React.CSSProperties;
              // Platinum-size logos have room for the name and website underneath
              return size === 'platinum' ? (
                <div key={s.id} className="ts-big" style={style}>
                  <Tile s={s} height={LIST_LOGO[size]} />
                  <div className="ts-big-cap">
                    <span className="ts-big-name">{s.name}</span>
                    {s.website_url && <a className="ts-big-site" href={s.website_url} target="_blank" rel="noopener noreferrer sponsored">{s.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}<ExternalLink size={13} aria-hidden="true" /></a>}
                  </div>
                </div>
              ) : <Tile key={s.id} s={s} height={LIST_LOGO[size]} style={style} />;
            })}
          </div>
        </section>
      ))}
    </aside>
  );
}

type Api = ReturnType<typeof useTournamentSponsors>;

/** Admin: the tournament's Sponsors tab */
export function TournamentSponsorsAdmin({ clubId, api }: { clubId: string; api: Api }) {
  const { sponsors, save, remove, reorder, hasLogoSize } = api;
  const [editing, setEditing] = useState<TournamentSponsor | 'new' | null>(null);
  const ordered = inOrder(sponsors);
  // Grouped like the public list (hidden ones too); the arrows move a sponsor inside its category
  const groups = sponsorGroups(sponsors, true);

  const del = async (s: TournamentSponsor) => {
    if (!(await confirmAction({ title: `Remove ${s.name}?`, message: 'They come off this tournament\'s page straight away.', confirmLabel: 'Remove sponsor', danger: true }))) return;
    await remove(s.id);
  };

  return (
    <div>
      <div className="ts-admin-head">
        <p className="ht-lede">These show on this tournament&apos;s public page only, not with the club&apos;s sponsors. Logos are sized by category: Platinum biggest, then Gold, Silver and Bronze{hasLogoSize ? '. Change one sponsor\'s size with Edit' : ''}. The arrows set the order inside each category.</p>
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
            <thead><tr><th scope="col">Order</th><th scope="col">Sponsor</th><th scope="col">Category</th><th scope="col">Logo size</th><th scope="col">Shows in</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            {groups.map(g => (
            <tbody key={g.category}>
              <tr className="ts-group-row"><th scope="rowgroup" colSpan={6}>{categoryLabel(g.category)}</th></tr>
              {g.sponsors.map((s, i, list) => (
                <tr key={s.id}>
                  <td data-label="Order">
                    <span className="ts-order">
                      <span className="ts-order-num">{i + 1}</span>
                      <button type="button" className="ht-icon-btn" aria-label={`Move ${s.name} up`} disabled={i === 0} onClick={() => reorder(moveSponsor(list, s.id, -1))}><ChevronUp size={15} aria-hidden="true" /></button>
                      <button type="button" className="ht-icon-btn" aria-label={`Move ${s.name} down`} disabled={i === list.length - 1} onClick={() => reorder(moveSponsor(list, s.id, 1))}><ChevronDown size={15} aria-hidden="true" /></button>
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
                  <td data-label="Category"><span className="ht-state ts-cat"><CategoryIcon category={s.category} size={14} />{categoryLabel(s.category)}</span></td>
                  <td data-label="Logo size">
                    <span className={`ts-size${s.logo_size ? ' is-set' : ''}`}><Maximize2 size={13} aria-hidden="true" />{sizeLabel(sponsorSize(s))}{s.logo_size ? ' (set)' : ''}</span>
                  </td>
                  <td data-label="Shows in">
                    {!s.is_active ? <span className="ht-sub ts-hidden"><EyeOff size={13} aria-hidden="true" />Hidden</span>
                      : s.placement === 'title' ? <span className="ht-state ts-main">Main sponsor (presents)</span>
                      : s.placement === 'header' ? <span className="ht-state" data-tone="ok">{PLACEMENT_LABEL.header}</span>
                      : <span className="ht-sub">{PLACEMENT_LABEL.list}</span>}
                  </td>
                  <td className="ts-actions">
                    <button type="button" className="ht-icon-btn" aria-label={`Edit ${s.name}`} onClick={() => setEditing(s)}><Pencil size={15} aria-hidden="true" /></button>
                    <button type="button" className="ht-icon-btn is-danger" aria-label={`Remove ${s.name}`} onClick={() => del(s)}><Trash2 size={15} aria-hidden="true" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
            ))}
          </table>
        </div>
      )}

      {editing && (
        <SponsorForm clubId={clubId} sponsor={editing === 'new' ? null : editing} currentTitle={titleSponsor(sponsors) || sponsors.find(s => s.placement === 'title')} nextOrder={ordered.length ? ordered[ordered.length - 1].display_order + 1 : 0}
          hasLogoSize={hasLogoSize} onSave={(fields, id) => save(fields, id)} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function SponsorForm({ clubId, sponsor, nextOrder, currentTitle, hasLogoSize, onSave, onClose }: {
  clubId: string;
  /** The logo_size column exists (migration 20261199) */
  hasLogoSize: boolean;
  /** The tournament's main sponsor now, if any: picking another one moves it to the header strip */
  currentTitle?: TournamentSponsor;
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
  const [placement, setPlacement] = useState<SponsorPlacement>(sponsor?.placement || defaultPlacement(startCat));
  const [placementTouched, setPlacementTouched] = useState(!!sponsor);
  const [shown, setShown] = useState(sponsor?.is_active ?? true);
  // null = same as its category
  const [logoSize, setLogoSize] = useState<LogoSize | null>(sponsor?.logo_size ?? null);
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
    // One main sponsor per tournament (the database insists): the old one moves to the header strip first
    if (placement === 'title' && currentTitle && currentTitle.id !== sponsor?.id) {
      const moved = await onSave({ placement: 'header' }, currentTitle.id);
      if (moved) { setBusy(false); return setError(`Couldn't move ${currentTitle.name}: ${moved}`); }
    }
    const err = await onSave({
      name: name.trim(), logo_url: logo || null, website_url: normaliseWebsite(website) || null, category: cat.slice(0, 40), placement, is_active: shown,
      ...(hasLogoSize ? { logo_size: logoSize } : {}),
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
                <button key={c.key} type="button" className="ts-seg-ic" aria-pressed={category === c.key} onClick={() => pickCategory(c.key)}><CategoryIcon category={c.key} size={14} />{c.label}</button>
              ))}
              <button type="button" className="ts-seg-ic" aria-pressed={category === 'other'} onClick={() => pickCategory('other')}><Tag size={14} aria-hidden="true" />Other</button>
            </div>
            {category === 'other' && (
              <input aria-label="Your own category" className="form-input" style={{ marginTop: '0.5rem' }} placeholder="For example Food partner" maxLength={40}
                value={ownCategory} onChange={e => setOwnCategory(e.target.value)} />
            )}
            <p className="ht-hint">The public list goes Platinum, Gold, Silver, Bronze, Media partner, Partner, then your own categories.</p>
          </fieldset>
          {hasLogoSize && (() => {
            const catSize = categorySize(category === 'other' ? (ownCategory.trim() || 'other') : category);
            const now = logoSize ?? catSize;
            const shownCat = category === 'other' ? (ownCategory.trim() || 'your category') : categoryLabel(category);
            return (
              <fieldset className="ht-fx-status">
                <legend className="form-label ts-legend"><Maximize2 size={14} aria-hidden="true" />Logo size</legend>
                <div className="ht-fx-seg ts-seg-wrap">
                  <button type="button" aria-pressed={logoSize === null} onClick={() => setLogoSize(null)}>Same as category</button>
                  {LOGO_SIZES.map(z => (
                    <button key={z.key} type="button" aria-pressed={logoSize === z.key} onClick={() => setLogoSize(z.key)}>{z.label}</button>
                  ))}
                </div>
                <div className="ts-size-preview" aria-hidden="true">
                  {LOGO_SIZES.map(z => <span key={z.key} className={z.key === now ? 'is-on' : ''} data-size={z.key} />)}
                </div>
                <p className="ht-hint">
                  {logoSize === null
                    ? `Shows at ${sizeLabel(catSize)}, the size for ${shownCat}. Pick another only when a sponsor should stand out more or less than its category.`
                    : `Shows at ${sizeLabel(now)}, still listed under ${shownCat}.`}
                </p>
              </fieldset>
            );
          })()}
          <fieldset className="ht-fx-status">
            <legend className="form-label">Where it shows</legend>
            <div className="ht-fx-seg ts-seg-wrap">
              {(['title', 'header', 'list'] as const).map(p => (
                <button key={p} type="button" aria-pressed={placement === p} onClick={() => { setPlacement(p); setPlacementTouched(true); }}>{PLACEMENT_LABEL[p]}</button>
              ))}
            </div>
            <p className="ht-hint">
              {placement === 'title'
                ? `Shown above the tournament name: "${name.trim() || 'Sponsor'} presents". A tournament has one main sponsor${currentTitle && currentTitle.id !== sponsor?.id ? `, so ${currentTitle.name} moves to the header strip` : ''}.`
                : 'Every sponsor is also in the list at the bottom of the page.'}
            </p>
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
