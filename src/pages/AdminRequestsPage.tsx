import { useEffect, useState } from "react";
import AdminRoute from "../components/AdminRoute";
import { getAdminRequests, deleteAdminRequest } from "../services/adminService";
import { getCategories, getCities } from "../services/requestService";
import { AdminPage } from "./AdminDashboardPage";
import type { Category, City, RequestStatus } from "../types/request";

export default function AdminRequestsPage() { return <AdminRoute><Content /></AdminRoute>; }

function Content() {
  const [search, setSearch] = useState(""); const [status, setStatus] = useState(""); const [cat, setCat] = useState(""); const [city, setCity] = useState("");
  const [cats, setCats] = useState<Category[]>([]); const [cities, setCities] = useState<City[]>([]); const [page, setPage] = useState(1);
  const [state, setState] = useState<Awaited<ReturnType<typeof getAdminRequests>> | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => { void Promise.all([getCategories(), getCities()]).then(([a, b]) => { setCats(a.categories); setCities(b.cities); }); }, []);
  async function load() { setLoading(true); const r = await getAdminRequests({ search, status: status as RequestStatus || undefined, categoryId: cat || undefined, cityId: city || undefined, page, pageSize: 12 }); setState(r); setError(r.error ? "تعذر تحميل الطلبات." : ""); setLoading(false); }
  useEffect(() => { const t = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(t); }, [search, status, cat, city, page]);
  return <AdminPage>
    <Head />
    <div className="mb-5 grid gap-3 lg:grid-cols-4">
      <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="بحث بالعنوان أو الوصف" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" />
      <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><option value="">كل الحالات</option>{["open","closed","supplier_selected","in_progress","completed","cancelled"].map(s => <option key={s} value={s}>{label(s)}</option>)}</select>
      <select value={cat} onChange={e => { setCat(e.target.value); setPage(1); }} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><option value="">كل التصنيفات</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <select value={city} onChange={e => { setCity(e.target.value); setPage(1); }} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><option value="">كل المدن</option>{cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
    </div>
    {error && <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}
    {loading ? <Loading /> : state?.requests.length ? <>
      <div className="grid gap-3">{state.requests.map(r => <article key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><h3 className="font-black">{r.title}</h3><p className="mt-1 text-sm text-slate-500">{r.requesterName || "صاحب طلب"} · {r.categoryName} · {r.cityName}</p><p className="mt-2 text-xs text-slate-400">{date(r.createdAt)} · {r.offerCount} عروض</p></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">{label(r.status)}</span><a href={`/requests/${r.id}`} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">تفاصيل الطلب</a><button type="button" onClick={async()=>{if(!window.confirm("حذف هذا الطلب نهائيًا؟")) return; const result=await deleteAdminRequest(r.id); if(result.error) window.alert(result.error.message); else void load();}} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700">حذف الطلب</button></div></div></article>)}</div>
      <Pager page={page} next={state.hasNextPage} total={state.totalCount} prev={() => setPage(p => Math.max(1, p - 1))} go={() => setPage(p => p + 1)} />
    </> : <Empty />}
  </AdminPage>;
}
function Head() { return <div className="mb-7 flex items-center justify-between"><div><p className="text-sm font-black text-slate-400">إدارة المنصة</p><h1 className="mt-1 text-3xl font-black">إدارة الطلبات</h1></div><a href="/admin" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold">لوحة الإدارة</a></div>; }
function label(s: string) { return ({open:"مفتوح",closed:"مغلق",supplier_selected:"تم اختيار المورد",in_progress:"قيد التنفيذ",completed:"مكتمل",cancelled:"ملغى"}[s] || s); }
function date(v: string) { return new Date(v).toLocaleDateString("ar-SY"); }
function Pager(p:{page:number;next:boolean;total:number;prev:()=>void;go:()=>void}) { return <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm"><span>إجمالي النتائج: {p.total}</span><div className="flex gap-2"><button disabled={p.page===1} onClick={p.prev} className="rounded-lg border px-3 py-2 disabled:opacity-40">السابق</button><b className="px-2 py-2">{p.page}</b><button disabled={!p.next} onClick={p.go} className="rounded-lg border px-3 py-2 disabled:opacity-40">التالي</button></div></div>; }
function Loading() { return <div className="rounded-2xl bg-white p-10 text-center font-bold">جارٍ التحميل...</div>; }
function Empty() { return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center font-bold text-slate-500">لا توجد طلبات مطابقة.</div>; }
