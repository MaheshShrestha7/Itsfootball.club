'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Check, Copy, Download, ExternalLink, FileArchive, FileText, Printer, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useClub } from '@/lib/club-context';
import { seasonOptions } from '@/lib/agm-report';
import { comparisonPeriod, defaultYear, packPeriod, yearOptions } from '@/lib/audit-pack';
import { formatDate } from '@/lib/dates';
import { expenseSeason, formatMoney, paymentSeason, toCsv } from '@/lib/finance';
import {
  attendanceCsv, buildGrantPackZip, buildGrantReport, demographicsCsv, executiveSummaryCsv,
  grantSummaryText, itemisedExpensesCsv, spendSummaryCsv,
  type GrantContext, type GrantExpense, type GrantPayment, type GrantPeriod,
} from '@/lib/grant-report';
import { siteToday } from '@/lib/member-prices';
import { fetchPaged } from '@/lib/paged';
import { openReceipt } from '@/lib/receipts';
import { cell, heading, heavy, ink, muted, num, paper, PAPER_PRINT_CSS, rule, small, th, thNum, totalCell, totalNum } from '@/lib/report-paper';
import { getSupabaseClient } from '@/lib/supabase/client';
import type { EventAttendee } from '@/lib/supabase/types';

// Grant & Acquittal Readiness Report ("Club Impact & Participation Export"):
// Aggregates active player demographics (zero PII), junior/veterans/women's program attendance,
// and equipment/facility spend into a printable white-paper summary and a one-click ZIP pack.
// Read-only; fails closed if the ledger cannot be read in full so partial totals are never shown.

interface LedgerData {
  payments: GrantPayment[];
  expenses: GrantExpense[];
  eventAttendees: EventAttendee[];
  settings: { currency?: string; abn?: string | null; gst_registered?: boolean } | null;
}

