'use client';

import React, { useEffect, useRef, useState, use } from 'react';
import { useClub } from '@/lib/club-context';
import { Sponsor, SponsorTier, SponsorSizeScale, SponsorPackageStatus } from '@/lib/supabase/types';
import { defaultSeasonLabel } from '@/lib/season';
import {
  daysUntilEnd, defaultSponsorEnd, formatEndDate, isEndingSoon, isPastEndDate, isSponsorOnSite, isStaleSignup,
  LOGO_SIZE_LABEL, renewedEndDate, reorderSponsors, sortSponsorsByTier, sponsorHref, sponsorLabel, sponsorTierLabel,
} from '@/lib/sponsors';
import { useUrlTab } from '@/lib/use-url-tab';
import { useSearchParams } from 'next/navigation';
import SponsorPackagesPanel from '@/components/admin/SponsorPackagesPanel';
import ImageUploadZone from '@/components/ImageUploadZone';
import SponsorLogo from '@/components/SponsorLogo';
import { DollarSign, Plus, Edit2, ExternalLink, X, Sparkles, LayoutGrid, Eye, EyeOff, Maximize2, Calendar, Shield, Mail, Phone, User, Check, AlertCircle, Inbox, Package, RotateCcw, Power, GripVertical, ChevronUp, ChevronDown, Send, Copy, Trash2, RefreshCw } from 'lucide-react';
import { confirmAction } from '@/components/ConfirmDialog';
import { getAccessToken, getSupabaseClient } from '@/lib/supabase/client';
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
/** Marked Expired or Cancelled, or past its end date */
const isEnded = (s: Sponsor) => (!!s.package_status && ENDED.includes(s.package_status)) || isPastEndDate(s);
/** Signed up on the club's website and not put on the site yet (paid or not) */
const isNewSignup = (s: Sponsor) => !s.is_active && !isEnded(s) && (s.package_status === 'prospect' || s.package_status === 'paid');

type View = 'all' | 'new' | 'live' | 'hidden' | 'ending' | 'ended';
const VIEWS: { id: View; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New sign-ups' },
  { id: 'live', label: 'On site' },
  { id: 'hidden', label: 'Hidden' },
  { id: 'ending', label: 'Ending soon' },
  { id: 'ended', label: 'Ended' },
];
/** Each sponsor's group ("Ending soon" is a filter over On site, not a group of its own) */
const viewOf = (s: Sponsor): Exclude<View, 'all' | 'ending'> =>
  isEnded(s) ? 'ended' : isNewSignup(s) ? 'new' : isSponsorOnSite(s) ? 'live' : 'hidden';

/** The edit popup's sections, which the tabs at its top jump to */
const SECTIONS = [['business', 'Business'], ['shows', 'How it shows'], ['deal', 'Deal']] as const;

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

