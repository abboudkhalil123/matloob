import { useEffect, useMemo, useState } from "react";
import RequestCard from "../components/RequestCard";
import { getCategories, getCities, getRequests } from "../services/requestService";
import type { Category, City, Request, RequestStatus } from "../types/request";

import SiteHeader from "../components/SiteHeader";
const PAGE_SIZE = 12;
const statusOptions: { value: RequestStatus; label: string }[] = [
  { value: "open", label: "مفتوح" },
  { value: "closed", label: "مغلق" },
  { value: "supplier_selected", label: "تم اختيار مورد" },
  { value: "in_progress", label: "قيد التنفيذ" },
  { value: "completed", label: "مكتمل" },
  { value: "cancelled", label: "ملغى" },
];

function readRequestState() {
  const params = new URLSearchParams(window.location.search);
  const parsedPage = Number(params.get("page") || "1");
  return {
    search: params.get("search") || "",
    categoryId: params.get("category") || "",
    cityId: params.get("city") || "",
    status: (params.get("status") || "") as RequestStatus | "",
    minQuantity: params.get("minQuantity") || "",
    deliveryBefore: params.get("deliveryBefore") || "",
    date: params.get("sort") === "oldest" ? "oldest" : "newest",
    page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}

export default function RequestsPage() {
  const initial = useMemo(readRequestState, []);
  const [requests, setRequests] = useState<Request[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [search, setSearch] = useState(initial.search);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [cityId, setCityId] = useState(initial.cityId);
  const [status, setStatus] = useState<RequestStatus | "">(initial.status);
  const [minQuantity, setMinQuantity] = useState(initial.minQuantity);
  const [deliveryBefore, setDeliveryBefore] = useState(initial.deliveryBefore);
  const [date, setDate] = useState(initial.date);
  const [page, setPage] = useState(initial.page);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([getCategories(), getCities()]).then(([categoryResult, cityResult]) => {
      if (!active) return;
      if (categoryResult.error || cityResult.error) {
        setError("تعذر تحميل التصنيفات أو المدن. تأكد من إعداد Supabase وتطبيق Migration الخطوة الثامنة.");
        return;
      }
      setCategories(categoryResult.categories);
      setCities(cityResult.cities);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (categoryId) params.set("category", categoryId);
    if (cityId) params.set("city", cityId);
    if (status) params.set("status", status);
    if (minQuantity) params.set("minQuantity", minQuantity);
    if (deliveryBefore) params.set("deliveryBefore", deliveryBefore);
    if (date === "oldest") params.set("sort", "oldest");
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    window.history.replaceState(null, "", query ? `/requests?${query}` : "/requests");
  }, [search, categoryId, cityId, status, minQuantity, deliveryBefore, date, page]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => {
      const parsedQuantity = minQuantity.trim() ? Number(minQuantity) : undefined;
      void getRequests({
        search,
        categoryId,
        cityId,
        status: status || undefined,
        minQuantity: parsedQuantity !== undefined && Number.isFinite(parsedQuantity) && parsedQuantity >= 0 ? parsedQuantity : undefined,
        deliveryBefore: deliveryBefore || undefined,
        ascending: date === "oldest",
        page,
        pageSize: PAGE_SIZE,
      }).then(result => {
        if (!active) return;
        if (result.error) {
          setError("تعذر تحميل الطلبات حاليًا. تحقق من اتصال Supabase ثم حاول مرة أخرى.");
          setRequests([]);
          setTotalCount(0);
          setHasNextPage(false);
        } else {
          setRequests(result.requests);
          setTotalCount(result.totalCount);
          setHasNextPage(result.hasNextPage);
        }
        setLoading(false);
      });
    }, 400);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search, categoryId, cityId, status, minQuantity, deliveryBefore, date, page]);

  const categoryMap = useMemo(() => new Map(categories.map(item => [item.id, item.name])), [categories]);
  const cityMap = useMemo(() => new Map(cities.map(item => [item.id, item.name])), [cities]);

  function resetToFirstPage(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  return <><SiteHeader /><main dir="rtl" className="min-h-screen bg-slate-50 text-slate-950">
    <PageIntro title="الطلبات" description="تصفح الطلبات وابحث عن الفرص المناسبة لك." />
    <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-bold text-slate-700" htmlFor="request-search">البحث</label>
        <input id="request-search" value={search} onChange={e => resetToFirstPage(setSearch, e.target.value)} placeholder="ابحث في عنوان الطلب أو وصفه..." className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Filter label="التصنيف" value={categoryId} onChange={value => { setCategoryId(value); setPage(1); }} options={categories.map(item => ({ value: item.id, label: item.name }))} placeholder="كل التصنيفات" />
          <Filter label="المدينة" value={cityId} onChange={value => { setCityId(value); setPage(1); }} options={cities.map(item => ({ value: item.id, label: item.name }))} placeholder="كل المدن" />
          <Filter label="حالة الطلب" value={status} onChange={value => { setStatus(value as RequestStatus | ""); setPage(1); }} options={statusOptions} placeholder="كل الحالات" />
          <label className="text-sm font-bold text-slate-700">الكمية الدنيا<input inputMode="decimal" type="number" min="0" value={minQuantity} onChange={e => resetToFirstPage(setMinQuantity, e.target.value)} placeholder="مثال: 100" className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal text-slate-700 outline-none focus:border-slate-400" /></label>
          <label className="text-sm font-bold text-slate-700">تاريخ التسليم حتى<input type="date" value={deliveryBefore} onChange={e => resetToFirstPage(setDeliveryBefore, e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal text-slate-700 outline-none focus:border-slate-400" /></label>
          <Filter label="ترتيب النشر" value={date} onChange={value => { setDate(value); setPage(1); }} options={[{ value: "newest", label: "الأحدث" }, { value: "oldest", label: "الأقدم" }]} placeholder="ترتيب النشر" />
        </div>
      </div>

      <div className="mt-8">
        {loading ? <State title="جارٍ تحميل الطلبات..." description="يتم جلب صفحة النتائج من قاعدة البيانات." />
          : error ? <ErrorState message={error} onRetry={() => setPage(page)} />
          : requests.length === 0 ? <EmptyState />
          : <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-slate-500"><span>الصفحة {page}</span>{totalCount > 0 && <span>{totalCount} نتيجة</span>}</div>
            <div className="grid gap-5 lg:grid-cols-2">{requests.map(request => <RequestCard key={request.id} request={{
              id: request.id,
              title: request.title,
              category: categoryMap.get(request.category_id) ?? "غير محدد",
              city: cityMap.get(request.city_id) ?? "غير محدد",
              quantity: request.quantity === null ? "غير محدد" : String(request.quantity),
              unit: request.unit ?? "",
              deliveryDate: request.deadline ?? "غير محدد",
              offersCount: 0,
              publishedAt: formatDate(request.created_at),
              status: statusLabel(request.status),
            }} />)}</div>
            <Pagination page={page} hasNextPage={hasNextPage} onPrevious={() => setPage(value => Math.max(1, value - 1))} onNext={() => setPage(value => value + 1)} totalCount={totalCount} pageSize={PAGE_SIZE} />
          </>}
      </div>
    </section>
  </main></>;
}

function Filter({ label, options, value, onChange, placeholder }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="text-sm font-bold text-slate-700">{label}<select value={value} onChange={e => onChange(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 font-normal text-slate-700 outline-none focus:border-slate-400"><option value="">{placeholder}</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function Pagination({ page, hasNextPage, onPrevious, onNext, totalCount, pageSize }: { page: number; hasNextPage: boolean; onPrevious: () => void; onNext: () => void; totalCount: number; pageSize: number }) {
  const first = totalCount ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, totalCount);
  return <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-sm font-semibold text-slate-500">عرض {first}–{last} من {totalCount}</p>
    <div className="flex items-center gap-2">
      <button type="button" disabled={page <= 1} onClick={onPrevious} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40">السابق</button>
      <span className="min-w-24 text-center text-sm font-black">الصفحة {page}</span>
      <button type="button" disabled={!hasNextPage} onClick={onNext} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">التالي</button>
    </div>
  </div>;
}

export function PageIntro({ title, description }: { title: string; description: string }) {
  return <section className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16"><p className="text-sm font-black text-slate-400">مطلوب</p><h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">{title}</h1><p className="mt-4 text-lg text-slate-600">{description}</p></div></section>;
}
function EmptyState() { return <State title="لا توجد طلبات تطابق البحث الحالي." description="جرّب تعديل البحث أو إزالة أحد الفلاتر." />; }
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="rounded-3xl border border-red-200 bg-white px-6 py-16 text-center"><h2 className="text-xl font-black text-red-700">تعذر تحميل الطلبات</h2><p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-500">{message}</p><button type="button" onClick={onRetry} className="mt-5 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white">إعادة المحاولة</button></div>; }
function State({ title, description }: { title: string; description: string }) { return <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-50 text-slate-400">▤</div><h2 className="mt-5 text-xl font-black">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-500">{description}</p></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("ar-SY", { dateStyle: "medium" }).format(new Date(value)); }
function statusLabel(status: RequestStatus) { return statusOptions.find(item => item.value === status)?.label ?? status; }
