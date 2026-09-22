import type { RequestStatus } from "../types/request";

const labels: Record<RequestStatus, string> = {
  open: "مفتوح",
  closed: "مغلق",
  supplier_selected: "تم اختيار مورد",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
  cancelled: "ملغى",
};

export default function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const classes: Record<RequestStatus, string> = {
    open: "bg-emerald-50 text-emerald-700",
    closed: "bg-slate-100 text-slate-600",
    supplier_selected: "bg-blue-50 text-blue-700",
    in_progress: "bg-amber-50 text-amber-700",
    completed: "bg-violet-50 text-violet-700",
    cancelled: "bg-rose-50 text-rose-700",
  };
  return <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-black ${classes[status]}`}>{labels[status]}</span>;
}