const sectionHeading: React.CSSProperties = { fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' };
const sectionBox: React.CSSProperties = { borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', marginTop: '0.5rem' };
const hint: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' };

function getSponsorEffectiveScale(s: Pick<Sponsor, 'size_scale' | 'tier'>): 'xl' | 'lg' | 'md' | 'sm' {
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
  const { clubs, selectClubBySlug, sponsors, events, seasons, addSponsor, updateSponsor, deleteSponsor } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];

  const clubSponsors = sponsors.filter(s => s.club_id === club.id);
  const clubWideSponsors = clubSponsors.filter(s => !s.event_id);
  // The preview shows what fans see: club-wide sponsors that are on the site
  const previewSponsors = sortSponsorsByTier(clubWideSponsors.filter(sp => isSponsorOnSite(sp)));

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
    { all: clubSponsors.length, new: 0, live: 0, hidden: 0, ending: clubSponsors.filter(sp => isEndingSoon(sp)).length, ended: 0 }
  );
  const shownSponsors = view === 'all' ? clubSponsors
    : view === 'ending' ? clubSponsors.filter(sp => isEndingSoon(sp))
    : clubSponsors.filter(sp => viewOf(sp) === view);
  const staleSignups = clubSponsors.filter(sp => isStaleSignup(sp));

  const putOnSite = (sp: Sponsor) => updateSponsor(sp.id, { is_active: true });
  const endSponsorship = async (sp: Sponsor) => {
    if (await confirmAction({
      title: `End the sponsorship with ${sp.name}?`,
      message: 'They come off your club site straight away. Their details, payments and view and click history are kept, and you can bring them back later.',
      confirmLabel: 'End sponsorship',
    })) updateSponsor(sp.id, { is_active: false, package_status: 'expired' });
  };
  // Renewing moves the end date a year on (from today if it has passed); paying through the
  // renewal link does the same by itself (fulfil_payment, migration 20261132)
  const renew = async (sp: Sponsor) => {
    const until = renewedEndDate(sp.ends_on);
    if (await confirmAction({
      title: `Renew ${sp.name} until ${formatEndDate(until)}?`,
      message: isSponsorOnSite(sp)
        ? 'Use this once they have agreed to carry on. If they pay through a renewal link instead, this happens by itself.'
        : 'Use this once they have agreed to carry on. They go back on your club site straight away.',
      confirmLabel: 'Renew',
    })) updateSponsor(sp.id, { ends_on: until, ...(isEnded(sp) ? { is_active: true, package_status: 'confirmed' as const } : {}) });
  };
  const bringBack = (sp: Sponsor) => updateSponsor(sp.id, {
    is_active: true,
    package_status: 'confirmed',
    // Past its end date it would stay off the site, so it gets a new one
    ...(renewalsReady && isPastEndDate(sp) ? { ends_on: renewedEndDate(sp.ends_on) } : {}),
  });
  const clearOldSignups = async () => {
    if (await confirmAction({
      title: `Delete ${staleSignups.length === 1 ? '1 old sign-up' : `${staleSignups.length} old sign-ups`}?`,
      message: `${staleSignups.map(sp => sp.name).join(', ')}. They signed up on your website over 60 days ago and never paid. This cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    })) staleSignups.forEach(sp => deleteSponsor(sp.id));
  };

  // Payment and renewal links (app/api/sponsors/send-link): the result shows under the sponsor's card
  const [linkResult, setLinkResult] = useState<{ sponsorId: string; busy?: boolean; link?: string; emailed?: boolean; note?: string; copied?: boolean } | null>(null);
  const sendLink = async (sp: Sponsor, kind: 'payment' | 'renewal') => {
    setLinkResult({ sponsorId: sp.id, busy: true });
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/sponsors/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ clubId: club.id, sponsorId: sp.id, kind }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setLinkResult({ sponsorId: sp.id, note: json.error || 'The link could not be sent.' });
      setLinkResult({ sponsorId: sp.id, link: json.link, emailed: json.emailed, note: json.note });
      if (json.emailed && renewalsReady) updateSponsor(sp.id, { link_sent_at: new Date().toISOString() });
    } catch {
      setLinkResult({ sponsorId: sp.id, note: 'The link could not be sent. Check your connection and try again.' });
    }
  };
  const copyLink = async () => {
    if (!linkResult?.link) return;
    try {
      await navigator.clipboard.writeText(linkResult.link);
      setLinkResult({ ...linkResult, copied: true });
    } catch {
      window.prompt('Copy this link', linkResult.link);
    }
  };

  // Order fans see within a tier: drag the handle on a computer, or the arrows on a phone
  const [dragId, setDragId] = useState<string | null>(null);
  const moveSponsor = (ordered: Sponsor[], id: string, toIndex: number) => {
    for (const change of reorderSponsors(ordered, id, toIndex)) updateSponsor(change.id, { display_order: change.display_order });
  };
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
  // End dates, Renew and renewal links need migration 20261132_sponsor_renewals.sql; hidden until it runs
  const [renewalsReady, setRenewalsReady] = useState<boolean | null>(() => (getSupabaseClient() ? null : true));
  useEffect(() => {
    getSupabaseClient()?.from('sponsors').select('ends_on').limit(1).then(({ error }) => setRenewalsReady(!error));
  }, []);
  const seasonEnd = defaultSponsorEnd(seasons.filter(se => se.club_id === club.id));

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
    // New sponsors go last in their tier (drag or the arrows to move them)
    display_order: Math.max(0, ...clubSponsors.map(sp => sp.display_order || 0)) + 1,
    is_active: true,
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    package_value: '' as number | '',
    package_status: 'confirmed' as SponsorPackageStatus,
    season: defaultSeasonLabel(),
    // The end of the club's season (Seasons), or a year from today
    ends_on: seasonEnd,
  };

  const [form, setForm] = useState(blankForm);

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm(blankForm);
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
      ends_on: s.ends_on || '',
    });
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    if (form.scope === 'event' && !form.event_id) return;

    const { scope, label, ends_on, ...rest } = form;
    const payload = {
      ...rest,
      // Only sent once the column exists (migration 20261132); blank means no end date
      ...(renewalsReady ? { ends_on: ends_on || null } : {}),
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

  // The popup's section tabs: tapping one scrolls to it; scrolling marks the section in view
  const modalScroll = useRef<HTMLDivElement>(null);
  const [section, setSection] = useState<(typeof SECTIONS)[number][0]>('business');
  // A tapped tab stays marked while the smooth scroll runs past the other sections
  const jumpedAt = useRef(0);
  const jumpTo = (id: (typeof SECTIONS)[number][0], at: number) => {
    setSection(id);
    jumpedAt.current = at;
    document.getElementById(`sponsor-sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  useEffect(() => {
    const box = modalScroll.current;
    if (!modalOpen || !box) return;
    const onScroll = (e: Event) => {
      if (e.timeStamp - jumpedAt.current < 1000) return;
      // At the bottom the last section can't scroll up to the top, so it counts as in view
      if (box.scrollTop + box.clientHeight >= box.scrollHeight - 4) return setSection('deal');
      const top = box.getBoundingClientRect().top + 140;
      let current: (typeof SECTIONS)[number][0] = 'business';
      box.querySelectorAll<HTMLElement>('[data-section]').forEach(el => {
        if (el.getBoundingClientRect().top <= top) current = el.dataset.section as typeof current;
      });
      setSection(current);
    };
    box.addEventListener('scroll', onScroll, { passive: true });
    return () => box.removeEventListener('scroll', onScroll);
  }, [modalOpen]);

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
            <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>Bigger tiers get bigger logos. </strong>
            Platinum shows biggest, then Gold, Silver, Bronze and Grassroots. Change one sponsor&apos;s size with Logo size when you edit them.
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
                        {LOGO_SIZE_LABEL[scale]} logo
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
        {VIEWS.filter(v => v.id !== 'ending' || renewalsReady).map(v => (
          <button key={v.id} type="button" data-view-ok aria-pressed={view === v.id} onClick={() => setView(v.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.8rem', borderRadius: '9px', cursor: 'pointer',
              border: 'none', fontSize: '0.8rem', fontWeight: 700,
              background: view === v.id ? 'rgba(var(--tint-rgb), 0.1)' : 'transparent',
              color: view === v.id ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: view === v.id ? 'inset 0 -2px 0 var(--club-primary)' : 'none',
            }}>
            {v.label}
            <span style={{ fontSize: '0.7rem', padding: '0 0.45rem', borderRadius: 999,
              background: v.id === 'new' && viewCounts.new > 0 ? 'rgba(59, 130, 246, 0.25)' : v.id === 'ending' && viewCounts.ending > 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(var(--tint-rgb), 0.1)',
              color: v.id === 'new' && viewCounts.new > 0 ? 'var(--c-blue)' : v.id === 'ending' && viewCounts.ending > 0 ? 'var(--c-amber)' : 'var(--text-secondary)' }}>
              {viewCounts[v.id]}
            </span>
          </button>
        ))}
      </div>

      {/* Sponsors List */}
      {(() => {
        // `ordered`: the group as fans see it, when the card can be moved within it
        const renderSponsorRow = (sponsor: Sponsor, index?: number, ordered?: Sponsor[]) => {
          const scale = getSponsorEffectiveScale(sponsor);
          const isCustomScale = sponsor.size_scale && sponsor.size_scale !== 'auto';
          const linkedEvent = sponsor.event_id ? clubEvents.find(e => e.id === sponsor.event_id) : undefined;
          const stage = viewOf(sponsor);
          const website = sponsorHref(sponsor.website_url);
          const daysLeft = daysUntilEnd(sponsor);
          const endingSoon = isEndingSoon(sponsor);
          const movable = !!ordered && ordered.length > 1 && index !== undefined;
          const canUp = movable && index! > 0 && ordered![index! - 1].tier === sponsor.tier;
          const canDown = movable && index! < ordered!.length - 1 && ordered![index! + 1].tier === sponsor.tier;
          const result = linkResult?.sponsorId === sponsor.id ? linkResult : null;
          const actionStyle: React.CSSProperties = { minHeight: '40px', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' };
          return (
            <div
              key={sponsor.id}
              className="glass-panel"
              onDragOver={movable && dragId && ordered!.find(o => o.id === dragId)?.tier === sponsor.tier ? e => e.preventDefault() : undefined}
              onDrop={movable ? e => { e.preventDefault(); if (dragId) moveSponsor(ordered!, dragId, index!); setDragId(null); } : undefined}
              style={{
                outline: dragId && dragId !== sponsor.id && ordered?.find(o => o.id === dragId)?.tier === sponsor.tier ? '1px dashed var(--border-medium)' : undefined,
                padding: '1.25rem 1.75rem',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                opacity: stage === 'ended' ? 0.75 : undefined,
                borderLeft: stage === 'new' && sponsor.package_status === 'paid' ? '4px solid #10B981'
                  : stage === 'ended' ? undefined
                  : endingSoon ? '4px solid #F59E0B'
                  : scale === 'xl' ? '4px solid #F59E0B' : scale === 'lg' ? '4px solid #EAB308' : undefined,
              }}
            >
              {/* On a phone the details move under the logo instead of squeezing into a narrow column */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.85rem 1.25rem', flex: '1 1 auto', minWidth: 0 }}>
                {movable && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span draggable onDragStart={e => { setDragId(sponsor.id); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDragId(null)}
                      title="Drag to change the order" aria-hidden="true" style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'inline-flex' }}>
                      <GripVertical size={18} />
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {([['up', canUp, ChevronUp, index! - 1], ['down', canDown, ChevronDown, index! + 1]] as const).map(([dir, enabled, Icon, to]) => (
                        <button key={dir} type="button" disabled={!enabled} onClick={() => moveSponsor(ordered!, sponsor.id, to)}
                          aria-label={`Move ${sponsor.name} ${dir}`} title={enabled ? `Move ${dir}` : 'Higher tiers always show first'}
                          style={{ width: 30, height: 22, padding: 0, borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-secondary)', display: 'grid', placeItems: 'center', cursor: enabled ? 'pointer' : 'default', opacity: enabled ? 1 : 0.35 }}>
                          <Icon size={13} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
                        Logo size: {LOGO_SIZE_LABEL[scale]}{!isCustomScale && ' (by tier)'}
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
                    {endingSoon && daysLeft !== null && (
                      <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--c-amber)', border: '1px solid rgba(245, 158, 11, 0.4)', fontSize: '0.7rem' }}>
                        {daysLeft === 0 ? 'Last day today' : `Ends in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`}
                      </span>
                    )}
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
                    {sponsor.ends_on && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Calendar size={11} />
                        {isPastEndDate(sponsor) ? 'Ended' : 'Ends on'} {formatEndDate(sponsor.ends_on)}
                      </span>
                    )}
                    {sponsor.contact_name && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <User size={11} />
                        {sponsor.contact_name}
                      </span>
                    )}
                    {sponsor.link_sent_at && (stage === 'new' || endingSoon || stage === 'ended') && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--c-green)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Check size={11} />
                        {stage === 'new' ? 'Payment' : 'Renewal'} link sent {new Date(sponsor.link_sent_at).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short' })}
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
                {/* Price-on-request sign-ups have nothing to pay: the club replies to their Inbox message */}
                {stage === 'new' && sponsor.package_status === 'prospect' && Number(sponsor.package_value) > 0 && (
                  <button type="button" disabled={result?.busy} onClick={() => sendLink(sponsor, 'payment')} className="btn btn-secondary btn-sm" style={actionStyle}>
                    <Send size={14} /> {sponsor.link_sent_at ? 'Send payment link again' : 'Send payment link'}
                  </button>
                )}
                {renewalsReady && (endingSoon || (stage === 'ended' && isPastEndDate(sponsor))) && (
                  <button type="button" disabled={result?.busy} onClick={() => sendLink(sponsor, 'renewal')} className="btn btn-secondary btn-sm" style={actionStyle}>
                    <Send size={14} /> {sponsor.link_sent_at ? 'Send renewal link again' : 'Send renewal link'}
                  </button>
                )}
                {renewalsReady && (endingSoon || (stage === 'ended' && isPastEndDate(sponsor))) && (
                  <button type="button" onClick={() => renew(sponsor)} className="btn btn-primary btn-sm" style={actionStyle}>
                    <RefreshCw size={14} /> Renew
                  </button>
                )}
                <button onClick={() => handleOpenEdit(sponsor)} title={`Edit ${sponsor.name}`} aria-label={`Edit ${sponsor.name}`} className="btn btn-secondary btn-sm" style={{ minWidth: '40px', minHeight: '40px' }}>
                  <Edit2 size={14} />
                </button>
                {(stage === 'new' || stage === 'hidden') && (
                  <button type="button" onClick={() => putOnSite(sponsor)} className="btn btn-primary btn-sm" style={actionStyle}>
                    <Eye size={14} /> Put on site
                  </button>
                )}
                {stage === 'live' && (
                  <button type="button" onClick={() => endSponsorship(sponsor)} className="btn btn-secondary btn-sm" style={actionStyle}>
                    <Power size={14} /> End sponsorship
                  </button>
                )}
                {stage === 'ended' && !(renewalsReady && isPastEndDate(sponsor)) && (
                  <button type="button" onClick={() => bringBack(sponsor)} className="btn btn-secondary btn-sm" style={actionStyle}>
                    <RotateCcw size={14} /> Bring back
                  </button>
                )}
              </div>

              {/* What happened to the payment or renewal link */}
              {result && !result.busy && (
                <div role="status" style={{ flexBasis: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 0.85rem', padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'rgba(var(--shade-rgb), 0.3)', border: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
                  {result.emailed
                    ? <span style={{ color: 'var(--c-green)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Check size={14} /> Emailed to {sponsor.contact_email}</span>
                    : <span style={{ color: result.link ? 'var(--c-amber)' : 'var(--c-red)', fontWeight: 700 }}>{result.note}</span>}
                  {result.link && (
                    <button type="button" onClick={copyLink} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Copy size={13} /> {result.copied ? 'Copied' : 'Copy link'}
                    </button>
                  )}
                  <button type="button" onClick={() => setLinkResult(null)} aria-label="Dismiss" className="btn btn-sm" style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-muted)' }}>
                    <X size={14} />
                  </button>
                </div>
              )}
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
        // In the order fans see them: higher tiers first, then the order set here
        const currentClubWide = sortSponsorsByTier(current.filter(sp => !sp.event_id));
        // Group event-scoped sponsors under the event they belong to; sponsors whose
        // event was since deleted still show under a "Former Event" fallback group.
        const eventGroups = clubEvents
          .map(evt => ({ event: evt, list: sortSponsorsByTier(current.filter(sp => sp.event_id === evt.id)) }))
          .filter(g => g.list.length > 0);
        // Moving needs the whole group, so the arrows only show when nothing is filtered out
        const canReorder = view === 'all' || view === 'live';
        const reorderHint = (list: Sponsor[]) => canReorder && list.length > 1 && (
          <p className="text-note" style={{ margin: '-0.4rem 0 0.85rem' }}>
            Fans see higher tiers first. To change the order within a tier, drag the handle or use the arrows.
          </p>
        );
        const plain = (sp: Sponsor) => renderSponsorRow(sp);
        const movable = (list: Sponsor[]) => list.map((sp, i) => renderSponsorRow(sp, i, canReorder ? list : undefined));
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
                <div className="stack">
                  {signups.map(plain)}
                  {staleSignups.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem 1rem', padding: '0.85rem 1rem', border: '1px dashed var(--border-medium)', borderRadius: '12px' }}>
                      <span className="text-meta" style={{ flex: '1 1 240px' }}>
                        {staleSignups.length === 1 ? '1 unpaid sign-up is' : `${staleSignups.length} unpaid sign-ups are`} older than 60 days. Nothing is deleted unless you tap the button.
                      </span>
                      <button type="button" onClick={clearOldSignups} className="btn btn-secondary btn-sm" style={{ color: 'var(--c-red)', minHeight: '40px', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Trash2 size={14} /> Clear old sign-ups ({staleSignups.length})
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentClubWide.length > 0 && (
              <div>
                {heading(<Shield size={14} />, 'Club-Wide Sponsors')}
                {reorderHint(currentClubWide)}
                <div className="stack">{movable(currentClubWide)}</div>
              </div>
            )}

            {eventGroups.map(({ event, list }) => (
              <div key={event.id}>
                {heading(<Calendar size={14} />, `Event Sponsors • ${event.title}`)}
                {reorderHint(list)}
                <div className="stack">{movable(list)}</div>
              </div>
            ))}

            {orphanedEventSponsors.length > 0 && (
              <div>
                {heading(null, 'Former Event Sponsors')}
                <div className="stack">{orphanedEventSponsors.map(plain)}</div>
              </div>
            )}

            {ended.length > 0 && (
              <div>
                {heading(<EyeOff size={14} />, 'Ended')}
                <p className="text-note" style={{ margin: '-0.4rem 0 0.85rem' }}>
                  Off your site, because they were ended or their end date has passed. Their details, payments and view and click history are kept for renewal talks.
                </p>
                <div className="stack">{ended.map(plain)}</div>
              </div>
            )}
          </div>
        );
      })()}
      </>)}

      {/* Add / Edit Sponsor Modal: Business, How it shows and Deal, with the title and Save kept on screen */}
      {modalOpen && (
        <div ref={modalScroll} style={{
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
            padding: '0 1.5rem',
          }}>
            <div style={{ position: 'sticky', top: '-1rem', zIndex: 2, background: 'var(--bg-surface-elevated)', padding: '1.5rem 0 0', borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0' }}>
              <div className="section-head" style={{ marginBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {editingId ? 'Edit Sponsor' : 'Add Club Sponsor'}
                </h3>
                <button type="button" onClick={() => setModalOpen(false)} aria-label="Close" title="Close (Esc)" className="touch-target" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>
              <nav aria-label="Sections" style={{ display: 'flex', gap: '1.1rem', borderBottom: '1px solid var(--border-subtle)' }}>
                {SECTIONS.map(([id, label]) => (
                  <button key={id} type="button" onClick={e => jumpTo(id, e.timeStamp)}
                    style={{ padding: '0.55rem 0.1rem', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem', color: section === id ? 'var(--text-primary)' : 'var(--text-muted)', boxShadow: section === id ? 'inset 0 -2px 0 var(--club-primary)' : 'none' }}>
                    {label}
                  </button>
                ))}
              </nav>
            </div>

            <form onSubmit={handleSave} style={{ paddingTop: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.85rem', marginBottom: '1.25rem', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid rgba(var(--club-primary-rgb), 0.45)', background: 'rgba(var(--club-primary-rgb), 0.08)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div id="sponsors-on-site" style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Show on the club site</div>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    {form.is_active
                      ? `On: fans see this sponsor on your club pages${renewalsReady && form.ends_on ? ` until ${formatEndDate(form.ends_on)}` : ''}.`
                      : 'Off: only admins can see this sponsor. It turns off by itself when the sponsorship ends.'}
                  </p>
                </div>
                <Switch checked={form.is_active} label="Show on the club site"
                  onChange={on => setForm({ ...form, is_active: on, package_status: on && ENDED.includes(form.package_status) ? 'confirmed' : form.package_status })} />
              </div>

              {/* ---------- Business ---------- */}
              <section id="sponsor-sec-business" data-section="business" style={{ scrollMarginTop: '7rem' }}>
                <h4 style={sectionHeading}><Shield size={14} color="var(--club-primary)" /> Business</h4>

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
                  <p style={hint}>No website? Leave it blank. The logo then shows without a link.</p>
                </div>

                <div className="form-group">
                  <label htmlFor="sponsors-contact-name" className="form-label row row-tight"><User size={12} /> Contact Name</label>
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
                <p style={{ ...hint, marginTop: '-0.5rem' }}>Contact details are for admins only, never shown on the site.</p>
              </section>

              {/* ---------- How it shows ---------- */}
              <section id="sponsor-sec-shows" data-section="shows" style={{ ...sectionBox, scrollMarginTop: '7rem' }}>
                <h4 style={sectionHeading}><Eye size={14} color="var(--club-primary)" /> How it shows</h4>

                <div className="form-group">
                  <label className="form-label">Where it shows</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                    {([['club', Shield, 'Whole club'], ['event', Calendar, 'One event']] as const).map(([value, Icon, text]) => (
                      <button key={value} type="button" aria-pressed={form.scope === value}
                        onClick={() => setForm({ ...form, scope: value, event_id: value === 'club' ? '' : form.event_id })}
                        className="btn btn-sm"
                        style={{
                          justifyContent: 'center',
                          gap: '0.4rem',
                          background: form.scope === value ? 'rgba(16, 185, 129, 0.15)' : 'rgba(var(--tint-rgb), 0.05)',
                          border: form.scope === value ? '1px solid #10B981' : '1px solid var(--border-subtle)',
                          color: form.scope === value ? 'var(--c-green)' : 'var(--text-secondary)',
                        }}>
                        <Icon size={14} /> {text}
                      </button>
                    ))}
                  </div>
                  <p style={hint}>
                    {form.scope === 'club'
                      ? 'On the club home page, page footers and match pages.'
                      : 'Only on the chosen event’s page.'}
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
                  <p style={hint}>Higher tiers show first, with bigger logos.</p>
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
                    <p style={hint}>
                      For example &ldquo;Front of Shirt Partner&rdquo;. Leave blank to show &ldquo;{sponsorTierLabel(form.tier)}&rdquo;.
                    </p>
                  </div>
                )}

                <div className="form-group">
                  <span id="sponsors-logo-size" className="form-label">Logo size</span>
                  <div role="group" aria-labelledby="sponsors-logo-size" style={{ display: 'flex', gap: '4px', padding: '4px', borderRadius: '12px', background: 'rgba(var(--shade-rgb), 0.35)', border: '1px solid var(--border-subtle)' }}>
                    {(['auto', 'xl', 'lg', 'md', 'sm'] as SponsorSizeScale[]).map(size => (
                      <button key={size} type="button" aria-pressed={form.size_scale === size} onClick={() => setForm({ ...form, size_scale: size })}
                        style={{
                          flex: 1, padding: '0.5rem 0.2rem', borderRadius: '9px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
                          border: 'none',
                          background: form.size_scale === size ? 'rgba(var(--club-primary-rgb), 0.2)' : 'transparent',
                          color: form.size_scale === size ? 'var(--text-primary)' : 'var(--text-muted)',
                          boxShadow: form.size_scale === size ? 'inset 0 0 0 1px rgba(var(--club-primary-rgb), 0.6)' : 'none',
                        }}>
                        {LOGO_SIZE_LABEL[size]}
                      </button>
                    ))}
                  </div>
                  <p style={hint}>
                    By tier: {sponsorTierLabel(form.tier)} shows {LOGO_SIZE_LABEL[getSponsorEffectiveScale({ tier: form.tier, size_scale: 'auto' })].toLowerCase()}.
                  </p>
                </div>
              </section>

              {/* ---------- Deal ---------- */}
              <section id="sponsor-sec-deal" data-section="deal" style={{ ...sectionBox, scrollMarginTop: '7rem' }}>
                <h4 style={sectionHeading}><DollarSign size={14} color="var(--club-primary)" /> Deal</h4>
                <p style={{ ...hint, marginTop: '-0.5rem', marginBottom: '1rem' }}>Only admins see this.</p>

                {renewalsReady && (
                  <div className="form-group">
                    <label htmlFor="sponsors-ends-on" className="form-label">Ends on</label>
                    <input id="sponsors-ends-on"
                      type="date"
                      className="form-input"
                      value={form.ends_on}
                      onChange={e => setForm({ ...form, ends_on: e.target.value })}
                    />
                    <p style={hint}>
                      {form.ends_on
                        ? 'The day after, they come off the site and move to Ended. Needs you reminds you 30 days before.'
                        : 'No end date: they stay on the site until you end the sponsorship.'}
                      {form.ends_on !== seasonEnd && (
                        <>
                          {' '}
                          <button type="button" onClick={() => setForm({ ...form, ends_on: seasonEnd })}
                            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--club-ink)', fontWeight: 700, cursor: 'pointer', fontSize: 'inherit' }}>
                            Use {formatEndDate(seasonEnd)}{seasons.some(se => se.club_id === club.id) ? ' (season end)' : ''}
                          </button>
                        </>
                      )}
                    </p>
                  </div>
                )}

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
              </section>

              {editingSponsor && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '0.5rem', paddingTop: '1rem', textAlign: 'center' }}>
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

              <div style={{ position: 'sticky', bottom: '-1rem', zIndex: 2, display: 'flex', gap: '0.75rem', margin: '1rem -1.5rem 0', padding: '0.9rem 1.5rem 1.4rem', background: 'var(--bg-surface-elevated)', borderTop: '1px solid var(--border-subtle)', borderRadius: '0 0 var(--radius-xl) var(--radius-xl)' }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
                  Save Sponsor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
