'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useClub } from '@/lib/club-context';
import { passTokenHint } from '@/lib/ids';
import { clubTeamsOf, teamsOfMember, teamOfMatch } from '@/lib/teams';
import { clubPlaysIn, kickoff, soonestFirst } from '@/lib/fixtures';
import { SITE_URL, authReturnUrl, safeNextPath } from '@/lib/slugs';
import { defaultSeasonLabel } from '@/lib/season';
import { liveStreak } from '@/lib/clubscore-defaults';
import { pointsBreakdown, seasonOptions } from '@/lib/member-season-stats';
import { ClubMember, MemberMessageCategory, PlayerPosition, MembershipPlan } from '@/lib/supabase/types';
import PaymentStep from '@/components/PaymentStep';
import { formatMoney, membershipTermEnd, todayIso } from '@/lib/finance';
import { DEFAULT_CREST } from '@/lib/crest';
import { useShopOpen } from '@/lib/use-shop-open';
import { getSupabaseClient } from '@/lib/supabase/client';
import VirtualPassCard from '@/components/VirtualPassCard';
import GuardianPortal from '@/components/GuardianPortal';
import { useAuth } from '@/lib/auth-context';
import Captcha, { captchaError, type CaptchaHandle } from '@/components/Captcha';
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
  KeyRound,
  User,
  Phone,
  Send,
  MessageSquare,
  ShoppingBag,
  LogOut,
  Clock,
  AlertCircle,
  ExternalLink,
  Check,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { AuthAlert, AuthTabs, EmailField, InboxSent, PasswordField, SubmitButton, useShake } from '@/components/auth/AuthBits';
import PlayerAvatar from '@/components/PlayerAvatar';
import { DATE_LOCALE } from '@/lib/dates';

/** The signed-in user's own pending or rejected application (my_membership_application RPC) */
interface MyApplication {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  /** Only after migration 20261030 */
  role?: string | null;
  date_of_birth?: string | null;
  emergency_contact?: string | null;
  membership_tier: string;
  membership_status: 'pending' | 'rejected';
  rejection_reason: string | null;
  application_notes: string | null;
  player_position: string | null;
  jersey_number: number | null;
  applied_at: string | null;
  reviewed_at: string | null;
  signup_paid: boolean;
}

const formatDay = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }) : null;

/** Whole years from a 'YYYY-MM-DD' birth date to today, or null when there isn't one */
function ageFrom(dateOfBirth: string): number | null {
  const [y, m, d] = dateOfBirth.split('-').map(Number);
  if (!y || !m || !d) return null;
  const now = new Date();
  return now.getFullYear() - y - (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d) ? 1 : 0);
}

/** A first guess at "joining as" from the tier name; the applicant can change it */
// A short burst in the club's colours when an application goes in (skipped when reduced motion is on)
function celebrate(primary: string, accent: string) {
  if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  import('canvas-confetti').then(({ default: confetti }) => {
    confetti({ particleCount: 90, spread: 70, startVelocity: 38, origin: { y: 0.35 }, colors: [primary, accent, '#FFFFFF'], disableForReducedMotion: true, zIndex: 9999 });
  }).catch(() => {});
}

const guessRole = (tier: string): 'player' | 'supporter' =>
  /player|squad|academy|youth|junior|senior|team/i.test(tier) ? 'player' : 'supporter';

