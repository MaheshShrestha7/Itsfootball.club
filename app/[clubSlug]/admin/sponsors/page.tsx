'use client';

import React, { useEffect, useState, use } from 'react';
import { useClub } from '@/lib/club-context';
import { Sponsor, SponsorTier, SponsorSizeScale, SponsorPackageStatus } from '@/lib/supabase/types';
import { defaultSeasonLabel } from '@/lib/season';
import { isSponsorOnSite, sponsorHref, sponsorLabel, sponsorTierLabel } from '@/lib/sponsors';
import { useUrlTab } from '@/lib/use-url-tab';
import { useSearchParams } from 'next/navigation';
import SponsorPackagesPanel from '@/components/admin/SponsorPackagesPanel';
import ImageUploadZone from '@/components/ImageUploadZone';
import SponsorLogo from '@/components/SponsorLogo';
import { DollarSign, Plus, Edit2, ExternalLink, X, Sparkles, LayoutGrid, Eye, EyeOff, Maximize2, Calendar, Shield, Mail, Phone, User, Check, AlertCircle, Inbox, Package, RotateCcw, Power } from 'lucide-react';
import { confirmAction } from '@/components/ConfirmDialog';
import { getSupabaseClient } from '@/lib/supabase/client';
import { formatMoney } from '@/lib/finance';
import { DATE_LOCALE } from '@/lib/dates';

