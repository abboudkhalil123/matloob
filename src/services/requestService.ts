import { supabase } from "../lib/supabase";
import type {
  Category,
  City,
  CreateRequestInput,
  Request,
  RequestStatus,
  UpdateRequestInput,
} from "../types/request";

const requestSelect = `
  id,
  requester_id,
  title,
  category_id,
  description,
  quantity,
  unit,
  city_id,
  delivery_area,
  deadline,
  budget,
  preferred_contact,
  phone,
  status,
  selected_offer_id,
  created_at,
  updated_at,
  category:categories(id, name, slug, created_at, is_active),
  city:cities(id, name, created_at, is_active)
`;

function getSupabaseError() {
  return new Error("إعداد Supabase غير مكتمل.");
}

export async function getCategories(): Promise<{ categories: Category[]; error: Error | null }> {
  if (!supabase) return { categories: [], error: getSupabaseError() };
  const { data, error } = await supabase.from("categories").select("id, name, slug, created_at, is_active, sort_order").eq("is_active", true).order("sort_order", { ascending: true }).order("id", { ascending: true });
  return { categories: (data as Category[] | null) ?? [], error };
}

export async function getCities(): Promise<{ cities: City[]; error: Error | null }> {
  if (!supabase) return { cities: [], error: getSupabaseError() };
  const { data, error } = await supabase.from("cities").select("id, name, created_at, is_active").eq("is_active", true).order("name");
  return { cities: (data as City[] | null) ?? [], error };
}

export type RequestSearchOptions = {
  search?: string;
  categoryId?: string;
  cityId?: string;
  status?: RequestStatus;
  minQuantity?: number;
  deliveryBefore?: string;
  ascending?: boolean;
  page?: number;
  pageSize?: number;
};

export async function getRequests(options?: RequestSearchOptions): Promise<{
  requests: Request[];
  totalCount: number;
  hasNextPage: boolean;
  error: Error | null;
}> {
  if (!supabase) return { requests: [], totalCount: 0, hasNextPage: false, error: getSupabaseError() };

  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? 12));
  const { data, error } = await supabase.rpc("search_requests", {
    p_search: options?.search?.trim() || null,
    p_category_id: options?.categoryId || null,
    p_city_id: options?.cityId || null,
    p_status: options?.status || null,
    p_min_quantity: options?.minQuantity ?? null,
    p_delivery_before: options?.deliveryBefore || null,
    p_ascending: options?.ascending ?? false,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) return { requests: [], totalCount: 0, hasNextPage: false, error };
  const rows = (data as Array<Record<string, unknown>> | null) ?? [];
  const totalCount = Number(rows[0]?.total_count ?? 0);
  const requests = rows.map((row) => ({
    ...row,
    category: undefined,
    city: undefined,
  })) as unknown as Request[];
  return { requests, totalCount, hasNextPage: page * pageSize < totalCount, error: null };
}

export async function getRequestById(id: string): Promise<{ request: Request | null; error: Error | null }> {
  if (!supabase) return { request: null, error: getSupabaseError() };
  const { data, error } = await supabase.from("requests").select(requestSelect).eq("id", id).maybeSingle();
  return { request: (data as unknown as Request | null) ?? null, error };
}

async function getCurrentUserId() {
  if (!supabase) return { userId: null, error: getSupabaseError() };
  const { data, error } = await supabase.auth.getUser();
  if (error) return { userId: null, error };
  if (!data.user) return { userId: null, error: new Error("يجب تسجيل الدخول أولًا.") };
  return { userId: data.user.id, error: null };
}

export async function createRequest(data: CreateRequestInput): Promise<{ request: Request | null; error: Error | null }> {
  if (!supabase) return { request: null, error: getSupabaseError() };
  const { userId, error: userError } = await getCurrentUserId();
  if (userError || !userId) return { request: null, error: userError ?? new Error("يجب تسجيل الدخول أولًا.") };

  const { data: created, error } = await supabase
    .from("requests")
    .insert({ ...data, requester_id: userId })
    .select(requestSelect)
    .single();

  return { request: (created as unknown as Request | null) ?? null, error };
}

export async function updateRequest(id: string, changes: UpdateRequestInput): Promise<{ request: Request | null; error: Error | null }> {
  if (!supabase) return { request: null, error: getSupabaseError() };
  const { data, error } = await supabase
    .from("requests")
    .update(changes)
    .eq("id", id)
    .select(requestSelect)
    .single();
  return { request: (data as unknown as Request | null) ?? null, error };
}

export async function deleteRequest(id: string): Promise<{ error: Error | null }> {
  if (!supabase) return { error: getSupabaseError() };
  const { error } = await supabase.from("requests").delete().eq("id", id);
  return { error };
}
export async function selectOffer(requestId: string, offerId: string): Promise<{ request: Request | null; error: Error | null }> {
  if (!supabase) return { request: null, error: getSupabaseError() };

  const { data, error } = await supabase.rpc("select_offer_for_request", {
    p_request_id: requestId,
    p_offer_id: offerId,
  });

  if (error) return { request: null, error };

  const selected = Array.isArray(data) ? data[0] : data;
  if (!selected) return { request: null, error: new Error("تعذر تثبيت العرض المختار.") };

  return { request: selected as Request, error: null };
}
export async function startRequestExecution(requestId: string): Promise<{ request: Request | null; error: Error | null }> {
  if (!supabase) return { request: null, error: getSupabaseError() };
  const { data, error } = await supabase.rpc("start_request_execution", { p_request_id: requestId });
  if (error) return { request: null, error };
  const result = Array.isArray(data) ? data[0] : data;
  return { request: (result as Request | null) ?? null, error: null };
}

export async function completeRequest(requestId: string): Promise<{ request: Request | null; error: Error | null }> {
  if (!supabase) return { request: null, error: getSupabaseError() };
  const { data, error } = await supabase.rpc("complete_request", { p_request_id: requestId });
  if (error) return { request: null, error };
  const result = Array.isArray(data) ? data[0] : data;
  return { request: (result as Request | null) ?? null, error: null };
}

export async function closeRequest(requestId: string): Promise<{ request: Request | null; error: Error | null }> {
  if (!supabase) return { request: null, error: getSupabaseError() };
  const { data, error } = await supabase.rpc("close_request", { p_request_id: requestId });
  if (error) return { request: null, error };
  const result = Array.isArray(data) ? data[0] : data;
  return { request: (result as Request | null) ?? null, error: null };
}

export async function cancelRequest(requestId: string): Promise<{ request: Request | null; error: Error | null }> {
  if (!supabase) return { request: null, error: getSupabaseError() };
  const { data, error } = await supabase.rpc("cancel_request", { p_request_id: requestId });
  if (error) return { request: null, error };
  const result = Array.isArray(data) ? data[0] : data;
  return { request: (result as Request | null) ?? null, error: null };
}
