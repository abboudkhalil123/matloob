import { supabase } from "../lib/supabase";
import type { Category, City } from "../types/request";
import type { SupplierCategory, SupplierProfile, SupplierProfileInput, SupplierWorkingHour } from "../types/supplier";

const profileSelect = "id, user_id, company_name, business_type, description, city_id, location_text, years_experience, phone, contact_info, verified, created_at, updated_at";

function configError() {
  return new Error("إعداد Supabase غير مكتمل.");
}

async function currentUserId() {
  if (!supabase) return { userId: null, error: configError() };
  const { data, error } = await supabase.auth.getUser();
  if (error) return { userId: null, error };
  if (!data.user) return { userId: null, error: new Error("يجب تسجيل الدخول أولًا.") };
  return { userId: data.user.id, error: null };
}

async function ensureSupplierRole(userId: string) {
  if (!supabase) return { error: configError() };
  const { data, error } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (error) return { error };
  if (data?.role !== "supplier") return { error: new Error("هذا الحساب ليس حساب مورد.") };
  return { error: null };
}

export async function getCurrentSupplierProfile(): Promise<{ profile: SupplierProfile | null; error: Error | null }> {
  const { userId, error: userError } = await currentUserId();
  if (userError || !userId || !supabase) return { profile: null, error: userError ?? configError() };
  const roleResult = await ensureSupplierRole(userId);
  if (roleResult.error) return { profile: null, error: roleResult.error };
  return getSupplierProfileForUserId(userId);
}

async function getSupplierProfileForUserId(userId: string) {
  if (!supabase) return { profile: null as SupplierProfile | null, error: configError() };
  const { data, error } = await supabase.from("supplier_profiles").select(profileSelect).eq("user_id", userId).maybeSingle();
  return { profile: (data as SupplierProfile | null) ?? null, error };
}

export async function createSupplierProfile(data: SupplierProfileInput): Promise<{ profile: SupplierProfile | null; error: Error | null }> {
  const { userId, error: userError } = await currentUserId();
  if (userError || !userId || !supabase) return { profile: null, error: userError ?? configError() };
  const roleResult = await ensureSupplierRole(userId);
  if (roleResult.error) return { profile: null, error: roleResult.error };
  const { data: created, error } = await supabase.from("supplier_profiles").insert({ ...data, user_id: userId }).select(profileSelect).single();
  return { profile: (created as SupplierProfile | null) ?? null, error };
}

export async function updateSupplierProfile(id: string, data: SupplierProfileInput): Promise<{ profile: SupplierProfile | null; error: Error | null }> {
  if (!supabase) return { profile: null, error: configError() };
  const { userId, error: userError } = await currentUserId();
  if (userError || !userId) return { profile: null, error: userError ?? new Error("يجب تسجيل الدخول أولًا.") };
  const roleResult = await ensureSupplierRole(userId);
  if (roleResult.error) return { profile: null, error: roleResult.error };
  const { data: updated, error } = await supabase.from("supplier_profiles").update(data).eq("id", id).eq("user_id", userId).select(profileSelect).single();
  return { profile: (updated as SupplierProfile | null) ?? null, error };
}

export async function deleteSupplierProfile(id: string): Promise<{ error: Error | null }> {
  if (!supabase) return { error: configError() };
  const { userId, error: userError } = await currentUserId();
  if (userError || !userId) return { error: userError ?? new Error("يجب تسجيل الدخول أولًا.") };
  const roleResult = await ensureSupplierRole(userId);
  if (roleResult.error) return { error: roleResult.error };
  const { error } = await supabase.from("supplier_profiles").delete().eq("id", id).eq("user_id", userId);
  return { error };
}

export async function getSupplierCategories(supplierId: string): Promise<{ categories: SupplierCategory[]; error: Error | null }> {
  if (!supabase) return { categories: [], error: configError() };
  const { data, error } = await supabase.from("supplier_categories").select("supplier_id, category_id, created_at, category:categories(id, name, slug, created_at, is_active)").eq("supplier_id", supplierId);
  return { categories: (data as unknown as SupplierCategory[] | null) ?? [], error };
}

export async function setSupplierCategories(supplierId: string, categoryIds: string[]): Promise<{ error: Error | null }> {
  if (!supabase) return { error: configError() };
  const { userId, error: userError } = await currentUserId();
  if (userError || !userId) return { error: userError ?? new Error("يجب تسجيل الدخول أولًا.") };
  const roleResult = await ensureSupplierRole(userId);
  if (roleResult.error) return { error: roleResult.error };
  const { error: deleteError } = await supabase.from("supplier_categories").delete().eq("supplier_id", supplierId);
  if (deleteError) return { error: deleteError };
  if (!categoryIds.length) return { error: null };
  const { error } = await supabase.from("supplier_categories").insert(categoryIds.map((categoryId) => ({ supplier_id: supplierId, category_id: categoryId })));
  return { error };
}

export async function getSupplierWorkingHours(supplierId: string): Promise<{ hours: SupplierWorkingHour[]; error: Error | null }> {
  if (!supabase) return { hours: [], error: configError() };
  const { data, error } = await supabase.from("supplier_working_hours").select("id, supplier_id, day_of_week, is_open, open_time, close_time, created_at, updated_at").eq("supplier_id", supplierId).order("day_of_week");
  return { hours: (data as SupplierWorkingHour[] | null) ?? [], error };
}

