import React from 'react';
import { formatMoney } from '@/lib/finance';

/** A price with its member price (migration 20261143): members see theirs with the full price struck
 *  through; everyone else sees the full price and what members pay. Display only. */
export default function MemberPriceTag({ cents, memberCents, isMember, currency, suffix }: {
  cents: number; memberCents?: number | null; isMember: boolean; currency: string; suffix?: React.ReactNode;
}) {
  const muted: React.CSSProperties = { fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-muted)' };
  if (!memberCents || memberCents >= cents) return <span>{formatMoney(cents, currency)}{suffix}</span>;
  if (isMember) {
    return (
      <span>
        {formatMoney(memberCents, currency)}{suffix}{' '}
        <s style={muted} aria-label={`was ${formatMoney(cents, currency)}`}>{formatMoney(cents, currency)}</s>{' '}
        <span className="badge badge-primary" style={{ fontSize: '0.65rem', verticalAlign: 'middle' }}>Member price</span>
      </span>
    );
  }
  return (
    <span>
      {formatMoney(cents, currency)}{suffix}
      <span style={{ ...muted, display: 'block' }}>{formatMoney(memberCents, currency)} for members</span>
    </span>
  );
}
