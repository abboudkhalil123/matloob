import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import Brand from "../components/Brand";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSuccess("");
    setError("");
    if (!supabase) { setError("إعداد Supabase غير مكتمل. لا يمكن إرسال الرابط حاليًا."); return; }
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setLoading(false);
    if (resetError) { setError("حدث خطأ، حاول مرة أخرى."); return; }
    setSuccess("تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني.");
  }

  return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
    <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <a href="/" className="mb-8 flex items-center gap-3"><Brand /></a>
      <h1 className="text-2xl font-black">استعادة كلمة المرور</h1>
      <p className="mt-2 mb-7 text-sm leading-7 text-slate-500">أدخل بريدك الإلكتروني لإرسال رابط استعادة كلمة المرور.</p>
      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">البريد الإلكتروني</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" /></label>
        {success && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{success}</div>}
        {error && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
        <button disabled={loading} className="w-full rounded-xl bg-slate-950 px-5 py-3.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{loading ? "جارٍ الإرسال..." : "إرسال رابط استعادة كلمة المرور"}</button>
        <a href="/login" className="block text-center text-sm font-semibold text-slate-600 hover:text-slate-950">العودة إلى تسجيل الدخول</a>
      </form>
    </section>
  </main>;
}
