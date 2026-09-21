'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import { useClub } from '@/lib/club-context';
import { Shield, Search, Radio, CreditCard, Settings, PlusCircle, MapPin, Users } from 'lucide-react';

export default function ClubsDirectoryPage() {
  const { clubs, matches } = useClub();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredClubs = clubs.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.short_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.stadium_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PlatformNavbar />

      <main className="container" style={{ padding: '3.5rem 1.5rem', flex: 1 }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '1.5rem',
          marginBottom: '2.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '2rem',
        }}>
          <div>
            <div className="badge badge-primary" style={{ marginBottom: '0.5rem' }}>DIRECTORY</div>
            <h1 style={{ fontSize: '2.4rem', fontWeight: 900 }}>Registered Football Clubs</h1>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '500px' }}>
              Explore official club websites, live match-day centers, and digital passes across the network.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', width: '100%', maxWidth: '520px' }}>
            <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '180px' }}>
              <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search by club or stadium..."
                className="form-input touch-target"
                style={{ paddingLeft: '2.25rem', minHeight: '44px' }}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <Link href="/create-club" className="btn btn-primary touch-target" style={{ minHeight: '44px' }}>
              <PlusCircle size={16} /> <span>Create Club</span>
            </Link>
          </div>
        </div>

        {/* Clubs Grid */}
        <div className="grid-responsive-3">
          {filteredClubs.map(club => {
            const liveMatch = matches.find(m => m.club_id === club.id && m.status === 'live');

            return (
              <div
                key={club.id}
                className="glass-panel glass-panel-interactive"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  borderTop: `4px solid ${club.primary_color}`,
                }}
              >
                {/* Banner & Crest */}
                <div style={{ height: '130px', position: 'relative' }}>
                  <img
                    src={club.banner_url}
                    alt={club.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(14,20,30,0.9), transparent)' }} />
                  {liveMatch && (
                    <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                      <span className="badge badge-live">
                        <span className="pulse-dot" /> LIVE
                      </span>
                    </div>
                  )}
                  <div style={{ position: 'absolute', bottom: '12px', left: '16px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <img
                      src={club.logo_url}
                      alt={club.name}
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '10px',
                        border: `2px solid ${club.primary_color}`,
                        objectFit: 'cover',
                      }}
                    />
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF' }}>{club.name}</h3>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{club.short_name} • Est. {club.founded_year}</span>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontStyle: 'italic', fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                      &ldquo;{club.motto}&rdquo;
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <MapPin size={14} color={club.primary_color} />
                        <span>{club.stadium_name} ({club.stadium_capacity.toLocaleString()} cap)</span>
                      </div>
                      <div>
                        Web: <code style={{ color: club.primary_color }}>/{club.slug}</code>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <Link href={`/${club.slug}`} className="btn btn-primary btn-sm">
                      Public Page
                    </Link>
                    <Link href={liveMatch ? `/${club.slug}/match/${liveMatch.id}` : `/${club.slug}#fixtures`} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Radio size={14} color="#EF4444" /> Match Center
                    </Link>
                    <Link href={`/${club.slug}/member`} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <CreditCard size={14} color={club.primary_color} /> Member Pass
                    </Link>
                    <Link href={`/${club.slug}#squad`} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Users size={14} /> Squad Roster
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <Footer />
    </div>
  );
}
