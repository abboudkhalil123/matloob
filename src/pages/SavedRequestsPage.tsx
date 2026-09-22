import { useEffect, useState } from "react";
import ProtectedRoute from "../components/ProtectedRoute";
import { useAuth } from "../lib/auth";
import { getSavedRequests, unsaveRequest } from "../services/savedRequestService";
import type { SavedRequest } from "../types/savedRequest";

import SiteHeader from "../components/SiteHeader";
const PAGE_SIZE = 12;

export default function SavedRequestsPage() {
  return <ProtectedRoute><SavedRequestsContent /></ProtectedRoute>;
}

function SavedRequestsContent() {
  const { profile, loading: authLoading } = useAuth();
  const [items, setItems] = useState<SavedRequest[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    if (profile?.role !== "supplier") return;
    setLoading(true);
    setError("");
    const result = await getSavedRequests({ page, pageSize: PAGE_SIZE });
    if (result.error) {
      setItems([]);
      setTotalCount(0);
      setHasNextPage(false);
      setError("تعذر تحميل الطلبات المحفوظة حاليًا.");
    } else {
      setItems(result.savedRequests);
      setTotalCount(result.totalCount);
      setHasNextPage(result.hasNextPage);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!authLoading && profile?.role === "supplier") void load();
  }, [authLoading, profile?.role, page]);

  if (!authLoading && profile?.role !== "supplier") {
    return <><SiteHeader /><main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50 px-4"><div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-black">هذه الصفحة للموردين فقط</h1><p className="mt-3 text-sm leading-7 text-slate-500">الطلبات المحفوظة متاحة لحسابات الموردين فقط.</p></div></main></>;
  }

  async function handleUnsave(item: SavedRequest) {
    setBusyId(item.id);
    setError("");
    const result = await unsaveRequest(item.requestId);
    if (result.error) setError(result.error.message || "تعذر إلغاء حفظ الطلب.");
    else {
      setItems(current => current.filter(saved => saved.id !== item.id));
      setTotalCount(current => Math.max(0, current - 1));
      if (items.length === 1 && page > 1) setPage(current => current - 1);
    }
    setBusyId(null);
  }

  return <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-950">
    <section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16"><p className="text-sm font-black text-slate-400">حساب المورد</p><h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">طلباتي المحفوظة</h1><p className="mt-4 text-lg text-slate-600">احتفظ بالطلبات المهمة للرجوع إليها لاحقًا.</p></div></section>
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {error && <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{error}</div>}
      {loading ? <State title="جارٍ تحميل الطلبات المحفوظة..." description="يتم جلب صفحة النتائج من قاعدة البيانات." />
        : items.length === 0 ? <State title="لا توجد طلبات محفوظة" description="عندما تحفظ طلبًا مهمًا سيظهر هنا." />
        : <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-slate-500"><span>الصفحة {page}</span>{totalCount > 0 && <span>{totalCount} طلب محفوظ</span>}</div>
          <div className="grid gap-5 lg:grid-cols-2">{items.map(item => <SavedCard key={item.id} item={item} busy={busyId === item.id} onUnsave={() => void handleUnsave(item)} />)}</div>
          <Pagination page={page} hasNextPage={hasNextPage} totalCount={totalCount} onPrevious={() => setPage(current => Math.max(1, current - 1))} onNext={() => setPage(current => current + 1)} />
        </>}
    </section>
  </main>;
}

function SavedCard({ item, busy, onUnsave }: { item: SavedRequest; busy: boolean; onUnsave: () => void }) {
  const request = item.request;
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    {request ? <>
      <div className="flex items-start justify-between gap-4"><div><span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{request.category?.name ?? "غير محدد"}</span><h2 className="mt-3 text-lg font-black">{request.title}</h2></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${request.status === "open" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{statusLabel(request.status)}</span></div>
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-slate-600"><Info label="المدينة" value={request.city?.name ?? "غير محددة"} /><Info label="تاريخ النشر" value={formatDate(request.createdAt)} /></div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><span className="text-xs font-bold text-slate-400">حُفظ في {formatDate(item.createdAt)}</span><div className="flex gap-2"><a href={`/requests/${request.id}`} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">فتح الطلب</a><button type="button" disabled={busy} onClick={onUnsave} className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 disabled:opacity-60">{busy ? "جارٍ..." : "إلغاء الحفظ"}</button></div></div>
    </> : <div><div className="flex items-start justify-between gap-4"><div><span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">طلب محفوظ</span><h2 className="mt-3 text-lg font-black">الطلب غير متاح حاليًا</h2></div><span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">غير متاح</span></div><p className="mt-4 text-sm leading-7 text-slate-500">بقي سجل الحفظ لديك، لكن صلاحية الوصول إلى تفاصيل الطلب نفسها لا تسمح بعرضها حاليًا.</p><div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4"><span className="text-xs font-bold text-slate-400">حُفظ في {formatDate(item.createdAt)}</span><button type="button" disabled={busy} onClick={onUnsave} className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 disabled:opacity-60">{busy ? "جارٍ..." : "إلغاء الحفظ"}</button></div></div>}
  </article>;
}

function Pagination({ page, hasNextPage, totalCount, onPrevious, onNext }: { page: number; hasNextPage: boolean; totalCount: number; onPrevious: () => void; onNext: () => void }) {
  const first = totalCount ? (page - 1) * PAGE_SIZE + 1 : 0;
  const last = Math.min(page * PAGE_SIZE, totalCount);
  return <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-semibold text-slate-500">عرض {first}–{last} من {totalCount}</p><div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={onPrevious} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40">السابق</button><span className="min-w-24 text-center text-sm font-black">الصفحة {page}</span><button type="button" disabled={!hasNextPage} onClick={onNext} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">التالي</button></div></div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 font-bold text-slate-700">{value}</p></div>; }
function State({ title, description }: { title: string; description: string }) { return <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-50 text-slate-400">☆</div><h2 className="mt-5 text-xl font-black">{title}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-slate-500">{description}</p></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("ar-SY", { dateStyle: "medium" }).format(new Date(value)); }
function statusLabel(status: string) { return ({ open: "مفتوح", closed: "مغلق", supplier_selected: "تم اختيار مورد", in_progress: "قيد التنفيذ", completed: "مكتمل", cancelled: "ملغى" } as Record<string, string>)[status] ?? "غير معروف"; }
