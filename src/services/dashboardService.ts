import { supabase } from "../lib/supabase";
import type { DashboardOffer, DashboardRequest } from "../types/dashboard";
import type { RequestStatus } from "../types/request";

function configError() {
  return new Error("إعداد Supabase غير مكتمل.");
}

function mapRequest(row: Record<string, unknown>): DashboardRequest {
  const category = row.category as { name?: string | null } | null | undefined;
  const city = row.city as { name?: string | null } | null | undefined;
  const offers = row.offers as Array<{ count?: number }> | undefined;
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    status: row.status as RequestStatus,
    createdAt: String(row.created_at),
    categoryName: category?.name ?? null,
    cityName: city?.name ?? null,
    offerCount: Number(offers?.[0]?.count ?? 0),
  };
}

async function countRequests(userId: string, status?: RequestStatus) {
  if (!supabase) return { count: 0, error: configError() };
  let query = supabase.from("requests").select("id", { count: "exact", head: true }).eq("requester_id", userId);
  if (status) query = query.eq("status", status);
  const { count, error } = await query;
  return { count: count ?? 0, error };
}

export async function getRequesterDashboardData(userId: string) {
  if (!supabase) return { stats: null, latestRequests: [], actionRequests: [], error: configError() };
  const [total, open, inProgress, completed, cancelled, latest] = await Promise.all([
    countRequests(userId),
    countRequests(userId, "open"),
    countRequests(userId, "in_progress"),
    countRequests(userId, "completed"),
    countRequests(userId, "cancelled"),
    supabase.from("requests").select(`id, title, status, created_at, category:categories(name), city:cities(name)`).eq("requester_id", userId).order("created_at", { ascending: false }).limit(5),
  ]);
  const firstError = [total, open, inProgress, completed, cancelled].find((item) => item.error)?.error ?? latest.error;
  if (firstError) return { stats: null, latestRequests: [], actionRequests: [], error: firstError };

  const latestRows = ((latest.data as Array<Record<string, unknown>> | null) ?? []);
  const latestRequests = latestRows.map(mapRequest);

  let actionRequests: DashboardRequest[] = [];
  if (latestRequests.length) {
    const { data: offerRows, error: offerError } = await supabase.rpc("get_requester_offer_counts", { p_request_ids: latestRequests.map((item) => item.id) });
    if (!offerError) {
      const counts = new Map<string, number>();
      for (const row of ((offerRows as Array<{ request_id: string; offer_count: number }> | null) ?? [])) counts.set(row.request_id, Number(row.offer_count ?? 0));
      for (const item of latestRequests) item.offerCount = counts.get(item.id) ?? 0;
    }
    actionRequests = latestRequests.filter((item) => item.status === "open" && item.offerCount > 0);
  }
  return {
    stats: {
      total: total.count,
      open: open.count,
      inProgress: inProgress.count,
      completed: completed.count,
      cancelled: cancelled.count,
    },
    latestRequests,
    actionRequests,
    error: null,
  };
}

async function countSupplierOffers(supplierId: string, status?: RequestStatus) {
  if (!supabase) return { count: 0, error: configError() };
  const { data, error } = await supabase.rpc("get_supplier_dashboard_stats", { p_supplier_id: supplierId });
  if (error) return { count: 0, error };
  const row = Array.isArray(data) ? data[0] : data;
  const key = status === "supplier_selected" ? "selected" : status === "in_progress" ? "in_progress" : status === "completed" ? "completed" : "offers";
  return { count: Number((row as Record<string, unknown> | null)?.[key] ?? 0), error: null };
}

export async function getSupplierDashboardStats(supplierId: string) {
  if (!supabase) return { stats: null, error: configError() };
  const { data, error } = await supabase.rpc("get_supplier_dashboard_stats", { p_supplier_id: supplierId });
  if (error) return { stats: null, error };
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  return {
    stats: {
      offers: Number(row?.offers ?? 0),
      selected: Number(row?.selected ?? 0),
      inProgress: Number(row?.in_progress ?? 0),
      completed: Number(row?.completed ?? 0),
    },
    error: null,
  };
}

export async function getSupplierLatestOffers(supplierId: string, limit = 5): Promise<{ offers: DashboardOffer[]; error: Error | null }> {
  if (!supabase) return { offers: [], error: configError() };
  const { data, error } = await supabase.rpc("get_supplier_latest_offers", { p_supplier_id: supplierId, p_limit: limit });
  if (error) return { offers: [], error };
  const rows = (data as Array<Record<string, unknown>> | null) ?? [];
  return {
    offers: rows.map((row) => ({
      id: String(row.id),
      requestId: String(row.request_id),
      requestTitle: (row.request_title as string | null) ?? null,
      requestStatus: (row.request_status as RequestStatus | null) ?? null,
      price: Number(row.price ?? 0),
      currency: String(row.currency ?? ""),
      durationValue: row.duration_value == null ? null : Number(row.duration_value),
      durationUnit: (row.duration_unit as string | null) ?? null,
      createdAt: String(row.created_at),
    })),
    error: null,
  };
}
