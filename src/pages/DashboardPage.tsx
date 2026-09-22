import { useEffect, useState, type ReactNode } from "react";
import ProtectedRoute from "../components/ProtectedRoute";
import DashboardStatCard from "../components/DashboardStatCard";
import DashboardSection from "../components/DashboardSection";
import RequestStatusBadge from "../components/RequestStatusBadge";
import { useAuth } from "../lib/auth";
import { getRequesterDashboardData, getSupplierDashboardStats, getSupplierLatestOffers } from "../services/dashboardService";
import { getCurrentSupplierProfile } from "../services/supplierService";
import { getRequests } from "../services/requestService";
import { getMatchingSuppliersForRequest } from "../services/matchingService";
import { getSavedRequests, unsaveRequest } from "../services/savedRequestService";
import { getCurrentSubscription } from "../services/subscriptionService";
import { getMyVerificationRequest } from "../services/verificationService";
import { isAdmin } from "../services/adminSubscriptionService";
import { hasReviewedRequest } from "../services/reviewService";
import type { DashboardOffer, DashboardRequest } from "../types/dashboard";
import type { SavedRequest } from "../types/savedRequest";
import type { SupplierProfile } from "../types/supplier";

import SiteHeader from "../components/SiteHeader";
export default function DashboardPage() {
  return <ProtectedRoute><DashboardContent /></ProtectedRoute>;
}

function DashboardContent() {
  const { user, profile, loading } = useAuth();
  const [admin, setAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  useEffect(() => {
    let active = true;
    if (!user) { setAdmin(false); setAdminChecked(true); return () => { active = false; }; }
    void isAdmin().then(result => { if (active) { setAdmin(result.isAdmin); setAdminChecked(true); } });
    return () => { active = false; };
  }, [user]);
  if (loading || !user || !profile || !adminChecked) return <LoadingPage />;
  if (profile.role === "supplier") return <SupplierDashboard userId={user.id} name={profile.full_name} />;
  return <RequesterDashboard userId={user.id} name={profile.full_name} />;
}

function RequesterDashboard({ userId, name }: { userId: string; name: string | null }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getRequesterDashboardData>> | null>(null);
  const [reviewNeeds, setReviewNeeds] = useState<DashboardRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError("");
      const result = await getRequesterDashboardData(userId);
      if (!active) return;
      if (result.error) { setError("تعذر تحميل لوحة التحكم حاليًا."); setLoading(false); return; }
      setData(result);
      const completed = result.latestRequests.filter((item) => item.status === "completed");
      const checks = await Promise.all(completed.map(async item => [item, await hasReviewedRequest(item.id)] as const));
      if (active) setReviewNeeds(checks.filter(([, review]) => !review.error && !review.reviewed).map(([item]) => item));
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [userId]);

  return <DashboardShell title="لوحة التحكم" greeting={`مرحباً، ${name || "بك"}`} loading={loading} error={error}>
    {data?.stats && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <DashboardStatCard label="إجمالي طلباتي" value={data.stats.total} />
      <DashboardStatCard label="الطلبات المفتوحة" value={data.stats.open} />
      <DashboardStatCard label="قيد التنفيذ" value={data.stats.inProgress} />
      <DashboardStatCard label="المكتملة" value={data.stats.completed} />
      <DashboardStatCard label="الملغاة" value={data.stats.cancelled} />
    </div>}
    <div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
      <DashboardSection title="أحدث الطلبات" action={<a href="/requests" className="text-sm font-black text-slate-700">طلباتي ←</a>}>
        {data?.latestRequests.length ? <div className="space-y-3">{data.latestRequests.map(request => <RequestRow key={request.id} request={request} />)}</div> : <Empty text="لا توجد طلبات بعد." action="إنشاء طلب جديد" href="/requests/create" />}
      </DashboardSection>
      <DashboardSection title="تحتاج إلى إجراء">
        {data?.actionRequests.length ? <div className="space-y-3">{data.actionRequests.map(request => <ActionRow key={request.id} request={request} label={`${request.offerCount} ${request.offerCount === 1 ? "عرض" : "عروض"} بانتظار اختيارك`} />)}</div> : <Empty text="لا توجد طلبات تحتاج إلى إجراء حاليًا." />}
      </DashboardSection>
    </div>
    {reviewNeeds.length > 0 && <DashboardSection title="تحتاج إلى تقييم">
      <div className="space-y-3">{reviewNeeds.map(request => <ActionRow key={request.id} request={request} label="لديك طلب مكتمل يحتاج إلى تقييم المورد" />)}</div>
    </DashboardSection>}
    <div className="flex flex-wrap gap-3"><a href="/requests/create" className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white">إنشاء طلب جديد</a><a href="/requests" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-900">طلباتي</a></div>
  </DashboardShell>;
}

