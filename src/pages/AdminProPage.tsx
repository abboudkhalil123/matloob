import { useEffect, useState, type ReactNode } from "react";
import AdminRoute from "../components/AdminRoute";
import { activateProSubscription, cancelProSubscription, extendProSubscription, getAdminSubscriptions, getPendingProSubscriptions, setProExpiration } from "../services/adminSubscriptionService";
import type { AdminSubscription } from "../types/subscription";

const statusLabels: Record<AdminSubscription["status"], string> = { pending: "معلّق", active: "فعّال", expired: "منتهي", cancelled: "ملغى" };

export default function AdminProPage() {
  return <AdminRoute><AdminProContent /></AdminRoute>;
}

function AdminProContent() {
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([]);
  const [pending, setPending] = useState<AdminSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");

  async function load() {
    setLoading(true); setError("");
    const [all, queued] = await Promise.all([getAdminSubscriptions(), getPendingProSubscriptions()]);
    if (all.error || queued.error) setError(all.error?.message || queued.error?.message || "تعذر تحميل اشتراكات PRO.");
    setSubscriptions(all.subscriptions); setPending(queued.subscriptions); setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function activate(item: AdminSubscription) {
    if (!window.confirm(`هل تريد تفعيل PRO للمورد «${item.company_name || item.supplier_name || item.user_id}»؟ سيتم استخدام مدة خطة PRO من قاعدة البيانات ما لم تحدد تاريخًا مخصصًا.`)) return;
    setBusyId(item.id); setMessage("");
    const result = await activateProSubscription(item.id);
    if (result.error) setError(result.error.message || "تعذر تفعيل الاشتراك."); else setMessage("تم تفعيل اشتراك PRO بنجاح.");
    await load(); setBusyId("");
  }

  async function cancel(item: AdminSubscription) {
    if (!window.confirm(`هل تريد إلغاء اشتراك PRO للمورد «${item.company_name || item.supplier_name || item.user_id}»؟ لن يتم حذف السجل.`)) return;
    setBusyId(item.id); setMessage("");
    const result = await cancelProSubscription(item.id);
    if (result.error) setError(result.error.message || "تعذر إلغاء الاشتراك."); else setMessage("تم إلغاء اشتراك PRO.");
    await load(); setBusyId("");
  }

  async function extend(item: AdminSubscription) {
    const raw = window.prompt("أدخل عدد أيام التمديد (1 إلى 3650):", "30");
    if (raw === null) return;
    const days = Number(raw);
    if (!Number.isInteger(days) || days < 1 || days > 3650) { setError("عدد أيام التمديد يجب أن يكون بين 1 و3650."); return; }
    if (!window.confirm(`تأكيد تمديد الاشتراك ${days} يومًا؟`)) return;
    setBusyId(item.id); setMessage("");
    const result = await extendProSubscription(item.id, days);
    if (result.error) setError(result.error.message || "تعذر تمديد الاشتراك."); else setMessage("تم تمديد الاشتراك بنجاح.");
    await load(); setBusyId("");
  }

  async function setExpiration(item: AdminSubscription) {
    const initial = item.expires_at ? toLocalInputValue(item.expires_at) : "";
    const value = window.prompt("أدخل تاريخ ووقت الانتهاء بصيغة YYYY-MM-DDTHH:MM (التوقيت المحلي للمتصفح):", initial);
    if (value === null) return;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) { setError("تاريخ الانتهاء غير صالح."); return; }
    if (!window.confirm(`تأكيد تغيير تاريخ الانتهاء إلى ${parsed.toLocaleString("ar-SY")}؟`)) return;
    setBusyId(item.id); setMessage("");
    const result = await setProExpiration(item.id, parsed.toISOString());
    if (result.error) setError(result.error.message || "تعذر تغيير تاريخ الانتهاء."); else setMessage("تم تحديث تاريخ انتهاء الاشتراك.");
    await load(); setBusyId("");
  }

  if (loading) return <Page><State title="جارٍ تحميل إدارة PRO..." /></Page>;
  if (error && !subscriptions.length && !pending.length) return <Page><ErrorState message={error} onRetry={() => void load()} /></Page>;

  return <Page>
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-black text-slate-400">إدارة محددة</p><h1 className="mt-1 text-3xl font-black tracking-tight">إدارة اشتراكات PRO</h1><p className="mt-2 text-sm text-slate-500">هذه الصفحة مخصصة لإدارة اشتراكات PRO فقط، وليست لوحة تحكم إدارية عامة.</p></div>
      <button onClick={() => void load()} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold hover:bg-slate-50">تحديث البيانات</button>
    </div>
    {message && <div className="mb-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div>}
    {error && <div className="mb-5 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}

    <section className="mb-8 rounded-3xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">طلبات PRO المعلقة</h2><p className="mt-1 text-sm text-amber-800">تظهر هنا الطلبات التي لم يتم تفعيلها بعد.</p></div><span className="rounded-full bg-white px-3 py-1 text-sm font-black text-amber-800">{pending.length}</span></div>
      <div className="mt-5 grid gap-3">
        {pending.length === 0 ? <Empty text="لا توجد طلبات PRO معلقة حاليًا." /> : pending.map((item) => <SubscriptionCard key={item.id} item={item}><button disabled={busyId === item.id} onClick={() => void activate(item)} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busyId === item.id ? "جارٍ التنفيذ..." : "تفعيل PRO"}</button></SubscriptionCard>)}
      </div>
    </section>

    <section><h2 className="mb-4 text-xl font-black">اشتراكات PRO</h2><div className="grid gap-4">{subscriptions.length === 0 ? <Empty text="لا توجد اشتراكات PRO." /> : subscriptions.map((item) => <SubscriptionCard key={item.id} item={item}>
      <div className="flex flex-wrap gap-2">
        {(item.status === "active" || item.status === "pending") && <button disabled={busyId === item.id} onClick={() => void cancel(item)} className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700 disabled:opacity-50">إلغاء الاشتراك</button>}
        {(item.status === "active" || item.status === "expired") && <><button disabled={busyId === item.id} onClick={() => void extend(item)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 disabled:opacity-50">تمديد PRO</button><button disabled={busyId === item.id} onClick={() => void setExpiration(item)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">تحديد تاريخ الانتهاء</button></>}
      </div>
    </SubscriptionCard>)}</div></section>
  </Page>;
}

function SubscriptionCard({ item, children }: { item: AdminSubscription; children: ReactNode }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black">{item.company_name || item.supplier_name || "مورد بدون اسم"}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-black ${item.status === "active" ? "bg-emerald-50 text-emerald-700" : item.status === "pending" ? "bg-amber-50 text-amber-700" : item.status === "expired" ? "bg-slate-100 text-slate-600" : "bg-rose-50 text-rose-700"}`}>{statusLabels[item.status]}</span></div><p className="mt-1 text-sm font-bold text-slate-600">{item.supplier_name || "اسم المورد غير متوفر"}{item.business_type ? ` · ${item.business_type}` : ""}</p><p className="mt-2 break-all text-xs text-slate-400">معرّف المستخدم: {item.user_id}</p></div><div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4 lg:min-w-[600px]"><Info label="الخطة" value={item.plan_name} /><Info label="الحالة" value={statusLabels[item.status]} /><Info label="البداية" value={formatDate(item.started_at)} /><Info label="الانتهاء" value={formatDate(item.expires_at)} /><Info label="تاريخ الطلب" value={formatDate(item.created_at)} /></div></div><div className="mt-5 flex justify-end">{children}</div></article>;
}

function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-bold text-slate-400">{label}</p><p className="mt-1 font-bold text-slate-800">{value}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-7 text-center text-sm font-bold text-slate-500">{text}</div>; }
function State({ title }: { title: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><p className="font-black">{title}</p></div>; }
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm"><p className="font-black text-rose-700">{message}</p><button onClick={onRetry} className="mt-4 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">إعادة المحاولة</button></div>; }
function Page({ children }: { children: ReactNode }) { return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl">{children}</div></main>; }
function formatDate(value: string | null) { return value ? new Date(value).toLocaleString("ar-SY", { dateStyle: "medium", timeStyle: "short" }) : "—"; }
function toLocalInputValue(value: string) { const d = new Date(value); const pad = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