/** Short, readable application reference ('3F9A21C0' rather than a full database id) */
const applicationRef = (id: string) => id.replace(/-/g, '').slice(0, 8).toUpperCase();

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
    getMemberActivityLogs,
    applyForMembership,
    reloadFromServer,
    sendMemberMessage,
    getMemberMessages,
    getClubSeasonStats,
    getActiveSeason,
    clubTeams,
    clubTeamMembers,
    tournamentParticipants,
    seasons,
    matches,
    events,
    clubScoreProfiles,
  } = useClub();

  const club = selectClubBySlug(resolvedParams.clubSlug) || clubs[0];
  const clubMembers = members.filter(m => m.club_id === club.id);

  // Authentication State
  const [activeMember, setActiveMember] = useState<ClubMember | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  // Children this signed-in user is the parent / guardian of (my_children, migration 20261103)
  const [childMembers, setChildMembers] = useState<ClubMember[]>([]);
  const [childSignupPaid, setChildSignupPaid] = useState<Set<string>>(new Set());
  // A guardian adding another child through the application form
  const [addingChild, setAddingChild] = useState(false);

  // Gateway View Tabs & Sub-Modes
  const [gatewayTab, setGatewayTab] = useState<'signin' | 'signup'>('signin');

  // Sign-In Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captcha = useRef<CaptchaHandle>(null);
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
    role: 'supporter' as 'player' | 'supporter',
    dateOfBirth: '',
    termsAccepted: false,
    guardianConsent: false,
    teamId: '',
    guardianName: '',
    guardianEmail: '',
    guardianPhone: '',
    photoConsent: '' as '' | 'yes' | 'no',
  });
  // Clubs with several teams ask players which one they're joining
  const joinableTeams = clubTeamsOf(clubTeams, club.id);
  const applicantAge = signupForm.dateOfBirth ? ageFrom(signupForm.dateOfBirth) : null;
  const isMinor = applicantAge !== null && applicantAge < 18;
  // Joining a junior team always needs a parent or guardian, whatever the date of birth says
  const juniorTeamPicked = signupForm.role === 'player' && joinableTeams.length > 1
    && !!joinableTeams.find(t => t.id === signupForm.teamId)?.is_junior;
  const needsGuardian = isMinor || juniorTeamPicked || addingChild;
  const [signupError, setSignupError] = useState<string | null>(null);
  // After a sign-in link or reset email goes out, the card shows "Check your inbox" for this address
  const [sentTo, setSentTo] = useState<{ kind: 'link' | 'reset'; email: string } | null>(null);
  // The application form's step (1 about you, 2 membership, 3 confirm) and which way it last moved
  const [joinStep, setJoinStep] = useState(1);
  const [joinDir, setJoinDir] = useState<'back' | undefined>(undefined);
  const goJoinStep = (n: number) => { setJoinDir(n < joinStep ? 'back' : undefined); setJoinStep(n); joinShake.current?.closest('.auth-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const signInShake = useShake<HTMLFormElement>(loginError);
  const joinShake = useShake<HTMLFormElement>(signupError);
  const [submittedApplication, setSubmittedApplication] = useState<ClubMember | null>(null);
  // Signed in, not a member yet: their own application, and whether they're filling it in again
  const [myApplication, setMyApplication] = useState<MyApplication | null>(null);
  const [reapplying, setReapplying] = useState(false);
  // A new visit to the form starts at step 1
  useEffect(() => { setJoinStep(1); setJoinDir(undefined); }, [gatewayTab, addingChild, reapplying]);
  const [submitting, setSubmitting] = useState(false);
  // Club admins and staff who have a password can still use it
  // Member sign-in: an emailed link, or a password for people who set one
  const [signInMethod, setSignInMethod] = useState<'link' | 'password'>('link');
  const [loginPassword, setLoginPassword] = useState('');
  const { login, sendPasswordReset } = useAuth();

  // Where to go once signed in, when another page of this club sent them here (?next=/club/app:
  // the team availability link sends players to answer in the app)
  const router = useRouter();
  const nextPath = () => {
    if (typeof window === 'undefined') return null;
    const next = safeNextPath(new URLSearchParams(window.location.search).get('next'));
    return next.startsWith(`/${club.slug}/`) ? next : null;
  };
  useEffect(() => {
    const next = activeMember && nextPath();
    if (next) router.replace(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMember]);

  // Priced plans from Admin > Finance; with none set up the form keeps its built-in free tiers
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  // Plans for every team, plus those of the team the player picked (all of them until one is picked)
  const formPlans = plans.filter(p => !p.team_id || !signupForm.teamId || p.team_id === signupForm.teamId);
  useEffect(() => {
    if (formPlans.length && !formPlans.some(p => p.name === signupForm.tier)) {
      setSignupForm(f => ({ ...f, tier: formPlans[0].name }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signupForm.teamId, plans]);
  const [currency, setCurrency] = useState('AUD');
  const [paymentNotice, setPaymentNotice] = useState<'success' | 'cancelled' | null>(null);
  const [renewPlanId, setRenewPlanId] = useState('');
  const [renewOpen, setRenewOpen] = useState(false);

  // Authenticated Member Clubhouse State
  const [activeClubhouseTab, setActiveClubhouseTab] = useState<'pass' | 'stats' | 'messages'>('pass');
  // Season shown on the Season Stats tab ('' = the club's active season)
  const [statsSeason, setStatsSeason] = useState('');
  const shopOpen = useShopOpen(club.id);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Messaging Form State
  const [messageSubject, setMessageSubject] = useState('');
  const [messageCategory, setMessageCategory] = useState<MemberMessageCategory>('General');
  const [messageContent, setMessageContent] = useState('');
  const [messageSentToast, setMessageSentToast] = useState(false);


  /** Reads the signed-in user's pending or rejected application here (null if none, or before the migration) */
  const loadMyApplication = async (): Promise<MyApplication | null> => {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data } = await client.rpc('my_membership_application', { p_club_id: club.id });
    const application = Array.isArray(data) ? ((data[0] as MyApplication | undefined) ?? null) : null;
    setMyApplication(application);
    return application;
  };

  /** Children the signed-in user looks after here, and which of their sign-up fees are paid */
  const loadChildren = async (): Promise<ClubMember[]> => {
    const client = getSupabaseClient();
    if (!client) return [];
    // Before migration 20261103 there is no my_children: nobody has a family view yet
    const { data, error } = await client.rpc('my_children', { p_club_id: club.id });
    const list = !error && Array.isArray(data) ? (data as ClubMember[]) : [];
    setChildMembers(list);
    const pendingIds = list.filter(c => c.membership_status === 'pending').map(c => c.id);
    if (pendingIds.length) {
      const { data: paid } = await client.from('payments').select('member_id')
        .in('member_id', pendingIds).eq('kind', 'membership_signup').in('status', ['paid', 'awaiting_review']);
      setChildSignupPaid(new Set((paid || []).map(p => p.member_id as string)));
    } else {
      setChildSignupPaid(new Set());
    }
    return list;
  };

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
        setMyApplication(null);
        setReapplying(false);
        setChildMembers([]);
        setAddingChild(false);
        setAuthChecked(true);
        return;
      }
      setSignedInEmail(email);
      const [{ data, error }, children] = await Promise.all([
        client.rpc('claim_member_profile', { p_club_id: club.id }),
        loadChildren(),
      ]);
      if (cancelled) return;
      // Children's messages and payments come with the next load (guardians can read them)
      if (children.length) reloadFromServer();
      const row = Array.isArray(data) ? (data[0] as ClubMember | undefined) : undefined;
      if (error || !row) {
        setActiveMember(null);
        if (!error) {
          // Applied but not approved (yet): show them where their application stands
          const application = await loadMyApplication();
          if (cancelled) return;
          setLoginNotice(null);
          setLoginError(application || children.length ? null : `No membership or application was found for ${email || 'this email'} at ${club.name}. You can apply below.`);
        }
      } else {
        setActiveMember(row);
        setMyApplication(null);
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

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const payment = search.get('payment');
    if (payment === 'success' || payment === 'cancelled') setPaymentNotice(payment);
    // "Join the Club" links open straight on the membership application
    if (search.has('join')) setGatewayTab('signup');
    const client = getSupabaseClient();
    if (!client) return;
    client.from('membership_plans').select('*').eq('club_id', club.id).eq('is_active', true).order('sort_order')
      .then(({ data }) => {
        const list = (data || []) as MembershipPlan[];
        setPlans(list);
        if (list.length) setSignupForm(f => (list.some(p => p.name === f.tier) ? f : { ...f, tier: list[0].name, role: guessRole(list[0].name) }));
      });
    client.from('club_payment_settings').select('currency').eq('club_id', club.id).maybeSingle()
      .then(({ data }) => data?.currency && setCurrency(data.currency));
  }, [club.id]);

  // Signed in but not a member: apply with the address they signed in with
  useEffect(() => {
    if (signedInEmail) setSignupForm(f => (f.email ? f : { ...f, email: signedInEmail }));
  }, [signedInEmail]);

  // Keep activeMember in sync with live members state (e.g. after approval)
  useEffect(() => {
    if (activeMember) {
      const fresh = clubMembers.find(m => m.id === activeMember.id);
      if (fresh) {
        setActiveMember(fresh);
      }
    }
  }, [clubMembers, activeMember?.id]);

  // Children too: the club's decisions and payments show up without signing in again
  useEffect(() => {
    if (!childMembers.length) return;
    let changed = false;
    const next = childMembers.map(c => {
      const fresh = clubMembers.find(m => m.id === c.id);
      if (fresh && fresh !== c) changed = true;
      return fresh || c;
    });
    if (changed) setChildMembers(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubMembers]);

  // "Add another child": the application form, with the guardian's details from their other children
  const startAddChild = () => {
    // Newest details first: any child that has them
    const known = (key: 'guardian_name' | 'guardian_email' | 'guardian_phone') =>
      [...childMembers].reverse().map(c => c[key]?.trim()).find(Boolean);
    setSignupForm(f => ({
      ...f,
      fullName: '',
      email: '',
      phone: '',
      position: '',
      jerseyNumber: '',
      notes: '',
      emergencyContact: '',
      role: 'player',
      dateOfBirth: '',
      termsAccepted: false,
      guardianConsent: false,
      teamId: '',
      guardianName: known('guardian_name') || f.guardianName,
      guardianEmail: signedInEmail || known('guardian_email') || f.guardianEmail,
      guardianPhone: known('guardian_phone') || f.guardianPhone,
      photoConsent: '',
    }));
    setSignupError(null);
    setSubmittedApplication(null);
    setReapplying(false);
    setGatewayTab('signup');
    setAddingChild(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const finishAddChild = () => {
    setAddingChild(false);
    setSubmittedApplication(null);
    setGatewayTab('signin');
    void loadChildren();
  };

  // Handle Logout
  const handleLogout = async () => {
    setActiveMember(null);
    setChildMembers([]);
    setAddingChild(false);
    setMyApplication(null);
    setReapplying(false);
    await getSupabaseClient()?.auth.signOut();
  };

  // "Apply again" on a rejected application: the form, filled in with what they sent last time
  const startReapply = (application: MyApplication) => {
    setSignupForm(f => ({
      ...f,
      fullName: application.full_name,
      email: application.email,
      phone: application.phone || '',
      tier: plans.length && !plans.some(p => p.name === application.membership_tier) ? plans[0].name : application.membership_tier,
      position: (application.player_position || '') as PlayerPosition | '',
      jerseyNumber: application.jersey_number ? String(application.jersey_number) : '',
      notes: application.application_notes || '',
      role: application.role === 'supporter' ? 'supporter' : application.role ? 'player' : guessRole(application.membership_tier),
      dateOfBirth: application.date_of_birth || '',
      emergencyContact: application.emergency_contact || '',
      termsAccepted: false,
      guardianConsent: false,
      guardianName: '',
      guardianEmail: '',
      guardianPhone: '',
      photoConsent: '',
    }));
    setSignupError(null);
    setSubmittedApplication(null);
    setGatewayTab('signup');
    setReapplying(true);
  };

  // Email a one-time sign-in link (Supabase Auth)
  const handleRequestMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMagicLink();
  };
  const sendMagicLink = async () => {
    setLoginError(null);
    setLoginNotice(null);

    const client = getSupabaseClient();
    if (!client) {
      setLoginError('Sign-in is unavailable right now.');
      return;
    }
    const notReady = captchaError(captchaToken);
    if (notReady) return setLoginError(notReady);
    setSendingLink(true);
    const { error } = await client.auth.signInWithOtp({
      email: loginEmail.trim().toLowerCase(),
      options: { emailRedirectTo: authReturnUrl(window.location.origin, `/${club.slug}/member${nextPath() ? `?next=${encodeURIComponent(nextPath()!)}` : ''}`), captchaToken: captchaToken || undefined },
    });
    setSendingLink(false);
    captcha.current?.reset();
    if (error) {
      const m = error.message.toLowerCase();
      setLoginError(m.includes('captcha') ? 'The security check failed or expired. Please try again.'
        : m.includes('rate') ? 'Too many requests. Please wait a minute and try again.' : 'Could not send the sign-in link. Please try again.');
      return;
    }
    // Same message whether or not the email belongs to a member (no account enumeration)
    setSentTo({ kind: 'link', email: loginEmail.trim().toLowerCase() });
  };

  // Password sign-in. The page follows the auth state, so it switches to the member's pass by itself.
  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginNotice(null);
    const notReady = captchaError(captchaToken);
    if (notReady) return setLoginError(notReady);
    setSendingLink(true);
    const res = await login(loginEmail, loginPassword, captchaToken);
    setSendingLink(false);
    captcha.current?.reset();
    if (!res.success) return setLoginError(res.error || 'Could not sign in. Check your email and password.');
    setLoginPassword('');
  };

  const handleForgotPassword = async () => {
    setLoginError(null);
    setLoginNotice(null);
    if (!loginEmail.trim()) return setLoginError('Enter your email address first, then choose "Forgot password?" again.');
    const notReady = captchaError(captchaToken);
    if (notReady) return setLoginError(notReady);
    setSendingLink(true);
    const res = await sendPasswordReset(loginEmail, captchaToken);
    setSendingLink(false);
    captcha.current?.reset();
    if (!res.success) return setLoginError(res.error || 'Could not send the reset email.');
    // Same message whether or not there is an account (no account fishing)
    setSentTo({ kind: 'reset', email: loginEmail.trim() });
  };

  // Handle Membership Application Submit
  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);
    // Enter in an earlier step moves on rather than sending
    if (joinStep < 3) return goJoinStep(joinStep + 1);
    if (submitting) return;
    if (!signupForm.termsAccepted) return setSignupError('Please accept the club terms and privacy policy.');
    if (needsGuardian && !signupForm.guardianEmail.trim()) return setSignupError('Please add the parent or guardian\'s email: the club emails them about the player, and they sign in with it.');
    if (!needsGuardian && !signupForm.email.trim()) return setSignupError('Please add your email address.');
    if (juniorTeamPicked && !signupForm.dateOfBirth) return setSignupError('Please add the player\'s date of birth: junior teams are by age group.');
    if (needsGuardian && (!signupForm.guardianName.trim() || !signupForm.guardianPhone.trim())) return setSignupError('Please add a parent or guardian\'s name and phone number.');
    if (needsGuardian && !signupForm.photoConsent) return setSignupError('Please choose whether photos of the player can be shown publicly.');
    if (needsGuardian && !signupForm.guardianConsent) return setSignupError(juniorTeamPicked && !isMinor ? 'A parent or guardian needs to give their consent for junior team players.' : 'A parent or guardian needs to give their consent for applicants under 18.');
    setSubmitting(true);
    try {
      if (reapplying && myApplication) await handleReapply(myApplication);
      else await submitNewApplication();
    } finally {
      setSubmitting(false);
    }
  };

  // Apply again after a rejection: the same application goes back to the committee
  const handleReapply = async (application: MyApplication) => {
    const client = getSupabaseClient();
    if (!client) return;
    let { error } = await client.rpc('reapply_for_membership', {
      p_club_id: club.id,
      p_full_name: signupForm.fullName.trim(),
      p_phone: signupForm.phone.trim(),
      p_tier: signupForm.tier,
      p_role: signupForm.role,
      p_position: signupForm.role === 'player' ? signupForm.position || null : null,
      p_jersey: signupForm.role === 'player' && signupForm.jerseyNumber ? parseInt(signupForm.jerseyNumber) : null,
      p_notes: signupForm.notes.trim(),
      p_date_of_birth: signupForm.dateOfBirth || null,
      p_emergency_contact: emergencyContact(),
      p_terms_accepted: signupForm.termsAccepted,
      p_guardian_consent: needsGuardian && signupForm.guardianConsent,
      ...guardianArgs(),
    });
    // Before migration 20261102 the function has no guardian / team arguments: send it without them
    if (error?.code === 'PGRST202') {
      ({ error } = await client.rpc('reapply_for_membership', {
        p_club_id: club.id,
        p_full_name: signupForm.fullName.trim(),
        p_phone: signupForm.phone.trim(),
        p_tier: signupForm.tier,
        p_role: signupForm.role,
        p_position: signupForm.role === 'player' ? signupForm.position || null : null,
        p_jersey: signupForm.role === 'player' && signupForm.jerseyNumber ? parseInt(signupForm.jerseyNumber) : null,
        p_notes: signupForm.notes.trim(),
        p_date_of_birth: signupForm.dateOfBirth || null,
        p_emergency_contact: emergencyContact(),
        p_terms_accepted: signupForm.termsAccepted,
        p_guardian_consent: needsGuardian && signupForm.guardianConsent,
      }));
    }
    // Before migration 20261030 only the shorter version of the function exists
    if (error?.code === 'PGRST202') {
      ({ error } = await client.rpc('reapply_for_membership', {
        p_club_id: club.id,
        p_full_name: signupForm.fullName.trim(),
        p_phone: signupForm.phone.trim(),
        p_tier: signupForm.tier,
        p_position: signupForm.role === 'player' ? signupForm.position || null : null,
        p_jersey: signupForm.role === 'player' && signupForm.jerseyNumber ? parseInt(signupForm.jerseyNumber) : null,
        p_notes: signupForm.notes.trim(),
      }));
    }
    if (error) {
      setSignupError('Your application could not be sent. Please try again in a moment.');
      return;
    }
    void fetch('/api/members/application-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clubId: club.id, memberId: application.id, kind: 'applied' }),
    }).catch(() => undefined);
    setReapplying(false);
    await loadMyApplication();
  };

  // The guardian doubles as the emergency contact unless the applicant gave another one
  const emergencyContact = () => {
    const given = signupForm.emergencyContact.trim();
    if (given || !needsGuardian) return given;
    return [signupForm.guardianName.trim(), signupForm.guardianPhone.trim()].filter(Boolean).join(', ');
  };
  const requestedTeamId = () =>
    signupForm.role === 'player' && joinableTeams.length > 1 && signupForm.teamId ? signupForm.teamId : undefined;
  const guardianArgs = () => ({
    p_guardian_name: needsGuardian ? signupForm.guardianName.trim() : null,
    p_guardian_email: needsGuardian ? signupForm.guardianEmail.trim() : null,
    p_guardian_phone: needsGuardian ? signupForm.guardianPhone.trim() : null,
    p_photo_consent: needsGuardian && signupForm.photoConsent ? signupForm.photoConsent === 'yes' : null,
    p_requested_team_id: requestedTeamId() || null,
  });

  const submitNewApplication = async () => {
    const res = await applyForMembership(club.id, {
      full_name: signupForm.fullName,
      email: signupForm.email,
      phone: signupForm.phone,
      membership_tier: signupForm.tier,
      role: signupForm.role,
      player_position: signupForm.role === 'player' && signupForm.position ? signupForm.position : undefined,
      jersey_number: signupForm.role === 'player' && signupForm.jerseyNumber ? parseInt(signupForm.jerseyNumber) : undefined,
      application_notes: signupForm.notes,
      emergency_contact: emergencyContact(),
      date_of_birth: signupForm.dateOfBirth || undefined,
      terms_accepted: signupForm.termsAccepted,
      guardian_consent: needsGuardian && signupForm.guardianConsent,
      requested_team_id: requestedTeamId(),
      ...(needsGuardian ? {
        guardian_name: signupForm.guardianName.trim(),
        guardian_email: signupForm.guardianEmail.trim() || undefined,
        guardian_phone: signupForm.guardianPhone.trim(),
        photo_consent: signupForm.photoConsent ? signupForm.photoConsent === 'yes' : undefined,
      } : {}),
    });

    if (res.success && res.member) {
      setSubmittedApplication(res.member);
      celebrate(club.primary_color, club.accent_color);
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

  // Compute stats for current active member, for the season picked on the Season Stats tab
  const activeSeasonName = getActiveSeason(club.id)?.name || defaultSeasonLabel();
  const clubSeasons = seasons.filter(s => s.club_id === club.id);
  const memberStatsRows = activeMember ? playerStats.filter(s => s.member_id === activeMember.id) : [];
  const memberClubScoreRows = activeMember ? clubScoreProfiles.filter(p => p.member_id === activeMember.id) : [];
  const statsSeasonOptions = seasonOptions(clubSeasons, activeSeasonName, [
    ...memberStatsRows.map(s => s.season),
    ...memberClubScoreRows.map(p => p.season),
    ...matches.filter(m => m.club_id === club.id && m.status === 'completed').map(m => m.season),
  ]);
  const selectedSeason = statsSeason && statsSeasonOptions.includes(statsSeason) ? statsSeason : activeSeasonName;
  const currentStats = memberStatsRows.find(s => s.season === selectedSeason) || null;
  const currentClubScore = memberClubScoreRows.find(p => p.season === selectedSeason) || null;
  const memberActivityLogs = activeMember ? getMemberActivityLogs(activeMember.id) : [];

  // Back of the member pass: their teams, their next fixture, and renewal when it's offered
  const passTeams = activeMember ? teamsOfMember(clubTeamMembers, clubTeamsOf(clubTeams, club.id), activeMember.id) : [];
  const passNextMatch = (() => {
    if (!activeMember) return undefined;
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    const teamIds = new Set(passTeams.map(t => t.id));
    return matches
      .filter(m => m.club_id === club.id && m.status === 'upcoming' && kickoff(m) >= startOfToday)
      .filter(m => clubPlaysIn(m, tournamentParticipants, club.name))
      // With teams known, only their own teams' games (internal and tournament games count for everyone)
      .filter(m => {
        if (!teamIds.size) return true;
        const team = teamOfMatch(m, clubTeams);
        return !team || teamIds.has(team.id);
      })
      .sort(soonestFirst)[0];
  })();
  const canRenew = !!activeMember?.membership_expires_at && plans.some(p => p.price_cents > 0);
  const openRenewal = () => {
    setRenewOpen(true);
    requestAnimationFrame(() => document.getElementById('renew-membership')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };
  const clubScoreBreakdown = pointsBreakdown(memberActivityLogs, {
    season: selectedSeason,
    activeName: activeSeasonName,
    seasonRecord: clubSeasons.find(s => s.name === selectedSeason),
    referenceSeason: id => {
      const ref = matches.find(m => m.id === id) || events.find(e => e.id === id);
      return ref ? ref.season ?? null : undefined;
    },
    total: currentClubScore?.total_points,
  });
  const seasonClubScoreTotal = currentClubScore?.total_points ?? clubScoreBreakdown.reduce((sum, r) => sum + r.points, 0);
  const memberMessagesList = activeMember ? getMemberMessages(club.id, activeMember.id) : [];
  const clubSeasonStats = getClubSeasonStats(club.id, selectedSeason);

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
            <span>Back to {club.name}</span>
          </Link>
        </div>

        {paymentNotice && (
          <div role="status" className="glass-panel" style={{
            padding: '0.9rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.6rem',
            borderLeft: `4px solid ${paymentNotice === 'success' ? '#10B981' : '#F59E0B'}`,
          }}>
            {paymentNotice === 'success' ? <CheckCircle2 size={18} color="var(--c-green)" /> : <AlertCircle size={18} color="var(--c-amber)" />}
            <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
              {paymentNotice === 'success'
                ? 'Payment received, thank you! It can take a minute to show on your membership.'
                : 'Payment was cancelled. Nothing was charged. You can try again any time.'}
            </span>
          </div>
        )}

        {/* ==================================================================== */}
        {/* UN-AUTHENTICATED: GATEWAY & APPLICATION PORTAL */}
        {/* ==================================================================== */}
        {!activeMember || addingChild ? (
          <div style={{ maxWidth: gatewayTab === 'signin' && !addingChild && !reapplying ? '560px' : '640px', margin: '0 auto' }}>
            {!(addingChild || reapplying || (!myApplication && !(childMembers.length > 0 && signedInEmail))) && (
              <div className="glass-panel auth-card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                <header className="auth-head" style={{ marginBottom: 0 }}>
                  <img loading="eager" decoding="async" width={64} height={64} className="auth-crest"
                    src={club.logo_url || DEFAULT_CREST} alt={`${club.name} crest`} />
                  <h1>{club.name} members</h1>
                </header>
              </div>
            )}

            {/* A parent or guardian (not a member themselves): their children, instead of the tabs */}
            {!activeMember && childMembers.length > 0 && !addingChild && signedInEmail && (
              <>
                <GuardianPortal club={club} childMembers={childMembers} guardianEmail={signedInEmail} plans={plans} currency={currency} signupPaid={childSignupPaid} onAddChild={startAddChild} />
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '2rem' }}>
                  Signed in as {signedInEmail}.{' '}
                  <button type="button" onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--club-ink)', cursor: 'pointer', fontWeight: 700, fontSize: 'inherit', textDecoration: 'underline', textUnderlineOffset: '3px', minHeight: '44px', padding: '0 0.4rem' }}>
                    Sign out
                  </button>
                </div>
              </>
            )}

            {addingChild && !submittedApplication && (
              <div className="glass-panel" style={{ padding: '0.9rem 1.25rem', marginBottom: '1.25rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 700 }}>Adding a child to your family</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={finishAddChild}>Back to my family</button>
              </div>
            )}

            {/* Signed in with an application that isn't approved: where it stands, instead of the tabs */}
            {myApplication && !reapplying && !addingChild && (() => {
              const pending = myApplication.membership_status === 'pending';
              const plan = plans.find(p => p.name === myApplication.membership_tier);
              const unpaid = pending && !myApplication.signup_paid && !!plan && plan.price_cents > 0;
              return (
                <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
                  <span className="badge" style={pending
                    ? { background: 'rgba(245, 158, 11, 0.2)', color: 'var(--c-amber)', marginBottom: '0.75rem' }
                    : { background: 'rgba(239, 68, 68, 0.15)', color: 'var(--c-red)', marginBottom: '0.75rem' }}>
                    {pending ? '⏳ WAITING FOR COMMITTEE REVIEW' : 'NOT APPROVED'}
                  </span>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                    {pending ? 'Your application is with the committee' : 'Your application wasn\u2019t approved'}
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, maxWidth: '480px', margin: '0 auto 1.25rem auto' }}>
                    {pending
                      ? `We'll email ${myApplication.email} as soon as ${club.name} has made a decision. Once you're approved, your member pass appears here.`
                      : `${club.name} wasn't able to approve your application this time. If your circumstances have changed, you can apply again.`}
                  </p>

                  <div style={{ textAlign: 'left', background: 'rgba(var(--shade-rgb), 0.4)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'grid', gap: '0.35rem' }}>
                    <div>Applicant: <strong className="text-primary">{myApplication.full_name}</strong></div>
                    <div>Membership: <strong className="text-primary">{myApplication.membership_tier}</strong></div>
                    {myApplication.applied_at && <div>Applied: <strong className="text-primary">{formatDay(myApplication.applied_at)}</strong></div>}
                    {pending && plan && plan.price_cents > 0 && (
                      <div>Membership fee: <strong style={{ color: myApplication.signup_paid ? 'var(--c-green)' : 'var(--c-amber)' }}>{myApplication.signup_paid ? 'Paid' : `${formatMoney(plan.price_cents, currency)} to pay`}</strong></div>
                    )}
                    {!pending && myApplication.reviewed_at && <div>Decided: <strong className="text-primary">{formatDay(myApplication.reviewed_at)}</strong></div>}
                    {!pending && myApplication.rejection_reason && <div>Reason: <strong className="text-primary">{myApplication.rejection_reason}</strong></div>}
                  </div>

                  {unpaid && plan && (
                    <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                      <PaymentStep
                        clubId={club.id}
                        kind="membership_signup"
                        memberId={myApplication.id}
                        planId={plan.id}
                        amountCents={plan.price_cents}
                        label={`Pay for ${plan.name}`}
                      />
                    </div>
                  )}

                  {!pending && (
                    <button type="button" onClick={() => startReapply(myApplication)} className="btn btn-primary" style={{ width: '100%', marginBottom: '1rem' }}>
                      Apply again
                    </button>
                  )}

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Signed in as {signedInEmail}.{' '}
                    <button type="button" onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--club-ink)', cursor: 'pointer', fontWeight: 700, fontSize: 'inherit', textDecoration: 'underline', textUnderlineOffset: '3px', minHeight: '44px', padding: '0 0.4rem' }}>
                      Sign out
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Gateway Switcher Tabs */}
            {(addingChild || reapplying || (!myApplication && !(childMembers.length > 0 && signedInEmail))) && (<>
            <div className="glass-panel auth-card">
              <header className={`auth-head${gatewayTab === 'signup' && (joinStep > 1 || submittedApplication) ? ' is-compact' : ''}`}>
                <img loading="eager" decoding="async" width={64} height={64} className="auth-crest"
                  src={club.logo_url || DEFAULT_CREST} alt={`${club.name} crest`} />
                <h1>{addingChild ? 'Add your child' : gatewayTab === 'signin' ? `${club.name} members` : `Join ${club.name}`}</h1>
                <p>{addingChild
                  ? `Their details, then yours as their parent or guardian. ${club.name} will review the application and email you.`
                  : gatewayTab === 'signin'
                  ? 'Sign in to see your member pass, season stats and messages from the club.'
                  : 'Apply in three quick steps. The committee reviews every application and emails you the outcome.'}</p>
              </header>

              {!addingChild && !reapplying && !submittedApplication && (
                <AuthTabs idPrefix="gateway" label="Sign in or join" value={gatewayTab}
                  onChange={tab => { setGatewayTab(tab); setSubmittedApplication(null); setLoginError(null); setLoginNotice(null); }}
                  options={[['signin', 'Sign in'], ['signup', 'Join the club']] as const} />
              )}

              <div id="gateway-panel" role="tabpanel" aria-labelledby={`gateway-tab-${gatewayTab}`} key={gatewayTab}
                className="auth-panel" data-dir={gatewayTab === 'signin' ? 'back' : undefined}>
            {gatewayTab === 'signin' && (sentTo ? (
              <InboxSent email={sentTo.email} resendBusy={sendingLink}
                title={sentTo.kind === 'reset' ? 'Check your inbox' : 'Check your inbox'}
                onResend={() => (sentTo.kind === 'link' ? sendMagicLink() : handleForgotPassword())}
                onChangeEmail={() => { setSentTo(null); setLoginError(null); }}
                extra={<>
                <div style={{ marginTop: '1rem' }}><Captcha ref={captcha} onToken={setCaptchaToken} /></div>
                {loginError && <div style={{ marginTop: '0.75rem', textAlign: 'left' }}><AuthAlert kind="error">{loginError}</AuthAlert></div>}
                </>}>
                {sentTo.kind === 'reset'
                  ? <>If there&apos;s an account for <strong style={{ color: 'var(--text-primary)' }}>{sentTo.email}</strong>, we&apos;ve emailed it a link to choose a new password.</>
                  : <>If <strong style={{ color: 'var(--text-primary)' }}>{sentTo.email}</strong> has a membership or an application with {club.name}, a sign-in link is on its way. Open it on this device. It works once.</>}
              </InboxSent>
            ) : (
              <>
                <AuthTabs quiet idPrefix="signin" label="How to sign in" value={signInMethod}
                  onChange={m => { setSignInMethod(m); setLoginError(null); setLoginNotice(null); }}
                  options={[['link', 'Email me a link'], ['password', 'Password']] as const} />

                <form id="signin-panel" role="tabpanel" aria-labelledby={`signin-tab-${signInMethod}`} ref={signInShake}
                  onSubmit={signInMethod === 'link' ? handleRequestMagicLink : handlePasswordSignIn}>
                  <EmailField id="member-signin-email" value={loginEmail} onChange={setLoginEmail}
                    hint={signInMethod === 'link' ? 'Use the email your membership is registered with. No password needed.' : undefined} />

                  {signInMethod === 'password' && (
                    <PasswordField id="member-signin-password" value={loginPassword} onChange={setLoginPassword}
                      aside={<button type="button" className="auth-link" onClick={handleForgotPassword} disabled={sendingLink}>Forgot password?</button>} />
                  )}

                  <div style={{ marginBottom: '1rem' }}>
                    <Captcha ref={captcha} onToken={setCaptchaToken} />
                  </div>

                  {loginError && <AuthAlert kind="error">{loginError}</AuthAlert>}
                  {loginNotice && <AuthAlert kind="ok">{loginNotice}</AuthAlert>}

                  <SubmitButton busy={sendingLink} busyLabel={signInMethod === 'link' ? 'Sending your link...' : 'Signing in...'}
                    >
                    {signInMethod === 'link' ? 'Email me a sign-in link' : 'Sign in'}
                  </SubmitButton>
                </form>

                {signedInEmail && !activeMember ? (
                  <div className="auth-foot">
                    Signed in as {signedInEmail}.{' '}
                    <button type="button" className="auth-link" onClick={handleLogout} style={{ minHeight: '44px', padding: '0 0.4rem' }}>Use a different email</button>
                  </div>
                ) : (
                  <div className="auth-foot">
                    New to {club.name}?{' '}
                    <button type="button" className="auth-link" onClick={() => setGatewayTab('signup')} style={{ minHeight: '44px', padding: '0 0.4rem' }}>Apply to join</button>
                  </div>
                )}
              </>
            ))}

            {gatewayTab === 'signup' && (
              <>
                {submittedApplication ? (
                  /* Application Confirmation Screen */
                  <div className="auth-sent" role="status" style={{ padding: '0.5rem 0' }}>
                    <div className="auth-sent-icon" aria-hidden="true" style={{ color: 'var(--c-amber)', background: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.35)' }}>
                      <Clock size={34} />
                      <span className="auth-sent-tick">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                      </span>
                    </div>
                    <h2>Application sent, {submittedApplication.full_name.split(' ')[0]}</h2>
                    <p>Your application for <strong style={{ color: 'var(--text-primary)' }}>{submittedApplication.membership_tier}</strong> is with the {club.name} committee.</p>

                    <ol className="auth-next" aria-label="What happens next">
                      <li className="is-done"><strong>Application sent</strong><span>Just now</span></li>
                      <li className="is-now"><strong>Committee review</strong><span>They&apos;ll check your details</span></li>
                      <li><strong>We email {submittedApplication.guardian_email || submittedApplication.email}</strong><span>Then sign in here for your member pass</span></li>
                    </ol>

                    <div style={{
                      background: 'rgba(var(--shade-rgb), 0.35)',
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
                      <div>Applicant: <strong className="text-primary">{submittedApplication.full_name}</strong></div>
                                            <div>Application Ref: <code style={{ color: 'var(--c-amber)' }}>{applicationRef(submittedApplication.id)}</code></div>
                    </div>

                    {(() => {
                      const plan = plans.find(p => p.name === submittedApplication.membership_tier);
                      return plan && plan.price_cents > 0 ? (
                        <div style={{ marginBottom: '1.5rem' }}>
                          <PaymentStep
                            clubId={club.id}
                            kind="membership_signup"
                            memberId={submittedApplication.id}
                            planId={plan.id}
                            amountCents={plan.price_cents}
                            label={`Pay for ${plan.name}`}
                          />
                        </div>
                      ) : null;
                    })()}

                    {addingChild || (signedInEmail && submittedApplication.guardian_email === signedInEmail.toLowerCase()) ? (
                      <button type="button" onClick={finishAddChild} className="btn btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
                        Back to my family
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setGatewayTab('signin'); setSubmittedApplication(null); }}
                        className="btn btn-primary"
                        style={{ padding: '0.75rem 1.5rem' }}
                      >
                        Back to sign in
                      </button>
                    )}
                  </div>
                ) : (
                  /* Application form, in three steps. Only the current step is on the page, so the browser checks just its fields. */
                  <form onSubmit={handleSignupSubmit} ref={joinShake}>
                    <ol className="auth-steps" aria-label={`Step ${joinStep} of 3`}>
                      {['About you', 'Membership', 'Confirm'].map((label, i) => (
                        <li key={label} className={i + 1 < joinStep ? 'is-done' : i + 1 === joinStep ? 'is-now' : ''} aria-current={i + 1 === joinStep ? 'step' : undefined}>
                          {i + 1}. {label}
                        </li>
                      ))}
                    </ol>

                    <div key={joinStep} className="auth-panel" data-dir={joinDir}>
                    {joinStep === 1 && (<>
                    <div className="form-row-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label htmlFor="member-full-name" className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                          {addingChild ? 'Child’s full name' : 'Full name'}
                        </label>
                        <input autoComplete="name" id="member-full-name"
                          type="text"
                          required
                          value={signupForm.fullName}
                          onChange={e => setSignupForm({ ...signupForm, fullName: e.target.value })}
                          placeholder="e.g. Liam O'Connor"
                          className="form-input"
                        />
                      </div>
                      <div>
                        <label htmlFor="member-date-of-birth" className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                          Date of birth{juniorTeamPicked ? '' : ' (optional)'}
                        </label>
                        <input id="member-date-of-birth"
                          type="date"
                          required={juniorTeamPicked}
                          max={todayIso()}
                          value={signupForm.dateOfBirth}
                          onChange={e => setSignupForm({ ...signupForm, dateOfBirth: e.target.value })}
                          className="form-input"
                        />
                      </div>
                    </div>

                    <div className="form-row-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label htmlFor="member-email-address" className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                          {needsGuardian ? 'Player\'s own email (optional)' : 'Email'}
                        </label>
                        <input autoComplete="email" id="member-email-address"
                          type="email"
                          inputMode="email"
                          autoCapitalize="none"
                          required={!needsGuardian}
                          value={signupForm.email}
                          readOnly={reapplying}
                          onChange={e => setSignupForm({ ...signupForm, email: e.target.value })}
                          placeholder="e.g. liam@email.com"
                          className="form-input"
                        />
                      </div>
                      <div>
                        <label htmlFor="member-phone-number" className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                          Phone (optional)
                        </label>
                        <input autoComplete="tel" id="member-phone-number"
                          type="tel"
                          value={signupForm.phone}
                          onChange={e => setSignupForm({ ...signupForm, phone: e.target.value })}
                          placeholder="e.g. 0400 000 000"
                          className="form-input"
                        />
                      </div>
                    </div>
                    {isMinor && !addingChild && (
                      <div className="auth-field-hint" style={{ marginTop: '-0.25rem', marginBottom: '1rem' }}>Under 18: we&apos;ll ask for a parent or guardian in the next step.</div>
                    )}
                    </>)}

                    {joinStep === 2 && (<>
                    <fieldset style={{ border: 'none', padding: 0, margin: '0 0 1.1rem 0' }}>
                      <legend className="form-label" style={{ display: 'block', marginBottom: '0.45rem' }}>Membership</legend>
                      <div style={{ display: 'grid', gap: '0.55rem' }}>
                        {/* The club's own plans and fees (Admin > Finance). Without any, the built-in tiers carry no price. */}
                        {(formPlans.length ? formPlans.map(p => ({
                          name: p.name,
                          price: p.price_cents > 0 ? formatMoney(p.price_cents, currency) : 'Free',
                          hint: [p.duration_months ? (p.duration_months === 12 ? '12 months' : `${p.duration_months} month${p.duration_months === 1 ? '' : 's'}`) : '', p.description || ''].filter(Boolean).join(' · '),
                        })) : ['Supporter Season Pass', 'Senior Squad Player', 'Academy / Youth Squad', 'Club Volunteer', 'VIP Gold Pass'].map(name => ({ name, price: '', hint: '' }))
                        ).map(({ name, price, hint }) => (
                          <label key={name} className="auth-choice">
                            <input type="radio" name="member-membership-tier" value={name} checked={signupForm.tier === name} required
                              onChange={() => setSignupForm({ ...signupForm, tier: name, role: guessRole(name) })} />
                            <span>
                              <span className="auth-choice-title">{name}</span>
                              {hint && <span className="auth-choice-hint">{hint}</span>}
                            </span>
                            {price && <span className="auth-choice-price">{price}</span>}
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    {/* Joining as: decides the squad role, so it's asked, not guessed from the tier name */}
                    <fieldset style={{ border: 'none', padding: 0, margin: '0 0 1rem 0' }}>
                      <legend className="form-label" style={{ display: 'block', marginBottom: '0.45rem' }}>Joining as</legend>
                      <div className="form-row-2" style={{ gap: '0.55rem' }}>
                        {([['player', 'Player', 'I want to play for the club'], ['supporter', 'Supporter / non-playing', 'Fan, volunteer, family or social member']] as const).map(([value, title, hint]) => (
                          <label key={value} className="auth-choice">
                            <input type="radio" name="member-joining-as" value={value} checked={signupForm.role === value}
                              onChange={() => setSignupForm({ ...signupForm, role: value })} />
                            <span>
                              <span className="auth-choice-title">{title}</span>
                              <span className="auth-choice-hint">{hint}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    {/* Player fields */}
                    {signupForm.role === 'player' && (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '1rem',
                        marginBottom: '1rem',
                        background: 'rgba(var(--club-primary-rgb), 0.05)',
                        border: '1px solid rgba(var(--club-primary-rgb), 0.2)',
                        padding: '0.75rem',
                        borderRadius: '8px',
                      }}>
                        <div>
                          <label htmlFor="member-preferred-position" className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                            Preferred Position
                          </label>
                          <select id="member-preferred-position"
                            value={signupForm.position}
                            onChange={e => setSignupForm({ ...signupForm, position: e.target.value as PlayerPosition })}
                            className="form-select"
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
                          <label htmlFor="member-preferred-kit" className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                            Preferred Kit #
                          </label>
                          <input id="member-preferred-kit"
                            type="number"
                            min={1}
                            max={99}
                            value={signupForm.jerseyNumber}
                            onChange={e => setSignupForm({ ...signupForm, jerseyNumber: e.target.value })}
                            placeholder="e.g. 10"
                            className="form-input"
                          />
                        </div>

                        {joinableTeams.length > 1 && (
                          <div style={{ gridColumn: '1 / -1' }}>
                            <label htmlFor="member-team" className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                              Team you&apos;re joining
                            </label>
                            <select id="member-team"
                              value={signupForm.teamId}
                              onChange={e => setSignupForm({ ...signupForm, teamId: e.target.value })}
                              className="form-select"
                            >
                              <option value="">Not sure, the club will place me</option>
                              {joinableTeams.map(t => (
                                <option key={t.id} value={t.id}>{t.name}{t.age_group && !t.name.includes(t.age_group) ? ` (${t.age_group})` : ''}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ marginBottom: '1rem' }}>
                      <label htmlFor="member-emergency-contact" className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                        {needsGuardian ? 'Emergency contact, if not the guardian (optional)' : 'Emergency contact, name and phone (optional)'}
                      </label>
                      <input id="member-emergency-contact"
                        type="text"
                        maxLength={255}
                        value={signupForm.emergencyContact}
                        onChange={e => setSignupForm({ ...signupForm, emergencyContact: e.target.value })}
                        placeholder="e.g. Jo Smith, 0400 000 000"
                        className="form-input"
                      />
                    </div>

                    {needsGuardian && (
                      <fieldset style={{ border: '1px solid rgba(139, 92, 246, 0.35)', background: 'rgba(139, 92, 246, 0.06)', borderRadius: '10px', padding: '1rem', margin: '0 0 1rem 0' }}>
                        <legend style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', padding: '0 0.35rem' }}>Parent / guardian</legend>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0' }}>
                          {juniorTeamPicked && !isMinor ? 'Junior team players need a parent or guardian on file.' : 'Applicants under 18 need a parent or guardian on file.'}
                          {' '}The club emails them, not the player, and they sign in with that email to see the player&apos;s membership, pay fees and message the club. One sign-in covers all their children.
                        </p>
                        <div className="form-row-2" style={{ gap: '1rem', marginBottom: '0.75rem' }}>
                          {([
                            ['guardianName', 'member-guardian-name', 'Name *', 'text', 255],
                            ['guardianPhone', 'member-guardian-phone', 'Phone *', 'tel', 64],
                          ] as const).map(([key, id, label, type, max]) => (
                            <div key={key}>
                              <label htmlFor={id} style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>{label}</label>
                              <input id={id} type={type} required maxLength={max} value={signupForm[key]}
                                onChange={e => setSignupForm({ ...signupForm, [key]: e.target.value })}
                                className="form-input" />
                            </div>
                          ))}
                        </div>
                        <div style={{ marginBottom: '0.75rem' }}>
                          <label htmlFor="member-guardian-email" className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>Email *</label>
                          <input id="member-guardian-email" type="email" required maxLength={255} value={signupForm.guardianEmail}
                            onChange={e => setSignupForm({ ...signupForm, guardianEmail: e.target.value })}
                            className="form-input" />
                        </div>
                        <div role="radiogroup" aria-labelledby="member-photo-consent-label" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <span id="member-photo-consent-label" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Can photos of the player appear on the club&apos;s public website? *</span>
                          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer' }}>
                            <input type="radio" name="member-photo-consent" value="yes" checked={signupForm.photoConsent === 'yes'} onChange={() => setSignupForm({ ...signupForm, photoConsent: 'yes' })} />
                            Yes
                          </label>
                          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer' }}>
                            <input type="radio" name="member-photo-consent" value="no" checked={signupForm.photoConsent === 'no'} onChange={() => setSignupForm({ ...signupForm, photoConsent: 'no' })} />
                            No, keep photos of them off the public site
                          </label>
                        </div>
                      </fieldset>
                    )}
                    </>)}

                    {joinStep === 3 && (<>
                    <div className="auth-summary">
                      <div>{addingChild ? 'Child' : 'Name'}: <strong>{signupForm.fullName || '-'}</strong></div>
                      <div>Email: <strong>{(needsGuardian ? signupForm.guardianEmail : signupForm.email) || '-'}</strong></div>
                      <div>Membership: <strong>{signupForm.tier}</strong>{(() => { const p = plans.find(x => x.name === signupForm.tier); return p && p.price_cents > 0 ? <> · <strong>{formatMoney(p.price_cents, currency)}</strong>, paid after you apply</> : null; })()}</div>
                      <div>Joining as: <strong>{signupForm.role === 'player' ? `Player${signupForm.position ? `, ${signupForm.position}` : ''}` : 'Supporter'}</strong></div>
                      <button type="button" className="auth-link" style={{ justifySelf: 'start', marginTop: '0.2rem' }} onClick={() => goJoinStep(1)}>Change details</button>
                    </div>

                    <div style={{ marginBottom: '1.25rem' }}>
                      <label htmlFor="member-motivation-amp-background-notes" className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                        Anything the committee should know? (optional)
                      </label>
                      <textarea id="member-motivation-amp-background-notes"
                        rows={2}
                        value={signupForm.notes}
                        onChange={e => setSignupForm({ ...signupForm, notes: e.target.value })}
                        placeholder="e.g. played for Westside last season, keen to help with the juniors"
                        className="form-textarea" style={{ resize: 'none' }}
                      />
                    </div>

                    {/* Consent: everyone accepts the terms; under-18s also need a parent or guardian */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <label style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start', cursor: 'pointer' }}>
                        <input type="checkbox" checked={signupForm.termsAccepted}
                          onChange={e => setSignupForm({ ...signupForm, termsAccepted: e.target.checked })} style={{ marginTop: '0.15rem' }} />
                        <span>
                          I agree to the{' '}
                          <a href={`${SITE_URL}/terms`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--club-ink)', fontWeight: 700 }}>terms</a>
                          {' '}and{' '}
                          <a href={`${SITE_URL}/privacy`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--club-ink)', fontWeight: 700 }}>privacy policy</a>,
                          {' '}and to {club.name} keeping my details for club membership. *
                        </span>
                      </label>
                      {needsGuardian && (
                        <label style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start', cursor: 'pointer' }}>
                          <input type="checkbox" checked={signupForm.guardianConsent}
                            onChange={e => setSignupForm({ ...signupForm, guardianConsent: e.target.checked })} style={{ marginTop: '0.15rem' }} />
                          <span>
                            I am this applicant&apos;s parent or guardian and I consent to them joining {club.name}. *
                          </span>
                        </label>
                      )}
                    </div>
                    </>)}
                    </div>

                    {signupError && <AuthAlert kind="error">{signupError}</AuthAlert>}

                    <div className="auth-step-nav">
                      {joinStep > 1 && (
                        <button type="button" className="btn btn-secondary" onClick={() => goJoinStep(joinStep - 1)}>
                          <ArrowLeft size={16} /><span>Back</span>
                        </button>
                      )}
                      {joinStep < 3 ? (
                        <button type="button" className="btn btn-primary auth-submit" style={{ flex: 1 }} onClick={e => {
                          const form = (e.currentTarget as HTMLButtonElement).form;
                          if (form && !form.reportValidity()) return;
                          setSignupError(null);
                          goJoinStep(joinStep + 1);
                        }}>
                          <span>Continue</span><ArrowRight size={17} />
                        </button>
                      ) : (
                        <div style={{ flex: 1 }}>
                          <SubmitButton busy={submitting} busyLabel="Sending...">
                            {reapplying ? 'Send my application again' : 'Send my application'}
                          </SubmitButton>
                        </div>
                      )}
                    </div>

                    {reapplying && (
                      <button type="button" onClick={() => setReapplying(false)} className="btn btn-secondary" style={{ width: '100%', marginTop: '0.75rem' }}>
                        Cancel
                      </button>
                    )}
                  </form>
                )}
              </>
            )}
              </div>
            </div>
            </>)}
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
                <PlayerAvatar photoUrl={activeMember.photo_url} name={activeMember.full_name} size={52} style={{ borderRadius: '14px', border: `2px solid ${club.primary_color}` }} />

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                      {activeMember.full_name}
                    </h2>
                    <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--c-green)', fontSize: '0.72rem', fontWeight: 800 }}>
                      ✓ VERIFIED MEMBER
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {activeMember.membership_tier} • {club.name} • Pass <code style={{ color: 'var(--club-ink)' }}>{passTokenHint(activeMember.qr_code_token)}</code>
                  </div>
                </div>
              </div>

              <div className="row row-loose">
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

            {/* Renewal: shown from 30 days before expiry */}
            {(() => {
              const paidPlans = plans.filter(p => p.price_cents > 0);
              if (!activeMember.membership_expires_at || !paidPlans.length) return null;
              const daysLeft = Math.ceil((new Date(activeMember.membership_expires_at).getTime() - Date.now()) / 86400000);
              if (daysLeft > 30) return null;
              const plan = paidPlans.find(p => p.id === renewPlanId)
                || paidPlans.find(p => p.name === activeMember.membership_tier)
                || paidPlans[0];
              return (
                <div id="renew-membership" className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '2rem', borderLeft: `4px solid ${daysLeft < 0 ? '#EF4444' : '#F59E0B'}` }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                        {daysLeft < 0 ? 'Your membership has expired' : `Your membership expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
                      </div>
                      <div className="text-note">
                        {/* Same rule as the payment: from today or the current expiry, whichever is later */}
                        Expiry date {activeMember.membership_expires_at}. Renewing now runs to{' '}
                        {membershipTermEnd([todayIso(), activeMember.membership_expires_at.slice(0, 10)].sort()[1], club, plan.duration_months)}.
                      </div>
                    </div>
                    {!renewOpen && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setRenewOpen(true)}>Renew membership</button>
                    )}
                  </div>
                  {renewOpen && (
                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <label className="form-label" htmlFor="renew-plan">Plan</label>
                      <select id="renew-plan" className="form-select" value={plan.id} onChange={e => setRenewPlanId(e.target.value)}>
                        {paidPlans.map(p => (
                          <option key={p.id} value={p.id}>{p.name}: {formatMoney(p.price_cents, currency)}</option>
                        ))}
                      </select>
                      <PaymentStep
                        key={plan.id}
                        clubId={club.id}
                        kind="membership_renewal"
                        memberId={activeMember.id}
                        planId={plan.id}
                        amountCents={plan.price_cents}
                        label={`Renew ${plan.name} (${plan.duration_months} months)`}
                      />
                    </div>
                  )}
                </div>
              );
            })()}

            {childMembers.length > 0 && signedInEmail && (
              <GuardianPortal club={club} childMembers={childMembers} guardianEmail={signedInEmail} plans={plans} currency={currency} signupPaid={childSignupPaid} onAddChild={startAddChild} />
            )}

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
                  color: activeClubhouseTab === 'pass' ? 'var(--text-primary)' : 'var(--text-secondary)',
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
                  color: activeClubhouseTab === 'stats' ? 'var(--text-primary)' : 'var(--text-secondary)',
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
                  color: activeClubhouseTab === 'messages' ? 'var(--text-primary)' : 'var(--text-secondary)',
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
                    fontSize: '0.7rem',
                    fontWeight: 900,
                  }}>
                    {memberMessagesList.length}
                  </span>
                )}
              </button>

              {/* Not a tab: the shop is its own page, so this links there */}
              {shopOpen && (
                <Link
                  href={`/${club.slug}/shop`}
                  style={{
                    padding: '0.65rem 1.25rem',
                    borderRadius: '8px',
                    border: '1px solid transparent',
                    color: 'var(--text-secondary)',
                    fontWeight: 800,
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                  }}
                >
                  <ShoppingBag size={17} />
                  <span>Club Shop</span>
                </Link>
              )}
            </div>

            {/* SUB-TAB 1: VIRTUAL PASS */}
            {activeClubhouseTab === 'pass' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '100%', maxWidth: '400px' }}>
                  <VirtualPassCard
                    club={club}
                    member={activeMember}
                    teams={passTeams}
                    nextMatch={passNextMatch}
                    onRenew={canRenew ? openRenewal : undefined}
                  />
                </div>
              </div>
            )}

            {/* SUB-TAB 2: SEASON STATS (CLUB'S & OWN) */}
            {activeClubhouseTab === 'stats' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                {/* Season picker: starts on the club's active season */}
                <div className="row" style={{ justifyContent: 'flex-end', marginBottom: '-1.25rem' }}>
                  <label htmlFor="member-stats-season" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700 }}>SEASON:</label>
                  <select
                    id="member-stats-season"
                    value={selectedSeason}
                    onChange={(e) => setStatsSeason(e.target.value)}
                    style={{
                      padding: '0.45rem 0.85rem',
                      background: 'rgba(var(--tint-rgb), 0.07)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {statsSeasonOptions.map(name => (
                      <option key={name} value={name} style={{ background: 'rgb(var(--dk-17-24-39))', color: 'var(--text-primary)' }}>
                        {name}{name === activeSeasonName ? ' (Active)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 1. Club's Season Performance Dashboard */}
                <div className="glass-panel" style={{ padding: '2rem', borderTop: `4px solid ${club.primary_color}` }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div>
                      <span className="badge badge-gold" style={{ marginBottom: '0.35rem' }}>SEASON {selectedSeason}</span>
                      <h3 style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Trophy size={22} color="var(--c-amber)" />
                        <span>{club.name} — Club Season Statistics</span>
                      </h3>
                    </div>

                    {/* Form Pills */}
                    <div className="row">
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
                    <div className="stat-tile">
                      <div className="eyebrow">Matches</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                        {clubSeasonStats.matchesPlayed}
                      </div>
                      <div className="text-meta">Played</div>
                    </div>

                    <div className="stat-tile">
                      <div className="eyebrow">Record</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 900, color: 'var(--c-green)' }}>
                        {clubSeasonStats.wins}W - {clubSeasonStats.draws}D - {clubSeasonStats.losses}L
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--c-green)' }}>{clubSeasonStats.winRate}% Win Rate</div>
                    </div>

                    <div className="stat-tile">
                      <div className="eyebrow">Goals</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                        {clubSeasonStats.goalsFor} : {clubSeasonStats.goalsAgainst}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: clubSeasonStats.goalDifference < 0 ? 'var(--c-red)' : 'var(--c-green)' }}>{clubSeasonStats.goalDifference > 0 ? '+' : ''}{clubSeasonStats.goalDifference} GD</div>
                    </div>

                    <div className="stat-tile">
                      <div className="eyebrow">Clean Sheets</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 900, color: 'var(--c-blue)' }}>
                        {clubSeasonStats.cleanSheets}
                      </div>
                      <div className="text-meta">Shutouts Kept</div>
                    </div>

                    <div className="stat-tile">
                      <div className="eyebrow">Club Top Scorer</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 900, color: 'var(--c-purple)', marginTop: '4px' }}>
                        {clubSeasonStats.topScorer?.name || 'No goals yet'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--c-purple)', fontWeight: 700 }}>{clubSeasonStats.topScorer?.goals || 0} Goals</div>
                    </div>
                  </div>
                </div>

                {/* 2. Personal Performance Dashboard */}
                <div className="glass-panel" style={{ padding: '2rem' }}>
                  <div className="section-head">
                    <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                    <div className="stat-tile">
                      <div className="eyebrow">Appearances</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                        {currentStats?.appearances || 0}
                      </div>
                    </div>

                    <div className="stat-tile">
                      <div className="eyebrow">Goals</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 900, color: 'var(--c-green)' }}>
                        {currentStats?.goals || 0}
                      </div>
                    </div>

                    <div className="stat-tile">
                      <div className="eyebrow">Assists</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 900, color: 'var(--c-amber)' }}>
                        {currentStats?.assists || 0}
                      </div>
                    </div>

                    <div className="stat-tile">
                      <div className="eyebrow">Clean Sheets</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 900, color: 'var(--c-blue)' }}>
                        {currentStats?.clean_sheets || 0}
                      </div>
                    </div>

                    <div className="stat-tile">
                      <div className="eyebrow">MOTM Awards</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.8rem', fontWeight: 900, color: 'var(--c-purple)' }}>
                        {currentStats?.motm_awards || 0}
                      </div>
                    </div>

                    <div className="stat-tile">
                      <div className="eyebrow">Discipline</div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 900, color: 'var(--c-red)', marginTop: '6px' }}>
                        {currentStats?.yellow_cards || 0}Y • {currentStats?.red_cards || 0}R
                      </div>
                    </div>
                  </div>

                  <div className="text-note">
                    Total Playing Minutes: <strong className="text-primary">{currentStats?.minutes_played || 0} mins</strong>
                  </div>
                </div>

                {/* 3. ClubScore Gamification Progress */}
                {!currentClubScore && clubScoreBreakdown.length === 0 && (
                  <div className="glass-panel" style={{ padding: '1.5rem 2rem' }}>
                    <span className="badge badge-gold row row-tight" style={{ marginBottom: '0.5rem' }}>
                      <Zap size={12} fill="#F59E0B" /> CLUBSCORE FANTASY
                    </span>
                    <p className="text-note" style={{ margin: 0 }}>No ClubScore points in {selectedSeason} yet.</p>
                  </div>
                )}
                {(currentClubScore || clubScoreBreakdown.length > 0) && (
                  <div className="glass-panel" style={{ padding: '2rem', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                          <span className="badge badge-gold row row-tight">
                            <Zap size={12} fill="#F59E0B" /> CLUBSCORE FANTASY
                          </span>
                          <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--c-sky)' }}>
                            {selectedSeason}
                          </span>
                        </div>
                        <h4 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                          Level &amp; Attendance Streak Hub
                        </h4>
                      </div>

                      {currentClubScore && <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'rgba(245, 158, 11, 0.12)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '8px',
                      }}>
                        <Crown size={16} color="var(--c-amber)" />
                        <span style={{ fontWeight: 800, color: 'var(--c-amber)', fontSize: '0.85rem' }}>
                          {currentClubScore.tier}
                        </span>
                      </div>}
                    </div>

                    {/* Level Progress Bar */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Total XP Points: <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>{seasonClubScoreTotal} PTS</strong>
                        </span>
                        {currentClubScore && selectedSeason === activeSeasonName && (
                          <span className="text-meta">
                            Streak: {liveStreak(currentClubScore)}w active
                          </span>
                        )}
                      </div>

                      <div style={{ width: '100%', height: '10px', background: 'rgba(var(--shade-rgb), 0.4)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, Math.max(15, (seasonClubScoreTotal / 500) * 100))}%`,
                            background: 'linear-gradient(90deg, var(--club-primary) 0%, #F59E0B 100%)',
                            borderRadius: '6px',
                            transition: 'width 0.5s ease',
                          }}
                        />
                      </div>
                    </div>

                    {/* Where the points came from */}
                    <div>
                      <div className="eyebrow" style={{ marginBottom: '0.5rem' }}>Points breakdown</div>
                      <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid var(--border-subtle)', borderRadius: '8px', overflow: 'hidden' }}>
                        {clubScoreBreakdown.map(row => (
                          <div
                            key={row.source}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.6rem 0.9rem', borderBottom: '1px solid var(--border-subtle)' }}
                          >
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                              {row.label}
                              {row.count > 0 && <span className="text-meta" style={{ marginLeft: '0.4rem' }}>× {row.count}</span>}
                            </span>
                            <strong style={{ fontSize: '0.9rem', color: row.points < 0 ? 'var(--c-red)' : 'var(--c-green)', whiteSpace: 'nowrap' }}>
                              {row.points > 0 ? '+' : ''}{row.points} PTS
                            </strong>
                          </div>
                        ))}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.6rem 0.9rem', background: 'rgba(var(--tint-rgb), 0.05)' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 800 }}>Total</span>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{seasonClubScoreTotal} PTS</strong>
                        </div>
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
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MessageSquare size={20} color="var(--c-blue)" />
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
                      color: 'var(--c-green)',
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
                      <label htmlFor="member-inquiry-category" className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                        Inquiry Category:
                      </label>
                      <select id="member-inquiry-category"
                        value={messageCategory}
                        onChange={e => setMessageCategory(e.target.value as MemberMessageCategory)}
                        className="form-select"
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
                      <label htmlFor="member-subject" className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                        Subject:
                      </label>
                      <input id="member-subject"
                        type="text"
                        required
                        value={messageSubject}
                        onChange={e => setMessageSubject(e.target.value)}
                        placeholder="e.g. Training session attendance question"
                        className="form-input"
                      />
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                      <label htmlFor="member-message" className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
                        Message:
                      </label>
                      <textarea id="member-message"
                        rows={4}
                        required
                        value={messageContent}
                        onChange={e => setMessageContent(e.target.value)}
                        placeholder="Type your message to the club administration..."
                        className="form-textarea" style={{ resize: 'none' }}
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
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
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
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: isAdmin ? 'var(--c-sky)' : 'var(--c-green)' }}>
                                {isAdmin ? `🏛️ ${msg.sender_name}`
                                  // A parent or guardian can write about this member too
                                  : msg.sender_email && activeMember.email && msg.sender_email.toLowerCase() !== activeMember.email.toLowerCase() ? `👤 ${msg.sender_name}`
                                  : `👤 You (${activeMember.full_name})`}
                              </span>
                              <span className="text-meta">
                                {new Date(msg.created_at).toLocaleTimeString(DATE_LOCALE, { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            {msg.subject && (
                              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                {msg.subject}
                              </div>
                            )}

                            <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.45, margin: 0 }}>
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
