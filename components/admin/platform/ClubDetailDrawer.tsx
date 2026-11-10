'use client';

import React from 'react';
import Link from 'next/link';
import { PlatformClubItem } from '@/lib/supabase/types';
import { formatMoney } from '@/lib/finance';
import { formatDate } from '@/lib/dates';
import ClubConsole from '@/components/admin/platform/ClubConsole';
import type { EmailDraft } from '@/components/admin/platform/EmailComposer';
import PopupPanel from '@/components/PopupPanel';
import { getSupabaseClient } from '@/lib/supabase/client';
import {
  X,
  Building,
  Mail,
  ExternalLink,
  Shield,
  CreditCard,
  Globe,
  Users,
  Trophy,
  Calendar,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react';

interface ClubDetailDrawerProps {
  club: PlatformClubItem | null;
  onClose: () => void;
  onToggleStatus: (clubId: string, currentStatus: boolean) => Promise<void>;
  statusUpdating: boolean;
  onEmail: (d: EmailDraft) => void;
  showToast: (msg: string) => void;
  onChanged: () => void;
}

export default function ClubDetailDrawer({
  club,
  onClose,
  onToggleStatus,
  statusUpdating,
  onEmail,
  showToast,
  onChanged,
}: ClubDetailDrawerProps) {
  const [copiedEmail, setCopiedEmail] = React.useState(false);
  const [copiedSlug, setCopiedSlug] = React.useState(false);
  // The home page's "See a live club site" (F10-9): undefined while loading, 'missing' before migration 20261162
  const [demoId, setDemoId] = React.useState<string | null | 'missing' | undefined>(undefined);
  const [demoSaving, setDemoSaving] = React.useState(false);
  React.useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !club) return;
    client.from('platform_home_demo').select('club_id').maybeSingle()
      .then(({ data, error }) => setDemoId(error ? 'missing' : (data?.club_id as string | null) ?? null));
  }, [club]);

  if (!club) return null;

  const isDemo = demoId === club.id;
  const setDemo = async (on: boolean) => {
    const client = getSupabaseClient();
    if (!client) return;
    setDemoSaving(true);
    const { error } = await client.rpc('platform_set_home_demo', { p_club_id: on ? club.id : null });
    setDemoSaving(false);
    if (error) return showToast(error.message.includes('Operators') ? 'Only Super admins and Operators can change this.' : 'Could not change the home page demo.');
    setDemoId(on ? club.id : null);
    showToast(on ? `${club.name} is now the home page demo. The home page shows it within 5 minutes.` : 'The home page demo is cleared.');
  };

  const copyToClipboard = (text: string, type: 'email' | 'slug') => {
    navigator.clipboard.writeText(text);
    if (type === 'email') {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } else {
      setCopiedSlug(true);
      setTimeout(() => setCopiedSlug(false), 2000);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        justifyContent: 'flex-end',
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <PopupPanel onClose={onClose} label="Club details"
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '560px',
          height: '100%',
          background: 'rgb(var(--dk-9-13-22))',
          borderLeft: '1px solid var(--border-medium)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-xl)',
          overflowY: 'auto',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            background: 'rgba(var(--dk-9-13-22), 0.95)',
            backdropFilter: 'blur(12px)',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {club.logo_url ? (
              <img
                src={club.logo_url}
                alt=""
                style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'contain' }}
              />
            ) : (
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  background: club.primary_color || 'var(--club-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: '1rem',
                }}
              >
                {club.short_name.slice(0, 2)}
              </div>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                  {club.name}
                </h2>
                {club.is_active ? (
                  <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--c-green)', fontSize: '0.7rem' }}>
                    Active
                  </span>
                ) : (
                  <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--c-red)', fontSize: '0.7rem' }}>
                    Suspended
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                <span>/{club.slug}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(club.slug, 'slug')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-muted)' }}
                  title="Copy slug"
                >
                  {copiedSlug ? <Check size={12} color="var(--c-green)" /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Quick Action Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Link
              href={`/${club.slug}`}
              target="_blank"
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
            >
              <ExternalLink size={14} />
              <span>Open Public Site</span>
            </Link>
            <Link
              href={`/${club.slug}/admin`}
              target="_blank"
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
            >
              <Shield size={14} />
              <span>Enter Club Admin</span>
            </Link>
          </div>

          <ClubConsole key={club.id} club={club} onEmail={onEmail} showToast={showToast} onChanged={onChanged} />

          {/* Section 1: Footprint & Activity */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Trophy size={14} color="var(--text-secondary)" aria-hidden="true" />
              <span>Members and games</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Members</span>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {club.member_count}
                </div>
                {club.pending_count > 0 && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--c-amber)', fontWeight: 700 }}>
                    {club.pending_count} waiting for approval
                  </span>
                )}
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Teams and games</span>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {club.team_count} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>teams</span> · {club.match_count} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>fixtures</span>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Visitors, last 30 days</span>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {club.visits_30d.toLocaleString()}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Paid through the site, all time</span>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {formatMoney(club.gmv_cents, 'AUD')}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Club Owner & Leadership */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Users size={14} color="var(--text-secondary)" aria-hidden="true" />
              <span>Who runs it</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Primary Owner</span>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {club.owner_name || 'Club Founder'}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Contact Email</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
                  <span style={{ fontSize: '0.85rem', color: '#818CF8', fontWeight: 600 }}>
                    {club.owner_email || 'No email recorded'}
                  </span>
                  {club.owner_email && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(club.owner_email!, 'email')}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.15rem 0.45rem', fontSize: '0.7rem' }}
                    >
                      {copiedEmail ? <Check size={11} color="var(--c-green)" /> : <Copy size={11} />}
                      <span>{copiedEmail ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>
              </div>

              {club.owner_id && (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Owner ID: <code>{club.owner_id}</code>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Domain & Network Settings */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Globe size={14} color="var(--text-secondary)" aria-hidden="true" />
              <span>Web address and domain</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Standard URL</span>
                <code style={{ fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                  itsfootball.club/{club.slug}
                </code>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Custom Domain</span>
                {club.custom_domain ? (
                  <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818CF8', fontWeight: 700 }}>
                    {club.custom_domain}
                  </span>
                ) : (
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>None (Standard platform path)</span>
                )}
              </div>

              {club.custom_domain && (
                <div style={{ padding: '0.75rem', background: 'rgba(var(--tint-rgb), 0.03)', borderRadius: '6px', border: '1px solid var(--border-subtle)', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>DNS Target Status:</div>
                  Club DNS should point CNAME record to <code>cname.itsfootball.club</code> for automated SSL certificate provision.
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Payments & Monetization */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <CreditCard size={14} color="var(--text-secondary)" aria-hidden="true" />
              <span>Payments</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Stripe Connect Gateway</span>
                {club.stripe_ready ? (
                  <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--c-green)' }}>
                    ✓ Connected &amp; Payouts Ready
                  </span>
                ) : (
                  <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--c-amber)' }}>
                    Manual Bank Transfer Only
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Membership Policy</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {club.membership_payment_policy.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </div>

          {/* The club itsfootball.club's home page sends visitors to as a live example */}
          {demoId !== undefined && (
            <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>Home page demo</div>
              {demoId === 'missing' ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Run the 20261162_home_demo_club.sql migration to choose which club the home page shows.
                </p>
              ) : (
                <>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
                    {isDemo
                      ? 'The home page links to this club as "See a live club site".'
                      : demoId
                        ? 'Another club is the home page demo. Using this one replaces it.'
                        : 'No club is chosen yet, so the home page links to the first club in the list.'}
                  </p>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={demoSaving || !club.is_active} onClick={() => setDemo(!isDemo)}>
                    {demoSaving ? 'Saving…' : isDemo ? 'Stop using as the demo' : 'Use as the home page demo'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Section 5: Operator Security & Status Controls */}
          <div
            className="glass-panel"
            style={{
              padding: '1.25rem',
              border: club.is_active ? '1px solid var(--border-subtle)' : '1px solid rgba(239, 68, 68, 0.3)',
              background: club.is_active ? 'rgba(var(--tint-rgb), 0.02)' : 'rgba(239, 68, 68, 0.05)',
            }}
          >
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: club.is_active ? 'var(--text-primary)' : 'var(--c-red)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertTriangle size={14} color={club.is_active ? 'var(--c-amber)' : 'var(--c-red)'} />
              <span>Club status</span>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.5 }}>
              {club.is_active
                ? 'Suspend the club while it\'s being fixed. Its pages show a short notice and member check-ins stop until you turn it back on.'
                : 'This club is suspended. Turn it back on to open its pages and tournaments again.'}
            </p>

            <button
              type="button"
              disabled={statusUpdating}
              onClick={() => onToggleStatus(club.id, club.is_active)}
              className="btn btn-sm"
              style={{
                width: '100%',
                background: club.is_active ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                color: club.is_active ? 'var(--c-red)' : 'var(--c-green)',
                border: club.is_active ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
                fontWeight: 800,
              }}
            >
              {statusUpdating ? 'Saving…' : club.is_active ? 'Suspend club' : 'Turn club back on'}
            </button>
          </div>

          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
            Club registered on {formatDate(club.created_at)}
          </div>
        </div>
      </PopupPanel>
    </div>
  );
}
