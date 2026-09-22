import { useEffect, useMemo, useState } from "react";
import AdminRoute from "../components/AdminRoute";
import { approveVerificationRequest, getAdminVerificationRequests, rejectVerificationRequest } from "../services/verificationService";
import type { VerificationRequest, VerificationStatus } from "../types/verification";

const labels: Record<VerificationStatus, string> = {
  pending: "معلّق",
  approved: "مقبول",
  rejected: "مرفوض",
  cancelled: "ملغى",
};

export default function AdminVerificationPage() {
  return <AdminRoute><AdminVerificationContent /></AdminRoute>;
}

function AdminVerificationContent() {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [filter, setFilter] = useState<"all" | VerificationStatus>("pending");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true); setError("");
    const result = await getAdminVerificationRequests();
    if (result.error) setError(result.error.message || "تعذر تحميل طلبات التوثيق.");
    setRequests(result.requests); setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => filter === "all" ? requests : requests.filter((item) => item.status === filter), [filter, requests]);

  async function approve(item: VerificationRequest) {
    const notes = window.prompt("ملاحظات الإدارة (اختياري):", "");
    if (notes === null) return;
    if (!window.confirm(`تأكيد توثيق المورد «${item.company_name || item.supplier_name || item.supplier_id}»؟`)) return;
    setBusyId(item.id); setError(""); setMessage("");
    const result = await approveVerificationRequest(item.id, notes);
    if (result.error) setError(result.error.message || "تعذر الموافقة على طلب التوثيق.");
    else setMessage("تم توثيق المورد بنجاح.");
    await load(); setBusyId("");
  }

  async function reject(item: VerificationRequest) {
    const notes = window.prompt("سبب/ملاحظات الرفض:", "");
    if (notes === null) return;
    if (!window.confirm(`تأكيد رفض طلب توثيق «${item.company_name || item.supplier_name || item.supplier_id}»؟`)) return;
    setBusyId(item.id); setError(""); setMessage("");
    const result = await rejectVerificationRequest(item.id, notes);
    if (result.error) setError(result.error.message || "تعذر رفض طلب التوثيق.");
    else setMessage("تم رفض طلب التوثيق.");
    await load(); setBusyId("");
  }

  return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-black text-slate-400">إدارة محددة</p><h1 className="mt-1 text-3xl font-black tracking-tight">إدارة توثيق الموردين</h1><p className="mt-2 text-sm text-slate-500">مراجعة طلبات التوثيق فقط. التوثيق مستقل عن PRO.</p></div>
        <button onClick={() => void load()} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold hover:bg-slate-50">تحديث البيانات</button>
      </div>
      {message && <div className="mb-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div>}
      {error && <div className="mb-5 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}
      <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        {([['all','الكل'],['pending','pending'],['approved','approved'],['rejected','rejected'],['cancelled','cancelled']] as const).map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className={`rounded-xl px-4 py-2.5 text-sm font-black ${filter === value ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>{label}</button>)}
      </div>
      {loading ? <State text="جارٍ تحميل طلبات التوثيق..." /> : filtered.length === 0 ? <State text="لا توجد طلبات ضمن هذا الفلتر." /> : <div className="grid gap-4">{filtered.map((item) => <VerificationCard key={item.id} item={item} busy={busyId === item.id} onApprove={() => void approve(item)} onReject={() => void reject(item)} />)}</div>}
    </div>
  </main>;
}

function VerificationCard({ item, busy, onApprove, onReject }: { item: VerificationRequest; busy: boolean; onApprove: () => void; onReject: () => void }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black">{item.company_name || item.supplier_name || "مورد بدون اسم"}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-black ${item.status === 'pending' ? 'bg-amber-50 text-amber-700' : item.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : item.status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{labels[item.status]}</span></div>
        <p className="mt-1 text-sm font-bold text-slate-600">{item.supplier_name || "اسم المورد غير متوفر"}{item.business_type ? ` · ${item.business_type}` : ""}{item.city_name ? ` · ${item.city_name}` : ""}</p>
        <p className="mt-2 break-all text-xs text-slate-400">User ID: {item.supplier_id}</p>
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4 lg:min-w-[600px]">
        <Info label="الحالة" value={labels[item.status]} /><Info label="تاريخ الطلب" value={formatDate(item.created_at)} /><Info label="المراجعة" value={formatDate(item.reviewed_at)} /><Info label="موثّق" value={item.verified ? "نعم" : "لا"} />
      </div>
    </div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <Note label="ملاحظات المورد" value={item.notes} />
      <Note label="ملاحظات الإدارة" value={item.admin_notes} />
    </div>
    {item.status === 'pending' && <div className="mt-5 flex flex-wrap justify-end gap-2"><button disabled={busy} onClick={onReject} className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-black text-rose-700 disabled:opacity-50">{busy ? 'جارٍ التنفيذ...' : 'رفض'}</button><button disabled={busy} onClick={onApprove} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">{busy ? 'جارٍ التنفيذ...' : 'موافقة'}</button></div>}
  </article>;
}

function Note({ label, value }: { label: string; value: string | null | undefined }) { return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400">{label}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{value || 'لا توجد ملاحظات.'}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-bold text-slate-400">{label}</p><p className="mt-1 font-bold text-slate-800">{value}</p></div>; }
function State({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm font-bold text-slate-500">{text}</div>; }
function formatDate(value: string | null) { return value ? new Date(value).toLocaleString('ar-SY', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; }
