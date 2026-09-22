import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../lib/auth";
import { isAdmin } from "../services/adminSubscriptionService";

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { loading, user, configured } = useAuth();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (loading || !user || !configured) {
      setChecking(!loading && Boolean(user));
      return () => { active = false; };
    }
    setChecking(true);
    void isAdmin().then((result) => {
      if (!active) return;
      setAllowed(result.isAdmin);
      setError(result.error ? "تعذر التحقق من صلاحية الإدارة." : "");
      setChecking(false);
    });
    return () => { active = false; };
  }, [configured, loading, user]);

  if (loading || checking) {
    return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50 px-4"><div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-center shadow-sm"><p className="font-black">جارٍ التحقق من صلاحية الإدارة...</p><p className="mt-2 text-sm text-slate-500">هذه الصفحة متاحة للمسؤولين فقط.</p></div></main>;
  }

  if (!configured) {
    return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50 px-4"><div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center"><h1 className="text-lg font-black text-amber-950">إعداد Supabase غير مكتمل</h1><p className="mt-2 text-sm leading-7 text-amber-900">لا يمكن التحقق من صلاحية الإدارة قبل إعداد الاتصال بقاعدة البيانات.</p></div></main>;
  }

  if (!user) {
    window.location.replace("/login");
    return null;
  }

  if (error || !allowed) {
    return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50 px-4"><div className="max-w-md rounded-2xl border border-rose-200 bg-white p-7 text-center shadow-sm"><div className="mx-auto grid size-12 place-items-center rounded-full bg-rose-50 text-xl">!</div><h1 className="mt-4 text-xl font-black">لا تملك صلاحية الوصول</h1><p className="mt-2 text-sm leading-7 text-slate-500">لوحة الإدارة متاحة للمسؤولين المصرّح لهم فقط.</p><a href="/" className="mt-5 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white">العودة للرئيسية</a></div></main>;
  }

  return <>{children}</>;
}
