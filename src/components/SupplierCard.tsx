export type SupplierSummary = {
  id: string;
  name: string;
  activityType?: string;
  city?: string;
  services?: string[];
  avatarUrl?: string | null;
};

type SupplierCardProps = { supplier: SupplierSummary };

function SupplierCard({ supplier }: SupplierCardProps) {
  return <article className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
    <div className="flex items-start gap-4">
      <div className="supplier-avatar" aria-hidden="true">{supplier.avatarUrl ? <img src={supplier.avatarUrl} alt="" /> : <span>{supplier.name.trim().charAt(0) || "م"}</span>}</div>
      <div className="min-w-0 flex-1"><h3 className="truncate text-lg font-black text-slate-950">{supplier.name}</h3><p className="mt-1 text-sm font-semibold text-slate-500">{supplier.activityType || 'نوع النشاط غير محدد'}</p><p className="mt-2 text-sm text-slate-500">{supplier.city || 'المدينة غير محددة'}</p></div>
    </div>
    {supplier.services?.length ? <div className="mt-5 flex flex-wrap gap-2">{supplier.services.slice(0, 4).map((service) => <span key={service} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-600">{service}</span>)}</div> : null}
    <a href={`/suppliers/${supplier.id}`} className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800">عرض الملف</a>
  </article>;
}
export default SupplierCard;
