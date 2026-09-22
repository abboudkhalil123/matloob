import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import Brand from "../components/Brand";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [ready, setReady] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) {
      setError("إعداد Supabase غير مكتمل. لا يمكن إعادة تعيين كلمة المرور حاليًا.");
      setLoading(false);
      return;
    }

    let active = true;
    let recoveryEventReceived = false;

    const hasRecoveryUrl = (() => {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const queryParams = new URLSearchParams(window.location.search);
      return hashParams.get("type") === "recovery" || queryParams.get("type") === "recovery";
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" && session) {
        recoveryEventReceived = true;
        setReady(true);
        setLoading(false);
        setError("");
      }
    });

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;

      if (sessionError) {
        setError("تعذر التحقق من جلسة استعادة كلمة المرور. يرجى طلب رابط جديد.");
        setLoading(false);
        return;
      }

      if (data.session && (hasRecoveryUrl || recoveryEventReceived)) {
        setReady(true);
        setError("");
      } else {
        setError("رابط استعادة كلمة المرور غير صالح أو منتهي الصلاحية. يرجى طلب رابط جديد.");
      }
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSuccess("");
    setError("");

    if (!supabase) {
      setError("إعداد Supabase غير مكتمل. لا يمكن تغيير كلمة المرور حاليًا.");
      return;
    }

    if (!ready) {
      setError("لا توجد جلسة استعادة صالحة. يرجى استخدام رابط الاستعادة المرسل إلى بريدك.");
      return;
    }

    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }

    if (password.length < 6) {
      setError("يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.");
      return;
    }

    setUpdating(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setUpdating(false);

    if (updateError) {
      setError(updateError.message || "تعذر تغيير كلمة المرور. يرجى طلب رابط استعادة جديد.");
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setSuccess("تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.");
  }

  return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
    <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <a href="/" className="mb-8 flex items-center gap-3">
        <Brand />
      </a>
      <h1 className="text-2xl font-black">تعيين كلمة مرور جديدة</h1>
      <p className="mt-2 mb-7 text-sm leading-7 text-slate-500">أدخل كلمة المرور الجديدة لحسابك ثم أكدها لإتمام الاستعادة.</p>

      {loading ? (
        <Notice kind="info">جارٍ التحقق من رابط استعادة كلمة المرور...</Notice>
      ) : ready ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="كلمة المرور الجديدة" value={password} onChange={setPassword} />
          <Field label="تأكيد كلمة المرور" value={confirmPassword} onChange={setConfirmPassword} />
          {success && <Notice kind="success">{success}</Notice>}
          {error && <Notice kind="error">{error}</Notice>}
          <button disabled={updating || Boolean(success)} className="w-full rounded-xl bg-slate-950 px-5 py-3.5 font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
            {updating ? "جارٍ تغيير كلمة المرور..." : "تغيير كلمة المرور"}
          </button>
          <a href="/login" className="block text-center text-sm font-semibold text-slate-600 hover:text-slate-950">العودة إلى تسجيل الدخول</a>
        </form>
      ) : (
        <div className="space-y-5">
          {error && <Notice kind="error">{error}</Notice>}
          <a href="/forgot-password" className="block w-full rounded-xl bg-slate-950 px-5 py-3.5 text-center font-bold text-white transition hover:bg-slate-800">طلب رابط استعادة جديد</a>
          <a href="/login" className="block text-center text-sm font-semibold text-slate-600 hover:text-slate-950">العودة إلى تسجيل الدخول</a>
        </div>
      )}
    </section>
  </main>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block">
    <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
    <input type="password" value={value} onChange={(event) => onChange(event.target.value)} minLength={6} required className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />
  </label>;
}

function Notice({ kind, children }: { kind: "success" | "error" | "info"; children: ReactNode }) {
  const classes = kind === "success"
    ? "bg-emerald-50 text-emerald-700"
    : kind === "error"
      ? "bg-rose-50 text-rose-700"
      : "bg-slate-100 text-slate-600";

  return <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${classes}`}>{children}</div>;
}
