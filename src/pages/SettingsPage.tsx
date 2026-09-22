import { useState } from "react";
import SiteHeader from "../components/SiteHeader";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
import { supabase } from "../lib/supabase";

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [notifications, setNotifications] = useState(() => localStorage.getItem("matloob-notifications") !== "off");
  const [busy, setBusy] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");

  async function changePassword() {
    setPasswordMessage(""); setPasswordError("");
    if (password.length < 8) { setPasswordError("يجب أن تكون كلمة المرور 8 أحرف على الأقل."); return; }
    if (password !== confirm) { setPasswordError("تأكيد كلمة المرور غير مطابق."); return; }
    if (!supabase) { setPasswordError("إعداد Supabase غير مكتمل."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setPasswordError(error.message); else { setPassword(""); setConfirm(""); setPasswordMessage("تم تغيير كلمة المرور بنجاح."); }
  }

  async function deleteAccount() {
    if (!supabase || !user) return;
    const confirmed = window.confirm("حذف الحساب نهائي ولا يمكن التراجع عنه. هل أنت متأكد؟");
    if (!confirmed) return;
    setBusy(true); setDeleteMessage("");
    const { error } = await supabase.rpc("delete_my_account");
    if (error) { setBusy(false); setDeleteMessage(error.message); return; }
    await signOut();
    window.location.replace("/");
  }

  function setNotificationsValue(value: boolean) { setNotifications(value); localStorage.setItem("matloob-notifications", value ? "on" : "off"); }

  return <><SiteHeader /><main dir="rtl" className="min-h-screen bg-slate-50 text-slate-950"><section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8"><div className="mb-7"><p className="text-sm font-black text-slate-400">مطلوب</p><h1 className="mt-2 text-3xl font-black">الإعدادات</h1><p className="mt-2 text-sm font-semibold text-slate-500">إدارة الأمان والمظهر والإشعارات وخصوصية الحساب.</p></div>
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">الأمان</h2><div className="mt-5 grid gap-3 sm:grid-cols-2"><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="كلمة المرور الجديدة" className="h-12 rounded-xl border border-slate-200 px-4 text-sm"/><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="تأكيد كلمة المرور" className="h-12 rounded-xl border border-slate-200 px-4 text-sm"/></div>{passwordError&&<p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{passwordError}</p>}{passwordMessage&&<p className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{passwordMessage}</p>}<div className="mt-4 flex flex-wrap gap-3"><button disabled={busy} onClick={()=>void changePassword()} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-50">تغيير كلمة المرور</button><button disabled={busy} onClick={()=>void signOut().then(r=>{if(!r.error) window.location.replace("/")})} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black">تسجيل الخروج</button></div></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">المظهر</h2><p className="mt-2 text-sm font-semibold text-slate-500">اختر المظهر الفاتح أو الداكن للموقع.</p><div className="mt-4 flex flex-wrap gap-3"><button onClick={()=>setTheme("light")} className={`rounded-xl px-5 py-3 text-sm font-black ${theme==="light"?"bg-slate-950 text-white":"border border-slate-200 bg-white"}`}>☀️ فاتح</button><button onClick={()=>setTheme("dark")} className={`rounded-xl px-5 py-3 text-sm font-black ${theme==="dark"?"bg-slate-950 text-white":"border border-slate-200 bg-white"}`}>🌙 داكن</button></div></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black">إعدادات الإشعارات</h2><label className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-4"><span className="font-bold">تشغيل الإشعارات</span><input type="checkbox" checked={notifications} onChange={e=>setNotificationsValue(e.target.checked)} className="size-5"/></label></section>
      <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-black text-rose-800">الحساب والخصوصية</h2><p className="mt-2 text-sm leading-7 text-slate-500">حذف الحساب إجراء نهائي. ستُحذف بيانات الحساب المرتبطة به وفق قواعد المنصة.</p>{deleteMessage&&<p className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{deleteMessage}</p>}<button disabled={busy} onClick={()=>void deleteAccount()} className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-black text-rose-700 disabled:opacity-50">حذف الحساب</button></section>
    </div>
  </section></main></>;
}
