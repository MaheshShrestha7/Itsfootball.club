'use client';

import React, { useEffect, useRef, useState, use } from 'react';
import { useClub } from '@/lib/club-context';
import { Sponsor, SponsorTier, SponsorSizeScale, SponsorPackageStatus, SponsorshipPackage } from '@/lib/supabase/types';
import { defaultSeasonLabel } from '@/lib/season';
import {
  daysUntilEnd, defaultSponsorEnd, defaultSponsorSeason, formatEndDate, isEndingSoon, isPastEndDate, isSponsorOnSite, isStaleSignup,
  hasSentChange, LOGO_SIZE_LABEL, renewedEndDate, reorderSponsors, sortSponsorsByTier, sponsorHref, sponsorLabel, sponsorTierLabel, typedWebsite,
  canPayRenewal, localDateISO, matchSponsorPackage, sponsorPackageFor,
} from '@/lib/sponsors';
import { useUrlTab } from '@/lib/use-url-tab';
import { useSearchParams } from 'next/navigation';
import SponsorPackagesPanel from '@/components/admin/SponsorPackagesPanel';
import PerksPanel from '@/components/admin/PerksPanel';
import SponsorThanksPoster from '@/components/admin/SponsorThanksPoster';
import OneSponsorSpots from '@/components/admin/OneSponsorSpots';
import ImageUploadZone from '@/components/ImageUploadZone';
import SponsorLogo from '@/components/SponsorLogo';
import { DollarSign, Plus, Edit2, ExternalLink, X, LayoutGrid, Eye, EyeOff, Maximize2, Calendar, Shield, Mail, Phone, User, Check, AlertCircle, Inbox, Package, RotateCcw, Power, GripVertical, ChevronUp, ChevronDown, Send, Copy, Trash2, RefreshCw, FileText, Banknote, Printer, Gift } from 'lucide-react';
import { confirmAction } from '@/components/ConfirmDialog';
import { getAccessToken, getSupabaseClient } from '@/lib/supabase/client';
import { formatMoney, parseMoneyToCents } from '@/lib/finance';
import { DATE_LOCALE, formatShortDay } from '@/lib/dates';

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
// SPE-6: one that has been on the site (went_live_at, migration 20261136) and was hidden later is Hidden
const isNewSignup = (s: Sponsor) => !s.is_active && !s.went_live_at && !isEnded(s) && (s.package_status === 'prospect' || s.package_status === 'paid');
/** A deal with no money to pay: price on request, agreed in goods or services (SPE-21) */
const inKind = (s: Pick<Sponsor, 'package_value'>) => !(Number(s.package_value) > 0);

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
      style={{ flexShrink: 0, width: 48, height: 28, padding: 0, borderRadius: 999, border: '1px solid var(--border-medium)', background: checked ? 'var(--club-primary)' : 'color-mix(in oklab, var(--color-ink) 10%, transparent)', position: 'relative', cursor: 'pointer', transition: 'background-color 0.2s ease' }}>
      <span style={{ position: 'absolute', top: 3, left: checked ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: 'var(--color-print)', transition: 'left 0.2s ease' }} />
    </button>
  );
}

const onSiteBadge = (s: Sponsor) => isSponsorOnSite(s)
  ? <span className="admin-pill is-ok">On the site</span>
  : <span className="admin-pill">Hidden from the site</span>;

