import { supabase } from "../lib/supabase";
import type { AdminRequest, AdminStats, AdminSupplier, AdminUser } from "../types/admin";
import type { RequestStatus } from "../types/request";

function configError() { return new Error("إعداد Supabase غير مكتمل."); }

export async function getAdminStats(): Promise<{ stats: AdminStats | null; error: Error | null }> {
  if (!supabase) return { stats: null, error: configError() };
  const { data, error } = await supabase.rpc("get_admin_stats");
  if (error) return { stats: null, error };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { stats: null, error: new Error("تعذر تحميل إحصائيات الإدارة.") };
  return { stats: {
    totalUsers: Number(row.total_users ?? 0), requesterUsers: Number(row.requester_users ?? 0), supplierUsers: Number(row.supplier_users ?? 0),
    totalRequests: Number(row.total_requests ?? 0), openRequests: Number(row.open_requests ?? 0), completedRequests: Number(row.completed_requests ?? 0),
    totalOffers: Number(row.total_offers ?? 0), verifiedSuppliers: Number(row.verified_suppliers ?? 0), activeProSubscriptions: Number(row.active_pro_subscriptions ?? 0),
    pendingVerificationRequests: Number(row.pending_verification_requests ?? 0), pendingProSubscriptions: Number(row.pending_pro_subscriptions ?? 0),
  }, error: null };
}

export async function getAdminUsers(options: { search?: string; role?: "requester" | "supplier"; verified?: boolean; page?: number; pageSize?: number } = {}) {
  if (!supabase) return { users: [], totalCount: 0, hasNextPage: false, error: configError() };
  const page = Math.max(1, options.page ?? 1); const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 12));
  const { data, error } = await supabase.rpc("get_admin_users", { p_search: options.search?.trim() || null, p_role: options.role || null, p_verified: options.verified ?? null, p_page: page, p_page_size: pageSize });
  if (error) return { users: [] as AdminUser[], totalCount: 0, hasNextPage: false, error };
  const rows = (data ?? []) as Array<Record<string, unknown>>; const totalCount = Number(rows[0]?.total_count ?? 0);
  const users = rows.map((r) => ({ id: String(r.id), fullName: (r.full_name as string | null) ?? null, role: r.role as AdminUser["role"], createdAt: String(r.created_at), hasSupplierProfile: Boolean(r.has_supplier_profile), verified: Boolean(r.verified), proStatus: (r.pro_status as AdminUser["proStatus"]) ?? null, proExpiresAt: (r.pro_expires_at as string | null) ?? null, isActive: r.is_active !== false }));
  return { users, totalCount, hasNextPage: page * pageSize < totalCount, error: null };
}

export async function getAdminRequests(options: { search?: string; status?: RequestStatus; categoryId?: string; cityId?: string; page?: number; pageSize?: number } = {}) {
  if (!supabase) return { requests: [], totalCount: 0, hasNextPage: false, error: configError() };
  const page = Math.max(1, options.page ?? 1); const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 12));
  const { data, error } = await supabase.rpc("get_admin_requests", { p_search: options.search?.trim() || null, p_status: options.status || null, p_category_id: options.categoryId || null, p_city_id: options.cityId || null, p_page: page, p_page_size: pageSize });
  if (error) return { requests: [] as AdminRequest[], totalCount: 0, hasNextPage: false, error };
  const rows = (data ?? []) as Array<Record<string, unknown>>; const totalCount = Number(rows[0]?.total_count ?? 0);
  const requests = rows.map((r) => ({ id: String(r.id), title: String(r.title), requesterName: (r.requester_name as string | null) ?? null, categoryId: String(r.category_id), categoryName: String(r.category_name), cityId: String(r.city_id), cityName: String(r.city_name), status: String(r.status), createdAt: String(r.created_at), offerCount: Number(r.offer_count ?? 0) }));
  return { requests, totalCount, hasNextPage: page * pageSize < totalCount, error: null };
}

