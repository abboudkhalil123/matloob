import type { Profile } from "../types/profile";
import { supabase } from "../lib/supabase";

export async function getCurrentProfile(): Promise<{ profile: Profile | null; error: Error | null }> {
  if (!supabase) {
    return { profile: null, error: new Error("إعداد Supabase غير مكتمل.") };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) return { profile: null, error: userError };
  if (!userData.user) return { profile: null, error: null };

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role, created_at, updated_at, is_active")
    .eq("id", userData.user.id)
    .maybeSingle();

  return { profile: (data as Profile | null) ?? null, error };
}

export async function updateCurrentProfile(
  changes: Pick<Profile, "full_name">,
): Promise<{ profile: Profile | null; error: Error | null }> {
  if (!supabase) {
    return { profile: null, error: new Error("إعداد Supabase غير مكتمل.") };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) return { profile: null, error: userError };
  if (!userData.user) return { profile: null, error: new Error("يجب تسجيل الدخول أولًا.") };

  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: changes.full_name })
    .eq("id", userData.user.id)
    .select("id, full_name, avatar_url, role, created_at, updated_at, is_active")
    .single();

  return { profile: (data as Profile | null) ?? null, error };
}