const sectionHeading: React.CSSProperties = { fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' };
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

  // Sponsor list, Packages (?tab=packages, from the admin menu and Finance) or Member Perks (?tab=perks)
  const [tab, setTab] = useUrlTab(['list', 'packages', 'perks'] as const);
  const [thanksPosterOpen, setThanksPosterOpen] = useState(false);
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

  const putOnSite = (sp: Sponsor) => updateSponsor(sp.id, {
    is_active: true,
    // Kept here too so hiding them later in this visit files them under Hidden (the database sets it)
    went_live_at: sp.went_live_at || new Date().toISOString(),
    // SPE-21: a price-on-request sign-up the club has agreed with is no longer "in talks"
    ...(sp.package_status === 'prospect' && inKind(sp) ? { package_status: 'confirmed' as const } : {}),
  });
  // Sponsorship payments by sponsor (Treasurer and Commercial Officer can read them, migration 20261136):
  // who has paid (SPE-15) and whose bank transfer receipt is waiting to be checked (SPE-7)
  // SPP-2: and each sponsor's open invoice (sent before payment, migration 20261137's due_on; '*' so
  // this still loads before that migration runs)
  type OpenInvoice = { id: string; due_on: string; amount_cents: number; currency: string };
  const [sponsorPayments, setSponsorPayments] = useState<{ paid: Set<string>; receipt: Set<string>; invoice: Map<string, OpenInvoice> }>(
    () => ({ paid: new Set(), receipt: new Set(), invoice: new Map() }));
  const [paymentsLoaded, setPaymentsLoaded] = useState(0);
  const reloadPayments = () => setPaymentsLoaded(n => n + 1);
  useEffect(() => {
    getSupabaseClient()?.from('payments').select('*')
      .eq('club_id', club.id).eq('kind', 'sponsorship').in('status', ['paid', 'awaiting_review', 'pending'])
      .then(({ data }) => {
        const rows = (data || []) as { id: string; sponsor_id: string | null; status: string; due_on?: string | null; amount_cents: number; currency: string; created_at: string }[];
        const invoice = new Map<string, OpenInvoice>();
        rows.filter(r => r.status === 'pending' && r.due_on && r.sponsor_id).sort((a, b) => a.created_at.localeCompare(b.created_at))
          .forEach(r => invoice.set(r.sponsor_id!, { id: r.id, due_on: r.due_on!, amount_cents: r.amount_cents, currency: r.currency }));
        setSponsorPayments({
          paid: new Set(rows.filter(r => r.status === 'paid' && r.sponsor_id).map(r => r.sponsor_id!)),
          receipt: new Set(rows.filter(r => r.status === 'awaiting_review' && r.sponsor_id).map(r => r.sponsor_id!)),
          invoice,
        });
      });
  }, [club.id, paymentsLoaded]);

  // The club's packages: the Package choice in a sponsor's details (SPP-4), and what an invoice or
  // recorded payment is for
  const [packages, setPackages] = useState<SponsorshipPackage[]>([]);
  useEffect(() => {
    getSupabaseClient()?.from('sponsorship_packages').select('*').eq('club_id', club.id).order('sort_order')
      .then(({ data }) => setPackages((data || []) as SponsorshipPackage[]));
  }, [club.id, tab]);
  const pricedPackages = packages.filter(p => p.is_active && p.price_cents > 0);
  const packageFor = (sp: Sponsor) => pricedPackages.find(p => p.id === sp.package_id) || matchSponsorPackage(sp, pricedPackages);
  // sponsors.package_id needs migration 20261137; the Package choice stays hidden until it runs
  const [packageIdReady, setPackageIdReady] = useState(false);
  useEffect(() => {
    getSupabaseClient()?.from('sponsors').select('package_id').limit(1).then(({ error }) => setPackageIdReady(!error));
  }, []);

  // SPP-2: an invoice before payment, emailed to the sponsor (app/api/sponsors/invoice)
  const sendInvoice = async (sp: Sponsor, resend = false) => {
    setLinkResult({ sponsorId: sp.id, busy: true });
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/sponsors/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ clubId: club.id, sponsorId: sp.id, resend }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setLinkResult({ sponsorId: sp.id, note: json.error || 'The invoice could not be sent.' });
      setLinkResult({ sponsorId: sp.id, link: json.link, emailed: json.emailed, note: json.note || (json.emailed ? undefined : 'The invoice is ready. Copy the link and send it to them.') });
      reloadPayments();
    } catch {
      setLinkResult({ sponsorId: sp.id, note: 'The invoice could not be sent. Check your connection and try again.' });
    }
  };

  // SPP-3: money that came in outside the app (app/api/sponsors/record-payment)
  const [recording, setRecording] = useState<{ sponsor: Sponsor; amount: string; method: string; paidOn: string; until: string; busy?: boolean; error?: string } | null>(null);
  const openRecord = (sp: Sponsor) => {
    const today = localDateISO();
    const invoice = sponsorPayments.invoice.get(sp.id);
    const first = !sponsorPayments.paid.has(sp.id);
    const cents = invoice?.amount_cents ?? (Number(sp.package_value) > 0 ? Math.round(Number(sp.package_value) * 100) : packageFor(sp)?.price_cents);
    setRecording({
      sponsor: sp,
      amount: cents ? (cents / 100).toFixed(2) : '',
      method: 'bank_transfer',
      paidOn: today,
      // As fulfil_payment works it out: a first payment keeps an end date still ahead, else a year
      until: first ? (sp.ends_on && sp.ends_on >= today ? sp.ends_on : renewedEndDate(today)) : renewedEndDate(sp.ends_on),
    });
  };
  const saveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recording) return;
    const cents = parseMoneyToCents(recording.amount);
    if (cents === null || cents <= 0) return setRecording({ ...recording, error: 'Enter the amount they paid, e.g. 1500' });
    setRecording({ ...recording, busy: true, error: undefined });
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/sponsors/record-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ clubId: club.id, sponsorId: recording.sponsor.id, amountCents: cents, method: recording.method, paidOn: recording.paidOn, until: renewalsReady ? recording.until : undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return setRecording({ ...recording, busy: false, error: json.error || 'The payment could not be recorded.' });
      const sp = recording.sponsor;
      updateSponsor(sp.id, { package_status: 'paid', package_value: (json.amount_cents ?? cents) / 100, ...(json.ends_on ? { ends_on: json.ends_on } : {}) });
      setRecording(null);
      setLinkResult({ sponsorId: sp.id, note: `Payment recorded${json.sent ? `. ${sp.name} was emailed a thank-you with their invoice` : '. Their invoice is on their sponsor page'}${isSponsorOnSite(sp) ? '' : '. Tap Put on site when they\'re ready'}.` });
      reloadPayments();
    } catch {
      setRecording({ ...recording, busy: false, error: 'The payment could not be recorded. Check your connection and try again.' });
    }
  };
  // SPE-15: bringing back or renewing a sponsor who paid keeps them Paid
  const backOnStatus = (sp: Sponsor): SponsorPackageStatus => (sponsorPayments.paid.has(sp.id) ? 'paid' : 'confirmed');
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
    })) updateSponsor(sp.id, { ends_on: until, ...(isEnded(sp) ? { is_active: true, package_status: backOnStatus(sp) } : {}) });
  };
  const bringBack = (sp: Sponsor) => updateSponsor(sp.id, {
    is_active: true,
    package_status: backOnStatus(sp),
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
  // `page`: the link is to their own page (Copy their link), not a payment or renewal link
  const [linkResult, setLinkResult] = useState<{ sponsorId: string; busy?: boolean; link?: string; emailed?: boolean; note?: string; copied?: boolean; page?: boolean } | null>(null);
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
      if (json.emailed && renewalsReady) updateSponsor(sp.id, { link_sent_at: new Date().toISOString(), link_kind: kind });
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

  // The sponsor's own private page (SP-F1/F3/F4): their logo, results and invoices. Its secret comes
  // from the server (app/api/sponsors/page-link); `rotate` makes a new one so the old link stops working
  const copyPageLink = async (sp: Sponsor, rotate = false) => {
    if (rotate && !(await confirmAction({
      title: `New link for ${sp.name}?`,
      message: 'Their old page link stops working, and so do invoice, payment and renewal links already sent. Use this if their link reached the wrong person.',
      confirmLabel: 'Make a new link',
      danger: true,
    }))) return;
    setLinkResult({ sponsorId: sp.id, busy: true });
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/sponsors/page-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ clubId: club.id, sponsorId: sp.id, rotate }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.link) return setLinkResult({ sponsorId: sp.id, note: json.error || 'The link could not be fetched.' });
      const note = `${rotate ? 'New link made: the old one no longer works. ' : ''}Their own page, where they send a new logo and see their results and invoices. Only send it to them.`;
      const copied = await navigator.clipboard.writeText(json.link).then(() => true, () => false);
      setLinkResult({ sponsorId: sp.id, link: json.link, note, copied, page: true });
    } catch {
      setLinkResult({ sponsorId: sp.id, note: 'The link could not be fetched. Check your connection and try again.' });
    }
  };
  // A logo or website they sent from that page: nothing changes on the site until Use it
  // SPE-17: then the sponsor is emailed and their page says which (app/api/sponsors/change-reviewed)
  const tellSponsor = async (sp: Sponsor, used: boolean) => {
    const token = await getAccessToken();
    fetch('/api/sponsors/change-reviewed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ clubId: club.id, sponsorId: sp.id, used, logo: !!sp.pending_logo_url, website: !!sp.pending_website_url }),
    }).catch(() => { /* best effort: the change itself is saved either way */ });
  };
  const acceptSentChange = (sp: Sponsor) => {
    updateSponsor(sp.id, {
      ...(sp.pending_logo_url ? { logo_url: sp.pending_logo_url } : {}),
      ...(sp.pending_website_url ? { website_url: sp.pending_website_url } : {}),
      pending_logo_url: null, pending_website_url: null, pending_sent_at: null,
    });
    tellSponsor(sp, true);
  };
  const keepOld = (sp: Sponsor) => {
    updateSponsor(sp.id, { pending_logo_url: null, pending_website_url: null, pending_sent_at: null });
    tellSponsor(sp, false);
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
    // SPE-13: the club's current season by name, as Seasons calls it
    season: defaultSponsorSeason(seasons.filter(se => se.club_id === club.id), defaultSeasonLabel()),
    // The end of the club's season (Seasons), or a year from today
    ends_on: seasonEnd,
    // SPP-4: the package they hold, if any
    package_id: '',
  };

  const [form, setForm] = useState(blankForm);
  const [websiteError, setWebsiteError] = useState<string | null>(null);

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm(blankForm);
    setWebsiteError(null);
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
      package_id: s.package_id || '',
    });
    setWebsiteError(null);
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    if (form.scope === 'event' && !form.event_id) return;
    // "acme.com.au" is saved as https://acme.com.au/, so the logo links to it
    const website = form.website_url.trim() ? typedWebsite(form.website_url) : '';
    if (website === undefined) {
      setWebsiteError('That website address doesn\'t look right. Try something like acmeplumbing.com.au');
      document.getElementById('sponsors-website-link')?.focus();
      return;
    }

    const { scope, label, ends_on, package_id, ...rest } = form;
    const payload = {
      ...rest,
      // Only sent once the column exists (migration 20261137)
      ...(packageIdReady ? { package_id: package_id || null } : {}),
      website_url: website,
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
      const before = clubSponsors.find(sp => sp.id === editingId);
      // Shown now: no longer a new sign-up if they're hidden again later in this visit (SPE-6)
      updateSponsor(editingId, { ...payload, ...(payload.is_active && !before?.went_live_at ? { went_live_at: new Date().toISOString() } : {}) });
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
      <div className="admin-head">
        <div>
          <h1>Sponsors</h1>
          <p>Kit sponsors, ground naming rights and community sponsors, their packages and the perks they give members.</p>
        </div>

        <div className="admin-head-actions">
          <button type="button" onClick={() => setThanksPosterOpen(true)} className="btn btn-secondary row">
            <Printer size={16} aria-hidden="true" />
            <span>Print thank-you poster</span>
          </button>
          <button type="button" onClick={handleOpenAdd} className="btn btn-primary row">
            <Plus size={16} aria-hidden="true" />
            <span>Add a sponsor</span>
          </button>
        </div>
      </div>
      {thanksPosterOpen && <SponsorThanksPoster club={club} onClose={() => setThanksPosterOpen(false)} />}

      <div className="admin-tabs" role="tablist" aria-label="Sponsors">
        {([['list', 'Sponsors', Shield], ['packages', 'Packages', Package], ['perks', 'Member perks', Gift]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} data-view-ok onClick={() => setTab(id)} className="admin-tab">
            <Icon size={14} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      {tab === 'packages' ? <SponsorPackagesPanel club={club} /> : tab === 'perks' ? <PerksPanel club={club} sponsors={clubSponsors} /> : (<>

      <OneSponsorSpots club={club} />

      {/* Top Banner & Live Preview Toggle */}
      <div className="admin-notice" style={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {/* One paragraph that wraps as a whole, not three side-by-side columns on a phone */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', flex: '1 1 260px', minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <strong style={{ color: 'var(--text-primary)' }}>Bigger tiers get bigger logos. </strong>
            Platinum shows biggest, then Gold, Silver, Bronze and Grassroots. Change one sponsor&apos;s size with Logo size when you edit them.
          </p>
        </div>
        <button data-view-ok
          type="button"
          onClick={() => setShowLivePreview(!showLivePreview)}
          className="btn btn-secondary btn-sm"
        >
          <Eye size={13} aria-hidden="true" />
          <span>{showLivePreview ? 'Hide the preview' : 'Preview what fans see'}</span>
        </button>
      </div>

      {/* Live Public Scaling Preview (club-wide sponsors only - event sponsors show on their event's page) */}
      {showLivePreview && previewSponsors.length > 0 && (view === 'all' || view === 'live') && (
        <div style={{
          marginBottom: '2rem',
          padding: '1.25rem',
          background: 'color-mix(in oklab, var(--color-sidebar) 25%, transparent)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <LayoutGrid size={14} aria-hidden="true" /> What fans see
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
                    background: isXL || isLG ? 'var(--color-paper-3)' : 'var(--color-paper-2)',
                    border: isXL || isLG ? '1px solid var(--color-rule-strong)' : '1px solid var(--border-subtle)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: isXL ? '1rem' : isLG ? '0.75rem' : '0.5rem',
                    minWidth: isXL ? '280px' : isLG ? '220px' : isMD ? '170px' : '130px',
                    flex: isXL ? '2 1 280px' : isLG ? '1.5 1 220px' : '1 1 160px',
                  }}
                >
                  <SponsorLogo
                    src={sponsor.logo_url}
                    name={sponsor.name}
                    height={isXL ? 48 : isLG ? 36 : isMD ? 28 : 22}
                    style={{ maxWidth: isXL ? '130px' : isLG ? '100px' : isMD ? '80px' : '65px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: isXL ? '1rem' : isLG ? '0.88rem' : '0.78rem', color: 'var(--text-primary)' }}>
                      {sponsor.name}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.2rem 0.35rem', marginTop: '2px' }}>
                      {/* SPE-24: the pill stays on one line; the logo size moves under it instead */}
                      <span className="admin-pill">{sponsorLabel(sponsor)}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
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
      <div className="admin-chips" role="group" aria-label="Show" style={{ marginBottom: 'var(--space-md)' }}>
        {VIEWS.filter(v => v.id !== 'ending' || renewalsReady).map(v => (
          <button key={v.id} type="button" data-view-ok className="admin-chip" aria-pressed={view === v.id} onClick={() => setView(v.id)}>
            {v.label}
            <span className="num" style={(v.id === 'new' || v.id === 'ending') && viewCounts[v.id] > 0 ? { color: 'var(--color-warn)', fontWeight: 600 } : undefined}>
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
          // SPE-7: they paid by bank transfer and the receipt is waiting for the treasurer
          const receiptWaiting = sponsor.package_status === 'prospect' && sponsorPayments.receipt.has(sponsor.id);
          // SPP-2: an invoice sent before payment, and whether it's past its due date
          const invoice = sponsorPayments.invoice.get(sponsor.id);
          const overdue = !!invoice && invoice.due_on < localDateISO();
          // Something to pay for: not paid yet, or a renewal that is due (or an invoice already out)
          const payable = !receiptWaiting && sponsor.package_status !== 'cancelled'
            && (!!invoice || sponsor.package_status !== 'paid' || canPayRenewal(sponsor))
            // A deal agreed in goods or services has no money to come in
            && (!!invoice || !(sponsor.package_status === 'confirmed' && inKind(sponsor)));
          const statusText = receiptWaiting ? 'Receipt to check'
            : invoice ? (overdue ? 'Invoice overdue' : `Invoice due ${formatEndDate(invoice.due_on)}`)
            : stage === 'new' && sponsor.package_status === 'prospect' ? 'Not paid yet'
            : sponsor.package_status === 'confirmed' && inKind(sponsor) ? 'Agreed, in kind'
            : sponsor.package_status ? PACKAGE_STATUS_LABEL[sponsor.package_status] : '';
          // SPE-16: older links (before migration 20261136) don't say which they were
          const sentLinkName = sponsor.link_kind === 'renewal' ? 'Renewal' : sponsor.link_kind === 'payment' || stage === 'new' ? 'Payment' : null;
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
                    background: 'color-mix(in oklab, var(--color-ink) 5%, transparent)',
                    padding: '4px',
                    borderRadius: '6px',
                  }}
                />
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{sponsor.name}</span>
                    <span className="admin-pill" style={{ textTransform: 'capitalize' }}>{sponsor.tier}</span>
                    {sponsor.label?.trim() && <span className="text-meta">Shown as &ldquo;{sponsor.label.trim()}&rdquo;</span>}
                    {stage !== 'new' && stage !== 'ended' && (
                      <span className="admin-pill">
                        <Maximize2 size={10} aria-hidden="true" />
                        Logo size: {LOGO_SIZE_LABEL[scale]}{!isCustomScale && ' (by tier)'}
                      </span>
                    )}
                    {sponsor.package_status && (
                      <span className={`admin-pill${overdue ? ' is-danger' : receiptWaiting || invoice ? ' is-warn' : sponsor.package_status === 'paid' ? ' is-ok' : ''}`}>
                        {statusText}
                      </span>
                    )}
                    {stage !== 'ended' && onSiteBadge(sponsor)}
                    {stage !== 'ended' && packages.length > 0 && !sponsorPackageFor(sponsor, packages) && (
                      <span title="Posters, tickets and the check-in screen only show sponsors on a package. Pick their package in Edit, or give them the tier and price of one."
                        className="admin-pill">
                        Not on a package
                      </span>
                    )}
                    {endingSoon && daysLeft !== null && (
                      <span className="admin-pill is-warn">
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
                        {sponsor.season ? `, ${sponsor.season}` : ''}
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
                        {sentLinkName ? `${sentLinkName} link` : 'Link'} sent {new Date(sponsor.link_sent_at).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short' })}
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

              {/* A new logo or website they sent from their own page */}
              {hasSentChange(sponsor) && (
                <div role="status" style={{ flexBasis: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem 1rem', padding: '0.85rem 1rem', borderRadius: '12px', background: 'var(--color-warn-wash)', border: '1px solid var(--color-warn-line)' }}>
                  {sponsor.pending_logo_url && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <SponsorLogo src={sponsor.logo_url} name={sponsor.name} height={40} style={{ width: 64, background: 'var(--color-print)', padding: 4, borderRadius: 6 }} />
                      <span aria-hidden="true" className="text-muted">→</span>
                      <img src={sponsor.pending_logo_url} alt={`New logo from ${sponsor.name}`} style={{ height: 40, width: 64, objectFit: 'contain', background: 'var(--color-print)', padding: 4, borderRadius: 6 }} />
                    </div>
                  )}
                  <div style={{ flex: '1 1 200px', minWidth: 0, fontSize: '0.82rem' }}>
                    <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                      {sponsor.pending_logo_url && sponsor.pending_website_url ? 'New logo and website sent' : sponsor.pending_logo_url ? 'New logo sent' : 'New website sent'}
                      {sponsor.pending_sent_at && <span className="text-muted" style={{ fontWeight: 500 }}> {new Date(sponsor.pending_sent_at).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short' })}</span>}
                    </div>
                    {sponsor.pending_website_url && (
                      <div className="text-muted" style={{ overflowWrap: 'anywhere' }}>
                        Website: <a href={sponsorHref(sponsor.pending_website_url)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--club-ink)' }}>{sponsor.pending_website_url}</a>
                      </div>
                    )}
                    <div className="text-muted">Nothing changes on your site until you tap Use it.</div>
                  </div>
                  <div className="row row-wrap">
                    <button type="button" onClick={() => acceptSentChange(sponsor)} className="btn btn-primary btn-sm" style={actionStyle}><Check size={14} /> Use it</button>
                    <button type="button" onClick={() => keepOld(sponsor)} className="btn btn-secondary btn-sm" style={actionStyle}>Keep the old one</button>
                  </div>
                </div>
              )}

              <div className="row row-wrap">
                {linkedEvent && (
                  <span className="badge badge-primary" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <Calendar size={11} /> {linkedEvent.title}
                  </span>
                )}
                {/* Price-on-request sign-ups have nothing to pay: the club replies to their Inbox message */}
                {receiptWaiting && (
                  <a href={`/${club.slug}/admin/finance?tab=income`} className="btn btn-secondary btn-sm" style={actionStyle}>
                    <DollarSign size={14} /> Check the receipt in Finance
                  </a>
                )}
                {stage === 'new' && sponsor.package_status === 'prospect' && Number(sponsor.package_value) > 0 && !receiptWaiting && (
                  <button type="button" disabled={result?.busy} onClick={() => sendLink(sponsor, 'payment')} className="btn btn-secondary btn-sm" style={actionStyle}>
                    <Send size={14} /> {sponsor.link_sent_at && sponsor.link_kind !== 'renewal' ? 'Send payment link again' : 'Send payment link'}
                  </button>
                )}
                {renewalsReady && (endingSoon || (stage === 'ended' && isPastEndDate(sponsor))) && (
                  <button type="button" disabled={result?.busy} onClick={() => sendLink(sponsor, 'renewal')} className="btn btn-secondary btn-sm" style={actionStyle}>
                    <Send size={14} /> {sponsor.link_sent_at && sponsor.link_kind === 'renewal' ? 'Send renewal link again' : 'Send renewal link'}
                  </button>
                )}
                {renewalsReady && (endingSoon || (stage === 'ended' && isPastEndDate(sponsor))) && (
                  <button type="button" onClick={() => renew(sponsor)} className="btn btn-primary btn-sm" style={actionStyle}>
                    <RefreshCw size={14} /> Renew
                  </button>
                )}
                {/* SPP-2: for businesses that only pay against an invoice */}
                {payable && renewalsReady && (invoice || packageFor(sponsor)) && (
                  <button type="button" disabled={result?.busy} onClick={() => sendInvoice(sponsor, !!invoice)} className="btn btn-secondary btn-sm" style={actionStyle}
                    title={invoice ? 'Email them the same invoice again' : `An invoice due in 14 days${packageFor(sponsor) ? ` for ${packageFor(sponsor)!.name}` : ''}`}>
                    <FileText size={14} /> {invoice ? 'Send invoice again' : 'Send invoice'}
                  </button>
                )}
                {/* SPP-3: cash, cheque or a direct deposit the treasurer saw in the bank */}
                {payable && (
                  <button type="button" onClick={() => openRecord(sponsor)} className="btn btn-secondary btn-sm" style={actionStyle}>
                    <Banknote size={14} /> Record a payment
                  </button>
                )}
                {renewalsReady && !(stage === 'new' && sponsor.package_status === 'prospect') && (
                  <button type="button" disabled={result?.busy} onClick={() => copyPageLink(sponsor)} title="Copy the link to their own sponsor page" className="btn btn-secondary btn-sm" style={actionStyle}>
                    <Copy size={14} /> Copy their link
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
                <div role="status" style={{ flexBasis: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 0.85rem', padding: '0.65rem 0.85rem', borderRadius: '10px', background: 'color-mix(in oklab, var(--color-sidebar) 30%, transparent)', border: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
                  {result.emailed
                    ? <span style={{ color: 'var(--c-green)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Check size={14} /> Emailed to {sponsor.contact_email}</span>
                    : <span style={{ color: result.link && result.page ? 'var(--text-secondary)' : result.link ? 'var(--c-amber)' : 'var(--c-red)', fontWeight: 700 }}>{result.note}</span>}
                  {result.link && (
                    <button type="button" onClick={copyLink} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Copy size={13} /> {result.copied ? 'Copied' : 'Copy link'}
                    </button>
                  )}
                  {result.link && result.page && (
                    <a href={result.link} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <ExternalLink size={13} /> Open their page
                    </a>
                  )}
                  {result.link && result.page && (
                    <button type="button" onClick={() => copyPageLink(sponsor, true)} title="Stop the old link working, if it reached the wrong person" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      <RefreshCw size={13} /> New link
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
          <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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
                {heading(<Calendar size={14} />, `Event sponsors, ${event.title}`)}
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
          background: 'var(--color-scrim)',
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
                <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {editingId ? 'Edit sponsor' : 'Add a sponsor'}
                </h3>
                <button type="button" onClick={() => setModalOpen(false)} aria-label="Close" title="Close (Esc)" className="touch-target" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>
              <nav aria-label="Sections" style={{ display: 'flex', gap: '1.1rem', borderBottom: '1px solid var(--border-subtle)' }}>
                {SECTIONS.map(([id, label]) => (
                  <button key={id} type="button" onClick={e => jumpTo(id, e.timeStamp)}
                    style={{ padding: '0.55rem 0.1rem', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: section === id ? 'var(--text-primary)' : 'var(--text-muted)', boxShadow: section === id ? 'inset 0 -2px 0 var(--color-accent)' : 'none' }}>
                    {label}
                  </button>
                ))}
              </nav>
            </div>

            <form onSubmit={handleSave} style={{ paddingTop: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '0.85rem', marginBottom: '1.25rem', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid var(--color-accent-line)', background: 'var(--color-accent-wash)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div id="sponsors-on-site" style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Show on the club site</div>
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
                <h4 style={sectionHeading}><Shield size={14} color="var(--color-accent-ink)" /> Business</h4>

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
                  {/* Plain text so "www.acme.com.au" is accepted; Save adds the https:// (SPE-4) */}
                  <input id="sponsors-website-link"
                    type="text"
                    inputMode="url"
                    autoComplete="url"
                    className="form-input"
                    placeholder="yourbusiness.com.au"
                    aria-invalid={!!websiteError}
                    value={form.website_url}
                    onChange={e => { setForm({ ...form, website_url: e.target.value }); setWebsiteError(null); }}
                  />
                  {websiteError && <p role="alert" style={{ ...hint, color: 'var(--c-red)' }}>{websiteError}</p>}
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
                <h4 style={sectionHeading}><Eye size={14} aria-hidden="true" /> How it shows</h4>

                <div className="form-group">
                  <label className="form-label">Where it shows</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                    {([['club', Shield, 'Whole club'], ['event', Calendar, 'One event']] as const).map(([value, Icon, text]) => (
                      <button key={value} type="button" aria-pressed={form.scope === value}
                        onClick={() => setForm({ ...form, scope: value, event_id: value === 'club' ? '' : form.event_id })}
                        className="btn btn-secondary btn-sm"
                        style={{ justifyContent: 'center', gap: '0.4rem' }}>
                        <Icon size={14} aria-hidden="true" /> {text}
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
                          {evt.title} ({formatShortDay(evt.start_time)})
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
                  <div role="group" aria-labelledby="sponsors-logo-size" style={{ display: 'flex', gap: '4px', padding: '4px', borderRadius: '12px', background: 'color-mix(in oklab, var(--color-sidebar) 35%, transparent)', border: '1px solid var(--border-subtle)' }}>
                    {(['auto', 'xl', 'lg', 'md', 'sm'] as SponsorSizeScale[]).map(size => (
                      <button key={size} type="button" aria-pressed={form.size_scale === size} onClick={() => setForm({ ...form, size_scale: size })}
                        style={{
                          flex: 1, padding: '0.5rem 0.2rem', borderRadius: '9px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
                          border: 'none',
                          background: form.size_scale === size ? 'color-mix(in oklab, var(--color-accent) 20%, transparent)' : 'transparent',
                          color: form.size_scale === size ? 'var(--text-primary)' : 'var(--text-muted)',
                          boxShadow: form.size_scale === size ? 'inset 0 0 0 1px color-mix(in oklab, var(--color-accent) 60%, transparent)' : 'none',
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
                <h4 style={sectionHeading}><DollarSign size={14} color="var(--color-accent-ink)" /> Deal</h4>
                <p style={{ ...hint, marginTop: '-0.5rem', marginBottom: '1rem' }}>Only admins see this.</p>

                {packageIdReady && packages.length > 0 && (
                  <div className="form-group">
                    <label htmlFor="sponsors-package" className="form-label">Package</label>
                    <select id="sponsors-package" className="form-select" value={form.package_id}
                      onChange={e => {
                        const pkg = packages.find(p => p.id === e.target.value);
                        // The package sets the tier, and the value when none is typed yet
                        setForm({ ...form, package_id: e.target.value, ...(pkg ? { tier: pkg.tier, package_value: form.package_value === '' && pkg.price_cents > 0 ? pkg.price_cents / 100 : form.package_value } : {}) });
                      }}>
                      <option value="">No package</option>
                      {packages.map(p => (
                        <option key={p.id} value={p.id}>{p.name}{p.price_cents > 0 ? ` (${formatMoney(p.price_cents, currency)})` : ''}{p.is_active ? '' : ' (not offered now)'}</option>
                      ))}
                    </select>
                    <p style={hint}>Invoices and payment links are for this package. It counts towards the package&apos;s limit, if it has one.</p>
                  </div>
                )}

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
                        ? 'The day after, they come off the site and move to Ended. Needs you reminds you 30 days before, and with Sponsor renewal reminders on (Email Notifications) they are emailed the renewal link.'
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

      {/* SPP-3: Record a payment (cash, cheque or a direct deposit) */}
      {recording && (
        <div role="dialog" aria-modal="true" aria-labelledby="record-payment-title"
          onKeyDown={e => { if (e.key === 'Escape') setRecording(null); }}
          style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'var(--color-scrim)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflowY: 'auto' }}>
          <form onSubmit={saveRecord} className="glass-panel" style={{ margin: 'auto', width: '100%', maxWidth: '440px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-xl)', padding: '1.5rem' }}>
            <div className="section-head" style={{ marginBottom: '0.35rem' }}>
              <h3 id="record-payment-title" style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)' }}>Record a payment</h3>
              <button type="button" onClick={() => setRecording(null)} aria-label="Close" title="Close (Esc)" className="touch-target" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <p className="text-meta" style={{ margin: '0 0 1.1rem' }}>
              Money {recording.sponsor.name} paid outside the website. They&apos;re marked Paid, it goes in Finance, and their invoice shows on their sponsor page.
            </p>
            {sponsorPayments.invoice.get(recording.sponsor.id) ? (
              <div className="form-group">
                <span className="form-label">Amount</span>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                  {formatMoney(sponsorPayments.invoice.get(recording.sponsor.id)!.amount_cents, sponsorPayments.invoice.get(recording.sponsor.id)!.currency)}
                  <span className="text-meta" style={{ fontWeight: 500 }}>, pays the invoice you sent them</span>
                </div>
              </div>
            ) : (
              <div className="form-group">
                <label htmlFor="record-amount" className="form-label">Amount ({currency})</label>
                <input id="record-amount" className="form-input" inputMode="decimal" required value={recording.amount}
                  onChange={e => setRecording({ ...recording, amount: e.target.value, error: undefined })} placeholder="e.g. 1500" />
              </div>
            )}
            <div className="form-group">
              <span id="record-method" className="form-label">How they paid</span>
              <div role="group" aria-labelledby="record-method" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                {([['bank_transfer', 'Direct deposit'], ['cash', 'Cash'], ['cheque', 'Cheque'], ['other', 'Other']] as const).map(([value, text]) => (
                  <button key={value} type="button" aria-pressed={recording.method === value} onClick={() => setRecording({ ...recording, method: value })}
                    className="btn btn-secondary btn-sm"
                    style={{ justifyContent: 'center' }}>
                    {text}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-row-2" style={{ gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="record-paid-on" className="form-label">Date received</label>
                <input id="record-paid-on" type="date" className="form-input" required max={localDateISO()} value={recording.paidOn}
                  onChange={e => setRecording({ ...recording, paidOn: e.target.value, error: undefined })} />
              </div>
              {renewalsReady && (
                <div className="form-group">
                  <label htmlFor="record-until" className="form-label">Sponsorship runs until</label>
                  <input id="record-until" type="date" className="form-input" required min={recording.paidOn} value={recording.until}
                    onChange={e => setRecording({ ...recording, until: e.target.value, error: undefined })} />
                </div>
              )}
            </div>
            {recording.error && <p role="alert" style={{ color: 'var(--c-red)', fontSize: '0.85rem', margin: '0 0 0.75rem' }}>{recording.error}</p>}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button type="button" onClick={() => setRecording(null)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
              <button type="submit" disabled={recording.busy} className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
                {recording.busy ? 'Saving…' : 'Record payment'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
