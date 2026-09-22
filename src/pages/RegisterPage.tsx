import { useState, type FormEvent, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import Brand from "../components/Brand";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState("طالب خدمة");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSuccess("");
    setError("");
    if (password !== confirm) {
      setError("كلمة المرور يجب أن تكون متطابقة.");
      return;
    }
    if (!supabase) {
      setError("إعداد Supabase غير مكتمل. لا يمكن إنشاء الحساب حاليًا.");
      return;
    }
    setLoading(true);
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim(), account_type: role } },
    });
    setLoading(false);
    if (authError) {
      setError(authError.message.includes("already") ? "هذا البريد الإلكتروني مستخدم بالفعل." : "حدث خطأ، حاول مرة أخرى.");
      return;
    }
    if (data.session) {
      setSuccess("تم إنشاء الحساب بنجاح.");
      window.location.replace("/");
    } else {
      setSuccess("تم إنشاء الحساب بنجاح. تحقق من بريدك الإلكتروني إذا كان التحقق مطلوبًا.");
    }
  }

  return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
    <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <a href="/" className="mb-8 flex items-center gap-3"><Brand /></a>
      <h1 className="text-2xl font-black">إنشاء حساب</h1>
      <p className="mt-2 mb-7 text-sm leading-7 text-slate-500">أنشئ حسابك وابدأ باستخدام مطلوب.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="الاسم" value={name} onChange={setName} />
        <Field label="البريد الإلكتروني" type="email" value={email} onChange={setEmail} required />
        <Field label="كلمة المرور" type="password" value={password} onChange={setPassword} required />
        <Field label="تأكيد كلمة المرور" type="password" value={confirm} onChange={setConfirm} required />
        <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">نوع الحساب</span><select value={role} onChange={(e) => setRole(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none"><option>طالب خدمة</option><option>مورد</option></select></label>
        {success && <Notice kind="success">{success}</Notice>}
        {error && <Notice kind="error">{error}</Notice>}
        <button disabled={loading} className="w-full rounded-xl bg-slate-950 px-5 py-3.5 font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">{loading ? "جارٍ إنشاء الحساب..." : "إنشاء الحساب"}</button>
        <p className="text-center text-sm font-semibold text-slate-600">لديك حساب؟ <a href="/login" className="text-slate-950">تسجيل الدخول</a></p>
      </form>
    </section>
  </main>;
}

function Field({ label, type = "text", value, onChange, required }: { label: string; type?: string; value: string; onChange: (value: string) => void; required?: boolean }) { return <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100" /></label>; }
function Notice({ kind, children }: { kind: "success" | "error"; children: ReactNode }) { return <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${kind === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{children}</div>; }
