'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useClub } from '@/lib/club-context';
import { ClubMember, MemberMessageCategory, PlayerPosition } from '@/lib/supabase/types';
import { getSupabaseClient } from '@/lib/supabase/client';
import VirtualPassCard from '@/components/VirtualPassCard';
import QRScannerModal from '@/components/QRScannerModal';
import {
  Shield,
  CreditCard,
  Trophy,
  Activity,
  Calendar,
  CheckCircle2,
  ArrowLeft,
  QrCode,
  Sparkles,
  Users,
  Award,
  Flame,
  Crown,
  Zap,
  TrendingUp,
  History,
  Mail,
  Lock,
  User,
  Phone,
  Send,
  MessageSquare,
  LogOut,
  Clock,
  AlertCircle,
  ExternalLink,
  Check,
  ChevronRight
} from 'lucide-react';

export default function MemberPortalPage({
  params,
}: {
  params: Promise<{ clubSlug: string }>;
}) {
  const resolvedParams = use(params);
  const {
    clubs,
    selectClubBySlug,
    members,
    playerStats,
    getMemberClubScore,
    getMemberActivityLogs,
    applyForMembership,
    reloadFromServer,
    sendMemberMessage,
    getMemberMessages,
    getClubSeasonStats
  } = useClub();

  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const clubMembers = members.filter(m => m.club_id === club.id);

  // Authentication State
  const [activeMember, setActiveMember] = useState<ClubMember | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Gateway View Tabs & Sub-Modes
  const [gatewayTab, setGatewayTab] = useState<'signin' | 'signup'>('signin');

  // Sign-In Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const [sendingLink, setSendingLink] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);

  // Sign-Up Application Form State
  const [signupForm, setSignupForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    tier: 'Supporter Season Pass',
    position: '' as PlayerPosition | '',
    jerseyNumber: '',
    notes: '',
    emergencyContact: '',
  });
  const [signupError, setSignupError] = useState<string | null>(null);
  const [submittedApplication, setSubmittedApplication] = useState<ClubMember | null>(null);

  // Authenticated Member Clubhouse State
  const [activeClubhouseTab, setActiveClubhouseTab] = useState<'pass' | 'stats' | 'messages'>('pass');
  const [scannerOpen, setScannerOpen] = useState(false);

  // Messaging Form State
  const [messageSubject, setMessageSubject] = useState('');
  const [messageCategory, setMessageCategory] = useState<MemberMessageCategory>('General');
  const [messageContent, setMessageContent] = useState('');
  const [messageSentToast, setMessageSentToast] = useState(false);


  // 1. Follow the Supabase session; once signed in, link it to this club's member record
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const client = getSupabaseClient();
    if (!client) {
      setAuthChecked(true);
      return;
    }

    let cancelled = false;
    const resolveMember = async (userId: string | null, email: string | null) => {
      if (cancelled) return;
      if (!userId) {
        setActiveMember(null);
        setSignedInEmail(null);
        setAuthChecked(true);
        return;
      }
      setSignedInEmail(email);
      const { data, error } = await client.rpc('claim_member_profile', { p_club_id: club.id });
      if (cancelled) return;
      const row = Array.isArray(data) ? (data[0] as ClubMember | undefined) : undefined;
      if (error || !row) {
        setActiveMember(null);
        if (!error) {
          setLoginNotice(null);
          setLoginError(`No approved membership was found for ${email || 'this email'} at ${club.name}. If you have applied, the committee still needs to approve you.`);
        }
      } else {
        setActiveMember(row);
        setLoginError(null);
        reloadFromServer();
      }
      setAuthChecked(true);
    };

    client.auth.getSession().then(({ data }) => resolveMember(data.session?.user.id ?? null, data.session?.user.email ?? null));
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      // Deferred so Supabase calls never run inside the auth callback
      setTimeout(() => resolveMember(session?.user.id ?? null, session?.user.email ?? null), 0);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [club.id]);

  // Keep activeMember in sync with live members state (e.g. after approval)
  useEffect(() => {
    if (activeMember) {
      const fresh = clubMembers.find(m => m.id === activeMember.id);
      if (fresh) {
        setActiveMember(fresh);
      }
    }
  }, [clubMembers, activeMember?.id]);

  // Handle Logout
  const handleLogout = async () => {
    setActiveMember(null);
    await getSupabaseClient()?.auth.signOut();
  };

  // Email a one-time sign-in link (Supabase Auth)
  const handleRequestMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginNotice(null);

    const client = getSupabaseClient();
    if (!client) {
      setLoginError('Sign-in is unavailable right now.');
      return;
    }
    setSendingLink(true);
    const { error } = await client.auth.signInWithOtp({
      email: loginEmail.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/${club.slug}/member` },
    });
    setSendingLink(false);
    if (error) {
      setLoginError(error.message.toLowerCase().includes('rate') ? 'Too many requests. Please wait a minute and try again.' : 'Could not send the sign-in link. Please try again.');
      return;
    }
    // Same message whether or not the email belongs to a member (no account enumeration)
    setLoginNotice('If this email belongs to an approved member, a sign-in link is on its way. Check your inbox.');
  };

  // Handle Membership Application Submit
  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);

    const res = applyForMembership(club.id, {
      full_name: signupForm.fullName,
      email: signupForm.email,
      phone: signupForm.phone,
      membership_tier: signupForm.tier,
      player_position: signupForm.position ? signupForm.position : undefined,
      jersey_number: signupForm.jerseyNumber ? parseInt(signupForm.jerseyNumber) : undefined,
      application_notes: signupForm.notes,
      emergency_contact: signupForm.emergencyContact,
    });

    if (res.success && res.member) {
      setSubmittedApplication(res.member);
    } else {
      setSignupError(res.message || 'Could not submit application.');
    }
  };

  // Handle Sending Message to Admin
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMember || !messageContent.trim()) return;

    sendMemberMessage({
      club_id: club.id,
      member_id: activeMember.id,
      sender_type: 'member',
      sender_name: activeMember.full_name,
      sender_email: activeMember.email,
      subject: messageSubject.trim() || `${messageCategory} Inquiry`,
      category: messageCategory,
      content: messageContent.trim(),
    });

    setMessageSubject('');
    setMessageContent('');
    setMessageSentToast(true);
    setTimeout(() => setMessageSentToast(false), 3500);
  };

  // Compute stats for current active member
  const currentStats = activeMember ? playerStats.find(s => s.member_id === activeMember.id) : null;
  const currentClubScore = activeMember ? getMemberClubScore(activeMember.id) : null;
  const memberActivityLogs = activeMember ? getMemberActivityLogs(activeMember.id) : [];
  const memberMessagesList = activeMember ? getMemberMessages(club.id, activeMember.id) : [];
  const clubSeasonStats = getClubSeasonStats(club.id);

  return (
    <div style={{ minHeight: '85vh', padding: '3rem 0 5rem 0' }}>
      <div className="container">
        {/* Navigation Breadcrumb */}
        <div style={{ marginBottom: '1.5rem' }}>
          <Link
            href={`/${club.slug}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
              transition: 'color 0.2s',
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to {club.name} Clubhouse</span>
          </Link>
        </div>

        {/* ==================================================================== */}
        {/* UN-AUTHENTICATED: GATEWAY & APPLICATION PORTAL */}
        {/* ==================================================================== */}
        {!activeMember ? (
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            {/* Club Brand Card */}
            <div className="glass-panel" style={{
              padding: '2.5rem 2rem',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
              marginBottom: '2rem',
            }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: `linear-gradient(90deg, ${club.primary_color}, #F59E0B)`,
              }} />

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
                <img loading="eager" decoding="async" width={74} height={74}
                  src={club.logo_url}
                  alt={`${club.name} crest`}
                  style={{
                    width: '74px',
                    height: '74px',
                    borderRadius: '18px',
                    border: `3px solid ${club.primary_color}`,
                    objectFit: 'cover',
                    background: '#000000',
                  }}
                />
              </div>

              <span className="badge badge-primary" style={{ marginBottom: '0.75rem', padding: '0.25rem 0.75rem' }}>
                OFFICIAL MEMBER GATEWAY
              </span>

              <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#FFFFFF', marginBottom: '0.4rem' }}>
                {club.name} Member Portal
              </h1>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '460px', margin: '0 auto', lineHeight: 1.5 }}>
                Access your official virtual turnstile pass, track squad and club season statistics, and message club administration.
              </p>
            </div>

            {/* Gateway Switcher Tabs */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.5rem',
              background: 'rgba(0, 0, 0, 0.4)',
              padding: '0.35rem',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle)',
              marginBottom: '1.75rem',
            }}>
              <button
                type="button"
                onClick={() => { setGatewayTab('signin'); setSubmittedApplication(null); }}
                style={{
                  padding: '0.75rem',
                  borderRadius: '9px',
                  border: 'none',
                  background: gatewayTab === 'signin' ? 'var(--club-primary)' : 'transparent',
                  color: gatewayTab === 'signin' ? '#FFFFFF' : 'var(--text-secondary)',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.2s ease',
                }}
              >
                <User size={16} />
                <span>Member Sign In</span>
              </button>

              <button
                type="button"
                onClick={() => { setGatewayTab('signup'); setSubmittedApplication(null); }}
                style={{
                  padding: '0.75rem',
                  borderRadius: '9px',
                  border: 'none',
                  background: gatewayTab === 'signup' ? 'var(--club-primary)' : 'transparent',
                  color: gatewayTab === 'signup' ? '#FFFFFF' : 'var(--text-secondary)',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.2s ease',
                }}
              >
                <Zap size={16} />
                <span>Apply for Membership</span>
              </button>
            </div>

            {/* Error or Notice Alert */}
            {loginNotice && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '8px',
                padding: '0.85rem 1rem',
                color: '#10B981',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1.5rem',
              }}>
                <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                <span>{loginNotice}</span>
              </div>
            )}

            {loginError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '0.85rem 1rem',
                color: '#EF4444',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1.5rem',
              }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{loginError}</span>
              </div>
            )}

            {/* TAB 1: MEMBER SIGN IN */}
            {gatewayTab === 'signin' && (
              <div className="glass-panel" style={{ padding: '2rem' }}>
                <form onSubmit={handleRequestMagicLink}>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '0.4rem' }}>
                      Member Email Address:
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={e => setLoginEmail(e.target.value)}
                        placeholder="e.g. member@email.com"
                        style={{
                          width: '100%',
                          padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                          borderRadius: '8px',
                          background: 'rgba(0, 0, 0, 0.4)',
                          border: '1px solid var(--border-subtle)',
                          color: '#FFFFFF',
                          fontSize: '0.9rem',
                        }}
                      />
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                      We&apos;ll email you a single-use link. Use the same address your membership was registered with.
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={sendingLink}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    <Sparkles size={18} />
                    <span>{sendingLink ? 'Sending...' : 'Email Me a Sign-In Link'}</span>
                  </button>
                </form>

                {signedInEmail && !activeMember && (
                  <div style={{ marginTop: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Signed in as {signedInEmail}.{' '}
                    <button type="button" onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#10B981', cursor: 'pointer', fontWeight: 700 }}>
                      Use a different email
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: APPLY FOR MEMBERSHIP (SIGN-UP FORM) */}
            {gatewayTab === 'signup' && (
              <div className="glass-panel" style={{ padding: '2rem' }}>
                {submittedApplication ? (
                  /* Application Confirmation Screen */
                  <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                    <div style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: 'rgba(245, 158, 11, 0.15)',
                      border: '2px solid #F59E0B',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 1.25rem auto',
                    }}>
                      <Clock size={32} color="#F59E0B" />
                    </div>

                    <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#F59E0B', marginBottom: '0.75rem' }}>
                      ⏳ APPLICATION PENDING COMMITTEE REVIEW
                    </span>

                    <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#FFFFFF', marginBottom: '0.5rem' }}>
                      Application Received, {submittedApplication.full_name}!
                    </h2>

                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, maxWidth: '480px', margin: '0 auto 1.5rem auto' }}>
                      Your membership application for <strong>{submittedApplication.membership_tier}</strong> has been safely recorded in the {club.name} administrative queue.
                      Once approved by the club executive committee, your digital pass will be activated and you will be able to sign in.
                    </p>

                    <div style={{
                      background: 'rgba(0, 0, 0, 0.35)',
                      borderRadius: '8px',
                      padding: '1rem',
                      textAlign: 'left',
                      fontSize: '0.82rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                      marginBottom: '1.5rem',
                      border: '1px solid var(--border-subtle)',
                    }}>
                      <div>Applicant: <strong style={{ color: '#FFFFFF' }}>{submittedApplication.full_name}</strong></div>
                      <div>Email: <strong style={{ color: '#FFFFFF' }}>{submittedApplication.email}</strong></div>
                      <div>Membership Tier: <strong style={{ color: '#10B981' }}>{submittedApplication.membership_tier}</strong></div>
                      <div>Application Ref: <code style={{ color: '#F59E0B' }}>{submittedApplication.id}</code></div>
                    </div>

                    <button
                      type="button"
                      onClick={() => { setGatewayTab('signin'); setSubmittedApplication(null); }}
                      className="btn btn-primary"
                      style={{ padding: '0.75rem 1.5rem' }}
                    >
                      Return to Member Sign-In
                    </button>
                  </div>
                ) : (
                  /* Application Registration Form */
                  <form onSubmit={handleSignupSubmit}>
                    <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.75rem' }}>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
                        Club Membership Application
                      </h2>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Join the {club.name} community. Applications are reviewed by club administration.
                      </p>
                    </div>

                    {signupError && (
                      <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        padding: '0.75rem 1rem',
                        color: '#EF4444',
                        fontSize: '0.82rem',
                        marginBottom: '1rem',
                      }}>
                        {signupError}
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '0.35rem' }}>
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={signupForm.fullName}
                          onChange={e => setSignupForm({ ...signupForm, fullName: e.target.value })}
                          placeholder="e.g. Liam O'Connor"
                          style={{
                            width: '100%',
                            padding: '0.65rem 0.75rem',
                            borderRadius: '8px',
                            background: 'rgba(0,0,0,0.4)',
                            border: '1px solid var(--border-subtle)',
                            color: '#FFFFFF',
                            fontSize: '0.85rem',
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '0.35rem' }}>
                          Email Address *
                        </label>
                        <input
                          type="email"
                          required
                          value={signupForm.email}
                          onChange={e => setSignupForm({ ...signupForm, email: e.target.value })}
                          placeholder="e.g. liam@email.com"
                          style={{
                            width: '100%',
                            padding: '0.65rem 0.75rem',
                            borderRadius: '8px',
                            background: 'rgba(0,0,0,0.4)',
                            border: '1px solid var(--border-subtle)',
                            color: '#FFFFFF',
                            fontSize: '0.85rem',
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '0.35rem' }}>
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={signupForm.phone}
                          onChange={e => setSignupForm({ ...signupForm, phone: e.target.value })}
                          placeholder="+1 (555) 000-0000"
                          style={{
                            width: '100%',
                            padding: '0.65rem 0.75rem',
                            borderRadius: '8px',
                            background: 'rgba(0,0,0,0.4)',
                            border: '1px solid var(--border-subtle)',
                            color: '#FFFFFF',
                            fontSize: '0.85rem',
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '0.35rem' }}>
                          Membership Tier *
                        </label>
                        <select
                          value={signupForm.tier}
                          onChange={e => setSignupForm({ ...signupForm, tier: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.65rem 0.75rem',
                            borderRadius: '8px',
                            background: '#040609',
                            border: '1px solid var(--border-subtle)',
                            color: '#FFFFFF',
                            fontSize: '0.85rem',
                          }}
                        >
                          <option value="Supporter Season Pass">Supporter Season Pass</option>
                          <option value="Senior Squad Player">Senior Squad Player</option>
                          <option value="Academy / Youth Squad">Academy / Youth Squad</option>
                          <option value="Club Volunteer">Club Volunteer</option>
                          <option value="VIP Gold Pass">VIP Gold Pass</option>
                        </select>
                      </div>
                    </div>

                    {/* Conditional Player fields if applying as player */}
                    {signupForm.tier.includes('Player') && (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '1rem',
                        marginBottom: '1rem',
                        background: 'rgba(16, 185, 129, 0.05)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        padding: '0.75rem',
                        borderRadius: '8px',
                      }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#10B981', marginBottom: '0.35rem' }}>
                            Preferred Position
                          </label>
                          <select
                            value={signupForm.position}
                            onChange={e => setSignupForm({ ...signupForm, position: e.target.value as PlayerPosition })}
                            style={{
                              width: '100%',
                              padding: '0.55rem 0.75rem',
                              borderRadius: '6px',
                              background: '#040609',
                              border: '1px solid var(--border-subtle)',
                              color: '#FFFFFF',
                              fontSize: '0.8rem',
                            }}
                          >
                            <option value="">Select Position...</option>
                            <option value="GK">Goalkeeper (GK)</option>
                            <option value="CB">Center Back (CB)</option>
                            <option value="LB">Left Back (LB)</option>
                            <option value="RB">Right Back (RB)</option>
                            <option value="CDM">Defensive Mid (CDM)</option>
                            <option value="CM">Center Mid (CM)</option>
                            <option value="CAM">Attacking Mid (CAM)</option>
                            <option value="LW">Left Wing (LW)</option>
                            <option value="RW">Right Wing (RW)</option>
                            <option value="ST">Striker (ST)</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#10B981', marginBottom: '0.35rem' }}>
                            Preferred Kit #
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={99}
                            value={signupForm.jerseyNumber}
                            onChange={e => setSignupForm({ ...signupForm, jerseyNumber: e.target.value })}
                            placeholder="e.g. 10"
                            style={{
                              width: '100%',
                              padding: '0.55rem 0.75rem',
                              borderRadius: '6px',
                              background: 'rgba(0,0,0,0.4)',
                              border: '1px solid var(--border-subtle)',
                              color: '#FFFFFF',
                              fontSize: '0.8rem',
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '0.35rem' }}>
                        Motivation &amp; Background Notes:
                      </label>
                      <textarea
                        rows={2}
                        value={signupForm.notes}
                        onChange={e => setSignupForm({ ...signupForm, notes: e.target.value })}
                        placeholder="Tell the club committee why you would like to join..."
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.75rem',
                          borderRadius: '8px',
                          background: 'rgba(0,0,0,0.4)',
                          border: '1px solid var(--border-subtle)',
                          color: '#FFFFFF',
                          fontSize: '0.85rem',
                          resize: 'none',
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                      <Zap size={18} />
                      <span>Submit Membership Application</span>
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ==================================================================== */
          /* AUTHENTICATED: MEMBER DIGITAL CLUBHOUSE */
          /* ==================================================================== */
          <div>
            {/* Top Member Status Banner */}
            <div className="glass-panel" style={{
              padding: '1.25rem 1.5rem',
              marginBottom: '2rem',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              borderTop: `4px solid ${club.primary_color}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <img loading="lazy" decoding="async" width={52} height={52}
                  src={activeMember.photo_url}
                  alt={`${activeMember.full_name} photo`}
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '14px',
                    objectFit: 'cover',
                    border: `2px solid ${club.primary_color}`,
                    background: '#000000',
                  }}
                />

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
                      {activeMember.full_name}
                    </h2>
                    <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', fontSize: '0.72rem', fontWeight: 800 }}>
                      ✓ VERIFIED MEMBER
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {activeMember.membership_tier} • {club.name} • Pass Token: <code style={{ color: 'var(--club-primary)' }}>{activeMember.qr_code_token}</code>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: '1px solid rgba(16, 185, 129, 0.4)' }}
                >
                  <QrCode size={15} color="var(--club-primary)" />
                  <span>Gate Scanner</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)' }}
                >
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>

            {/* Clubhouse Sub-Tabs */}
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              marginBottom: '2rem',
              borderBottom: '1px solid var(--border-subtle)',
              paddingBottom: '0.75rem',
              flexWrap: 'wrap',
            }}>
              <button
                type="button"
                onClick={() => setActiveClubhouseTab('pass')}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '8px',
                  border: activeClubhouseTab === 'pass' ? `1px solid ${club.primary_color}` : '1px solid transparent',
                  background: activeClubhouseTab === 'pass' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  color: activeClubhouseTab === 'pass' ? '#FFFFFF' : 'var(--text-secondary)',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                <CreditCard size={17} color={activeClubhouseTab === 'pass' ? 'var(--club-primary)' : undefined} />
                <span>Virtual Member Pass</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveClubhouseTab('stats')}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '8px',
                  border: activeClubhouseTab === 'stats' ? `1px solid ${club.primary_color}` : '1px solid transparent',
                  background: activeClubhouseTab === 'stats' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  color: activeClubhouseTab === 'stats' ? '#FFFFFF' : 'var(--text-secondary)',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                <Activity size={17} color={activeClubhouseTab === 'stats' ? 'var(--club-primary)' : undefined} />
                <span>Season Stats (Club &amp; Own)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveClubhouseTab('messages')}
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '8px',
                  border: activeClubhouseTab === 'messages' ? `1px solid ${club.primary_color}` : '1px solid transparent',
                  background: activeClubhouseTab === 'messages' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  color: activeClubhouseTab === 'messages' ? '#FFFFFF' : 'var(--text-secondary)',
                  fontWeight: 800,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                <MessageSquare size={17} color={activeClubhouseTab === 'messages' ? 'var(--club-primary)' : undefined} />
                <span>Contact Admin Messages</span>
                {memberMessagesList.length > 0 && (
                  <span style={{
                    background: 'var(--club-primary)',
                    color: '#000',
                    borderRadius: '10px',
                    padding: '0.1rem 0.4rem',
                    fontSize: '0.68rem',
                    fontWeight: 900,
                  }}>
                    {memberMessagesList.length}
                  </span>
                )}
              </button>
            </div>

            {/* SUB-TAB 1: VIRTUAL PASS */}
            {activeClubhouseTab === 'pass' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '100%', maxWidth: '400px' }}>
                  <VirtualPassCard club={club} member={activeMember} />
                </div>
              </div>
            )}

            {/* SUB-TAB 2: SEASON STATS (CLUB'S & OWN) */}
            {activeClubhouseTab === 'stats' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                {/* 1. Club's Season Performance Dashboard */}
                <div className="glass-panel" style={{ padding: '2rem', borderTop: `4px solid ${club.primary_color}` }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div>
                      <span className="badge badge-gold" style={{ marginBottom: '0.35rem' }}>LEAGUE CAMPAIGN 2025/26</span>
                      <h3 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Trophy size={22} color="#F59E0B" />
                        <span>{club.name} — Club Season Statistics</span>
                      </h3>
                    </div>

                    {/* Form Pills */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, marginRight: '0.2rem' }}>FORM:</span>
                      {clubSeasonStats.form.length === 0 && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No completed matches yet</span>
                      )}
                      {clubSeasonStats.form.map((res, i) => (
                        <span
                          key={i}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            background: res === 'W' ? '#10B981' : res === 'D' ? '#F59E0B' : '#EF4444',
                            color: '#000000',
                            fontWeight: 900,
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {res}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Club Stats Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                  }}>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Matches</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 900, color: '#FFFFFF' }}>
                        {clubSeasonStats.matchesPlayed}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Played</div>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Record</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 900, color: '#10B981' }}>
                        {clubSeasonStats.wins}W - {clubSeasonStats.draws}D - {clubSeasonStats.losses}L
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#10B981' }}>{clubSeasonStats.winRate}% Win Rate</div>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Points</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 900, color: '#F59E0B' }}>
                        {clubSeasonStats.points}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Total League PTS</div>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Goals</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 900, color: '#FFFFFF' }}>
                        {clubSeasonStats.goalsFor} : {clubSeasonStats.goalsAgainst}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#10B981' }}>+{clubSeasonStats.goalDifference} GD</div>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Clean Sheets</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 900, color: '#3B82F6' }}>
                        {clubSeasonStats.cleanSheets}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Shutouts Kept</div>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Club Top Scorer</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 900, color: '#A855F7', marginTop: '4px' }}>
                        {clubSeasonStats.topScorer?.name || 'No goals yet'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#A855F7', fontWeight: 700 }}>{clubSeasonStats.topScorer?.goals || 0} Goals</div>
                    </div>
                  </div>
                </div>

                {/* 2. Personal Performance Dashboard */}
                <div className="glass-panel" style={{ padding: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Activity size={20} color="var(--club-primary)" />
                      <span>{activeMember.full_name} — Personal Season Performance</span>
                    </h3>
                    <span className="badge badge-primary">{activeMember.membership_tier}</span>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                  }}>
                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Appearances</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 900, color: '#FFFFFF' }}>
                        {currentStats?.appearances || 0}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Goals</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 900, color: '#10B981' }}>
                        {currentStats?.goals || 0}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assists</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 900, color: '#F59E0B' }}>
                        {currentStats?.assists || 0}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Clean Sheets</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 900, color: '#3B82F6' }}>
                        {currentStats?.clean_sheets || 0}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>MOTM Awards</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 900, color: '#A855F7' }}>
                        {currentStats?.motm_awards || 0}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Discipline</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 900, color: '#EF4444', marginTop: '6px' }}>
                        {currentStats?.yellow_cards || 0}Y • {currentStats?.red_cards || 0}R
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Total Playing Minutes: <strong style={{ color: '#FFFFFF' }}>{currentStats?.minutes_played || 0} mins</strong>
                  </div>
                </div>

                {/* 3. ClubScore Gamification Progress */}
                {currentClubScore && (
                  <div className="glass-panel" style={{ padding: '2rem', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                          <span className="badge badge-gold" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Zap size={12} fill="#F59E0B" /> CLUBSCORE FANTASY
                          </span>
                          <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA' }}>
                            {currentClubScore.season}
                          </span>
                        </div>
                        <h4 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>
                          Level &amp; Attendance Streak Hub
                        </h4>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'rgba(245, 158, 11, 0.12)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '8px',
                      }}>
                        <Crown size={16} color="#F59E0B" />
                        <span style={{ fontWeight: 800, color: '#F59E0B', fontSize: '0.85rem' }}>
                          {currentClubScore.tier}
                        </span>
                      </div>
                    </div>

                    {/* Level Progress Bar */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Total XP Points: <strong style={{ color: '#FFFFFF', fontSize: '0.95rem' }}>{currentClubScore.total_points} PTS</strong>
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Streak: {currentClubScore.current_streak}w active
                        </span>
                      </div>

                      <div style={{ width: '100%', height: '10px', background: 'rgba(0,0,0,0.4)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, Math.max(15, (currentClubScore.total_points / 500) * 100))}%`,
                            background: 'linear-gradient(90deg, var(--club-primary) 0%, #F59E0B 100%)',
                            borderRadius: '6px',
                            transition: 'width 0.5s ease',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB 3: CONTACT ADMIN MESSAGES */}
            {activeClubhouseTab === 'messages' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '2rem' }}>
                {/* Send New Inquiry Left */}
                <div className="glass-panel" style={{ padding: '2rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MessageSquare size={20} color="#3B82F6" />
                    <span>Contact Club Administration</span>
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                    Send direct inquiries, pass questions, or availability notes directly to the {club.name} committee.
                  </p>

                  {messageSentToast && (
                    <div style={{
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid #10B981',
                      borderRadius: '8px',
                      padding: '0.75rem 1rem',
                      color: '#10B981',
                      fontSize: '0.85rem',
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}>
                      <CheckCircle2 size={16} />
                      <span>Message dispatched to club committee inbox!</span>
                    </div>
                  )}

                  <form onSubmit={handleSendMessage}>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '0.35rem' }}>
                        Inquiry Category:
                      </label>
                      <select
                        value={messageCategory}
                        onChange={e => setMessageCategory(e.target.value as MemberMessageCategory)}
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.75rem',
                          borderRadius: '8px',
                          background: '#040609',
                          border: '1px solid var(--border-subtle)',
                          color: '#FFFFFF',
                          fontSize: '0.85rem',
                        }}
                      >
                        <option value="General">General Inquiry</option>
                        <option value="Ticket / Pass">Virtual Pass &amp; Turnstile Issue</option>
                        <option value="Availability">Matchday Availability</option>
                        <option value="Medical">Medical / Fitness Status</option>
                        <option value="Kit & Gear">Kit &amp; Gear Sizing</option>
                        <option value="Committee">Club Committee Question</option>
                      </select>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '0.35rem' }}>
                        Subject:
                      </label>
                      <input
                        type="text"
                        required
                        value={messageSubject}
                        onChange={e => setMessageSubject(e.target.value)}
                        placeholder="e.g. Training session attendance question"
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.75rem',
                          borderRadius: '8px',
                          background: 'rgba(0,0,0,0.4)',
                          border: '1px solid var(--border-subtle)',
                          color: '#FFFFFF',
                          fontSize: '0.85rem',
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '0.35rem' }}>
                        Message:
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={messageContent}
                        onChange={e => setMessageContent(e.target.value)}
                        placeholder="Type your message to the club administration..."
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          borderRadius: '8px',
                          background: 'rgba(0,0,0,0.4)',
                          border: '1px solid var(--border-subtle)',
                          color: '#FFFFFF',
                          fontSize: '0.85rem',
                          resize: 'none',
                        }}
                      />
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                    >
                      <Send size={16} />
                      <span>Send to Club Administration</span>
                    </button>
                  </form>
                </div>

                {/* Message Correspondence History Right */}
                <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', height: '560px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
                      Conversation History
                    </h3>
                    <span className="badge" style={{ fontSize: '0.7rem' }}>
                      {memberMessagesList.length} Messages
                    </span>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {memberMessagesList.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                        <MessageSquare size={36} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                        <p style={{ margin: 0, fontSize: '0.85rem' }}>
                          No messages in your thread yet. Send a message to contact club administration.
                        </p>
                      </div>
                    ) : (
                      memberMessagesList.map(msg => {
                        const isAdmin = msg.sender_type === 'admin';

                        return (
                          <div
                            key={msg.id}
                            style={{
                              alignSelf: isAdmin ? 'flex-start' : 'flex-end',
                              maxWidth: '85%',
                              background: isAdmin ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              border: isAdmin ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                              borderRadius: '12px',
                              padding: '0.85rem 1rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.35rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isAdmin ? '#60A5FA' : '#10B981' }}>
                                {isAdmin ? `🏛️ ${msg.sender_name}` : `👤 You (${activeMember.full_name})`}
                              </span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            {msg.subject && (
                              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#FFFFFF', marginBottom: '0.25rem' }}>
                                {msg.subject}
                              </div>
                            )}

                            <p style={{ fontSize: '0.85rem', color: '#F8FAFC', lineHeight: 1.45, margin: 0 }}>
                              {msg.content}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* QR Scanner Reticle Modal */}
      <QRScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        mode="verify_pass"
        clubId={club.id}
      />
    </div>
  );
}
