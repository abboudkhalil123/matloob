export type RequestSummary = {
  id: string;
  title: string;
  category: string;
  city: string;
  quantity: string;
  unit: string;
  deliveryDate: string;
  offersCount: number;
  publishedAt: string;
  status: string;
};

type RequestCardProps = { request: RequestSummary };

export default function RequestCard({ request }: RequestCardProps) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
    <div className="flex items-start justify-between gap-4"><div><span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{request.category}</span><h3 className="mt-3 text-lg font-black text-slate-950">{request.title}</h3></div><span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{request.status}</span></div>
    <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-slate-600"><Info label="المدينة" value={request.city} /><Info label="الكمية" value={`${request.quantity} ${request.unit}`.trim()} /><Info label="موعد التسليم" value={request.deliveryDate} /><Info label="العروض" value="العروض غير متاحة في هذه المرحلة" /></div>
    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-400"><span>نشر: {request.publishedAt}</span><a href={`/requests/${request.id}`} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800">شاهد الطلب</a></div>
  </article>;
}
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 font-bold text-slate-700">{value}</p></div>; }
