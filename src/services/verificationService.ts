import { supabase } from "../lib/supabase";
import type { VerificationRequest } from "../types/verification";

function requireSupabase() {
  if (!supabase) throw new Error("إعداد Supabase غير مكتمل.");
  return supabase;
}

function mapRequest(row: Record<string, unknown>): VerificationRequest {
  return {
    id: String(row.id),
    supplier_id: String(row.supplier_id),
    status: row.status as VerificationRequest["status"],
    notes: (row.notes as string | null) ?? null,
    admin_notes: (row.admin_notes as string | null) ?? null,
    reviewed_by: (row.reviewed_by as string | null) ?? null,
    reviewed_at: (row.reviewed_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    supplier_name: (row.supplier_name as string | null) ?? null,
    company_name: (row.company_name as string | null) ?? null,
    business_type: (row.business_type as string | null) ?? null,
    city_name: (row.city_name as string | null) ?? null,
    verified: row.verified == null ? undefined : Boolean(row.verified),
  };
}

export async function getMyVerificationRequest(): Promise<{ request: VerificationRequest | null; error: Error | null }> {
  try {
    const client = requireSupabase();
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError) return { request: null, error: userError };
    if (!userData.user) return { request: null, error: new Error("يجب تسجيل الدخول أولًا.") };
    const { data, error } = await client
      .from("verification_requests")
      .select("id, supplier_id, status, notes, admin_notes, reviewed_by, reviewed_at, created_at, updated_at")
      .eq("supplier_id", userData.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { request: data ? mapRequest(data as Record<string, unknown>) : null, error };
  } catch (error) {
    return { request: null, error: error instanceof Error ? error : new Error("تعذر تحميل حالة التوثيق.") };
  }
}

export async function createVerificationRequest(): Promise<{ request: VerificationRequest | null; error: Error | null }> {
  try {
    const { data, error } = await requireSupabase().rpc("create_verification_request");
    return { request: data ? mapRequest(data as Record<string, unknown>) : null, error };
  } catch (error) {
    return { request: null, error: error instanceof Error ? error : new Error("تعذر إرسال طلب التوثيق.") };
  }
}

export async function cancelVerificationRequest(requestId: string): Promise<{ request: VerificationRequest | null; error: Error | null }> {
  try {
    const { data, error } = await requireSupabase().rpc("cancel_verification_request", { p_request_id: requestId });
    return { request: data ? mapRequest(data as Record<string, unknown>) : null, error };
  } catch (error) {
    return { request: null, error: error instanceof Error ? error : new Error("تعذر إلغاء طلب التوثيق.") };
  }
}

export async function getAdminVerificationRequests(): Promise<{ requests: VerificationRequest[]; error: Error | null }> {
  try {
    const { data, error } = await requireSupabase().rpc("get_admin_verification_requests");
    return { requests: (data ?? []).map((row: unknown) => mapRequest(row as Record<string, unknown>)), error };
  } catch (error) {
    return { requests: [], error: error instanceof Error ? error : new Error("تعذر تحميل طلبات التوثيق.") };
  }
}

export async function approveVerificationRequest(requestId: string, adminNotes?: string): Promise<{ request: VerificationRequest | null; error: Error | null }> {
  try {
    const { data, error } = await requireSupabase().rpc("admin_approve_verification", {
      p_request_id: requestId,
      p_admin_notes: adminNotes?.trim() || null,
    });
    return { request: data ? mapRequest(data as Record<string, unknown>) : null, error };
  } catch (error) {
    return { request: null, error: error instanceof Error ? error : new Error("تعذر الموافقة على طلب التوثيق.") };
  }
}

export async function rejectVerificationRequest(requestId: string, adminNotes?: string): Promise<{ request: VerificationRequest | null; error: Error | null }> {
  try {
    const { data, error } = await requireSupabase().rpc("admin_reject_verification", {
      p_request_id: requestId,
      p_admin_notes: adminNotes?.trim() || null,
    });
    return { request: data ? mapRequest(data as Record<string, unknown>) : null, error };
  } catch (error) {
    return { request: null, error: error instanceof Error ? error : new Error("تعذر رفض طلب التوثيق.") };
  }
}