function SupplierDashboard({ userId, name }: { userId: string; name: string | null }) {
  const [supplier, setSupplier] = useState<SupplierProfile | null>(null);
  const [stats, setStats] = useState<{ offers: number; selected: number; inProgress: number; completed: number } | null>(null);
  const [matched, setMatched] = useState<DashboardRequest[]>([]);
  const [saved, setSaved] = useState<SavedRequest[]>([]);
  const [offers, setOffers] = useState<DashboardOffer[]>([]);
  const [subscription, setSubscription] = useState<Awaited<ReturnType<typeof getCurrentSubscription>>["subscription"]>(null);
  const [verification, setVerification] = useState<Awaited<ReturnType<typeof getMyVerificationRequest>>["request"]>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveBusy, setSaveBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true); setError("");
      const supplierResult = await getCurrentSupplierProfile();
      if (supplierResult.error || !supplierResult.profile) { if (active) { setError("تعذر تحميل ملف المورد حاليًا."); setLoading(false); } return; }
      const currentSupplier = supplierResult.profile;
      const [statsResult, requestResult, savedResult, offersResult, subscriptionResult, verificationResult] = await Promise.all([
        getSupplierDashboardStats(currentSupplier.id),
        getRequests({ status: "open", page: 1, pageSize: 12 }),
        getSavedRequests({ page: 1, pageSize: 5 }),
        getSupplierLatestOffers(currentSupplier.id, 5),
        getCurrentSubscription(),
        getMyVerificationRequest(),
      ]);
      if (!active) return;
      // The supplier dashboard must remain usable even if an optional section
      // (saved requests, subscriptions, verification, or public requests) is
      // blocked by its own RLS/data state. Only the supplier profile is required.
      setSupplier(currentSupplier);
      setStats(statsResult.error ? null : statsResult.stats);
      setSaved(savedResult.error ? [] : savedResult.savedRequests);
      setOffers(offersResult.error ? [] : offersResult.offers);
      setSubscription(subscriptionResult.error ? null : subscriptionResult.subscription);
      setVerification(verificationResult.error ? null : verificationResult.request);
      const visible = requestResult.error ? [] : requestResult.requests.slice(0, 12);
      const matchingResults = await Promise.all(visible.map(async request => [request, await getMatchingSuppliersForRequest(request.id)] as const));
      if (active) {
        setMatched(matchingResults.filter(([, result]) => !result.error && result.suppliers.some(item => item.supplierId === currentSupplier.user_id)).slice(0, 5).map(([request]) => mapVisibleRequest(request)));
        setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [userId]);

  async function handleUnsave(requestId: string) {
    setSaveBusy(requestId);
    const result = await unsaveRequest(requestId);
    if (!result.error) setSaved(current => current.filter(item => item.requestId !== requestId));
    setSaveBusy(null);
  }

  const displayName = supplier?.company_name || name || "بك";
  const verificationLabel = supplier?.verified ? "موثق" : verification?.status === "pending" ? "طلب التوثيق قيد المراجعة" : verification?.status === "rejected" ? "مرفوض" : "غير موثق";
  const subscriptionLabel = getSubscriptionLabel(subscription);

  return <DashboardShell title="لوحة تحكم المورد" greeting={`مرحباً، ${displayName}`} loading={loading} error={error}>
    {stats && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><DashboardStatCard label="العروض التي قدمتها" value={stats.offers} /><DashboardStatCard label="العروض المختارة" value={stats.selected} /><DashboardStatCard label="قيد التنفيذ" value={stats.inProgress} /><DashboardStatCard label="المكتملة" value={stats.completed} /></div>}
    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <DashboardSection title="طلبات قد تناسبك" action={<a href="/requests" className="text-sm font-black text-slate-700">تصفح الطلبات ←</a>}>
        {matched.length ? <div className="space-y-3">{matched.map(request => <RequestRow key={request.id} request={request} />)}</div> : <Empty text="لا توجد طلبات مطابقة ظاهرة لك حاليًا." action="تصفح الطلبات" href="/requests" />}
      </DashboardSection>
      <DashboardSection title="الطلبات المحفوظة" action={<a href="/supplier/saved-requests" className="text-sm font-black text-slate-700">عرض كل المحفوظات ←</a>}>
        {saved.length ? <div className="space-y-3">{saved.map(item => <SavedDashboardRow key={item.id} item={item} busy={saveBusy === item.requestId} onUnsave={() => void handleUnsave(item.requestId)} />)}</div> : <Empty text="لا توجد طلبات محفوظة بعد." action="تصفح الطلبات" href="/requests" />}
      </DashboardSection>
    </div>
    <DashboardSection title="أحدث العروض التي قدمتها">
      {offers.length ? <div className="space-y-3">{offers.map(offer => <OfferRow key={offer.id} offer={offer} />)}</div> : <Empty text="لم تقدم أي عروض بعد." action="تصفح الطلبات" href="/requests" />}
    </DashboardSection>
    <DashboardSection title="حالة الحساب">
      <div className="grid gap-3 sm:grid-cols-2"><StatusCard label="التوثيق" value={verificationLabel} /><StatusCard label="الاشتراك" value={subscriptionLabel} /></div>
    </DashboardSection>
    <div className="flex flex-wrap gap-3"><a href="/requests" className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white">تصفح الطلبات</a><a href="/supplier/saved-requests" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-900">طلباتي المحفوظة</a><a href="/profile/edit" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-900">تعديل ملف المورد</a><a href="/supplier/pro" className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-900">حالة PRO</a></div>
  </DashboardShell>;
}

