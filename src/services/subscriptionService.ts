import { supabase } from "../lib/supabase";
import type { Subscription, SubscriptionPlan } from "../types/subscription";

function configError() {
  return new Error("إعداد Supabase غير مكتمل.");
}

export async function getSubscriptionPlans(): Promise<{ plans: SubscriptionPlan[]; error: Error | null }> {
  if (!supabase) return { plans: [], error: configError() };
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("id, code, name, price_syp, duration_days, is_active, created_at, updated_at")
    .eq("is_active", true)
    .order("price_syp", { ascending: true });
  return { plans: (data as SubscriptionPlan[] | null) ?? [], error };
}

export async function getCurrentSubscription(): Promise<{ subscription: Subscription | null; error: Error | null }> {
  if (!supabase) return { subscription: null, error: configError() };
  const { data, error } = await supabase.rpc("get_current_subscription");
  if (error) return { subscription: null, error };
  const row = Array.isArray(data) ? data[0] : data;
  return { subscription: (row as Subscription | undefined) ?? null, error: null };
}

export async function hasActiveProSubscription(): Promise<{ isPro: boolean; error: Error | null }> {
  if (!supabase) return { isPro: false, error: configError() };
  const { data, error } = await supabase.auth.getUser();
  if (error) return { isPro: false, error };
  if (!data.user) return { isPro: false, error: new Error("يجب تسجيل الدخول أولًا.") };
  const result = await supabase.rpc("has_active_pro_subscription", { p_user_id: data.user.id });
  return { isPro: Boolean(result.data), error: result.error };
}

export async function createProSubscriptionRequest(): Promise<{ subscriptionId: string | null; error: Error | null }> {
  if (!supabase) return { subscriptionId: null, error: configError() };
  const { data, error } = await supabase.rpc("create_pro_subscription_request");
  return { subscriptionId: (data as string | null) ?? null, error };
}