const MAX_ROWS = 100000;

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(name: string, rows: (string | number | null | undefined)[][]) {
  downloadBlob(name, new Blob(['\ufeff' + toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
}

function safeSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'period';
}

export default function GrantReportPage({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = use(params);
  const {
    clubs, selectClubBySlug, members, clubTeams, clubTeamMembers,
    matches, events, availabilities, playerStats, seasons, getActiveSeason,
  } = useClub();
  const { can } = useAuth();
  const club = selectClubBySlug(clubSlug) || clubs[0];
  const allowed = can(club.id, 'finance');
  const seesPeople = can(club.id, 'members') || can(club.id, 'squad');

  const [ledger, setLedger] = useState<LedgerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [periodMode, setPeriodMode] = useState<'season' | 'dates'>('season');
  const [pickedSeason, setPickedSeason] = useState<string | null>(null);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);

  // Optional grant application / acquittal header context (client-side only)
  const [grantName, setGrantName] = useState('');
  const [fundingBody, setFundingBody] = useState('');
  const [reference, setReference] = useState('');
  const [showItemised, setShowItemised] = useState(false);
  const [printItemised, setPrintItemised] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    const db = getSupabaseClient();
    let stopped = false;
    (async () => {
      if (!db) {
        if (!stopped) setError('The club\'s records can\'t be reached right now.');
        return;
      }
      const [payments, expenses, attendees, settings] = await Promise.all([
        fetchPaged<GrantPayment>((from, to) => db.from('payments').select('*').eq('club_id', club.id).order('id').range(from, to), MAX_ROWS),
        fetchPaged<GrantExpense>((from, to) => db.from('expenses').select('*').eq('club_id', club.id).order('id').range(from, to), MAX_ROWS),
        fetchPaged<EventAttendee>((from, to) => db.from('event_attendees').select('id, event_id, club_id, member_id, attendee_name, checkin_status, checked_in_at, qr_ticket_code').eq('club_id', club.id).order('id').range(from, to), MAX_ROWS),
        db.from('club_payment_settings').select('currency, abn, gst_registered').eq('club_id', club.id).maybeSingle(),
      ]);
      if (stopped) return;
      const failed = payments.error || expenses.error;
      if (failed) return setError(`The report wasn't made, because some of the club's records couldn't be read (${failed}). Please try again.`);
      setLedger({
        payments: payments.data,
        expenses: expenses.data,
        eventAttendees: attendees.error ? [] : attendees.data,
        settings: settings.data,
      });
    })().catch(() => {
      if (!stopped) setError('The report wasn\'t made, because the club\'s records couldn\'t be read. Check your connection and try again.');
    });
    return () => { stopped = true; };
  }, [club.id, allowed]);

  const clubSeasons = useMemo(() => seasons.filter(s => s.club_id === club.id), [seasons, club.id]);
  const seasonPayments = useMemo(
    () => (ledger?.payments || []).map(p => ({ ...p, season: paymentSeason(p, clubSeasons) })),
    [ledger, clubSeasons]
  );
  const seasonExpenses = useMemo(
    () => (ledger?.expenses || []).map(e => ({ ...e, season: expenseSeason(e, clubSeasons) })),
    [ledger, clubSeasons]
  );

  // Season mode options
  const sOptions = useMemo(
    () => seasonOptions(clubSeasons, [...seasonPayments, ...seasonExpenses]),
    [clubSeasons, seasonPayments, seasonExpenses]
  );
  const activeSeasonName = getActiveSeason(club.id)?.name?.trim();
  const selectedSeason = pickedSeason ?? (sOptions.some(o => o.name === activeSeasonName) ? activeSeasonName! : sOptions[0]?.name ?? '');
  const selectedSeasonIdx = sOptions.findIndex(o => o.name === selectedSeason);
  const seasonInfo = sOptions[selectedSeasonIdx];
  const prevSeasonInfo = sOptions[selectedSeasonIdx + 1] ?? null;

  // Date / Financial Year mode options
  const startMonth = club.fiscal_year_start_month || 7;
  const fyOptions = useMemo(
    () => (ledger ? yearOptions(ledger.payments as Parameters<typeof yearOptions>[0], ledger.expenses as Parameters<typeof yearOptions>[1], startMonth) : []),
    [ledger, startMonth]
  );
  const defaultFy = defaultYear(fyOptions, siteToday());
  const from = range?.from ?? defaultFy?.from ?? `${new Date().getFullYear() - 1}-07-01`;
  const to = range?.to ?? defaultFy?.to ?? `${new Date().getFullYear()}-06-30`;
  const datePackPeriod = useMemo(() => packPeriod(from, to, startMonth), [from, to, startMonth]);
  const prevDatePackPeriod = useMemo(
    () => (ledger && datePackPeriod
      ? comparisonPeriod(datePackPeriod, startMonth, ledger.payments as Parameters<typeof comparisonPeriod>[2], ledger.expenses as Parameters<typeof comparisonPeriod>[3])
      : null),
    [ledger, datePackPeriod, startMonth]
  );
  const listedFy = fyOptions.some(y => y.startYear === datePackPeriod?.startYear);

  // Active GrantPeriod + Previous GrantPeriod
  const { period, previousPeriod } = useMemo((): { period: GrantPeriod | null; previousPeriod: GrantPeriod | null } => {
    if (periodMode === 'season') {
      if (!selectedSeason) {
        // Fallback when club has no seasons or ledger yet: use current calendar year
        const yr = String(new Date().getFullYear());
        return { period: { mode: 'season', label: `Season ${yr}`, from: `${yr}-01-01`, to: `${yr}-12-31`, seasonName: yr }, previousPeriod: null };
      }
      const p: GrantPeriod = {
        mode: 'season',
        label: `Season ${selectedSeason}`,
        from: seasonInfo?.start_date || '',
        to: seasonInfo?.end_date || '',
        seasonName: selectedSeason,
      };
      const prev: GrantPeriod | null = prevSeasonInfo ? {
        mode: 'season',
        label: `Season ${prevSeasonInfo.name}`,
        from: prevSeasonInfo.start_date || '',
        to: prevSeasonInfo.end_date || '',
        seasonName: prevSeasonInfo.name,
      } : null;
      return { period: p, previousPeriod: prev };
    }
    if (!datePackPeriod) return { period: null, previousPeriod: null };
    return {
      period: { mode: 'dates', label: datePackPeriod.label, from: datePackPeriod.from, to: datePackPeriod.to },
      previousPeriod: prevDatePackPeriod ? { mode: 'dates', label: prevDatePackPeriod.label, from: prevDatePackPeriod.from, to: prevDatePackPeriod.to } : null,
    };
  }, [periodMode, selectedSeason, seasonInfo, prevSeasonInfo, datePackPeriod, prevDatePackPeriod]);

  const grantCtx: GrantContext = useMemo(
    () => ({ grantName, fundingBody, reference }),
    [grantName, fundingBody, reference]
  );

  const report = useMemo(() => {
    if (!ledger || !period) return null;
    return buildGrantReport({
      club,
      settings: ledger.settings,
      period,
      previousPeriod,
      includeDemographics: seesPeople,
      members,
      teams: clubTeams,
      teamMembers: clubTeamMembers,
      matches,
      events,
      eventAttendees: ledger.eventAttendees,
      availabilities,
      playerStats,
      payments: period.mode === 'season' ? seasonPayments : ledger.payments,
      expenses: period.mode === 'season' ? seasonExpenses : ledger.expenses,
    });
  }, [
    ledger, period, previousPeriod, club, seesPeople, members, clubTeams,
    clubTeamMembers, matches, events, availabilities, playerStats, seasonPayments, seasonExpenses,
  ]);

  const currency = report?.spend.currency || 'AUD';
  const fmt = (cents: number) => (cents < 0 ? `(${formatMoney(-cents, currency)})` : formatMoney(cents, currency));
  const filePrefix = `${club.slug}-grant-impact-${safeSlug(period?.label || 'report')}`;

  const handleDownloadZip = () => {
    if (!report) return;
    const bytes = buildGrantPackZip(report, grantCtx);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    downloadBlob(`${filePrefix}.zip`, new Blob([buffer], { type: 'application/zip' }));
  };

  const handleCopySummary = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(grantSummaryText(report, grantCtx));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: ignore if clipboard is unavailable
    }
  };

  if (!allowed) {
    return <p style={{ color: 'var(--text-secondary)' }}>Only people with access to Finance can open the Grant &amp; acquittal report.</p>;
  }

  return (
    <div>
      <style>{`
        ${PAPER_PRINT_CSS}
        .grant-kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.75rem; margin: 1.25rem 0 1.5rem; }
        .grant-kpi { border: ${rule}; border-radius: 10px; padding: 0.75rem 0.9rem; background: #f8fafc; }
        .grant-kpi-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: ${muted}; font-weight: 700; }
        .grant-kpi-value { font-size: 1.35rem; font-weight: 800; color: ${ink}; margin-top: 0.2rem; font-variant-numeric: tabular-nums; }
        .grant-kpi-sub { font-size: 0.76rem; color: ${muted}; margin-top: 0.15rem; }
        @media (max-width: 720px) { .grant-kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media print {
          .grant-no-print { display: none !important; }
          .grant-kpi { background: #fff !important; }
        }
      `}</style>

      <div className="admin-head grant-no-print">
        <div>
          <Link href={`/${club.slug}/admin/finance`} className="text-meta" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
            <ArrowLeft size={14} aria-hidden="true" /> Finance
          </Link>
          <h1>Grant &amp; acquittal report</h1>
          <p>One-click Club Impact &amp; Participation Export — aggregated demographics, junior &amp; veterans attendance, and equipment &amp; facility spend.</p>
        </div>

        <div className="admin-head-actions" style={{ flexWrap: 'wrap' }}>
          <select
            data-view-ok
            aria-label="Reporting period mode"
            className="form-select"
            style={{ width: 'auto' }}
            value={periodMode}
            onChange={e => setPeriodMode(e.target.value as 'season' | 'dates')}
          >
            <option value="season">By season</option>
            <option value="dates">By financial year / dates</option>
          </select>

          {periodMode === 'season' ? (
            sOptions.length > 0 && (
              <select
                data-view-ok
                aria-label="Season"
                className="form-select"
                style={{ width: 'auto' }}
                value={selectedSeason}
                onChange={e => setPickedSeason(e.target.value)}
              >
                {sOptions.map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
              </select>
            )
          ) : (
            <>
              {fyOptions.length > 0 && (
                <select
                  data-view-ok
                  aria-label="Financial year"
                  className="form-select"
                  style={{ width: 'auto' }}
                  value={listedFy ? datePackPeriod?.startYear : 'custom'}
                  onChange={e => {
                    const chosen = fyOptions.find(o => o.startYear === Number(e.target.value));
                    if (chosen) setRange({ from: chosen.from, to: chosen.to });
                  }}
                >
                  {!listedFy && <option value="custom">Custom dates</option>}
                  {fyOptions.map(o => <option key={o.startYear} value={o.startYear}>{o.label}</option>)}
                </select>
              )}
              <input data-view-ok aria-label="From date" type="date" className="form-input" style={{ width: 'auto' }} value={from} onChange={e => setRange({ from: e.target.value, to })} />
              <input data-view-ok aria-label="To date" type="date" className="form-input" style={{ width: 'auto' }} value={to} onChange={e => setRange({ from, to: e.target.value })} />
            </>
          )}

          <button data-view-ok type="button" className="btn btn-primary" disabled={!report} onClick={handleDownloadZip}>
            <FileArchive size={16} aria-hidden="true" /> Export Grant Pack (.zip)
          </button>
          <button data-view-ok type="button" className="btn btn-secondary" disabled={!report} onClick={() => window.print()}>
            <Printer size={16} aria-hidden="true" /> Print / PDF
          </button>
          <button data-view-ok type="button" className="btn btn-secondary" disabled={!report} onClick={handleCopySummary}>
            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy summary'}
          </button>
        </div>
      </div>

      {/* Optional grant metadata bar — prints onto the white-paper header & included in ZIP */}
      <div
        className="grant-no-print"
        style={{
          maxWidth: 860, margin: '0 auto 1.25rem', padding: '0.9rem 1rem',
          borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem',
        }}
      >
        <div>
          <label className="form-label" htmlFor="grant-name">Grant / program name (optional)</label>
          <input data-view-ok id="grant-name" className="form-input" placeholder="e.g. Local Sport Grant Program 2026" value={grantName} onChange={e => setGrantName(e.target.value)} />
        </div>
        <div>
          <label className="form-label" htmlFor="grant-body">Council / funding body (optional)</label>
          <input data-view-ok id="grant-body" className="form-input" placeholder="e.g. Blacktown City Council" value={fundingBody} onChange={e => setFundingBody(e.target.value)} />
        </div>
        <div>
          <label className="form-label" htmlFor="grant-ref">Application / acquittal ref (optional)</label>
          <input data-view-ok id="grant-ref" className="form-input" placeholder="e.g. LSG-2026-042" value={reference} onChange={e => setReference(e.target.value)} />
        </div>
      </div>

      {error && (
        <div role="alert" style={{ maxWidth: 860, margin: '0 auto 1.25rem', padding: '0.9rem 1rem', borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: 'var(--text-primary)', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2, color: '#ef4444' }} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {!error && !report && (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0' }}>
          {ledger ? 'Pick a valid start and end date to build the report.' : 'Reading club records...'}
        </p>
      )}

      {report && (
        <>
          <article className="agm-paper" style={paper}>
            {/* Header */}
            <header style={{ borderBottom: heavy, paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: muted }}>
                  Club Impact &amp; Participation Report
                </div>
                <h2 style={{ margin: '0.2rem 0 0', fontSize: '1.55rem', fontWeight: 900, color: ink }}>
                  {report.governance.clubName}
                </h2>
                <p style={{ ...small, marginTop: '0.25rem' }}>
                  {report.period.label}
                  {report.period.from && report.period.to ? ` (${formatDate(report.period.from)} – ${formatDate(report.period.to)})` : ''}
                  {report.governance.abn ? ` · ABN ${report.governance.abn}` : ''}
                  {report.governance.gstRegistered ? ' · GST Registered' : ''}
                </p>
                {(grantName.trim() || fundingBody.trim() || reference.trim()) && (
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', fontWeight: 600, color: ink }}>
                    {[grantName.trim(), fundingBody.trim(), reference.trim() ? `Ref: ${reference.trim()}` : ''].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.78rem', color: muted }}>
                <div>Prepared {formatDate(report.generatedAt)}</div>
                <div>Aggregated · Zero PII</div>
              </div>
            </header>

            {/* Headline KPI strip */}
            <div className="grant-kpi-grid">
              <div className="grant-kpi">
                <div className="grant-kpi-label">Active Players</div>
                <div className="grant-kpi-value">{report.demographics.available ? report.demographics.activePlayers : '—'}</div>
                <div className="grant-kpi-sub">
                  {report.demographics.available ? `${report.demographics.totalMembers} total members` : 'People access required'}
                </div>
              </div>
              <div className="grant-kpi">
                <div className="grant-kpi-label">Junior &amp; Veterans</div>
                <div className="grant-kpi-value">
                  {report.demographics.available
                    ? `${report.demographics.juniorPlayers} / ${report.demographics.veteranPlayers}`
                    : '—'}
                </div>
                <div className="grant-kpi-sub">
                  {report.demographics.available ? `${report.demographics.womenGirlsPlayers} women & girls` : 'People access required'}
                </div>
              </div>
              <div className="grant-kpi">
                <div className="grant-kpi-label">Participant-Sessions</div>
                <div className="grant-kpi-value">{report.attendance.totalParticipantSessions.toLocaleString()}</div>
                <div className="grant-kpi-sub">
                  {report.attendance.allClub.matchesCompleted} matches · {report.attendance.allClub.trainingSessions} trainings
                </div>
              </div>
              <div className="grant-kpi">
                <div className="grant-kpi-label">Equip. &amp; Facility Spend</div>
                <div className="grant-kpi-value">{fmt(report.spend.grantRelevantTotalCents)}</div>
                <div className="grant-kpi-sub">
                  {report.spend.receiptReadiness.withReceiptCount}/{report.spend.receiptReadiness.totalCount} receipts on file
                </div>
              </div>
            </div>

            {/* Section 1: Governance & Child-Safe Readiness */}
            <section>
              <h3 style={heading}>1. Club Profile &amp; Governance Readiness</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr>
                    <td style={cell}>Home Ground &amp; Facility</td>
                    <td style={{ ...cell, textAlign: 'right', paddingRight: 0, fontWeight: 600 }}>
                      {report.governance.homeGround || 'Not recorded'}
                      {report.governance.pitchType ? ` (${report.governance.pitchType})` : ''}
                    </td>
                  </tr>
                  {report.governance.homeAddress && (
                    <tr>
                      <td style={cell}>Facility Address</td>
                      <td style={{ ...cell, textAlign: 'right', paddingRight: 0 }}>{report.governance.homeAddress}</td>
                    </tr>
                  )}
                  <tr>
                    <td style={cell}>Active Club Teams</td>
                    <td style={num}>{report.governance.activeTeamsCount}</td>
                  </tr>
                  <tr>
                    <td style={cell}>Executive Committee Members</td>
                    <td style={num}>{report.governance.committeeCount}</td>
                  </tr>
                  <tr>
                    <td style={cell}>Child-Safe / Welfare Officer Appointed</td>
                    <td style={{ ...num, fontWeight: 600 }}>{report.governance.welfareOfficerAppointed ? 'Yes' : 'Not recorded'}</td>
                  </tr>
                  <tr>
                    <td style={cell}>Coaches &amp; Staff with Current Background Checks (WWC / DBS)</td>
                    <td style={num}>
                      {report.governance.safeguarding.valid + report.governance.safeguarding.expiring} of {report.governance.safeguarding.totalStaff}
                    </td>
                  </tr>
                </tbody>
              </table>
              {report.governance.safeguarding.expired > 0 && (
                <p style={{ ...small, color: '#b45309' }}>
                  Note: {report.governance.safeguarding.expired} staff member{report.governance.safeguarding.expired === 1 ? ' has' : 's have'} an expired background check on file.
                </p>
              )}
            </section>

            {/* Section 2: Active Player Demographics */}
            <section>
              <h3 style={heading}>2. Active Player &amp; Member Demographics</h3>
              {!report.demographics.available ? (
                <p style={small}>Member demographic breakdowns require People (Squad or Members) access. Financial and program activity figures below remain complete.</p>
              ) : (
                <>
                  <p style={small}>
                    Aggregated counts only — no personal names, contact details or birth dates are included.
                    Active members: <strong>{report.demographics.totalMembers}</strong> ({report.demographics.activePlayers} active players, {report.demographics.staffVolunteers} coaches/volunteers/staff, {report.demographics.supporters} supporters).
                    {report.demographics.feeWaiversCount > 0 && ` Fee waivers / hardship support granted: ${report.demographics.feeWaiversCount}.`}
                    {report.demographics.distinctAdultNationalities > 0 && ` Distinct nationalities represented (adult members): ${report.demographics.distinctAdultNationalities}.`}
                  </p>

                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.6rem' }}>
                    <thead>
                      <tr>
                        <th style={th}>Age Bracket (Active Players)</th>
                        <th style={thNum}>Players</th>
                        <th style={thNum}>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.demographics.ageBrackets.map(b => (
                        <tr key={b.label}>
                          <td style={cell}>{b.label}</td>
                          <td style={num}>{b.count}</td>
                          <td style={{ ...num, color: muted }}>{b.percent.toFixed(1)}%</td>
                        </tr>
                      ))}
                      <tr>
                        <td style={totalCell}>Total Active Players</td>
                        <td style={totalNum}>{report.demographics.activePlayers}</td>
                        <td style={totalNum}>100.0%</td>
                      </tr>
                    </tbody>
                  </table>

                  {report.demographics.byTeamGender.length > 0 && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                      <thead>
                        <tr>
                          <th style={th}>Team Gender Category</th>
                          <th style={thNum}>Teams</th>
                          <th style={thNum}>Active Players</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.demographics.byTeamGender.map(g => (
                          <tr key={g.gender}>
                            <td style={cell}>{g.label}</td>
                            <td style={num}>{g.teams}</td>
                            <td style={num}>{g.players}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {report.demographics.tiers.length > 0 && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                      <thead>
                        <tr>
                          <th style={th}>Membership Tier</th>
                          <th style={thNum}>Members</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.demographics.tiers.map(t => (
                          <tr key={t.tier}>
                            <td style={cell}>{t.tier}</td>
                            <td style={num}>{t.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </section>

            {/* Section 3: Junior, Veterans & Community Program Attendance */}
            <section>
              <h3 style={heading}>3. Junior, Veterans &amp; Program Attendance</h3>
              <p style={small}>
                Tracks active squad size, completed matches, lineup appearances, and training attendance per program stream.
                Teams spanning multiple streams (e.g. Girls U14) appear in each relevant stream; &ldquo;All Club Programs&rdquo; is deduplicated.
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.6rem' }}>
                <thead>
                  <tr>
                    <th style={th}>Program Stream</th>
                    <th style={{ ...thNum, width: '10%' }}>Teams</th>
                    <th style={{ ...thNum, width: '12%' }}>Squad</th>
                    <th style={{ ...thNum, width: '12%' }}>Matches</th>
                    <th style={{ ...thNum, width: '14%' }}>Match Apps</th>
                    <th style={{ ...thNum, width: '14%' }}>Trainings</th>
                    <th style={{ ...thNum, width: '14%' }}>Avg Turnout</th>
                  </tr>
                </thead>
                <tbody>
                  {report.attendance.programs.map(p => (
                    <tr key={p.key}>
                      <td style={cell}>{p.label}</td>
                      <td style={{ ...num, width: '10%' }}>{p.teams}</td>
                      <td style={{ ...num, width: '12%' }}>{p.squadSize}</td>
                      <td style={{ ...num, width: '12%' }}>{p.matchesCompleted}</td>
                      <td style={{ ...num, width: '14%' }}>{p.matchAppearances}</td>
                      <td style={{ ...num, width: '14%' }}>{p.trainingAttendances}</td>
                      <td style={{ ...num, width: '14%', color: muted }}>{p.avgTrainingTurnout}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={totalCell}>{report.attendance.allClub.label}</td>
                    <td style={{ ...totalNum, width: '10%' }}>{report.attendance.allClub.teams}</td>
                    <td style={{ ...totalNum, width: '12%' }}>{report.attendance.allClub.squadSize}</td>
                    <td style={{ ...totalNum, width: '12%' }}>{report.attendance.allClub.matchesCompleted}</td>
                    <td style={{ ...totalNum, width: '14%' }}>{report.attendance.allClub.matchAppearances}</td>
                    <td style={{ ...totalNum, width: '14%' }}>{report.attendance.allClub.trainingAttendances}</td>
                    <td style={{ ...totalNum, width: '14%' }}>{report.attendance.allClub.avgTrainingTurnout}</td>
                  </tr>
                </tbody>
              </table>

              {report.attendance.communityEvents.eventsHeld > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                  <thead>
                    <tr>
                      <th style={th}>Community &amp; Club Events</th>
                      <th style={thNum}>Events Held</th>
                      <th style={thNum}>RSVPs</th>
                      <th style={thNum}>Checked In</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.attendance.communityEvents.byCategory.map(c => (
                      <tr key={c.category}>
                        <td style={cell}>{c.label}</td>
                        <td style={num}>{c.count}</td>
                        <td style={num}>{c.rsvps}</td>
                        <td style={num}>{c.checkins}</td>
                      </tr>
                    ))}
                    <tr>
                      <td style={totalCell}>Total Community Events</td>
                      <td style={totalNum}>{report.attendance.communityEvents.eventsHeld}</td>
                      <td style={totalNum}>{report.attendance.communityEvents.totalRsvps}</td>
                      <td style={totalNum}>{report.attendance.communityEvents.totalCheckins}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </section>

            {/* Section 4: Equipment, Facility & Grant Spend */}
            <section>
              <h3 style={heading}>4. Equipment, Facility &amp; Grant Spend (Acquittal Summary)</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Expenditure Category</th>
                    <th style={{ ...thNum, width: '12%' }}>Items</th>
                    <th style={thNum}>{report.period.label}</th>
                    {report.previousPeriod && <th style={thNum}>{report.previousPeriod.label}</th>}
                  </tr>
                </thead>
                <tbody>
                  {report.spend.buckets.map(b => (
                    <tr key={b.key}>
                      <td style={cell}>
                        {b.label}
                        {b.grantRelevant && <span style={{ marginLeft: '0.45rem', fontSize: '0.7rem', color: '#0369a1', fontWeight: 700 }}>GRANT-ELIGIBLE</span>}
                      </td>
                      <td style={{ ...num, width: '12%', color: muted }}>{b.count}</td>
                      <td style={num}>{fmt(b.cents)}</td>
                      {report.previousPeriod && <td style={{ ...num, color: muted }}>{fmt(b.previousCents)}</td>}
                    </tr>
                  ))}
                  <tr>
                    <td style={{ ...cell, fontWeight: 700 }}>Subtotal: Equipment, Facilities &amp; Coaching</td>
                    <td style={{ ...num, width: '12%', fontWeight: 700 }}>{report.spend.receiptReadiness.totalCount}</td>
                    <td style={{ ...num, fontWeight: 700 }}>{fmt(report.spend.grantRelevantTotalCents)}</td>
                    {report.previousPeriod && <td style={{ ...num, color: muted, fontWeight: 700 }}>{fmt(report.spend.grantRelevantPreviousCents)}</td>}
                  </tr>
                  <tr>
                    <td style={totalCell}>Total Club Operating Expenditure</td>
                    <td style={{ ...totalNum, width: '12%' }}></td>
                    <td style={totalNum}>{fmt(report.spend.totalExpensesCents)}</td>
                    {report.previousPeriod && <td style={{ ...totalNum, color: muted }}>{fmt(report.spend.previousExpensesCents)}</td>}
                  </tr>
                </tbody>
              </table>

              {/* Funding & Co-contribution */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                <thead>
                  <tr>
                    <th style={th}>Funding &amp; Club Co-Contribution</th>
                    <th style={thNum}>{report.period.label}</th>
                    {report.previousPeriod && <th style={thNum}>{report.previousPeriod.label}</th>}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={cell}>Total Club Income (Paid)</td>
                    <td style={num}>{fmt(report.spend.totalIncomeCents)}</td>
                    {report.previousPeriod && <td style={{ ...num, color: muted }}>{fmt(report.spend.previousIncomeCents)}</td>}
                  </tr>
                  <tr>
                    <td style={cell}>Grants &amp; Council Funding Received</td>
                    <td style={num}>{fmt(report.spend.grantIncomeCents)}</td>
                    {report.previousPeriod && <td style={{ ...num, color: muted }}>{fmt(report.spend.previousGrantIncomeCents)}</td>}
                  </tr>
                  <tr>
                    <td style={totalCell}>
                      Club Self-Funded Income
                      {report.spend.selfFundedPercent !== null ? ` (${report.spend.selfFundedPercent}% self-funded)` : ''}
                    </td>
                    <td style={totalNum}>{fmt(report.spend.selfFundedIncomeCents)}</td>
                    {report.previousPeriod && <td style={{ ...totalNum, color: muted }}>—</td>}
                  </tr>
                </tbody>
              </table>

              {/* Receipt Readiness Callout */}
              <div
                style={{
                  marginTop: '1rem', padding: '0.75rem 0.9rem', borderRadius: 8,
                  border: report.spend.receiptReadiness.missingReceiptCount > 0 ? '1px solid #f59e0b' : '1px solid #10b981',
                  background: report.spend.receiptReadiness.missingReceiptCount > 0 ? '#fffbeb' : '#ecfdf5',
                  fontSize: '0.84rem', display: 'flex', gap: '0.55rem', alignItems: 'flex-start',
                }}
              >
                <ShieldCheck size={17} style={{ flexShrink: 0, marginTop: 2, color: report.spend.receiptReadiness.missingReceiptCount > 0 ? '#b45309' : '#047857' }} aria-hidden="true" />
                <div>
                  <strong>Acquittal receipt readiness:</strong>{' '}
                  {report.spend.receiptReadiness.totalCount === 0
                    ? 'No equipment, facility, or coaching expenses recorded in this period.'
                    : `${report.spend.receiptReadiness.withReceiptCount} of ${report.spend.receiptReadiness.totalCount} grant-relevant expense items (${fmt(report.spend.receiptReadiness.withReceiptCents)} of ${fmt(report.spend.receiptReadiness.totalCents)}) have a supplier receipt attached.`}
                  {report.spend.receiptReadiness.missingReceiptCount > 0 && (
                    <span>
                      {' '}Missing receipts on <strong>{report.spend.receiptReadiness.missingReceiptCount}</strong> item{report.spend.receiptReadiness.missingReceiptCount === 1 ? '' : 's'} ({fmt(report.spend.receiptReadiness.missingReceiptCents)}).
                    </span>
                  )}
                </div>
              </div>

              {/* Itemised Equipment & Facility Spend Schedule */}
              {report.spend.itemisedGrantExpenses.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <div className="grant-no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <button
                      data-view-ok
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.7rem' }}
                      onClick={() => setShowItemised(s => !s)}
                    >
                      {showItemised ? 'Hide' : 'Show'} itemised equipment &amp; facility schedule ({report.spend.itemisedGrantExpenses.length})
                    </button>
                    <label style={{ fontSize: '0.8rem', color: muted, display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                      <input data-view-ok type="checkbox" checked={printItemised} onChange={e => setPrintItemised(e.target.checked)} />
                      Include itemised schedule when printing PDF
                    </label>
                  </div>

                  {(showItemised || printItemised) && (
                    <div className={printItemised ? '' : 'grant-no-print'}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: ink, margin: '0.5rem 0 0.35rem' }}>
                        Itemised Equipment, Facility &amp; Coaching Expenses
                      </h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr>
                            <th style={th}>Date</th>
                            <th style={th}>Category</th>
                            <th style={th}>Supplier / Description</th>
                            <th style={{ ...thNum, width: '16%' }}>Amount</th>
                            <th style={{ ...thNum, width: '14%' }}>Receipt</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.spend.itemisedGrantExpenses.map(item => (
                            <tr key={item.id}>
                              <td style={{ ...cell, whiteSpace: 'nowrap' }}>{formatDate(item.date)}</td>
                              <td style={cell}>{item.categoryLabel}</td>
                              <td style={cell}>
                                {item.vendor ? <strong>{item.vendor}</strong> : null}
                                {item.vendor && item.description ? ' — ' : ''}
                                {item.description}
                              </td>
                              <td style={{ ...num, width: '16%' }}>{fmt(item.amountCents)}</td>
                              <td style={{ ...num, width: '14%' }}>
                                {item.hasReceipt ? (
                                  <button
                                    data-view-ok
                                    type="button"
                                    onClick={() => openReceipt('expense', item.id)}
                                    style={{ background: 'none', border: 'none', padding: 0, color: '#0369a1', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', fontSize: 'inherit' }}
                                  >
                                    View <ExternalLink size={12} className="grant-no-print" aria-hidden="true" />
                                  </button>
                                ) : (
                                  <span style={{ color: '#b45309' }}>Missing</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </section>

            <footer style={{ marginTop: '1.75rem', paddingTop: '0.75rem', borderTop: rule, fontSize: '0.75rem', color: muted, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span>Financial figures reconcile with the club&apos;s Finance ledger, AGM Report and Audit Pack.</span>
              <span>All demographic counts are aggregated with zero personally identifiable information (PII).</span>
            </footer>
          </article>

          {/* Individual CSV downloads */}
          <div
            className="grant-no-print"
            style={{
              maxWidth: 860, margin: '1.25rem auto 0', padding: '1rem',
              borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.6rem', color: 'var(--text-primary)' }}>
              Individual CSV spreadsheets (all 5 are bundled in the one-click ZIP pack above)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button data-view-ok type="button" className="btn btn-secondary" onClick={() => downloadCsv(`${filePrefix}-01-executive-summary.csv`, executiveSummaryCsv(report, grantCtx))}>
                <Download size={14} aria-hidden="true" /> Executive summary
              </button>
              <button data-view-ok type="button" className="btn btn-secondary" onClick={() => downloadCsv(`${filePrefix}-02-player-demographics.csv`, demographicsCsv(report))}>
                <Download size={14} aria-hidden="true" /> Player demographics
              </button>
              <button data-view-ok type="button" className="btn btn-secondary" onClick={() => downloadCsv(`${filePrefix}-03-program-attendance.csv`, attendanceCsv(report))}>
                <Download size={14} aria-hidden="true" /> Program attendance
              </button>
              <button data-view-ok type="button" className="btn btn-secondary" onClick={() => downloadCsv(`${filePrefix}-04-equipment-facility-spend.csv`, spendSummaryCsv(report))}>
                <Download size={14} aria-hidden="true" /> Equipment &amp; facility spend
              </button>
              <button data-view-ok type="button" className="btn btn-secondary" onClick={() => downloadCsv(`${filePrefix}-05-itemised-grant-expenses.csv`, itemisedExpensesCsv(report))}>
                <FileText size={14} aria-hidden="true" /> Itemised acquittal schedule
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