function DashboardShell({ title, greeting, loading, error, children }: { title: string; greeting: string; loading: boolean; error: string; children: ReactNode }) {
  const { profile } = useAuth();
  const avatar = profile?.avatar_url;
  const initial = (profile?.full_name || 'م').trim().charAt(0) || 'م';
  return <><SiteHeader /><main dir="rtl" className="dashboard-page min-h-screen bg-slate-50 text-slate-950">
    <div className="dashboard-layout mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <aside className="dashboard-sidebar">
        <div className="dashboard-user-card">
          <div className="dashboard-avatar">{avatar ? <img src={avatar} alt="" /> : <span>{initial}</span>}</div>
          <div className="min-w-0"><p className="truncate text-sm font-black">{profile?.full_name || 'حسابي'}</p><p className="mt-1 text-xs font-bold text-slate-400">{profile?.role === 'supplier' ? 'مورد' : 'طالب خدمة'}</p></div>
        </div>
        <nav className="dashboard-side-nav" aria-label="تنقل لوحة التحكم">
          <a className="active" href="/dashboard">⌂ <span>الرئيسية</span></a>
          <a href="/requests">▣ <span>الطلبات</span></a>
          {profile?.role === 'supplier' ? <a href="/suppliers">♧ <span>الموردون</span></a> : <a href="/suppliers">♧ <span>الموردون</span></a>}
          <a href="/notifications">♢ <span>الإشعارات</span></a>
          <a href="/profile/edit">◉ <span>الملف الشخصي</span></a>
          <a href="/settings">⚙ <span>الإعدادات</span></a>
        </nav>
        <a href={profile?.role === 'supplier' ? '/supplier/pro' : '/requests/create'} className="dashboard-pro-card">
          <strong>{profile?.role === 'supplier' ? 'حساب PRO' : 'حوّل احتياجك إلى فرصة'}</strong>
          <span>{profile?.role === 'supplier' ? 'مزايا إضافية للموردين' : 'أنشئ طلبًا جديدًا الآن'}</span>
          <b>{profile?.role === 'supplier' ? 'استكشف المزايا' : 'إنشاء طلب'} ↗</b>
        </a>
      </aside>
      <div className="dashboard-main">
        <section className="dashboard-hero">
          <div><p className="dashboard-kicker">مطلوب · مساحة العمل</p><h1>{title}</h1><p>{greeting}</p></div>
          <a href="/" className="dashboard-home-link">الرئيسية ↗</a>
        </section>
        <section className="dashboard-content">{loading ? <LoadingState /> : error ? <ErrorState message={error} /> : children}</section>
      </div>
    </div>
  </main></>;
}

function RequestRow({ request }: { request: DashboardRequest }) {
  return <a href={`/requests/${request.id}`} className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-base font-black">{request.title}</p><p className="mt-1 text-sm text-slate-500">{request.categoryName || "تصنيف غير محدد"} · {request.cityName || "مدينة غير محددة"}</p></div><RequestStatusBadge status={request.status} /></div><div className="mt-3 flex flex-wrap gap-4 text-xs font-bold text-slate-400"><span>{formatDate(request.createdAt)}</span>{request.offerCount > 0 && <span>{request.offerCount} {request.offerCount === 1 ? "عرض" : "عروض"}</span>}</div></a>;
}

