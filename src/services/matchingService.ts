import { supabase } from "../lib/supabase";
import type { MatchingSupplier } from "../types/matching";

function configError() {
  return new Error("إعداد Supabase غير مكتمل.");
}

export async function getMatchingSuppliersForRequest(requestId: string): Promise<{
  suppliers: MatchingSupplier[];
  error: Error | null;
}> {
  if (!supabase) return { suppliers: [], error: configError() };
  if (!requestId) return { suppliers: [], error: new Error("معرّف الطلب مطلوب.") };

  const { data, error } = await supabase.rpc("get_matching_suppliers_for_request", {
    p_request_id: requestId,
  });

  if (error) return { suppliers: [], error };

  const rows = (data as Array<Record<string, unknown>> | null) ?? [];
  const suppliers = rows.map((row) => ({
    supplierId: String(row.supplier_id),
    companyName: (row.company_name as string | null) ?? null,
    businessType: (row.business_type as string | null) ?? null,
    cityId: (row.city_id as string | null) ?? null,
    verified: Boolean(row.verified),
    isPro: Boolean(row.is_pro),
    matchScore: Number(row.match_score ?? 0),
  }));

  return { suppliers, error: null };
}
