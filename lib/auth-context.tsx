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

// Pre-configured demonstration personas for instant evaluation
export const DEMO_PERSONAS: Record<'owner' | 'player' | 'supporter', UserProfile> = {
  owner: {
    id: 'user-elena-vance-admin',
    email: 'admin@apexcityfc.club',
    full_name: 'Elena Vance',
    avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
    club_roles: {
      'club-apex-01': 'owner',
      'club-vanguard-01': 'owner',
      'all': 'owner', // Grants owner accreditation to newly created clubs in demo mode
    },
    created_at: '2024-01-01T00:00:00.000Z',
  },
  player: {
    id: 'user-julian-drake-player',
    email: 'julian.drake@apexcityfc.club',
    full_name: 'Julian Drake (#10)',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
    club_roles: {
      'club-apex-01': 'player',
    },
    created_at: '2024-01-15T00:00:00.000Z',
  },
  supporter: {
    id: 'user-lucas-fan',
    email: 'lucas.fan@football.club',
    full_name: 'Lucas Bennett',
    avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80',
    club_roles: {
      'club-apex-01': 'supporter',
    },
    created_at: '2024-02-01T00:00:00.000Z',
  },
};

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, fullName: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  getUserRoleForClub: (clubId: string) => ClubRole | null;
  hasClubAdminAccess: (clubId: string) => boolean;
  loginDemoUser: (role: 'owner' | 'player' | 'supporter') => void;
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

    const initAuth = async () => {
      // 1. If Supabase is connected, check real Supabase Auth session
      if (isSupabaseConfigured) {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user) {
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
      }

      // 2. Local session engine check
      try {
        const saved = localStorage.getItem(AUTH_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.email) {
            setUser(parsed);
          }
        }
      } catch (err) {
        console.warn('Could not restore auth session', err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
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

    // 1. Demo Persona lookup first for immediate testing
    if (trimmedEmail.includes('admin') || trimmedEmail.includes('vance') || trimmedEmail.includes('owner')) {
      persistUser(DEMO_PERSONAS.owner);
      return { success: true };
    }

    if (trimmedEmail.includes('player') || trimmedEmail.includes('drake')) {
      persistUser(DEMO_PERSONAS.player);
      return { success: true };
    }

    // 2. Supabase integration if configured
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

    // 3. Default registered local user
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

  // Quick 1-click persona switch for testing
  const loginDemoUser = useCallback((role: 'owner' | 'player' | 'supporter') => {
    persistUser(DEMO_PERSONAS[role]);
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
        loginDemoUser,
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
