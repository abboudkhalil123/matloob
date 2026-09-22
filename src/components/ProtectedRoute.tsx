import type { ReactNode } from "react";
import { useAuth } from "../lib/auth";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { loading, user, configured } = useAuth();

  if (loading) {
    return (
      <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-center shadow-sm">
          <p className="font-black text-slate-900">جارٍ التحقق من تسجيل الدخول...</p>
          <p className="mt-2 text-sm text-slate-500">يرجى الانتظار لحظة.</p>
        </div>
      </main>
    );
  }

  if (!configured) {
    return (
      <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <h1 className="text-lg font-black text-amber-950">إعداد تسجيل الدخول غير مكتمل</h1>
          <p className="mt-2 text-sm leading-7 text-amber-900">
            يجب إعداد اتصال Supabase أولًا حتى يمكن الوصول إلى هذه الصفحة.
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    window.location.replace("/login");
    return null;
  }

  return <>{children}</>;
}
