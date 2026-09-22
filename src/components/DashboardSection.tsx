import type { ReactNode } from "react";

type Props = { title: string; action?: ReactNode; children: ReactNode };

export default function DashboardSection({ title, action, children }: Props) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-black tracking-tight">{title}</h2>
      {action}
    </div>
    <div className="mt-5">{children}</div>
  </section>;
}
