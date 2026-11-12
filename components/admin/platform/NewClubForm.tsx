'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Check, History, Mail, Plus } from 'lucide-react';
import ImageUploadZone from '@/components/ImageUploadZone';
import WizardGroundSearch, { type WizardGround } from '@/components/grounds/WizardGroundSearch';
import { isClubSlugAvailable } from '@/lib/club-context';
import { checkClubSlug } from '@/lib/slugs';
import { FOOTBALL_COLOR_PALETTES } from '@/lib/theme-utils';
import { getAccessToken } from '@/lib/supabase/client';
import { Crest } from '@/components/admin/platform/McArt';
import { platformApi } from '@/components/admin/platform/api';

// Mission Control -> Clubs -> New club. The same details as the public Create club wizard on one page.
// The platform admin who makes it is the Owner; an owner email sends the Owner invite, and the club
// moves to that person when they accept (keepOldOwner false). Server side: /api/platform/clubs.

interface Props {
  onCancel: () => void;
  /** The club is saved; `note` says what else happened (invite sent or not) */
  onMade: (clubId: string, note: string) => void;
}

const blank = {
  name: '', short_name: '', slug: '',
  primary_color: '#10B981', secondary_color: '#0F172A', accent_color: '#F59E0B', logo_url: '',
  stadium_name: '', stadium_address: '', stadium_pitch_type: '', stadium_parking_info: '',
  contact_email: '', contact_phone: '', owner_email: '',
};