export async function getAdminSuppliers(options: { search?: string; cityId?: string; verified?: boolean; page?: number; pageSize?: number } = {}) {
  if (!supabase) return { suppliers: [], totalCount: 0, hasNextPage: false, error: configError() };
  const page = Math.max(1, options.page ?? 1); const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 12));
  const { data, error } = await supabase.rpc("get_admin_suppliers", { p_search: options.search?.trim() || null, p_city_id: options.cityId || null, p_verified: options.verified ?? null, p_page: page, p_page_size: pageSize });
  if (error) return { suppliers: [] as AdminSupplier[], totalCount: 0, hasNextPage: false, error };
  const rows = (data ?? []) as Array<Record<string, unknown>>; const totalCount = Number(rows[0]?.total_count ?? 0);
  const suppliers = rows.map((r) => ({ id: String(r.id), userId: String(r.user_id), supplierName: (r.supplier_name as string | null) ?? null, companyName: (r.company_name as string | null) ?? null, businessType: (r.business_type as string | null) ?? null, cityId: (r.city_id as string | null) ?? null, cityName: (r.city_name as string | null) ?? null, verified: Boolean(r.verified), reviewCount: Number(r.review_count ?? 0), ratingAverage: r.rating_average == null ? null : Number(r.rating_average), proStatus: r.pro_status as AdminSupplier["proStatus"], createdAt: String(r.created_at) }));
  return { suppliers, totalCount, hasNextPage: page * pageSize < totalCount, error: null };
}

export type AdminReferencePage = {
  page?: number;
  pageSize?: number;
};

export async function getAdminCategories(options: AdminReferencePage & { search?: string; isActive?: boolean } = {}) {
  if (!supabase) return { categories: [] as import("../types/adminReference").AdminCategory[], totalCount: 0, hasNextPage: false, error: new Error("إعداد Supabase غير مكتمل.") };
  const { data, error } = await supabase.rpc("get_admin_categories", {
    p_search: options.search?.trim() || null,
    p_is_active: options.isActive ?? null,
    p_page: options.page ?? 1,
    p_page_size: options.pageSize ?? 12,
  });
  if (error) return { categories: [], totalCount: 0, hasNextPage: false, error };
  const rows = (data as Array<Record<string, unknown>> | null) ?? [];
  const totalCount = Number(rows[0]?.total_count ?? 0);
  return {
    categories: rows.map((row) => ({ id: String(row.id), name: String(row.name), slug: String(row.slug), isActive: Boolean(row.is_active), createdAt: String(row.created_at), requestCount: Number(row.request_count ?? 0), supplierCount: Number(row.supplier_count ?? 0), usageCount: Number(row.usage_count ?? 0) })),
    totalCount,
    hasNextPage: (options.page ?? 1) * (options.pageSize ?? 12) < totalCount,
    error: null,
  };
}

export async function createAdminCategory(name: string, slug: string) {
  if (!supabase) return { category: null, error: new Error("إعداد Supabase غير مكتمل.") };
  const { data, error } = await supabase.rpc("create_admin_category", { p_name: name, p_slug: slug });
  return { category: data, error };
}

export async function updateAdminCategory(id: string, name: string, slug: string) {
  if (!supabase) return { category: null, error: new Error("إعداد Supabase غير مكتمل.") };
  const { data, error } = await supabase.rpc("update_admin_category", { p_category_id: id, p_name: name, p_slug: slug });
  return { category: data, error };
}

export async function setAdminCategoryActive(id: string, isActive: boolean) {
  if (!supabase) return { category: null, error: new Error("إعداد Supabase غير مكتمل.") };
  const { data, error } = await supabase.rpc("set_admin_category_active", { p_category_id: id, p_is_active: isActive });
  return { category: data, error };
}

export async function getAdminCities(options: AdminReferencePage & { search?: string; isActive?: boolean } = {}) {
  if (!supabase) return { cities: [] as import("../types/adminReference").AdminCity[], totalCount: 0, hasNextPage: false, error: new Error("إعداد Supabase غير مكتمل.") };
  const { data, error } = await supabase.rpc("get_admin_cities", {
    p_search: options.search?.trim() || null,
    p_is_active: options.isActive ?? null,
    p_page: options.page ?? 1,
    p_page_size: options.pageSize ?? 12,
  });
  if (error) return { cities: [], totalCount: 0, hasNextPage: false, error };
  const rows = (data as Array<Record<string, unknown>> | null) ?? [];
  const totalCount = Number(rows[0]?.total_count ?? 0);
  return {
    cities: rows.map((row) => ({ id: String(row.id), name: String(row.name), isActive: Boolean(row.is_active), createdAt: String(row.created_at), requestCount: Number(row.request_count ?? 0), supplierCount: Number(row.supplier_count ?? 0), usageCount: Number(row.usage_count ?? 0) })),
    totalCount,
    hasNextPage: (options.page ?? 1) * (options.pageSize ?? 12) < totalCount,
    error: null,
  };
}

