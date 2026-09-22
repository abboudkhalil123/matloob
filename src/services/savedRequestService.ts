import { supabase } from "../lib/supabase";
import type { SavedRequest } from "../types/savedRequest";
import type { RequestStatus } from "../types/request";

const configError = () => new Error("إعداد Supabase غير مكتمل.");

function mapSavedRequest(row: Record<string, unknown>): SavedRequest {
  const requestRow = row.request as Record<string, unknown> | null | undefined;
  const category = requestRow?.category as Record<string, unknown> | null | undefined;
  const city = requestRow?.city as Record<string, unknown> | null | undefined;

  return {
    id: String(row.id),
    supplierId: String(row.supplier_id),
    requestId: String(row.request_id),
    createdAt: String(row.created_at),
    request: requestRow ? {
      id: String(requestRow.id),
      title: String(requestRow.title),
      status: requestRow.status as RequestStatus,
      categoryId: String(requestRow.category_id),
      cityId: String(requestRow.city_id),
      createdAt: String(requestRow.created_at),
      category: category ? {
        id: String(category.id),
        name: String(category.name),
        slug: String(category.slug),
        created_at: String(category.created_at),
      } : null,
      city: city ? {
        id: String(city.id),
        name: String(city.name),
        created_at: String(city.created_at),
      } : null,
    } : null,
  };
}

export async function saveRequest(requestId: string): Promise<{ savedRequest: SavedRequest | null; error: Error | null }> {
  if (!supabase) return { savedRequest: null, error: configError() };
  if (!requestId.trim()) return { savedRequest: null, error: new Error("معرف الطلب غير صالح.") };

  const { data, error } = await supabase.rpc("save_request", { p_request_id: requestId });
  if (error) return { savedRequest: null, error };
  const row = Array.isArray(data) ? data[0] : data;
  return { savedRequest: row ? mapSavedRequest(row as Record<string, unknown>) : null, error: null };
}

export async function unsaveRequest(requestId: string): Promise<{ removed: boolean; error: Error | null }> {
  if (!supabase) return { removed: false, error: configError() };
  if (!requestId.trim()) return { removed: false, error: new Error("معرف الطلب غير صالح.") };
  const { data, error } = await supabase.rpc("unsave_request", { p_request_id: requestId });
  return { removed: Boolean(data), error };
}

export async function isRequestSaved(requestId: string): Promise<{ saved: boolean; error: Error | null }> {
  if (!supabase) return { saved: false, error: configError() };
  if (!requestId.trim()) return { saved: false, error: new Error("معرف الطلب غير صالح.") };
  const { data, error } = await supabase.rpc("is_request_saved", { p_request_id: requestId });
  return { saved: Boolean(data), error };
}

export async function getSavedRequests(options?: { page?: number; pageSize?: number }): Promise<{
  savedRequests: SavedRequest[];
  totalCount: number;
  hasNextPage: boolean;
  error: Error | null;
}> {
  if (!supabase) return { savedRequests: [], totalCount: 0, hasNextPage: false, error: configError() };

  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? 12));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await supabase
    .from("saved_requests")
    .select(`
      id,
      supplier_id,
      request_id,
      created_at,
      request:requests(
        id,
        title,
        status,
        category_id,
        city_id,
        created_at,
        category:categories(id,name,slug,created_at,is_active),
        city:cities(id,name,created_at,is_active)
      )
    `, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return { savedRequests: [], totalCount: 0, hasNextPage: false, error };
  const rows = (data as Array<Record<string, unknown>> | null) ?? [];
  const totalCount = count ?? 0;
  return {
    savedRequests: rows.map(mapSavedRequest),
    totalCount,
    hasNextPage: page * pageSize < totalCount,
    error: null,
  };
}
