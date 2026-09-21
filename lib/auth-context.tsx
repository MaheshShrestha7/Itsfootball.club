'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ClubRole } from './supabase/types';
import { getSupabaseClient, isSupabaseConfigured } from './supabase/client';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  // Map of club_id -> ClubRole ('owner' | 'admin' | 'staff' | 'player' | 'member' | 'supporter')
  club_roles: Record<string, ClubRole>;
  created_at: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, fullName: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  getUserRoleForClub: (clubId: string) => ClubRole | null;
  hasClubAdminAccess: (clubId: string) => boolean;
  assignClubRole: (clubId: string, role: ClubRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'itsfootball_auth_session_v1';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize session from localStorage or Supabase
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let isMounted = true;

    const initAuth = async () => {
      // 1. If Supabase is connected, check real Supabase Auth session with safety timeout
      if (isSupabaseConfigured) {
        try {
          const supabase = getSupabaseClient();
          if (supabase) {
            // Guard with a 1500ms timeout so network latency never hangs the app
            const sessionPromise = supabase.auth.getSession();
            const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
              setTimeout(() => resolve({ data: { session: null } }), 1500)
            );
            const { data } = await Promise.race([sessionPromise, timeoutPromise]);
            if (data?.session?.user && isMounted) {
              const authUser = data.session.user;
              setUser({
                id: authUser.id,
                email: authUser.email || '',
                full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Member',
                avatar_url: authUser.user_metadata?.avatar_url,
                club_roles: authUser.user_metadata?.club_roles || { all: 'owner' },
                created_at: authUser.created_at,
              });
              setIsLoading(false);
              return;
            }
          }
        } catch (supabaseErr) {
          console.warn('Supabase session lookup skipped/failed:', supabaseErr);
        }
      }

      // 2. Local session engine check
      try {
        const saved = localStorage.getItem(AUTH_STORAGE_KEY);
        if (saved && isMounted) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.email) {
            setUser(parsed);
          }
        }
      } catch (err) {
        console.warn('Could not restore auth session', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync session across browser tabs
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === AUTH_STORAGE_KEY) {
        if (e.newValue) {
          try {
            setUser(JSON.parse(e.newValue));
          } catch {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Save session updates to localStorage
  const persistUser = useCallback((u: UserProfile | null) => {
    setUser(u);
    if (typeof window !== 'undefined') {
      if (u) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(u));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
  }, []);

  // Login method
  const login = useCallback(async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedEmail = email.toLowerCase().trim();

    if (!trimmedEmail) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    // 1. Supabase integration if configured
    if (isSupabaseConfigured && password) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
          });

          if (!error && data.user) {
            const authUser = data.user;
            const userObj: UserProfile = {
              id: authUser.id,
              email: authUser.email || trimmedEmail,
              full_name: authUser.user_metadata?.full_name || trimmedEmail.split('@')[0],
              avatar_url: authUser.user_metadata?.avatar_url,
              club_roles: authUser.user_metadata?.club_roles || {},
              created_at: authUser.created_at,
            };
            persistUser(userObj);
            return { success: true };
          }
        } catch (err) {
          console.warn('Supabase sign-in fallback:', err);
        }
      }
    }

    // 2. Default registered local user
    const defaultUser: UserProfile = {
      id: `user-${Date.now()}`,
      email: trimmedEmail,
      full_name: trimmedEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      club_roles: {},
      created_at: new Date().toISOString(),
    };

    persistUser(defaultUser);
    return { success: true };
  }, [persistUser]);

  // Signup method
  const signup = useCallback(async (email: string, fullName: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedEmail = email.toLowerCase().trim();
    if (!trimmedEmail || !fullName.trim()) {
      return { success: false, error: 'Please provide full name and email.' };
    }

    if (isSupabaseConfigured && password) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data, error } = await supabase.auth.signUp({
            email: trimmedEmail,
            password,
            options: {
              data: {
                full_name: fullName.trim(),
                club_roles: {},
              },
            },
          });

          if (!error && data.user) {
            const userObj: UserProfile = {
              id: data.user.id,
              email: trimmedEmail,
              full_name: fullName.trim(),
              club_roles: {},
              created_at: new Date().toISOString(),
            };
            persistUser(userObj);
            return { success: true };
          }
        } catch (err) {
          console.warn('Supabase sign-up fallback:', err);
        }
      }
    }

    const newUser: UserProfile = {
      id: `user-${Date.now()}`,
      email: trimmedEmail,
      full_name: fullName.trim(),
      club_roles: {},
      created_at: new Date().toISOString(),
    };

    persistUser(newUser);
    return { success: true };
  }, [persistUser]);

  // Logout method
  const logout = useCallback(() => {
    if (isSupabaseConfigured) {
      const supabase = getSupabaseClient();
      supabase?.auth.signOut();
    }
    persistUser(null);
  }, [persistUser]);

  // Role resolution for a specific club
  const getUserRoleForClub = useCallback((clubId: string): ClubRole | null => {
    if (!user) return null;
    if (user.club_roles['all']) return user.club_roles['all'];
    return user.club_roles[clubId] || null;
  }, [user]);

  // Checks if user has admin/owner accreditation for this club
  const hasClubAdminAccess = useCallback((clubId: string): boolean => {
    if (!user) return false;
    const role = getUserRoleForClub(clubId);
    return role === 'owner' || role === 'admin';
  }, [user, getUserRoleForClub]);

  // Assign or claim role for a club in user's active session profile
  const assignClubRole = useCallback((clubId: string, role: ClubRole) => {
    if (!user) return;
    const updatedUser: UserProfile = {
      ...user,
      club_roles: {
        ...user.club_roles,
        [clubId]: role,
      },
    };
    persistUser(updatedUser);
  }, [user, persistUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        getUserRoleForClub,
        hasClubAdminAccess,
        assignClubRole,
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
