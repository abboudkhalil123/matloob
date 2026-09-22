import { useEffect, useState, type FormEvent } from "react";
import { PageIntro } from "./RequestsPage";
import { useAuth } from "../lib/auth";
import { createRequest, deleteRequest, getCategories, getCities } from "../services/requestService";
import { deleteRequestAttachment, uploadRequestAttachment } from "../services/attachmentService";
import type { Category, City } from "../types/request";

import SiteHeader from "../components/SiteHeader";
export default function CreateRequestPage() {
  const { profile } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loadingReferences, setLoadingReferences] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", quantity: "", unit: "", category_id: "", description: "", city_id: "", delivery_area: "", deadline: "", budget: "", preferred_contact: "", phone: "" });
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentResults, setAttachmentResults] = useState<{ name: string; status: "pending" | "success" | "error"; message?: string }[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all([getCategories(), getCities()]).then(([categoryResult, cityResult]) => {
      if (!active) return;
      if (categoryResult.error || cityResult.error) setError("تعذر تحميل التصنيفات أو المدن. تأكد من تطبيق Migration الخطوة الثامنة.");
      else { setCategories(categoryResult.categories); setCities(cityResult.cities); }
      setLoadingReferences(false);
    });
    return () => { active = false; };
  }, []);

  function update(key: keyof typeof form, value: string) { setForm(current => ({ ...current, [key]: value })); }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null); setError(null);
    if (!form.title.trim() || !form.category_id || !form.description.trim() || !form.city_id) {
      setError("يرجى تعبئة عنوان الطلب والتصنيف والوصف والمدينة.");
      return;
    }
    const invalid = attachmentFiles.some(file => file.size <= 0 || file.size > 10 * 1024 * 1024 || !new Set(["image/jpeg","image/png","image/webp","application/pdf"]).has(file.type) || !new Set(["jpg","jpeg","png","webp","pdf"]).has(file.name.toLowerCase().split(".").pop() || ""));
    if (invalid) {
      setError("يوجد مرفق غير صالح. المسموح JPG/JPEG/PNG/WEBP/PDF وبحد أقصى 10 MB.");
      return;
    }
    setSubmitting(true);
    const result = await createRequest({
      title: form.title.trim(), category_id: form.category_id, description: form.description.trim(),
      quantity: form.quantity ? Number(form.quantity) : null, unit: form.unit.trim() || null, city_id: form.city_id,
      delivery_area: form.delivery_area.trim() || null, deadline: form.deadline || null, budget: form.budget ? Number(form.budget) : null,
      preferred_contact: form.preferred_contact || null, phone: form.phone.trim() || null,
    });
    if (result.error || !result.request) { setSubmitting(false); setError(result.error?.message ?? "تعذر نشر الطلب."); return; }

    if (attachmentFiles.length) {
      const results = attachmentFiles.map(file => ({ name: file.name, status: "pending" as const }));
      setAttachmentResults(results);
      let uploadFailed: string | null = null;
      const uploadedAttachmentIds: string[] = [];
      for (let index = 0; index < attachmentFiles.length; index += 1) {
        const file = attachmentFiles[index];
        const uploaded = await Promise.race([
          uploadRequestAttachment(result.request.id, file),
          new Promise<Awaited<ReturnType<typeof uploadRequestAttachment>>>((resolve) => window.setTimeout(() => resolve({ item: null, error: new Error("انتهت مهلة رفع المرفق. تحقق من اتصال الإنترنت وحاول مرة أخرى.") }), 30000)),
        ]);
        if (uploaded.error || !uploaded.item) {
          uploadFailed = uploaded.error?.message || "تعذر رفع المرفق.";
          results[index] = { name: file.name, status: "error" };
          setAttachmentResults([...results]);
          break;
        }
        uploadedAttachmentIds.push(uploaded.item.id);
        results[index] = { name: file.name, status: "success" };
        setAttachmentResults([...results]);
      }
      if (uploadFailed) {
        for (const attachmentId of uploadedAttachmentIds) await deleteRequestAttachment(attachmentId);
        await deleteRequest(result.request.id);
        setSubmitting(false);
        setError(`لم يتم نشر الطلب لأن رفع المرفقات لم يكتمل: ${uploadFailed}`);
        return;
      }
    }

    setSubmitting(false);
    setMessage(attachmentFiles.length ? "تم نشر الطلب ورفع جميع المرفقات بنجاح." : "تم نشر الطلب بنجاح.");
    window.setTimeout(() => { window.location.href = `/requests/${result.request?.id}`; }, 700);
  }

  return <><SiteHeader /><main dir="rtl" className="min-h-screen bg-slate-50 text-slate-950"><PageIntro title="انشر طلبك" description="أدخل تفاصيل ما تحتاجه ليتم نشره في قاعدة البيانات." /><form onSubmit={submit} className="mx-auto max-w-4xl space-y-5 px-4 py-10 sm:px-6 lg:px-8">
    {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{message}</div>}
    {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</div>}
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-lg font-black">تفاصيل الطلب</h2><div className="mt-6 grid gap-5 sm:grid-cols-2">
      <Field label="عنوان الطلب" value={form.title} onChange={v => update("title", v)} required />
      <Field label="الكمية" type="number" value={form.quantity} onChange={v => update("quantity", v)} />
      <Field label="وحدة القياس" value={form.unit} onChange={v => update("unit", v)} />
      <SelectField label="التصنيف" value={form.category_id} onChange={v => update("category_id", v)} options={categories.map(item => ({ value: item.id, label: item.name }))} placeholder={loadingReferences ? "جارٍ التحميل..." : "اختر التصنيف"} disabled={loadingReferences} />
      <Field label="وصف تفصيلي" value={form.description} onChange={v => update("description", v)} textarea wide required />
      <SelectField label="المدينة" value={form.city_id} onChange={v => update("city_id", v)} options={cities.map(item => ({ value: item.id, label: item.name }))} placeholder={loadingReferences ? "جارٍ التحميل..." : "اختر المدينة"} disabled={loadingReferences} />
      <Field label="منطقة التسليم" value={form.delivery_area} onChange={v => update("delivery_area", v)} />
      <Field label="الموعد المطلوب" type="date" value={form.deadline} onChange={v => update("deadline", v)} />
      <Field label="الميزانية المتوقعة — اختياري" type="number" value={form.budget} onChange={v => update("budget", v)} />
    </div></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-lg font-black">التواصل</h2><div className="mt-6 grid gap-5 sm:grid-cols-2">
      <SelectField label="طريقة التواصل المفضلة" value={form.preferred_contact} onChange={v => update("preferred_contact", v)} options={[{ value: "phone", label: "الهاتف" }, { value: "whatsapp", label: "واتساب" }, { value: "platform", label: "رسائل المنصة" }]} placeholder="اختر طريقة التواصل" />
      <Field label="رقم الهاتف" type="tel" value={form.phone} onChange={v => update("phone", v)} />
      <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-600"><p className="font-bold text-slate-800">صاحب الطلب</p><p className="mt-1">{profile?.full_name || "حسابك الحالي"}</p></div>
      <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-600"><p className="font-bold text-slate-800">المرفقات</p><p className="mt-1">JPG / JPEG / PNG / WEBP / PDF — حتى 10 MB للملف.</p><input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" onChange={e => setAttachmentFiles(Array.from(e.target.files ?? []))} className="mt-3 block w-full text-sm" />{attachmentFiles.length > 0 && <div className="mt-3 space-y-2">{attachmentFiles.map((file) => <div key={`${file.name}-${file.size}`} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs"><span className="truncate font-bold">{file.name}</span><span>{(file.size / 1024 / 1024).toFixed(2)} MB</span></div>)}</div>}{attachmentResults.length > 0 && <div className="mt-3 space-y-2">{attachmentResults.map(item => <div key={item.name} className={`rounded-xl px-3 py-2 text-xs font-bold ${item.status === "success" ? "bg-emerald-50 text-emerald-700" : item.status === "error" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>{item.name}: {item.status === "success" ? "تم الرفع" : item.status === "error" ? `فشل: ${item.message || "تعذر الرفع"}` : "جارٍ الرفع..."}</div>)}</div>}</div>
    </div></section>
    <button disabled={submitting || loadingReferences} type="submit" className="w-full rounded-xl bg-slate-950 px-6 py-3.5 font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "جارٍ نشر الطلب..." : "نشر الطلب"}</button>
  </form></main></>;
}

function Field({ label, type = "text", value, onChange, textarea = false, wide = false, required = false }: { label: string; type?: string; value: string; onChange: (value: string) => void; textarea?: boolean; wide?: boolean; required?: boolean }) {
  const cls = `mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400 ${textarea ? "min-h-32 py-3" : "h-12"}`;
  return <label className={`text-sm font-bold text-slate-700 ${wide ? "sm:col-span-2" : ""}`}>{label}{textarea ? <textarea required={required} value={value} onChange={e => onChange(e.target.value)} className={cls} /> : <input required={required} type={type} value={value} onChange={e => onChange(e.target.value)} className={cls} />}</label>;
}
function SelectField({ label, options, value, onChange, placeholder, disabled = false }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (value: string) => void; placeholder: string; disabled?: boolean }) { return <label className="text-sm font-bold text-slate-700">{label}<select required value={value} disabled={disabled} onChange={e => onChange(e.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-slate-400 disabled:bg-slate-50"><option value="">{placeholder}</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
