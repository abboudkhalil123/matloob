import { supabase } from "../lib/supabase";
import type { CreateSupplierReviewInput, Review, SupplierRating } from "../types/review";

function getSupabaseError() {
  return new Error("إعداد Supabase غير مكتمل.");
}

const reviewSelect = "id, request_id, reviewed_supplier_id, rating, comment, created_at, updated_at";

export async function getSupplierReviews(supplierId: string): Promise<{ reviews: Review[]; error: Error | null }> {
  if (!supabase) return { reviews: [], error: getSupabaseError() };
  const { data, error } = await supabase
    .from("reviews")
    .select(reviewSelect)
    .eq("reviewed_supplier_id", supplierId)
    .order("created_at", { ascending: false });
  return { reviews: (data as Review[] | null) ?? [], error };
}

export async function getSupplierRating(supplierId: string): Promise<{ rating: SupplierRating; error: Error | null }> {
  if (!supabase) return { rating: { average: null, count: 0 }, error: getSupabaseError() };
  const { data, error } = await supabase
    .from("reviews")
    .select("rating")
    .eq("reviewed_supplier_id", supplierId);
  if (error) return { rating: { average: null, count: 0 }, error };
  const ratings = (data as Array<{ rating: number }> | null) ?? [];
  if (!ratings.length) return { rating: { average: null, count: 0 }, error: null };
  const average = ratings.reduce((sum, item) => sum + item.rating, 0) / ratings.length;
  return { rating: { average, count: ratings.length }, error: null };
}

export async function hasReviewedRequest(requestId: string): Promise<{ reviewed: boolean; error: Error | null }> {
  if (!supabase) return { reviewed: false, error: getSupabaseError() };
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) return { reviewed: false, error: userError };
  if (!userData.user) return { reviewed: false, error: null };
  const { data, error } = await supabase
    .from("reviews")
    .select("id")
    .eq("request_id", requestId)
    .eq("reviewer_id", userData.user.id)
    .maybeSingle();
  if (error) return { reviewed: false, error };
  return { reviewed: Boolean(data), error: null };
}

export async function createSupplierReview(input: CreateSupplierReviewInput): Promise<{ review: Review | null; error: Error | null }> {
  if (!supabase) return { review: null, error: getSupabaseError() };
  const { data, error } = await supabase.rpc("create_supplier_review", {
    p_request_id: input.request_id,
    p_rating: input.rating,
    p_comment: input.comment?.trim() || null,
  });
  if (error) return { review: null, error };
  const review = Array.isArray(data) ? data[0] : data;
  return { review: (review as Review | null) ?? null, error: null };
}
