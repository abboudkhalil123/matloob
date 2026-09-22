import { supabase } from "../lib/supabase";
import type { AdminSubscription } from "../types/subscription";

function requireSupabase() {
  if (!supabase) throw new Error("إعداد Supabase غير مكتمل.");
  return supabase;
}

function mapSubscription(row: Record<string, unknown>): AdminSubscription {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    supplier_name: (row.supplier_name as string | null) ?? null,
    company_name: (row.company_name as string | null) ?? null,
    business_type: (row.business_type as string | null) ?? null,
    plan_code: row.plan_code === "PRO" ? "PRO" : "FREE",
    plan_name: String(row.plan_name),
    status: row.status as AdminSubscription["status"],
    started_at: (row.started_at as string | null) ?? null,
    expires_at: (row.expires_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function isAdmin(): Promise<{ isAdmin: boolean; error: Error | null }> {
  try {
    const client = requireSupabase();
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError) return { isAdmin: false, error: userError };
    if (!userData.user) return { isAdmin: false, error: null };

    const { data, error } = await client.rpc("is_admin", { p_user_id: userData.user.id });
    return { isAdmin: Boolean(data), error };
  } catch (error) {
    return { isAdmin: false, error: error instanceof Error ? error : new Error("تعذر التحقق من صلاحية الإدارة.") };
  }
}

export async function getAdminSubscriptions(): Promise<{ subscriptions: AdminSubscription[]; error: Error | null }> {
  try {
    const { data, error } = await requireSupabase().rpc("get_admin_pro_subscriptions");
    return { subscriptions: (data ?? []).map((row: unknown) => mapSubscription(row as Record<string, unknown>)), error };
  } catch (error) {
    return { subscriptions: [], error: error instanceof Error ? error : new Error("تعذر تحميل اشتراكات PRO.") };
  }
}

export async function getPendingProSubscriptions(): Promise<{ subscriptions: AdminSubscription[]; error: Error | null }> {
  try {
    const { data, error } = await requireSupabase().rpc("get_admin_pending_pro_subscriptions");
    return { subscriptions: (data ?? []).map((row: unknown) => mapSubscription(row as Record<string, unknown>)), error };
  } catch (error) {
    return { subscriptions: [], error: error instanceof Error ? error : new Error("تعذر تحميل طلبات PRO المعلقة.") };
  }
}

export async function activateProSubscription(subscriptionId: string, startedAt?: string, expiresAt?: string) {
  const { data, error } = await requireSupabase().rpc("admin_activate_pro_subscription", {
    p_subscription_id: subscriptionId,
    p_started_at: startedAt ?? null,
    p_expires_at: expiresAt ?? null,
  });
  return { subscription: data ?? null, error };
}

export async function cancelProSubscription(subscriptionId: string) {
  const { data, error } = await requireSupabase().rpc("admin_cancel_pro_subscription", {
    p_subscription_id: subscriptionId,
  });
  return { subscription: data ?? null, error };
}

export async function extendProSubscription(subscriptionId: string, days: number) {
  const { data, error } = await requireSupabase().rpc("admin_extend_pro_subscription", {
    p_subscription_id: subscriptionId,
    p_days: days,
  });
  return { subscription: data ?? null, error };
}

export async function setProExpiration(subscriptionId: string, expiresAt: string) {
  const { data, error } = await requireSupabase().rpc("admin_set_pro_expiration", {
    p_subscription_id: subscriptionId,
    p_expires_at: expiresAt,
  });
  return { subscription: data ?? null, error };
}
