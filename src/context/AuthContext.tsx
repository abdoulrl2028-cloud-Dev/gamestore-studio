import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';

import { messageFrom, supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

type AuthValue = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  error: string | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!supabase);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = async () => {
    if (!supabase || !session?.user) {
      setProfile(null);
      return;
    }
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, display_name, role')
      .eq('id', session.user.id)
      .maybeSingle();
    if (profileError) {
      setError(messageFrom(profileError));
      return;
    }
    setProfile(data as Profile | null);
  };

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setReady(true);
      })
      .catch((reason) => {
        if (!active) return;
        setError(messageFrom(reason));
        setReady(true);
      });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshProfile().catch((reason) => setError(messageFrom(reason)));
    }, 0);
    return () => clearTimeout(timer);
  }, [session?.user?.id]);

  const value = useMemo<AuthValue>(() => ({
    ready,
    session,
    profile,
    error,
    refreshProfile,
    signOut: async () => {
      if (!supabase) return;
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
    },
  }), [ready, session, profile, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('Autenticação indisponível.');
  return value;
}
