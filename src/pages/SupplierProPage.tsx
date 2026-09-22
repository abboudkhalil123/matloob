import { useEffect, useMemo, useState, type ReactNode } from "react";
import ProtectedRoute from "../components/ProtectedRoute";
import SiteHeader from "../components/SiteHeader";
import { useAuth } from "../lib/auth";
import { createProSubscriptionRequest, getCurrentSubscription, getSubscriptionPlans } from "../services/subscriptionService";
import type { Subscription, SubscriptionPlan, SubscriptionStatus } from "../types/subscription";

const benefits = [
  ["الوصول إلى جميع الطلبات", "عند تفعيل PRO يمكنك تصفح جميع الطلبات المفتوحة، وليس فقط الطلبات المتاحة للخطة المجانية."],
  ["إشعارات المطابقة الفورية", "عند نشر طلب جديد يطابق تخصصك، يصلك إشعار داخل المنصة مباشرة."],
  ["طلب توثيق الحساب", "يمكن لمورد PRO إرسال طلب توثيق إلى الإدارة لرفع مستوى الثقة في ملفه."],
] as const;

export default function SupplierProPage() {
  return <ProtectedRoute><SupplierProContent /></ProtectedRoute>;
}

function SupplierProContent() {
  const { profile, profileLoading } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const [planResult, subscriptionResult] = await Promise.all([getSubscriptionPlans(), getCurrentSubscription()]);
    if (planResult.error || subscriptionResult.error) {
      setError("تعذر تحميل بيانات اشتراك PRO حاليًا. حاول مرة أخرى.");
    } else {
      setPlans(planResult.plans);
      setSubscription(subscriptionResult.subscription);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const proPlan = plans.find((plan) => plan.code === "PRO");
  const isSupplier = profile?.role === "supplier";
  const effectiveStatus = useMemo<SubscriptionStatus | "free">(() => {
    if (!subscription) return "free" as const;
    if (subscription.plan_code !== "PRO") return "free" as const;
    if (subscription.status === "active" && subscription.expires_at && new Date(subscription.expires_at).getTime() <= Date.now()) return "expired" as const;
    return subscription.status;
  }, [subscription]);

  async function requestPro() {
    setRequesting(true);
    setMessage("");
    const result = await createProSubscriptionRequest();
    if (result.error) setMessage(result.error.message || "تعذر إرسال الطلب.");
    else {
      setMessage("تم تسجيل طلب PRO كطلب قيد المراجعة. لا يتم تفعيل PRO تلقائيًا.");
      await load();
    }
    setRequesting(false);
  }

  if (profileLoading || loading) return <PageShell><State title="جارٍ تحميل حالة الاشتراك..." /></PageShell>;
  if (!isSupplier) return <PageShell><State title="صفحة PRO مخصصة للموردين فقط." description="هذا الحساب ليس حساب مورد، ولا يمكنه طلب اشتراك PRO." /></PageShell>;
  if (error) return <PageShell><ErrorState message={error} onRetry={() => void load()} /></PageShell>;

  return <PageShell>
    <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-black text-slate-400">اشتراك الموردين</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">PRO</h1>
        <p className="mt-3 text-slate-600">PRO تمنح المورد مزايا إضافية فعلية داخل المنصة، وتُفعّل فقط بعد تأكيد الدفع من الإدارة.</p>
        <div className="mt-7 rounded-2xl bg-slate-50 p-5">
          <p className="text-3xl font-black">{proPlan ? `${formatNumber(proPlan.price_syp)} ل.س` : "غير متاح"}</p>
          <p className="mt-1 text-sm font-bold text-slate-500">{proPlan?.duration_days ? `${proPlan.duration_days} يومًا` : ""} / شهر</p>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {benefits.map(([title, description]) => <div key={title} className={`rounded-2xl border p-4 ${effectiveStatus === "active" ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"}`}><div className="flex items-start gap-3"><span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-sm font-black ${effectiveStatus === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{effectiveStatus === "active" ? "✓" : "PRO"}</span><div><h2 className="font-black">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{description}</p></div></div></div>)}
        </div>
      </section>

      <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:sticky lg:top-6">
        <p className="text-sm font-black text-slate-400">حالة اشتراكك</p>
        <StatusBlock status={effectiveStatus} subscription={subscription} />
        {message && <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold leading-7 text-slate-700">{message}</div>}
        {effectiveStatus === "free" || effectiveStatus === "expired" || effectiveStatus === "cancelled" ? <>
          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="font-black text-blue-900">الدفع وتفعيل PRO</p>
            <p className="mt-2 text-sm leading-7 text-blue-800">قبل طلب الاشتراك، تواصل مع الإدارة عبر Telegram لإتمام الدفع. لن يتم تفعيل حسابك كـ PRO إلا بعد تأكيد الدفع من الإدارة.</p>
            <a href="https://t.me/abboudkhalil" target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white">تواصل مع الإدارة عبر Telegram</a>
          </div>
          <button type="button" disabled={requesting || !proPlan} onClick={() => void requestPro()} className="mt-3 w-full rounded-xl border border-slate-200 px-5 py-3 font-black text-slate-900 disabled:cursor-not-allowed disabled:opacity-50">{requesting ? "جارٍ إرسال الطلب..." : `طلب اشتراك PRO — ${proPlan ? formatNumber(proPlan.price_syp) : "500"} ل.س`}</button>
        </> : null}
      </aside>
    </div>
  </PageShell>;
}

function StatusBlock({ status, subscription }: { status: string; subscription: Subscription | null }) {
  if (status === "active" && subscription) {
    const days = subscription.expires_at ? Math.max(0, Math.ceil((new Date(subscription.expires_at).getTime() - Date.now()) / 86400000)) : null;
    return <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-2xl font-black text-emerald-800">PRO</p><p className="mt-3 text-sm font-bold text-emerald-800">تاريخ البداية: {formatDate(subscription.started_at)}</p><p className="mt-1 text-sm font-bold text-emerald-800">تاريخ الانتهاء: {formatDate(subscription.expires_at)}</p>{days !== null && <p className="mt-1 text-sm font-black text-emerald-800">الأيام المتبقية: {days}</p>}</div>;
  }
  if (status === "pending") return <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-black leading-7 text-amber-900">طلب اشتراك PRO قيد المراجعة.</div>;
  if (status === "expired") return <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-black leading-7 text-slate-700">انتهى اشتراك PRO الخاص بك.</div>;
  if (status === "cancelled") return <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-black leading-7 text-slate-700">اشتراك PRO ملغى.</div>;
  return <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm font-black leading-7 text-slate-700">أنت حاليًا على الخطة المجانية.</div>;
}

function PageShell({ children }: { children: ReactNode }) { return <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-950"><SiteHeader /><section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</section></main>; }
function State({ title, description }: { title: string; description?: string }) { return <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><h1 className="text-xl font-black">{title}</h1>{description && <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>}</div>; }
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-16 text-center"><h1 className="text-xl font-black text-rose-800">تعذر تحميل بيانات الاشتراك</h1><p className="mt-2 text-sm text-rose-700">{message}</p><button type="button" onClick={onRetry} className="mt-5 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white">إعادة المحاولة</button></div>; }
function formatNumber(value: number) { return new Intl.NumberFormat("ar-SY", { maximumFractionDigits: 2 }).format(value); }
function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat("ar-SY", { dateStyle: "medium" }).format(new Date(value)) : "غير محدد"; }