export async function setSupplierWorkingHours(supplierId: string, hours: Omit<SupplierWorkingHour, "id" | "created_at" | "updated_at">[]): Promise<{ error: Error | null }> {
  if (!supabase) return { error: configError() };
  const { userId, error: userError } = await currentUserId();
  if (userError || !userId) return { error: userError ?? new Error("يجب تسجيل الدخول أولًا.") };
  const roleResult = await ensureSupplierRole(userId);
  if (roleResult.error) return { error: roleResult.error };
  const { error: deleteError } = await supabase.from("supplier_working_hours").delete().eq("supplier_id", supplierId);
  if (deleteError) return { error: deleteError };
  if (!hours.length) return { error: null };
  const { error } = await supabase.from("supplier_working_hours").insert(hours);
  return { error };
}

export type SupplierDirectoryItem = Omit<SupplierProfile, "verified"> & {
  verified?: boolean;
  city: Pick<City, "id" | "name"> | null;
  categories: Category[];
  rating_average?: number | null;
  rating_count?: number;
  avatar_url?: string | null;
};

export type SupplierSearchOptions = {
  search?: string;
  categoryId?: string;
  cityId?: string;
  rating?: number;
  page?: number;
  pageSize?: number;
};

export async function getSupplierProfiles(options?: SupplierSearchOptions): Promise<{
  suppliers: SupplierDirectoryItem[];
  totalCount: number;
  hasNextPage: boolean;
  error: Error | null;
}> {
  if (!supabase) return { suppliers: [], totalCount: 0, hasNextPage: false, error: configError() };
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? 12));
  const { data, error } = await supabase.rpc("search_supplier_directory", {
    p_search: options?.search?.trim() || null,
    p_category_id: options?.categoryId || null,
    p_city_id: options?.cityId || null,
    p_min_rating: options?.rating ?? null,
    p_page: page,
    p_page_size: pageSize,
  });
  if (error) return { suppliers: [], totalCount: 0, hasNextPage: false, error };

  const rows = (data as Array<Record<string, unknown>> | null) ?? [];
  const totalCount = Number(rows[0]?.total_count ?? 0);
  const suppliers: SupplierDirectoryItem[] = rows.map((row) => ({
    id: String(row.id),
    user_id: String(row.user_id),
    company_name: (row.company_name as string | null) ?? null,
    business_type: (row.business_type as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    city_id: (row.city_id as string | null) ?? null,
    location_text: (row.location_text as string | null) ?? null,
    years_experience: (row.years_experience as number | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    contact_info: (row.contact_info as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    city: row.city_id ? { id: String(row.city_id), name: String(row.city_name ?? "") } : null,
    categories: Array.isArray(row.categories) ? row.categories as Category[] : [],
    rating_average: row.rating_average === null || row.rating_average === undefined ? null : Number(row.rating_average),
    rating_count: Number(row.rating_count ?? 0),
    avatar_url: null,
  }));

  // الصور العامة تأتي من ملف المستخدم، بينما دليل الموردين يعيد بيانات supplier_profiles.
  // نجلبها دفعةً واحدة عبر الاستعلامات العامة المتاحة دون تغيير بنية قاعدة البيانات.
  const avatarResults = await Promise.all(suppliers.map(async (supplier) => {
    const { data, error: avatarError } = await supabase!.rpc("get_public_profile", { p_user_id: supplier.user_id });
    if (avatarError) return { userId: supplier.user_id, avatarUrl: null as string | null };
    const row = Array.isArray(data) ? data[0] : data;
    return { userId: supplier.user_id, avatarUrl: (row as { avatar_url?: string | null } | null)?.avatar_url ?? null };
  }));
  const avatarMap = new Map(avatarResults.map((item) => [item.userId, item.avatarUrl]));
  suppliers.forEach((supplier) => { supplier.avatar_url = avatarMap.get(supplier.user_id) ?? null; });

  return { suppliers, totalCount, hasNextPage: page * pageSize < totalCount, error: null };
}

export async function getSupplierProfileById(id: string): Promise<{ profile: SupplierDirectoryItem | null; hours: SupplierWorkingHour[]; error: Error | null }> {
  if (!supabase) return { profile: null, hours: [], error: configError() };
  const { data, error } = await supabase.from("supplier_profiles").select(profileSelect).eq("id", id).maybeSingle();
  if (error) return { profile: null, hours: [], error };
  if (!data) return { profile: null, hours: [], error: null };
  const profile = data as SupplierProfile;
  const [categoryResult, hoursResult, cityResult] = await Promise.all([
    getSupplierCategories(id),
    getSupplierWorkingHours(id),
    profile.city_id ? supabase.from("cities").select("id, name, created_at, is_active").eq("id", profile.city_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (categoryResult.error) return { profile: null, hours: [], error: categoryResult.error };
  if (hoursResult.error) return { profile: null, hours: [], error: hoursResult.error };
  if (cityResult.error) return { profile: null, hours: [], error: cityResult.error };
  return {
    profile: { ...profile, city: (cityResult.data as City | null) ?? null, categories: categoryResult.categories.map((item) => ({ id: item.category?.id ?? item.category_id, name: item.category?.name ?? "", slug: item.category?.slug ?? "", created_at: item.category?.created_at ?? "", is_active: item.category?.is_active ?? true })) },
    hours: hoursResult.hours,
    error: null,
  };
}
