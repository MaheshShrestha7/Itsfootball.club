'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { User } from '@supabase/supabase-js';
import { ClubRole, toClubRole } from './supabase/types';
import { getSupabaseClient, isSupabaseConfigured } from './supabase/client';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  // club_id -> role. Read from the database (club owner / club_members), never from the browser.
  club_roles: Record<string, ClubRole>;
  created_at: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  /** Sign-up worked but the email address has to be confirmed before signing in */
  needsEmailConfirmation?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  signup: (email: string, fullName: string, password: string) => Promise<AuthResult>;
  /** Sends the sign-up confirmation email again */
  resendConfirmation: (email: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  getUserRoleForClub: (clubId: string) => ClubRole | null;
  hasClubAdminAccess: (clubId: string) => boolean;
  /** Shows a role in the UI straight away (e.g. right after creating a club). The database still decides what is allowed. */
  assignClubRole: (clubId: string, role: ClubRole) => void;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MIN_PASSWORD_LENGTH = 8;
// Browser-side leftovers from the old fake sign-in; removed on load
const LEGACY_AUTH_KEY = 'itsfootball_auth_session_v1';
const LEGACY_MEMBER_SESSION_PREFIX = 'itsfootball_member_session_';
const CLUB_STATE_KEY = 'itsfootball_state_v1';

/** Where the confirmation link in the sign-up email brings people back to (this site, not the Supabase default) */
const confirmRedirect = () => `${window.location.origin}/my-clubs`;

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Incorrect email or password.';
  if (m.includes('email not confirmed')) return 'Please confirm your email address first. Check your inbox for the link.';
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (m.includes('email rate limit')) {
    return 'The email service has hit its hourly sending limit, so no more confirmation emails can be sent for a while. Try again later, or ask the site owner to raise the limit.';
  }
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Please wait a minute and try again.';
  return message;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [dbRoles, setDbRoles] = useState<Record<string, ClubRole>>({});
  const [uiRoles, setUiRoles] = useState<Record<string, ClubRole>>({});
  const [isLoading, setIsLoading] = useState(true);

  const loadRoles = useCallback(async (userId: string) => {
    const client = getSupabaseClient();
    if (!client) return;
    // Links approved memberships made under this email (by a club admin) to the account, then
    // returns them. Falls back to already-linked rows if the migration isn't applied yet.
    const claimMemberships = async () => {
      const claimed = await client.rpc('claim_my_memberships');
      return claimed.error ? client.from('club_members').select('club_id, role').eq('user_id', userId) : claimed;
    };
    const [owned, memberships] = await Promise.all([
      client.from('clubs').select('id').eq('owner_id', userId),
      claimMemberships(),
    ]);

    const roles: Record<string, ClubRole> = {};
    // Squad roles are labels ('Player, Club Admin'), so map them to a permission level
    ((memberships.data || []) as { club_id: string; role: string }[]).forEach(row => {
      roles[row.club_id] = toClubRole(row.role);
    });
    (owned.data || []).forEach(row => {
      roles[row.id] = 'owner';
    });
    setDbRoles(roles);
    // Anything the database now confirms no longer needs a UI-only override
    setUiRoles(prev => Object.fromEntries(Object.entries(prev).filter(([id]) => !roles[id])));
  }, []);

  // Follow the Supabase session (the only source of truth for who is signed in)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(LEGACY_AUTH_KEY);
      Object.keys(localStorage)
        .filter(k => k.startsWith(LEGACY_MEMBER_SESSION_PREFIX))
        .forEach(k => localStorage.removeItem(k));
    } catch {
      // storage unavailable
    }

    const client = getSupabaseClient();
    if (!isSupabaseConfigured || !client) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const apply = async (user: User | null) => {
      if (cancelled) return;
      if (!user) {
        setAuthUser(null);
        setDbRoles({});
        setUiRoles({});
        setIsLoading(false);
        return;
      }
      setAuthUser(user);
      try {
        await loadRoles(user.id);
      } catch (err) {
        console.warn('Could not load club roles:', err);
      }
      if (!cancelled) setIsLoading(false);
    };

    client.auth.getSession().then(({ data }) => apply(data.session?.user ?? null));
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      // Deferred: Supabase calls made inside this callback can deadlock the auth client
      setTimeout(() => apply(session?.user ?? null), 0);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadRoles]);

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) return { success: false, error: 'Please enter a valid email address.' };
    if (!password) return { success: false, error: 'Please enter your password.' };

    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Sign-in is unavailable: the authentication service is not configured.' };

    const { error } = await client.auth.signInWithPassword({ email: cleanEmail, password });
    if (error) return { success: false, error: friendlyAuthError(error.message) };
    return { success: true };
  }, []);

  const signup = useCallback(async (email: string, fullName: string, password: string): Promise<AuthResult> => {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !fullName.trim()) {
      return { success: false, error: 'Please provide your full name and email.' };
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return { success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
    }

    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Sign-up is unavailable: the authentication service is not configured.' };

    const { data, error } = await client.auth.signUp({
      email: cleanEmail,
      password,
      // No roles here: user metadata can be edited by the user, so it must never grant access
      options: { data: { full_name: fullName.trim() }, emailRedirectTo: confirmRedirect() },
    });
    if (error) return { success: false, error: friendlyAuthError(error.message) };
    // With email confirmation switched on there is no session until the link is clicked
    if (!data.session) return { success: true, needsEmailConfirmation: true };
    return { success: true };
  }, []);

  const resendConfirmation = useCallback(async (email: string): Promise<AuthResult> => {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) return { success: false, error: 'Enter your email address first.' };
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'The authentication service is not configured.' };
    const { error } = await client.auth.resend({ type: 'signup', email: cleanEmail, options: { emailRedirectTo: confirmRedirect() } });
    return error ? { success: false, error: friendlyAuthError(error.message) } : { success: true };
  }, []);

  const logout = useCallback(async () => {
    const client = getSupabaseClient();
    try {
      await client?.auth.signOut();
    } finally {
      // Don't leave an admin's cached member details on a shared computer
      try {
        localStorage.removeItem(CLUB_STATE_KEY);
      } catch {
        // ignore
      }
      window.location.reload();
    }
  }, []);

  const clubRoles = useMemo(() => ({ ...dbRoles, ...uiRoles }), [dbRoles, uiRoles]);

  const user = useMemo<UserProfile | null>(() => {
    if (!authUser) return null;
    return {
      id: authUser.id,
      email: authUser.email || '',
      full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Member',
      avatar_url: authUser.user_metadata?.avatar_url,
      club_roles: clubRoles,
      created_at: authUser.created_at,
    };
  }, [authUser, clubRoles]);

  const getUserRoleForClub = useCallback(
    (clubId: string): ClubRole | null => (user ? user.club_roles[clubId] || null : null),
    [user]
  );

  const hasClubAdminAccess = useCallback(
    (clubId: string): boolean => {
      const role = getUserRoleForClub(clubId);
      return role === 'owner' || role === 'admin';
    },
    [getUserRoleForClub]
  );

  const assignClubRole = useCallback((clubId: string, role: ClubRole) => {
    setUiRoles(prev => ({ ...prev, [clubId]: role }));
  }, []);

  const refreshRoles = useCallback(async () => {
    if (authUser) await loadRoles(authUser.id);
  }, [authUser, loadRoles]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        resendConfirmation,
        logout,
        getUserRoleForClub,
        hasClubAdminAccess,
        assignClubRole,
        refreshRoles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
