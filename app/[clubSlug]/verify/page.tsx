'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useClub } from '@/lib/club-context';
import { Shield, CheckCircle2, XCircle, AlertTriangle, ArrowLeft, CreditCard, RefreshCw } from 'lucide-react';

export default function VerifyPassPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const { clubs, selectClubBySlug, verifyMemberPass } = useClub();
  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];

  const [inputToken, setInputToken] = useState(token);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (token) {
      const res = verifyMemberPass(token);
      setResult(res);
    }
  }, [token, verifyMemberPass]);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputToken.trim()) return;
    const res = verifyMemberPass(inputToken);
    setResult(res);
  };

  return (
    <div style={{ padding: '4rem 0 6rem 0' }}>
      <div className="container" style={{ maxWidth: '600px' }}>
        <Link
          href={`/${club.slug}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}
        >
          <ArrowLeft size={16} />
          <span>Return to {club.name}</span>
        </Link>

        <div className="glass-panel" style={{
          padding: '2.5rem',
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-xl)',
          textAlign: 'center',
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: club.primary_color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem auto',
          }}>
            <Shield size={28} color="#FFFFFF" />
          </div>

          <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#FFFFFF', marginBottom: '0.4rem' }}>
            {club.name} Pass Verification
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>
            Official digital membership and accreditation validator
          </p>

          {/* Verification Form if no token or to re-verify */}
          <form onSubmit={handleVerify} style={{ marginBottom: '2rem' }}>
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label className="form-label">Member Pass Token</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter QR token Enter the pass QR token"
                  value={inputToken}
                  onChange={e => setInputToken(e.target.value)}
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
                <button type="submit" className="btn btn-primary">
                  Validate
                </button>
              </div>
            </div>
          </form>

          {/* Verification Result Display */}
          {result && (
            <div style={{
              background: result.valid
                ? 'rgba(16, 185, 129, 0.12)'
                : result.member
                ? 'rgba(245, 158, 11, 0.12)'
                : 'rgba(239, 68, 68, 0.12)',
              border: `2px solid ${result.valid ? '#10B981' : result.member ? '#F59E0B' : '#EF4444'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '1.75rem',
              animation: 'fadeIn 0.3s ease',
              textAlign: 'left',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                {result.valid ? (
                  <CheckCircle2 size={32} color="#10B981" />
                ) : result.member ? (
                  <AlertTriangle size={32} color="#F59E0B" />
                ) : (
                  <XCircle size={32} color="#EF4444" />
                )}
                <div>
                  <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: 900,
                    color: result.valid ? '#10B981' : result.member ? '#F59E0B' : '#EF4444',
                  }}>
                    {result.valid ? 'ACCREDITED & ACTIVE' : result.member ? 'PASS REQUIRES ATTENTION' : 'INVALID PASS TOKEN'}
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: '#FFFFFF' }}>
                    {result.message}
                  </div>
                </div>
              </div>

              {result.member && (
                <div style={{
                  background: 'rgba(0,0,0,0.35)',
                  padding: '1.25rem',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.25rem',
                }}>
                  <img
                    src={result.member.photo_url}
                    alt={result.member.full_name}
                    style={{ width: '72px', height: '72px', borderRadius: '14px', objectFit: 'cover' }}
                  />
                  <div>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF' }}>
                      {result.member.full_name}
                    </h4>
                    <div style={{ fontSize: '0.85rem', color: 'var(--club-primary)', fontWeight: 700 }}>
                      {result.member.is_executive ? result.member.executive_title : result.member.membership_tier}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Position: {result.member.player_position || 'Staff'} • Number: #{result.member.jersey_number || 'N/A'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Valid Thru: {result.member.membership_expires_at}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