export async function createAdminCity(name: string) {
  if (!supabase) return { city: null, error: new Error("إعداد Supabase غير مكتمل.") };
  const { data, error } = await supabase.rpc("create_admin_city", { p_name: name });
  return { city: data, error };
}

export async function updateAdminCity(id: string, name: string) {
  if (!supabase) return { city: null, error: new Error("إعداد Supabase غير مكتمل.") };
  const { data, error } = await supabase.rpc("update_admin_city", { p_city_id: id, p_name: name });
  return { city: data, error };
}

export async function setAdminCityActive(id: string, isActive: boolean) {
  if (!supabase) return { city: null, error: new Error("إعداد Supabase غير مكتمل.") };
  const { data, error } = await supabase.rpc("set_admin_city_active", { p_city_id: id, p_is_active: isActive });
  return { city: data, error };
}

export async function getAdminReportSummary(from: string|null, toExclusive: string|null) { return reportRpc('get_admin_report_summary',{p_from:from,p_to_exclusive:toExclusive}, mapSummary); }
export async function getAdminRequestFunnel(from: string|null, toExclusive: string|null) { return reportRpc('get_admin_request_funnel',{p_from:from,p_to_exclusive:toExclusive}, mapFunnel); }
export async function getAdminOfferAnalytics(from: string|null, toExclusive: string|null) { return reportRpc('get_admin_offer_analytics',{p_from:from,p_to_exclusive:toExclusive}, mapOfferAnalytics); }
export async function getAdminTopCategories(from: string|null,toExclusive:string|null,page=1,pageSize=12) { return reportPage('get_admin_top_categories',{p_from:from,p_to_exclusive:toExclusive,p_page:page,p_page_size:pageSize}, row=>({id:String(row.id),name:String(row.name),requestCount:Number(row.request_count??0),offerCount:Number(row.offer_count??0),supplierCount:Number(row.supplier_count??0)})); }
export async function getAdminTopCities(from: string|null,toExclusive:string|null,page=1,pageSize=12) { return reportPage('get_admin_top_cities',{p_from:from,p_to_exclusive:toExclusive,p_page:page,p_page_size:pageSize}, row=>({id:String(row.id),name:String(row.name),requestCount:Number(row.request_count??0),supplierCount:Number(row.supplier_count??0),completedRequestCount:Number(row.completed_request_count??0)})); }
export async function getAdminActiveSuppliers(from: string|null,toExclusive:string|null,page=1,pageSize=12) { return reportPage('get_admin_active_suppliers',{p_from:from,p_to_exclusive:toExclusive,p_page:page,p_page_size:pageSize}, row=>({userId:String(row.user_id),supplierName:String(row.supplier_name??'مورد'),offerCount:Number(row.offer_count??0),selectedOfferCount:Number(row.selected_offer_count??0),completedRequestCount:Number(row.completed_request_count??0),ratingAverage:row.rating_average==null?null:Number(row.rating_average),verified:Boolean(row.verified),isPro:Boolean(row.is_pro)})); }
export async function getAdminActivity(from:string|null,toExclusive:string|null,granularity:'day'|'month') { return reportRows('get_admin_activity_over_time',{p_from:from,p_to_exclusive:toExclusive,p_granularity:granularity}, row=>({bucket:String(row.bucket),requestCount:Number(row.request_count??0),offerCount:Number(row.offer_count??0),newUserCount:Number(row.new_user_count??0)})); }
export async function getAdminStatusDistribution(from:string|null,toExclusive:string|null) { return reportRows('get_admin_status_distribution',{p_from:from,p_to_exclusive:toExclusive}, row=>({status:String(row.status),requestCount:Number(row.request_count??0)})); }
export async function getAdminProAnalytics(from:string|null,toExclusive:string|null) { return reportRpc('get_admin_pro_analytics',{p_from:from,p_to_exclusive:toExclusive}, row=>({activePro:Number(row.active_pro??0),pendingPro:Number(row.pending_pro??0),expiredPro:Number(row.expired_pro??0),expiredDuringPeriod:Number(row.expired_during_period??0),proActivationsDuringPeriod:Number(row.pro_activations_during_period??0)})); }
export async function getAdminVerificationAnalytics(from:string|null,toExclusive:string|null) { return reportRpc('get_admin_verification_analytics',{p_from:from,p_to_exclusive:toExclusive}, row=>({pending:Number(row.pending??0),approved:Number(row.approved??0),rejected:Number(row.rejected??0),cancelled:Number(row.cancelled??0),createdDuringPeriod:Number(row.created_during_period??0)})); }

