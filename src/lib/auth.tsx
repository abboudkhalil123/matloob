import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { getCurrentProfile } from "../services/profileService";
import type { Profile } from "../types/profile";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  profileLoading: boolean;
  configured: boolean;
  signOut: () => Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session);
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
      if (!nextSession) setProfile(null);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!supabase || !session?.user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    void getCurrentProfile().then(async ({ profile: currentProfile }) => {
      if (!active) return;
      if (currentProfile && currentProfile.is_active === false) {
        setProfile(null);
        setProfileLoading(false);
        await supabase.auth.signOut();
        window.alert("تم إيقاف هذا الحساب من قبل الإدارة.");
        return;
      }
      setProfile(currentProfile);
      setProfileLoading(false);
    });

    return () => {
      active = false;
    };
  }, [session]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    profileLoading,
    configured: Boolean(supabase),
    signOut: async () => {
      if (!supabase) {
        return { error: new Error("إعداد Supabase غير مكتمل.") };
      }
      const { error } = await supabase.auth.signOut();
      return { error };
    },
  }), [loading, profile, profileLoading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth يجب أن يُستخدم داخل AuthProvider.");
  return context;
}