export default function NewClubForm({ onCancel, onMade }: Props) {
  const [f, setF] = useState(blank);
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugFree, setSlugFree] = useState<boolean | null>(null);
  const [ground, setGround] = useState<WizardGround | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof blank, v: string) => setF(prev => ({
    ...prev,
    [k]: v,
    // The web address follows the name until it's typed by hand
    ...(k === 'name' && !slugEdited ? { slug: checkClubSlug(v).cleanSlug } : {}),
  }));

  const slug = checkClubSlug(f.slug || f.name);
  useEffect(() => {
    setSlugFree(null);
    if (slug.error) return;
    let live = true;
    const t = setTimeout(() => { isClubSlugAvailable(slug.cleanSlug).then(ok => { if (live) setSlugFree(ok); }); }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [slug.cleanSlug, slug.error]);

  const pickGround = (g: WizardGround | null) => {
    setGround(g);
    if (!g) return;
    const pitch = (g.pitches || [])[0];
    setF(prev => ({
      ...prev,
      stadium_name: g.name,
      stadium_address: [g.address, `${g.suburb} ${g.state}${g.postcode ? ` ${g.postcode}` : ''}`].filter(Boolean).join(', '),
      stadium_parking_info: g.parking ? g.parking.slice(0, 200) : prev.stadium_parking_info,
      ...(pitch?.surface && /synthetic|turf|artificial/i.test(pitch.surface) ? { stadium_pitch_type: '3G / 4G All-Weather Turf' } : {}),
    }));
  };

  const owner = f.owner_email.trim().toLowerCase();
  const ownerFirst = owner ? owner.split('@')[0] : '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (slug.error) { setError(slug.error); return; }
    if (slugFree === false) { setError(`itsfootball.club/${slug.cleanSlug} is already taken. Pick another web address.`); return; }
    setBusy(true);
    setError(null);
    const res = await platformApi<{ id?: string; slug?: string }>('clubs', { ...f, slug: slug.cleanSlug });
    if (res.error || !res.id) { setBusy(false); setError(res.error || 'The club could not be made.'); return; }
    const clubId = res.id;
    const notes: string[] = [];

    if (ground) {
      // Not fatal: the ground can be linked later under Branding -> Home ground guide
      const token = await getAccessToken();
      const linked = await fetch('/api/admin/grounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ clubId, action: 'save', groundId: ground.id, listed: false }),
      }).then(r => r.ok).catch(() => false);
      if (!linked) notes.push('The home ground could not be linked to the directory, so link it in the club’s Branding page.');
    }

    if (owner) {
      const inv = await platformApi('club-invites', { action: 'invite', clubId, email: owner, role: 'owner', keepOldOwner: false });
      notes.unshift(inv.error ? `The Owner invite didn’t go: ${inv.error} Send it again from Who runs it.` : `Owner invite sent to ${owner}.`);
    } else {
      notes.unshift('You’re the Owner.');
    }
    setBusy(false);
    onMade(clubId, notes.join(' '));
  };

  const address = `itsfootball.club/${slug.cleanSlug || 'your-club'}`;

  return (
    <div>
      <div className="mc-page-h">
        <div>
          <button type="button" className="mc-back" onClick={onCancel}><ArrowLeft size={14} /> Clubs</button>
          <h1>New club</h1>
          <p>Same details as the public Create club page. Everything can be changed later in the club&rsquo;s admin.</p>
        </div>
      </div>

      <div className="mc-nc">
        <form className="mc-card mc-nc-form" onSubmit={submit} aria-label="New club">
          <section className="mc-cp-sec">
            <h3><span className="mc-nc-n">1</span>Name and web address</h3>
            <div className="mc-nc-row">
              <label className="mc-nc-fld"><span>Club name</span>
                <input className="mc-input" required minLength={2} maxLength={80} value={f.name} onChange={e => set('name', e.target.value)} autoComplete="off" />
              </label>
              <label className="mc-nc-fld"><span>Short name</span>
                <input className="mc-input" maxLength={12} placeholder={f.name ? f.name.substring(0, 3).toUpperCase() : 'Optional'} value={f.short_name} onChange={e => set('short_name', e.target.value)} />
              </label>
            </div>
            <label className="mc-nc-fld"><span>Web address</span>
              <span className="mc-nc-pre"><span>itsfootball.club/</span>
                <input className="mc-input" value={f.slug} onChange={e => { setSlugEdited(true); set('slug', e.target.value); }} aria-describedby="mc-nc-slug" autoComplete="off" />
              </span>
              <small id="mc-nc-slug" className={!slug.error && slugFree ? 'ok' : slug.error || slugFree === false ? 'bad' : ''} aria-live="polite">
                {!f.name && !f.slug ? 'Fills in from the name.' : slug.error || (slugFree === false ? 'Already taken. Pick another.' : slugFree ? 'Free to use' : 'Checking…')}
              </small>
            </label>
          </section>

          <section className="mc-cp-sec">
            <h3><span className="mc-nc-n">2</span>Colours and crest</h3>
            <div className="mc-nc-fld"><span>Pick a set</span>
              <div className="mc-nc-pals">
                {FOOTBALL_COLOR_PALETTES.map(p => (
                  <button key={p.name} type="button" className="mc-nc-pal" aria-label={p.name} title={p.name}
                    aria-pressed={f.primary_color === p.primary && f.secondary_color === p.secondary && f.accent_color === p.accent}
                    onClick={() => setF(prev => ({ ...prev, primary_color: p.primary, secondary_color: p.secondary, accent_color: p.accent }))}>
                    <i style={{ background: p.primary }} /><i style={{ background: p.secondary }} /><i style={{ background: p.accent }} />
                  </button>
                ))}
              </div>
            </div>
            <div className="mc-nc-cols">
              {([['primary_color', 'Primary'], ['secondary_color', 'Secondary'], ['accent_color', 'Accent']] as const).map(([k, label]) => (
                <label key={k} className="mc-nc-col">
                  <input type="color" value={f[k]} onChange={e => set(k, e.target.value.toUpperCase())} aria-label={`${label} colour`} />
                  {label} <span className="num">{f[k]}</span>
                </label>
              ))}
            </div>
            <div className="mc-nc-fld">
              <ImageUploadZone
                label="Crest"
                recommendedText="Square PNG or SVG. Leave it and they get the plain shield for now."
                currentImageUrl={f.logo_url}
                onUploadComplete={url => set('logo_url', url)}
                folder="crests"
                aspectRatio="1:1"
              />
            </div>
          </section>

          <section className="mc-cp-sec">
            <h3><span className="mc-nc-n">3</span>Home ground <span className="mc-muted">optional</span></h3>
            <WizardGroundSearch picked={ground} onPick={pickGround} />
            {!ground && (
              <label className="mc-nc-fld"><span>Or type the ground&rsquo;s name</span>
                <input className="mc-input" maxLength={120} value={f.stadium_name} onChange={e => set('stadium_name', e.target.value)} />
              </label>
            )}
          </section>

          <section className="mc-cp-sec">
            <h3><span className="mc-nc-n">4</span>Contact <span className="mc-muted">optional, the club can add these later</span></h3>
            <div className="mc-nc-row even">
              <label className="mc-nc-fld"><span>Club email</span>
                <input className="mc-input" type="email" maxLength={200} placeholder="Optional" value={f.contact_email} onChange={e => set('contact_email', e.target.value)} />
              </label>
              <label className="mc-nc-fld"><span>Phone</span>
                <input className="mc-input" type="tel" maxLength={40} placeholder="Optional" value={f.contact_phone} onChange={e => set('contact_phone', e.target.value)} />
              </label>
            </div>
          </section>

          <section className="mc-cp-sec">
            <h3><span className="mc-nc-n">5</span>Who owns it</h3>
            <label className="mc-nc-fld"><span>Owner&rsquo;s email <small>(optional)</small></span>
              <input className="mc-input" type="email" maxLength={200} placeholder="Leave blank to own it yourself" value={f.owner_email} onChange={e => set('owner_email', e.target.value)} />
            </label>
            <p className="mc-nc-note">
              {owner
                ? `We email ${ownerFirst} an Owner invite (one use, 7 days). Until ${ownerFirst} accepts, you’re the Owner so you can set the club up. When they accept, the club moves to them and they get the welcome pack.`
                : 'Left blank: you’re the Owner. You can hand it over later with an Owner invite from the club panel.'}
            </p>
          </section>

          {error && <p className="mc-nc-err" role="alert">{error}</p>}
          <div className="mc-nc-foot">
            <span className="mc-muted">Goes live straight away at {address}</span>
            <button type="button" className="mc-pill-btn ghost" onClick={onCancel} disabled={busy}>Cancel</button>
            <button type="submit" className="mc-pill-btn" disabled={busy || !!slug.error || slugFree === false}>
              <Plus size={14} /> {busy ? 'Making the club…' : owner ? 'Make club and send invite' : 'Make club'}
            </button>
          </div>
        </form>

        <aside className="mc-card mc-nc-pv" aria-label="Preview">
          <div className="band" style={{ background: `linear-gradient(135deg, ${f.primary_color}, ${f.primary_color} 60%, ${f.accent_color})` }} />
          <div className="body">
            <Crest logoUrl={f.logo_url || null} label={f.short_name || f.name || 'FC'} color={f.primary_color} size={56} />
            <div><h2>{f.name || 'Your club'}</h2><small className="mc-muted">{address}</small></div>
            <ul>
              <li><Check size={14} />Public site, match centre and admin pages go live</li>
              {f.stadium_name && <li><Check size={14} />{f.stadium_name} {ground ? 'linked as the home ground' : 'as the home ground'}</li>}
              <li><Mail size={14} /><span>{owner ? `Owner invite to ${owner}` : 'You’re the Owner'}</span></li>
              <li><History size={14} />Written to the Action log as made by you</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