async function reportRpc<T>(fn:string,args:Record<string,unknown>,map:(row:Record<string,unknown>)=>T){
  if(!supabase) return {data:null,error:new Error('إعداد Supabase غير مكتمل.')};
  const {data,error}=await supabase.rpc(fn,args); if(error) return {data:null,error};
  const row=((data as Array<Record<string,unknown>>|null)?.[0])??{}; return {data:map(row),error:null};
}
async function reportRows<T>(fn:string,args:Record<string,unknown>,map:(row:Record<string,unknown>)=>T){
  if(!supabase) return {data:[] as T[],error:new Error('إعداد Supabase غير مكتمل.')};
  const {data,error}=await supabase.rpc(fn,args); if(error) return {data:[] as T[],error}; return {data:((data as Array<Record<string,unknown>>|null)??[]).map(map),error:null};
}
async function reportPage<T>(fn:string,args:Record<string,unknown>,map:(row:Record<string,unknown>)=>T){
  if(!supabase) return {data:[] as T[],totalCount:0,hasNextPage:false,error:new Error('إعداد Supabase غير مكتمل.')};
  const {data,error}=await supabase.rpc(fn,args); if(error) return {data:[] as T[],totalCount:0,hasNextPage:false,error}; const rows=(data as Array<Record<string,unknown>>|null)??[]; const totalCount=Number(rows[0]?.total_count??0); const page=Number(args.p_page??1),size=Number(args.p_page_size??12); return {data:rows.map(map),totalCount,hasNextPage:page*size<totalCount,error:null};
}
function mapSummary(row:Record<string,unknown>){ return {totalUsers:Number(row.total_users??0),newUsers:Number(row.new_users??0),requesterUsers:Number(row.requester_users??0),supplierUsers:Number(row.supplier_users??0),totalRequests:Number(row.total_requests??0),newRequests:Number(row.new_requests??0),openRequests:Number(row.open_requests??0),inProgressRequests:Number(row.in_progress_requests??0),completedRequests:Number(row.completed_requests??0),cancelledRequests:Number(row.cancelled_requests??0),supplierSelectedRequests:Number(row.supplier_selected_requests??0),totalOffers:Number(row.total_offers??0),newOffers:Number(row.new_offers??0),averageOffersPerRequest:Number(row.average_offers_per_request??0),requestsWithOffers:Number(row.requests_with_offers??0),totalSuppliers:Number(row.total_suppliers??0),newSuppliers:Number(row.new_suppliers??0),verifiedSuppliers:Number(row.verified_suppliers??0),unverifiedSuppliers:Number(row.unverified_suppliers??0),activeProSuppliers:Number(row.active_pro_suppliers??0)}; }
function mapFunnel(row:Record<string,unknown>){ return {requestsCreated:Number(row.requests_created??0),requestsWithOffers:Number(row.requests_with_offers??0),requestsWithSelectedSupplier:Number(row.requests_with_selected_supplier??0),requestsStarted:Number(row.requests_started??0),requestsCompleted:Number(row.requests_completed??0),offersRate:row.offers_rate==null?null:Number(row.offers_rate),selectionRate:row.selection_rate==null?null:Number(row.selection_rate),startRate:row.start_rate==null?null:Number(row.start_rate),completionRate:row.completion_rate==null?null:Number(row.completion_rate)}; }
function mapOfferAnalytics(row:Record<string,unknown>){ return {averageOffersPerRequest:Number(row.average_offers_per_request??0),maxOffersOnRequest:Number(row.max_offers_on_request??0),requestsWithoutOffers:Number(row.requests_without_offers??0),requestsWithOneOffer:Number(row.requests_with_one_offer??0),requestsWithMoreThanOneOffer:Number(row.requests_with_more_than_one_offer??0)}; }

export async function setAdminUserActive(userId: string, isActive: boolean) {
  if (!supabase) return { error: configError() };
  const { error } = await supabase.rpc("set_admin_user_active", { p_user_id: userId, p_is_active: isActive });
  return { error };
}

export async function deleteAdminRequest(requestId: string) {
  if (!supabase) return { error: configError() };
  const { error } = await supabase.rpc("delete_admin_request", { p_request_id: requestId });
  return { error };
}
