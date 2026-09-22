import { useEffect, useMemo, useState } from "react";
import SupplierCard, { type SupplierSummary } from "../components/SupplierCard";
import SiteHeader from "../components/SiteHeader";
import { getCategories, getCities } from "../services/requestService";
import { getSupplierProfiles, type SupplierDirectoryItem } from "../services/supplierService";
import type { Category, City } from "../types/request";

const PAGE_SIZE = 12;
const ratings = ["", "1", "2", "3", "4", "5"];

function readSupplierState() {
  const params = new URLSearchParams(window.location.search);
  const parsedPage = Number(params.get("page") || "1");
  return {
    search: params.get("search") || "",
    categoryId: params.get("category") || "",
    cityId: params.get("city") || "",
    rating: params.get("rating") || "",
    page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
  };
}

export default function SuppliersPage() {
  const initial = useMemo(readSupplierState, []);
  const [search, setSearch] = useState(initial.search);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [cityId, setCityId] = useState(initial.cityId);
  const [rating, setRating] = useState(initial.rating);
  const [page, setPage] = useState(initial.page);
  const [suppliers, setSuppliers] = useState<SupplierDirectoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    void Promise.all([getCategories(), getCities()]).then(([categoryResult, cityResult]) => {
      if (!active) return;
      if (categoryResult.error || cityResult.error) {
        setError("تعذر تحميل التصنيفات أو المدن. تحقق من إعداد Supabase.");
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
    if (rating) params.set("rating", rating);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    window.history.replaceState(null, "", query ? `/suppliers?${query}` : "/suppliers");
  }, [search, categoryId, cityId, rating, page]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const timer = window.setTimeout(() => {
      void getSupplierProfiles({
        search,
        categoryId,
        cityId,
        rating: rating ? Number(rating) : undefined,
        page,
        pageSize: PAGE_SIZE,
      }).then((result) => {
        if (!active) return;
        if (result.error) {
          setError("تعذر تحميل الموردين حاليًا. تحقق من اتصال Supabase ثم حاول مرة أخرى.");
          setSuppliers([]);
          setTotalCount(0);
          setHasNextPage(false);
        } else {
          setSuppliers(result.suppliers);
          setTotalCount(result.totalCount);
          setHasNextPage(result.hasNextPage);
        }
        setLoading(false);
      });
    }, 400);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search, categoryId, cityId, rating, page, retryKey]);

  const cards: SupplierSummary[] = useMemo(() => suppliers.map((supplier) => ({
    id: supplier.id,
    name: supplier.company_name || "مورد بدون اسم تجاري",
    activityType: supplier.business_type || undefined,
    city: supplier.city?.name || undefined,
    services: supplier.categories.map((item) => item.name),
    avatarUrl: supplier.avatar_url ?? null,
  })), [suppliers]);

  function updateSearch(value: string) { setSearch(value); setPage(1); }

  return <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-950">
    <SiteHeader />

    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <p className="text-sm font-black text-slate-400">دليل الأعمال داخل مطلوب</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">الموردون</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">اعثر على المورد أو الشركة أو مقدم الخدمة المناسب لطلبك.</p>
        <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <label className="block text-sm font-black text-slate-700" htmlFor="supplier-search">البحث</label>
          <div className="mt-2 flex items-center rounded-2xl border border-slate-200 bg-white px-4 focus-within:border-slate-400"><span className="text-slate-400" aria-hidden="true">⌕</span><input id="supplier-search" value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="ابحث باسم الشركة أو النشاط أو الوصف..." className="w-full bg-transparent px-3 py-3.5 text-sm outline-none" /></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Select label="التصنيف" value={categoryId} onChange={(value) => { setCategoryId(value); setPage(1); }} options={categories.map((item) => ({ value: item.id, label: item.name }))} placeholder="كل التصنيفات" />
            <Select label="المدينة" value={cityId} onChange={(value) => { setCityId(value); setPage(1); }} options={cities.map((item) => ({ value: item.id, label: item.name }))} placeholder="كل المدن" />
            <label className="text-sm font-bold text-slate-700">الحد الأدنى للتقييم<select value={rating} onChange={(event) => { setRating(event.target.value); setPage(1); }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold outline-none"><option value="">كل التقييمات</option>{ratings.slice(1).map((value) => <option key={value} value={value}>{value} نجوم فأكثر</option>)}</select></label>
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-400">التوثيق وPRO غير مفعّلين لأن بنيتهما غير موجودة في قاعدة البيانات الحالية.</p>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      {loading ? <State title="جارٍ تحميل الموردين..." description="يتم جلب صفحة النتائج من قاعدة البيانات." />
        : error ? <ErrorState message={error} onRetry={() => setRetryKey((value) => value + 1)} />
        : cards.length === 0 ? <State title="لا يوجد موردون يطابقون البحث الحالي." description="جرّب تعديل البحث أو إزالة أحد الفلاتر." />
        : <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-slate-500"><span>الصفحة {page}</span>{totalCount > 0 && <span>{totalCount} نتيجة</span>}</div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{cards.map((supplier) => <SupplierCard key={supplier.id} supplier={supplier} />)}</div>
          <Pagination page={page} hasNextPage={hasNextPage} onPrevious={() => setPage((value) => Math.max(1, value - 1))} onNext={() => setPage((value) => value + 1)} totalCount={totalCount} pageSize={PAGE_SIZE} />
        </>}
    </section>
  </main>;
}

function Select({ label, options, value, onChange, placeholder }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="text-sm font-bold text-slate-700">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold outline-none"><option value="">{placeholder}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
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

function State({ title, description }: { title: string; description: string }) { return <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm"><div className="mx-auto grid size-16 place-items-center rounded-2xl bg-slate-50 text-slate-400"><span aria-hidden="true" className="text-2xl">▦</span></div><h2 className="mt-5 text-xl font-black">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-500">{description}</p></div>; }
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-16 text-center"><h2 className="text-xl font-black text-rose-800">تعذر تحميل الموردين</h2><p className="mt-2 text-sm text-rose-700">{message}</p><button type="button" onClick={onRetry} className="mt-5 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white">إعادة المحاولة</button></div>; }