function ActionRow({ request, label }: { request: DashboardRequest; label: string }) { return <a href={`/requests/${request.id}`} className="block rounded-2xl border border-amber-100 bg-amber-50/60 p-4"><div className="flex items-center justify-between gap-3"><p className="font-black">{request.title}</p><span className="text-xs font-black text-amber-700">فتح الطلب ←</span></div><p className="mt-2 text-sm font-semibold text-amber-800">{label}</p></a>; }
function SavedDashboardRow({ item, busy, onUnsave }: { item: SavedRequest; busy: boolean; onUnsave: () => void }) { const request = item.request; return <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">{request ? <div><a href={`/requests/${request.id}`} className="font-black hover:underline">{request.title}</a><p className="mt-1 text-sm text-slate-500">{request.city?.name || "مدينة غير محددة"} · {formatDate(item.createdAt)}</p></div> : <div><p className="font-black">الطلب غير متاح حاليًا</p><p className="mt-1 text-xs text-slate-500">بقي سجل الحفظ دون تجاوز صلاحيات الوصول.</p></div>}<div className="flex gap-2"><button type="button" disabled={busy} onClick={onUnsave} className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-700 disabled:opacity-50">{busy ? "جارٍ..." : "إلغاء الحفظ"}</button>{request && <a href={`/requests/${request.id}`} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">فتح</a>}</div></div>; }
function OfferRow({ offer }: { offer: DashboardOffer }) { return <a href={`/requests/${offer.requestId}`} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black">{offer.requestTitle || "الطلب"}</p><div className="mt-1 flex flex-wrap gap-3 text-sm text-slate-500"><span>{offer.price.toLocaleString("ar-SY")} {offer.currency}</span>{offer.durationValue != null && <span>{offer.durationValue} {durationLabel(offer.durationUnit)}</span>}<RequestStatusBadge status={offer.requestStatus || "open"} /></div></div><span className="text-xs font-bold text-slate-400">{formatDate(offer.createdAt)}</span></a>; }
function StatusCard({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400">{label}</p><p className="mt-2 font-black text-slate-900">{value}</p></div>; }
function Empty({ text, action, href }: { text: string; action?: string; href?: string }) { return <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center"><p className="text-sm font-semibold text-slate-500">{text}</p>{action && href && <a href={href} className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white">{action}</a>}</div>; }
function LoadingPage() { return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50"><LoadingState /></main>; }
function LoadingState() { return <div className="w-full max-w-7xl rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm"><div className="mx-auto size-10 animate-pulse rounded-xl bg-slate-200" /><p className="mt-4 text-sm font-bold text-slate-500">جارٍ تحميل لوحة التحكم...</p></div>; }
function ErrorState({ message }: { message: string }) { return <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-14 text-center"><h2 className="text-xl font-black text-rose-800">تعذر تحميل لوحة التحكم</h2><p className="mt-2 text-sm font-semibold text-rose-700">{message}</p></div>; }
function mapVisibleRequest(request: { id: string; title: string; status: DashboardRequest["status"]; created_at: string; category?: { name?: string | null } | null; city?: { name?: string | null } | null } ): DashboardRequest { return { id: request.id, title: request.title, status: request.status, createdAt: request.created_at, categoryName: request.category?.name ?? null, cityName: request.city?.name ?? null, offerCount: 0 }; }
function formatDate(value: string) { return new Intl.DateTimeFormat("ar-SY", { dateStyle: "medium" }).format(new Date(value)); }
function durationLabel(value: string | null) { return ({ hours: "ساعات", days: "أيام", weeks: "أسابيع", months: "أشهر" } as Record<string, string>)[value || ""] || ""; }
function getSubscriptionLabel(subscription: Awaited<ReturnType<typeof getCurrentSubscription>>["subscription"]) { if (!subscription) return "FREE"; if (subscription.plan_code !== "PRO") return subscription.plan_name || "FREE"; if (subscription.status === "active" && subscription.expires_at && new Date(subscription.expires_at).getTime() > Date.now()) return "PRO"; if (subscription.status === "pending") return "PRO Pending"; if (subscription.status === "cancelled") return "PRO Cancelled"; return "PRO Expired"; }
