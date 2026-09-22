type Props = { label: string; value: number | string; hint?: string };

export default function DashboardStatCard({ label, value, hint }: Props) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-sm font-bold text-slate-500">{label}</p>
    <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value}</p>
    {hint && <p className="mt-2 text-xs font-semibold text-slate-400">{hint}</p>}
  </article>;
}
