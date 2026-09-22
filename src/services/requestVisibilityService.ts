import { supabase } from "../lib/supabase";

function getSupabaseError() {
  return new Error("إعداد Supabase غير مكتمل.");
}

export async function canSupplierViewRequest(requestId: string): Promise<{ allowed: boolean; error: Error | null }> {
  if (!supabase) return { allowed: false, error: getSupabaseError() };
  const { data, error } = await supabase.rpc("can_supplier_view_request", { p_request_id: requestId });
  return { allowed: Boolean(data), error };
}