const PACKAGE_STATUS_LABEL: Record<SponsorPackageStatus, string> = {
  prospect: 'Prospect (In Talks)',
  confirmed: 'Confirmed',
  paid: 'Paid',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

const ENDED: SponsorPackageStatus[] = ['expired', 'cancelled'];
const isEnded = (s: Sponsor) => !!s.package_status && ENDED.includes(s.package_status);
/** Signed up on the club's website and not put on the site yet (paid or not) */
const isNewSignup = (s: Sponsor) => !s.is_active && !isEnded(s) && (s.package_status === 'prospect' || s.package_status === 'paid');

type View = 'all' | 'new' | 'live' | 'hidden' | 'ended';
const VIEWS: { id: View; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New sign-ups' },
  { id: 'live', label: 'On site' },
  { id: 'hidden', label: 'Hidden' },
  { id: 'ended', label: 'Ended' },
];
const viewOf = (s: Sponsor): Exclude<View, 'all'> =>
  isEnded(s) ? 'ended' : isNewSignup(s) ? 'new' : isSponsorOnSite(s) ? 'live' : 'hidden';

/** An on/off switch in the style of Branding's home ground panel */
function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      style={{ flexShrink: 0, width: 48, height: 28, padding: 0, borderRadius: 999, border: '1px solid var(--border-medium)', background: checked ? 'var(--club-primary)' : 'rgba(var(--tint-rgb), 0.1)', position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s ease' }}>
      <span style={{ position: 'absolute', top: 3, left: checked ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s ease' }} />
    </button>
  );
}

const onSiteBadge = (s: Sponsor) => isSponsorOnSite(s)
  ? <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--c-green)', border: '1px solid rgba(16, 185, 129, 0.35)', fontSize: '0.7rem' }}>● On site</span>
  : <span className="badge" style={{ background: 'rgba(var(--tint-rgb), 0.06)', color: 'var(--text-muted)', border: '1px dashed var(--border-medium)', fontSize: '0.7rem' }}>Hidden from site</span>;

function getSponsorEffectiveScale(s: Sponsor): 'xl' | 'lg' | 'md' | 'sm' {
  if (s.size_scale && s.size_scale !== 'auto') {
    return s.size_scale;
  }
  switch (s.tier) {
    case 'platinum':
      return 'xl';
    case 'gold':
      return 'lg';
    case 'silver':
      return 'md';
    case 'bronze':
    case 'grassroots':
    default:
      return 'sm';
  }
}

export default function AdminSponsorsPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const { clubs, selectClubBySlug, sponsors, events, addSponsor, updateSponsor, deleteSponsor } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];

  const clubSponsors = sponsors.filter(s => s.club_id === club.id);
  const clubWideSponsors = clubSponsors.filter(s => !s.event_id);
  // The preview shows what fans see: club-wide sponsors that are on the site
  const previewSponsors = clubWideSponsors.filter(isSponsorOnSite);

  // Sponsor list or Packages (?tab=packages, from the admin menu and Finance)
  const [tab, setTab] = useUrlTab(['list', 'packages'] as const);
  // Which sponsors the list shows (?view=new opens New sign-ups, from "Needs you")
  // (replaceState with no state of its own keeps useSearchParams in sync, as in useUrlTab)
  const searchParams = useSearchParams();
  const view: View = VIEWS.find(v => v.id === searchParams.get('view'))?.id ?? 'all';
  const setView = (next: View) => {
    const query = new URLSearchParams(window.location.search);
    if (next === 'all') query.delete('view');
    else query.set('view', next);
    const search = query.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`);
  };
  const viewCounts = clubSponsors.reduce<Record<View, number>>(
    (acc, sp) => ({ ...acc, [viewOf(sp)]: acc[viewOf(sp)] + 1 }),
    { all: clubSponsors.length, new: 0, live: 0, hidden: 0, ended: 0 }
  );
  const shownSponsors = view === 'all' ? clubSponsors : clubSponsors.filter(sp => viewOf(sp) === view);

  const putOnSite = (sp: Sponsor) => updateSponsor(sp.id, { is_active: true });
  const endSponsorship = async (sp: Sponsor) => {
    if (await confirmAction({
      title: `End the sponsorship with ${sp.name}?`,
      message: 'They come off your club site straight away. Their details, payments and view and click history are kept, and you can bring them back later.',
      confirmLabel: 'End sponsorship',
    })) updateSponsor(sp.id, { is_active: false, package_status: 'expired' });
  };
  const bringBack = (sp: Sponsor) => updateSponsor(sp.id, { is_active: true, package_status: 'confirmed' });
  const clubEvents = events.filter(e => e.club_id === club.id);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showLivePreview, setShowLivePreview] = useState(true);
  // Package values in the club's own currency, the same as Finance shows them (AUD until set)
  const [currency, setCurrency] = useState('AUD');
  useEffect(() => {
    getSupabaseClient()?.from('club_payment_settings').select('currency').eq('club_id', club.id).maybeSingle()
      .then(({ data }) => data?.currency && setCurrency(data.currency));
  }, [club.id]);

  // Labels need migration 20261127_sponsor_labels.sql; until it runs the box stays hidden so saves keep working
  const [labelsReady, setLabelsReady] = useState<boolean | null>(() => (getSupabaseClient() ? null : true));
  useEffect(() => {
    getSupabaseClient()?.from('sponsors').select('label').limit(1).then(({ error }) => setLabelsReady(!error));
  }, []);

  const blankForm = {
    scope: 'club' as 'club' | 'event',
    event_id: '',
    name: '',
    // No stock photo or placeholder site: a sponsor without a logo shows its initials
    logo_url: '',
    website_url: '',
    tier: 'gold' as SponsorTier,
    label: '',
    size_scale: 'auto' as SponsorSizeScale,
    display_order: clubWideSponsors.length + 1,
    is_active: true,
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    package_value: '' as number | '',
    package_status: 'confirmed' as SponsorPackageStatus,
    season: defaultSeasonLabel(),
  };

  const [form, setForm] = useState(blankForm);

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({ ...blankForm, display_order: clubWideSponsors.length + 1 });
    setModalOpen(true);
  };

  const handleOpenEdit = (s: Sponsor) => {
    setEditingId(s.id);
    setForm({
      scope: s.event_id ? 'event' : 'club',
      event_id: s.event_id || '',
      name: s.name,
      logo_url: s.logo_url,
      website_url: s.website_url || '',
      tier: s.tier,
      label: s.label || '',
      size_scale: s.size_scale || 'auto',
      display_order: s.display_order,
      is_active: s.is_active,
      contact_name: s.contact_name || '',
      contact_email: s.contact_email || '',
      contact_phone: s.contact_phone || '',
      package_value: s.package_value ?? '',
      package_status: s.package_status || 'confirmed',
      season: s.season || defaultSeasonLabel(),
    });
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    if (form.scope === 'event' && !form.event_id) return;

    const { scope, label, ...rest } = form;
    const payload = {
      ...rest,
      // An ended sponsorship is never on the site
      is_active: rest.is_active && !ENDED.includes(rest.package_status),
      // Only sent once the label column exists
      ...(labelsReady ? { label: label.trim() || null } : {}),
      event_id: scope === 'event' ? form.event_id : undefined,
      package_value: form.package_value === '' ? undefined : Number(form.package_value),
    };

    if (editingId) {
      updateSponsor(editingId, payload);
    } else {
      addSponsor({
        club_id: club.id,
        ...payload,
      });
    }
    setModalOpen(false);
  };

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  const editingSponsor = editingId ? clubSponsors.find(sp => sp.id === editingId) : undefined;

  return (
    <div>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        <div>
          <span className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>CLUB SPONSORS & PARTNERS</span>
          <h1 className="stat-value">
            Club Sponsors & Commercial Partners
          </h1>
          <p className="text-body">
            Manage your kit sponsors, ground naming rights and community sponsors.
          </p>
        </div>

        <button onClick={handleOpenAdd} className="btn btn-primary row">
          <Plus size={16} />
          <span>Add New Sponsor</span>
        </button>
      </div>

      <div className="sponsor-tabs" role="tablist" aria-label="Sponsors" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {([['list', 'Sponsor List', Shield], ['packages', 'Packages', Package]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} data-view-ok onClick={() => setTab(id)}
            className={`btn btn-sm ${tab === id ? 'btn-primary' : 'btn-secondary'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'packages' ? <SponsorPackagesPanel club={club} /> : (<>

      {/* Top Banner & Live Preview Toggle */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem 1rem',
        padding: '0.85rem 1.25rem',
        background: 'rgba(var(--tint-rgb), 0.03)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '12px',
        marginBottom: '1.5rem',
      }}>
        {/* One paragraph that wraps as a whole, not three side-by-side columns on a phone */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', flex: '1 1 260px', minWidth: 0 }}>
          <Sparkles size={16} color="var(--c-amber)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Sponsor Space Scaling Active: </strong>
            Platinum sponsors receive premier width &amp; larger logos, cascading down to Gold, Silver, and Grassroots.
          </p>
        </div>
        <button data-view-ok
          type="button"
          onClick={() => setShowLivePreview(!showLivePreview)}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}
        >
          <Eye size={13} />
          <span>{showLivePreview ? 'Hide Live Preview' : 'Show Public Preview'}</span>
        </button>
      </div>

      {/* Live Public Scaling Preview (club-wide sponsors only - event sponsors show on their event's page) */}
      {showLivePreview && previewSponsors.length > 0 && (view === 'all' || view === 'live') && (
        <div style={{
          marginBottom: '2rem',
          padding: '1.25rem',
          background: 'rgba(var(--shade-rgb), 0.25)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <LayoutGrid size={14} /> What fans see
            </span>
            <span className="text-meta">
              Only sponsors that are on the site, at the size fans see them
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', justifyContent: 'flex-start' }}>
            {previewSponsors.map(sponsor => {
              const scale = getSponsorEffectiveScale(sponsor);
              const isXL = scale === 'xl';
              const isLG = scale === 'lg';
              const isMD = scale === 'md';
              return (
                <div
                  key={`prev-${sponsor.id}`}
                  style={{
                    padding: isXL ? '1rem 1.5rem' : isLG ? '0.85rem 1.25rem' : isMD ? '0.7rem 1rem' : '0.5rem 0.8rem',
                    background: isXL
                      ? 'radial-gradient(ellipse at top left, rgba(245, 158, 11, 0.15), rgba(var(--dk-30-41-59), 0.7))'
                      : isLG
                      ? 'rgba(245, 158, 11, 0.06)'
                      : 'rgba(var(--tint-rgb), 0.03)',
                    border: isXL
                      ? '1px solid rgba(245, 158, 11, 0.5)'
                      : isLG
                      ? '1px solid rgba(245, 158, 11, 0.25)'
                      : '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: isXL ? '1rem' : isLG ? '0.75rem' : '0.5rem',
                    minWidth: isXL ? '280px' : isLG ? '220px' : isMD ? '170px' : '130px',
                    flex: isXL ? '2 1 280px' : isLG ? '1.5 1 220px' : '1 1 160px',
                    boxShadow: isXL ? '0 6px 24px rgba(245, 158, 11, 0.12)' : 'none',
                  }}
                >
                  <SponsorLogo
                    src={sponsor.logo_url}
                    name={sponsor.name}
                    height={isXL ? 48 : isLG ? 36 : isMD ? 28 : 22}
                    style={{ maxWidth: isXL ? '130px' : isLG ? '100px' : isMD ? '80px' : '65px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: isXL ? '1rem' : isLG ? '0.88rem' : '0.78rem', color: 'var(--text-primary)' }}>
                      {sponsor.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '2px' }}>
                      <span className="badge" style={{
                        fontSize: '0.7rem',
                        backgroundColor: sponsor.tier === 'platinum' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(var(--tint-rgb), 0.08)',
                        color: sponsor.tier === 'platinum' ? 'var(--c-amber)' : 'var(--text-muted)',
                      }}>
                        {sponsorLabel(sponsor).toUpperCase()}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: isXL ? 'var(--c-amber)' : 'var(--text-muted)', fontWeight: 600 }}>
                        {scale.toUpperCase()} Space
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Which sponsors to list */}
      <div className="row row-wrap" role="group" aria-label="Show" style={{ gap: '0.4rem', marginBottom: '1.25rem', padding: '0.3rem', borderRadius: '12px', background: 'rgba(var(--shade-rgb), 0.35)', border: '1px solid var(--border-subtle)', width: 'fit-content', maxWidth: '100%' }}>
        {VIEWS.map(v => (
          <button key={v.id} type="button" data-view-ok aria-pressed={view === v.id} onClick={() => setView(v.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.8rem', borderRadius: '9px', cursor: 'pointer',
              border: 'none', fontSize: '0.8rem', fontWeight: 700,
              background: view === v.id ? 'rgba(var(--tint-rgb), 0.1)' : 'transparent',
              color: view === v.id ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: view === v.id ? 'inset 0 -2px 0 var(--club-primary)' : 'none',
            }}>
            {v.label}
            <span style={{ fontSize: '0.7rem', padding: '0 0.45rem', borderRadius: 999, background: v.id === 'new' && viewCounts.new > 0 ? 'rgba(59, 130, 246, 0.25)' : 'rgba(var(--tint-rgb), 0.1)', color: v.id === 'new' && viewCounts.new > 0 ? 'var(--c-blue)' : 'var(--text-secondary)' }}>
              {viewCounts[v.id]}
            </span>
          </button>
        ))}
      </div>

      {/* Sponsors List */}
      {(() => {
        const renderSponsorRow = (sponsor: Sponsor) => {
          const scale = getSponsorEffectiveScale(sponsor);
          const isCustomScale = sponsor.size_scale && sponsor.size_scale !== 'auto';
          const linkedEvent = sponsor.event_id ? clubEvents.find(e => e.id === sponsor.event_id) : undefined;
          const stage = viewOf(sponsor);
          const website = sponsorHref(sponsor.website_url);
          return (
            <div
              key={sponsor.id}
              className="glass-panel"
              style={{
                padding: '1.25rem 1.75rem',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                opacity: stage === 'ended' ? 0.75 : undefined,
                borderLeft: stage === 'new' && sponsor.package_status === 'paid' ? '4px solid #10B981'
                  : stage === 'ended' ? undefined
                  : scale === 'xl' ? '4px solid #F59E0B' : scale === 'lg' ? '4px solid #EAB308' : undefined,
              }}
            >
              {/* On a phone the details move under the logo instead of squeezing into a narrow column */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.85rem 1.25rem', flex: '1 1 auto', minWidth: 0 }}>
                <SponsorLogo
                  src={sponsor.logo_url}
                  name={sponsor.name}
                  height={scale === 'xl' ? 46 : 38}
                  style={{
                    width: scale === 'xl' ? '70px' : '55px',
                    background: 'rgba(var(--tint-rgb), 0.05)',
                    padding: '4px',
                    borderRadius: '6px',
                  }}
                />
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{sponsor.name}</span>
                    <span className="badge" style={{
                      backgroundColor: sponsor.tier === 'platinum' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(var(--tint-rgb), 0.08)',
                      color: sponsor.tier === 'platinum' ? 'var(--c-amber)' : 'var(--text-secondary)',
                    }}>
                      {sponsor.tier.toUpperCase()}
                    </span>
                    {sponsor.label?.trim() && <span className="text-meta">Shown as &ldquo;{sponsor.label.trim()}&rdquo;</span>}
                    {stage !== 'new' && stage !== 'ended' && (
                      <span className="badge" style={{
                        backgroundColor: scale === 'xl' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(var(--tint-rgb), 0.05)',
                        color: scale === 'xl' ? 'var(--c-amber)' : 'var(--text-muted)',
                        fontSize: '0.7rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}>
                        <Maximize2 size={10} />
                        {scale.toUpperCase()} Space Allocation
                        {isCustomScale && ' (Custom)'}
                      </span>
                    )}
                    {sponsor.package_status && (
                      <span className="badge" style={{
                        backgroundColor: sponsor.package_status === 'paid' ? 'rgba(16, 185, 129, 0.15)' : sponsor.package_status === 'prospect' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(var(--tint-rgb), 0.05)',
                        color: sponsor.package_status === 'paid' ? 'var(--c-green)' : sponsor.package_status === 'prospect' ? 'var(--c-blue)' : 'var(--text-muted)',
                        fontSize: '0.7rem',
                      }}>
                        {stage === 'new' && sponsor.package_status === 'prospect' ? 'Not paid yet' : PACKAGE_STATUS_LABEL[sponsor.package_status]}
                      </span>
                    )}
                    {stage !== 'ended' && onSiteBadge(sponsor)}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.85rem', marginTop: '4px' }}>
                    {website && (
                      <a
                        href={website}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <span>{sponsor.website_url}</span>
                        <ExternalLink size={11} />
                      </a>
                    )}
                    {sponsor.package_value != null && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {formatMoney(Math.round(sponsor.package_value * 100), currency)}
                        {sponsor.season ? ` • ${sponsor.season}` : ''}
                      </span>
                    )}
                    {sponsor.contact_name && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <User size={11} />
                        {sponsor.contact_name}
                      </span>
                    )}
                  </div>
                  {/* A website sign-up: what to check before it goes on the site */}
                  {stage === 'new' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 0.9rem', marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: 600 }}>
                      {sponsor.package_status === 'paid' && (
                        <span style={{ color: 'var(--c-green)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Check size={12} /> Paid</span>
                      )}
                      {sponsor.logo_url
                        ? <span style={{ color: 'var(--c-green)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><Check size={12} /> Logo added</span>
                        : <span style={{ color: 'var(--c-amber)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}><AlertCircle size={12} /> No logo yet (their initials will show)</span>}
                      <span style={{ color: 'var(--c-amber)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <AlertCircle size={12} /> {website ? 'Check the name and website they typed' : 'Check the name they typed (no website)'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="row row-wrap">
                {linkedEvent && (
                  <span className="badge badge-primary" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Calendar size={11} /> {linkedEvent.title}
                  </span>
                )}
                <button onClick={() => handleOpenEdit(sponsor)} title={`Edit ${sponsor.name}`} aria-label={`Edit ${sponsor.name}`} className="btn btn-secondary btn-sm" style={{ minWidth: '40px', minHeight: '40px' }}>
                  <Edit2 size={14} />
                </button>
                {(stage === 'new' || stage === 'hidden') && (
                  <button type="button" onClick={() => putOnSite(sponsor)} className="btn btn-primary btn-sm" style={{ minHeight: '40px', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Eye size={14} /> Put on site
                  </button>
                )}
                {stage === 'live' && (
                  <button type="button" onClick={() => endSponsorship(sponsor)} className="btn btn-secondary btn-sm" style={{ minHeight: '40px', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Power size={14} /> End sponsorship
                  </button>
                )}
                {stage === 'ended' && (
                  <button type="button" onClick={() => bringBack(sponsor)} className="btn btn-secondary btn-sm" style={{ minHeight: '40px', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <RotateCcw size={14} /> Bring back
                  </button>
                )}
              </div>
            </div>
          );
        };

        const heading = (icon: React.ReactNode, text: string) => (
          <h3 style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {icon} {text}
          </h3>
        );

        if (clubSponsors.length === 0) {
          return (
            <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No sponsors yet. Click &ldquo;Add New Sponsor&rdquo; to add your first club or event partner, or set up
              packages so businesses can sign up on your site.
            </div>
          );
        }
        if (shownSponsors.length === 0) {
          return (
            <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Nothing here right now.
            </div>
          );
        }

        // New sign-ups first, then the club-wide and event sponsors, then ended sponsorships
        const signups = shownSponsors.filter(sp => viewOf(sp) === 'new');
        const ended = shownSponsors.filter(sp => viewOf(sp) === 'ended');
        const current = shownSponsors.filter(sp => viewOf(sp) === 'live' || viewOf(sp) === 'hidden');
        const currentClubWide = current.filter(sp => !sp.event_id);
        // Group event-scoped sponsors under the event they belong to; sponsors whose
        // event was since deleted still show under a "Former Event" fallback group.
        const eventGroups = clubEvents
          .map(evt => ({ event: evt, list: current.filter(sp => sp.event_id === evt.id) }))
          .filter(g => g.list.length > 0);
        const orphanedEventSponsors = current.filter(
          sp => sp.event_id && !clubEvents.some(e => e.id === sp.event_id)
        );

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {signups.length > 0 && (
              <div>
                {heading(<Inbox size={14} />, 'New sign-ups from your website')}
                <p className="text-note" style={{ margin: '-0.4rem 0 0.85rem' }}>
                  They stay off your site until you check their details and tap Put on site.
                </p>
                <div className="stack">{signups.map(renderSponsorRow)}</div>
              </div>
            )}

            {currentClubWide.length > 0 && (
              <div>
                {heading(<Shield size={14} />, 'Club-Wide Sponsors')}
                <div className="stack">{currentClubWide.map(renderSponsorRow)}</div>
              </div>
            )}

            {eventGroups.map(({ event, list }) => (
              <div key={event.id}>
                {heading(<Calendar size={14} />, `Event Sponsors • ${event.title}`)}
                <div className="stack">{list.map(renderSponsorRow)}</div>
              </div>
            ))}

            {orphanedEventSponsors.length > 0 && (
              <div>
                {heading(null, 'Former Event Sponsors')}
                <div className="stack">{orphanedEventSponsors.map(renderSponsorRow)}</div>
              </div>
            )}

            {ended.length > 0 && (
              <div>
                {heading(<EyeOff size={14} />, 'Ended')}
                <p className="text-note" style={{ margin: '-0.4rem 0 0.85rem' }}>
                  Off your site. Their details, payments and view and click history are kept for renewal talks.
                </p>
                <div className="stack">{ended.map(renderSponsorRow)}</div>
              </div>
            )}
          </div>
        );
      })()}
      </>)}

      {/* Add / Edit Sponsor Modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          zIndex: 999,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}>
          <div className="glass-panel" style={{
            margin: 'auto',
            width: '100%',
            maxWidth: '540px',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
          }}>
            <div className="section-head">
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {editingId ? 'Edit Sponsor' : 'Add Club Sponsor'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Close" title="Close (Esc)" className="touch-target" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.85rem', marginBottom: '1.25rem', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid rgba(var(--club-primary-rgb), 0.45)', background: 'rgba(var(--club-primary-rgb), 0.08)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div id="sponsors-on-site" style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Show on the club site</div>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    {form.is_active
                      ? 'On: fans see this sponsor on your club pages.'
                      : 'Off: only admins can see this sponsor. It turns off by itself when the sponsorship ends.'}
                  </p>
                </div>
                <Switch checked={form.is_active} label="Show on the club site"
                  onChange={on => setForm({ ...form, is_active: on, package_status: on && ENDED.includes(form.package_status) ? 'confirmed' : form.package_status })} />
              </div>

              <div className="form-group">
                <label className="form-label">Sponsor Scope</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, scope: 'club', event_id: '' })}
                    className="btn btn-sm"
                    style={{
                      justifyContent: 'center',
                      gap: '0.4rem',
                      background: form.scope === 'club' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(var(--tint-rgb), 0.05)',
                      border: form.scope === 'club' ? '1px solid #10B981' : '1px solid var(--border-subtle)',
                      color: form.scope === 'club' ? 'var(--c-green)' : 'var(--text-secondary)',
                    }}
                  >
                    <Shield size={14} /> Club Sponsor
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, scope: 'event' })}
                    className="btn btn-sm"
                    style={{
                      justifyContent: 'center',
                      gap: '0.4rem',
                      background: form.scope === 'event' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(var(--tint-rgb), 0.05)',
                      border: form.scope === 'event' ? '1px solid #10B981' : '1px solid var(--border-subtle)',
                      color: form.scope === 'event' ? 'var(--c-green)' : 'var(--text-secondary)',
                    }}
                  >
                    <Calendar size={14} /> Event Sponsor
                  </button>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  {form.scope === 'club'
                    ? 'Shown on the club\'s public sponsor showcase.'
                    : 'Shown only on the selected event\'s detail page.'}
                </p>
              </div>

              {form.scope === 'event' && (
                <div className="form-group">
                  <label htmlFor="sponsors-event" className="form-label">Event *</label>
                  <select id="sponsors-event"
                    className="form-select"
                    required={form.scope === 'event'}
                    value={form.event_id}
                    onChange={e => setForm({ ...form, event_id: e.target.value })}
                  >
                    <option value="">Select an event…</option>
                    {clubEvents.map(evt => (
                      <option key={evt.id} value={evt.id}>
                        {evt.title} ({new Date(evt.start_time).toLocaleDateString(DATE_LOCALE)})
                      </option>
                    ))}
                  </select>
                  {clubEvents.length === 0 && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--c-amber)', marginTop: '0.35rem' }}>
                      No events yet - add one under Events first.
                    </p>
                  )}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="sponsors-sponsor-partner-name" className="form-label">Sponsor / Partner Name *</label>
                <input id="sponsors-sponsor-partner-name"
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Aura Hydration"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="form-row-2" style={{ gap: '1rem' }}>
                <div className="form-group">
                  <label htmlFor="sponsors-sponsorship-tier" className="form-label">Sponsorship Tier</label>
                  <select id="sponsors-sponsorship-tier"
                    className="form-select"
                    value={form.tier}
                    onChange={e => setForm({ ...form, tier: e.target.value as SponsorTier })}
                  >
                    <option value="platinum">Platinum Partner</option>
                    <option value="gold">Gold Partner</option>
                    <option value="silver">Silver Partner</option>
                    <option value="bronze">Bronze Partner</option>
                    <option value="grassroots">Grassroots Partner</option>
                  </select>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    Sets the order on the club page and the default logo size.
                  </p>
                </div>

                <div className="form-group">
                  <label htmlFor="sponsors-display-order" className="form-label">Display Order</label>
                  <input id="sponsors-display-order"
                    type="number"
                    className="form-input"
                    value={form.display_order}
                    onChange={e => setForm({ ...form, display_order: Number(e.target.value) })}
                  />
                </div>
              </div>

              {labelsReady && (
                <div className="form-group">
                  <label htmlFor="sponsors-label" className="form-label">Label shown on site (optional)</label>
                  <input id="sponsors-label"
                    type="text"
                    className="form-input"
                    maxLength={60}
                    placeholder={sponsorTierLabel(form.tier)}
                    value={form.label}
                    onChange={e => setForm({ ...form, label: e.target.value })}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    For example &ldquo;Front of Shirt Partner&rdquo;. Leave blank to show &ldquo;{sponsorTierLabel(form.tier)}&rdquo;.
                  </p>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="sponsors-display-size-space-scale-public-page-foo" className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Display Size / Space Scale</span>
                  <span className="text-meta">Public Page Footprint</span>
                </label>
                <select id="sponsors-display-size-space-scale-public-page-foo"
                  className="form-select"
                  value={form.size_scale}
                  onChange={e => setForm({ ...form, size_scale: e.target.value as SponsorSizeScale })}
                >
                  <option value="auto">Auto (by tier)</option>
                  <option value="xl">Extra Large</option>
                  <option value="lg">Large</option>
                  <option value="md">Medium</option>
                  <option value="sm">Compact</option>
                </select>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Determines how much visual real estate and logo size this sponsor commands on the public club page.
                </p>
              </div>

              <div className="form-group">
                <ImageUploadZone
                  clubId={club.id}
                  label="Sponsor Logo"
                  recommendedText="Transparent PNG or square logo, up to 5MB. Until there is one, their initials show."
                  currentImageUrl={form.logo_url}
                  onUploadComplete={url => setForm({ ...form, logo_url: url })}
                  folder="sponsors"
                  aspectRatio="1:1"
                />
              </div>

              <div className="form-group">
                <label htmlFor="sponsors-website-link" className="form-label">Website Link</label>
                <input id="sponsors-website-link"
                  type="url"
                  className="form-input"
                  placeholder="https://"
                  value={form.website_url}
                  onChange={e => setForm({ ...form, website_url: e.target.value })}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  No website? Leave it blank. The logo then shows without a link.
                </p>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <User size={14} color="var(--club-primary)" /> Sponsor Contact
                </h4>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Internal only - never shown on the public site.
                </p>

                <div className="form-group">
                  <label htmlFor="sponsors-contact-name" className="form-label">Contact Name</label>
                  <input id="sponsors-contact-name"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Sarah Whitfield"
                    value={form.contact_name}
                    onChange={e => setForm({ ...form, contact_name: e.target.value })}
                  />
                </div>

                <div className="form-row-2" style={{ gap: '1rem' }}>
                  <div className="form-group">
                    <label htmlFor="sponsors-contact-email" className="form-label row row-tight">
                      <Mail size={12} /> Contact Email
                    </label>
                    <input id="sponsors-contact-email"
                      type="email"
                      className="form-input"
                      placeholder="sarah@sponsor.com"
                      value={form.contact_email}
                      onChange={e => setForm({ ...form, contact_email: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="sponsors-contact-phone" className="form-label row row-tight">
                      <Phone size={12} /> Contact Phone
                    </label>
                    <input id="sponsors-contact-phone"
                      type="tel"
                      className="form-input"
                      placeholder="e.g. 0400 000 000"
                      value={form.contact_phone}
                      onChange={e => setForm({ ...form, contact_phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <DollarSign size={14} color="var(--club-primary)" /> Sponsorship Package
                </h4>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Internal only - never shown on the public site.
                </p>

                <div className="form-row-2" style={{ gap: '1rem' }}>
                  <div className="form-group">
                    <label htmlFor="sponsors-package-value" className="form-label">Package Value</label>
                    <input id="sponsors-package-value"
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-input"
                      placeholder="e.g. 5000"
                      value={form.package_value}
                      onChange={e => setForm({ ...form, package_value: e.target.value === '' ? '' : Number(e.target.value) })}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="sponsors-package-status" className="form-label">Package Status</label>
                    <select id="sponsors-package-status"
                      className="form-select"
                      value={form.package_status}
                      onChange={e => {
                        const status = e.target.value as SponsorPackageStatus;
                        // An ended sponsorship comes off the site
                        setForm({ ...form, package_status: status, is_active: ENDED.includes(status) ? false : form.is_active });
                      }}
                    >
                      {(Object.keys(PACKAGE_STATUS_LABEL) as SponsorPackageStatus[]).map(status => (
                        <option key={status} value={status}>{PACKAGE_STATUS_LABEL[status]}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="sponsors-season" className="form-label">Season</label>
                  <input id="sponsors-season"
                    type="text"
                    className="form-input"
                    placeholder={defaultSeasonLabel()}
                    value={form.season}
                    onChange={e => setForm({ ...form, season: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Sponsor
                </button>
              </div>
              {editingSponsor && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '1.25rem', paddingTop: '1rem', textAlign: 'center' }}>
                  <button data-needs-full type="button" className="btn btn-sm"
                    style={{ background: 'transparent', border: 'none', color: 'var(--c-red)', fontWeight: 700 }}
                    onClick={async () => {
                      if (await confirmAction({
                        title: `Delete ${editingSponsor.name} for good?`,
                        message: 'This also deletes their view and click history, and their payments lose the link to them. To take them off the site and keep their history, use End sponsorship instead. This cannot be undone.',
                        confirmLabel: 'Delete for good',
                        danger: true,
                      })) {
                        deleteSponsor(editingSponsor.id);
                        setModalOpen(false);
                      }
                    }}>
                    Delete for good
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
