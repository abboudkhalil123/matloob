import { supabase } from "../lib/supabase";
import type { CreateOfferInput, Offer, UpdateOfferInput } from "../types/offer";

type OfferResult = { offer: Offer | null; error: Error | null };

const offerSelect = `
  id,
  request_id,
  supplier_id,
  price,
  currency,
  duration_value,
  duration_unit,
  details,
  payment_terms,
  notes,
  created_at,
  updated_at,
  supplier:supplier_profiles(id, company_name, business_type)
`;

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

async function getCurrentSupplierId(userId: string) {
  if (!supabase) return { supplierId: null, error: configError() };
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profileError) return { supplierId: null, error: profileError };
  if (profile?.role !== "supplier") return { supplierId: null, error: new Error("هذا الحساب ليس حساب مورد.") };

  const { data, error } = await supabase.from("supplier_profiles").select("id").eq("user_id", userId).maybeSingle();
  if (error) return { supplierId: null, error };
  if (!data?.id) return { supplierId: null, error: new Error("يجب إنشاء ملف المورد أولًا.") };
  return { supplierId: data.id as string, error: null };
}

export async function getOffersForRequest(requestId: string): Promise<{ offers: Offer[]; error: Error | null }> {
  if (!supabase) return { offers: [], error: configError() };
  const { data, error } = await supabase.from("offers").select(offerSelect).eq("request_id", requestId).order("created_at", { ascending: false });
  return { offers: (data as unknown as Offer[] | null) ?? [], error };
}

export async function getMyOffers(limit?: number): Promise<{ offers: Offer[]; error: Error | null }> {
  if (!supabase) return { offers: [], error: configError() };
  const { userId, error: userError } = await currentUserId();
  if (userError || !userId) return { offers: [], error: userError ?? new Error("يجب تسجيل الدخول أولًا.") };
  const { supplierId, error: supplierError } = await getCurrentSupplierId(userId);
  if (supplierError || !supplierId) return { offers: [], error: supplierError ?? new Error("ملف المورد غير موجود.") };
  let query = supabase.from("offers").select(offerSelect).eq("supplier_id", supplierId).order("created_at", { ascending: false });
  if (limit) query = query.limit(Math.min(100, Math.max(1, limit)));
  const { data, error } = await query;
  return { offers: (data as unknown as Offer[] | null) ?? [], error };
}

export async function getOfferById(id: string): Promise<OfferResult> {
  if (!supabase) return { offer: null, error: configError() };
  const { data, error } = await supabase.from("offers").select(offerSelect).eq("id", id).maybeSingle();
  return { offer: (data as unknown as Offer | null) ?? null, error };
}

export async function createOffer(data: CreateOfferInput): Promise<OfferResult> {
  if (!supabase) return { offer: null, error: configError() };
  const { userId, error: userError } = await currentUserId();
  if (userError || !userId) return { offer: null, error: userError ?? new Error("يجب تسجيل الدخول أولًا.") };
  const { supplierId, error: supplierError } = await getCurrentSupplierId(userId);
  if (supplierError || !supplierId) return { offer: null, error: supplierError ?? new Error("ملف المورد غير موجود.") };
  if (data.supplier_id !== supplierId) return { offer: null, error: new Error("لا يمكنك تقديم عرض باسم مورد آخر.") };

  const { data: request, error: requestError } = await supabase.from("requests").select("id, requester_id, status").eq("id", data.request_id).maybeSingle();
  if (requestError) return { offer: null, error: requestError };
  if (!request) return { offer: null, error: new Error("الطلب غير موجود.") };
  if (request.status !== "open") return { offer: null, error: new Error("لا يمكن تقديم عرض على طلب غير مفتوح.") };
  if (request.requester_id === userId) return { offer: null, error: new Error("لا يمكنك تقديم عرض على طلبك الخاص.") };

  const { data: created, error } = await supabase.from("offers").insert({ ...data, supplier_id: supplierId }).select(offerSelect).single();
  return { offer: (created as unknown as Offer | null) ?? null, error };
}

export async function updateOffer(id: string, changes: UpdateOfferInput): Promise<OfferResult> {
  if (!supabase) return { offer: null, error: configError() };
  const { userId, error: userError } = await currentUserId();
  if (userError || !userId) return { offer: null, error: userError ?? new Error("يجب تسجيل الدخول أولًا.") };
  const { supplierId, error: supplierError } = await getCurrentSupplierId(userId);
  if (supplierError || !supplierId) return { offer: null, error: supplierError ?? new Error("ملف المورد غير موجود.") };

  const { data: existing, error: existingError } = await supabase.from("offers").select("id, supplier_id, request_id").eq("id", id).maybeSingle();
  if (existingError) return { offer: null, error: existingError };
  if (!existing) return { offer: null, error: new Error("العرض غير موجود.") };
  if (existing.supplier_id !== supplierId) return { offer: null, error: new Error("لا يمكنك تعديل عرض مورد آخر.") };

  const { data: updated, error } = await supabase.from("offers").update(changes).eq("id", id).select(offerSelect).single();
  return { offer: (updated as unknown as Offer | null) ?? null, error };
}

export async function deleteOffer(id: string): Promise<{ error: Error | null }> {
  if (!supabase) return { error: configError() };
  const { userId, error: userError } = await currentUserId();
  if (userError || !userId) return { error: userError ?? new Error("يجب تسجيل الدخول أولًا.") };
  const { supplierId, error: supplierError } = await getCurrentSupplierId(userId);
  if (supplierError || !supplierId) return { error: supplierError ?? new Error("ملف المورد غير موجود.") };
  const { error } = await supabase.from("offers").delete().eq("id", id).eq("supplier_id", supplierId);
  return { error };
}
