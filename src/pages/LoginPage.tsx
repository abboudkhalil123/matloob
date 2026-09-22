import { useState, type FormEvent, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import Brand from "../components/Brand";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (!supabase) {
      setError("إعداد Supabase غير مكتمل. لا يمكن تسجيل الدخول حاليًا.");
      return;
    }
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (authError) {
      setError("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
      return;
    }
    setMessage("تم تسجيل الدخول بنجاح.");
    window.location.replace("/");
  }

  return <AuthShell title="تسجيل الدخول" subtitle="سجّل دخولك للوصول إلى حسابك في مطلوب.">
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="البريد الإلكتروني" type="email" value={email} onChange={setEmail} required />
      <Field label="كلمة المرور" type="password" value={password} onChange={setPassword} required />
      {message && <Notice kind="success">{message}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      <button disabled={loading} className="w-full rounded-xl bg-slate-950 px-5 py-3.5 font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
        {loading ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول"}
      </button>
      <div className="flex items-center justify-between text-sm font-semibold">
        <a className="text-slate-600 hover:text-slate-950" href="/register">إنشاء حساب</a>
        <a className="text-slate-600 hover:text-slate-950" href="/forgot-password">نسيت كلمة المرور؟</a>
      </div>
    </form>
  </AuthShell>;
}

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
    <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <a href="/" className="mb-8 flex items-center gap-3">
        <Brand />
      </a>
      <h1 className="text-2xl font-black">{title}</h1>
      <p className="mt-2 mb-7 text-sm leading-7 text-slate-500">{subtitle}</p>
      {children}
    </section>
  </main>;
}

function Field({ label, type, value, onChange, required }: { label: string; type: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <label className="block">
    <span className="mb-2 block text-sm font-bold text-slate-700">{label}</span>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />
  </label>;
}

function Notice({ kind, children }: { kind: "success" | "error"; children: ReactNode }) {
  return <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${kind === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{children}</div>;
}
