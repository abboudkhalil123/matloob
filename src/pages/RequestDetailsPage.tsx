import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type InputHTMLAttributes, type SetStateAction, type TextareaHTMLAttributes } from "react";
import { PageIntro } from "./RequestsPage";
import { useAuth } from "../lib/auth";
import { cancelRequest, closeRequest, completeRequest, getCategories, getCities, getRequestById, selectOffer, startRequestExecution, updateRequest } from "../services/requestService";
import { getCurrentSupplierProfile } from "../services/supplierService";
import { createOffer, deleteOffer, getOffersForRequest, updateOffer } from "../services/offerService";
import { createSupplierReview, hasReviewedRequest } from "../services/reviewService";
import { deleteOfferAttachment, deleteRequestAttachment, getOfferAttachments, getRequestAttachments, uploadOfferAttachment, uploadRequestAttachment } from "../services/attachmentService";
import { isRequestSaved, saveRequest, unsaveRequest } from "../services/savedRequestService";
import type { OfferAttachment, RequestAttachment } from "../types/attachment";
import type { Request, RequestStatus } from "../types/request";
import type { Offer, OfferDurationUnit } from "../types/offer";

import SiteHeader from "../components/SiteHeader";
const durationOptions: { value: OfferDurationUnit; label: string }[] = [
  { value: "hours", label: "ساعات" },
  { value: "days", label: "أيام" },
  { value: "weeks", label: "أسابيع" },
  { value: "months", label: "أشهر" },
];

const emptyOffer = {
  price: "",
  currency: "SYP",
  duration_value: "",
  duration_unit: "days" as OfferDurationUnit,
  details: "",
  payment_terms: "",
  notes: "",
};

export default function RequestDetailsPage() {
  const id = window.location.pathname.split("/").filter(Boolean).pop() ?? "";
  const { user, profile, loading: authLoading } = useAuth();
  const [request, setRequest] = useState<Request | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offersLoading, setOffersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibilityDenied, setVisibilityDenied] = useState(false);
  const [offerError, setOfferError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectingOfferId, setSelectingOfferId] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyOffer);
  const [reviewed, setReviewed] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [requestAttachments, setRequestAttachments] = useState<RequestAttachment[]>([]);
  const [requestAttachmentFiles, setRequestAttachmentFiles] = useState<File[]>([]);
  const [requestAttachmentBusy, setRequestAttachmentBusy] = useState(false);
  const [requestAttachmentError, setRequestAttachmentError] = useState("");
  const [offerAttachments, setOfferAttachments] = useState<Record<string, OfferAttachment[]>>({});
  const [offerAttachmentFiles, setOfferAttachmentFiles] = useState<File[]>([]);
  const [editingOfferAttachments, setEditingOfferAttachments] = useState<OfferAttachment[]>([]);
  const [offerAttachmentBusy, setOfferAttachmentBusy] = useState(false);
  const [requestSaved, setRequestSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [editingRequest, setEditingRequest] = useState(false);
  const [requestEditSaving, setRequestEditSaving] = useState(false);
  const [requestEditError, setRequestEditError] = useState("");
  const [editCategories, setEditCategories] = useState<Awaited<ReturnType<typeof getCategories>>["categories"]>([]);
  const [editCities, setEditCities] = useState<Awaited<ReturnType<typeof getCities>>["cities"]>([]);
  const [requestEditForm, setRequestEditForm] = useState({ title: "", category_id: "", description: "", quantity: "", unit: "", city_id: "", delivery_area: "", deadline: "", budget: "", preferred_contact: "", phone: "" });

  const isOwner = Boolean(user && request && request.requester_id === user.id);
  const myOffer = useMemo(() => supplierId ? offers.find((offer) => offer.supplier_id === supplierId) ?? null : null, [offers, supplierId]);
  const canOffer = Boolean(user && profile?.role === "supplier" && request?.status === "open" && !isOwner && supplierId);
  const selectedOffer = useMemo(() => request?.selected_offer_id ? offers.find((offer) => offer.id === request.selected_offer_id) ?? null : null, [offers, request?.selected_offer_id]);
  const isSelectedSupplier = Boolean(user && supplierId && selectedOffer?.supplier_id === supplierId);
  const canStartExecution = Boolean(request && request.status === "supplier_selected" && (isOwner || isSelectedSupplier));
  const canCompleteRequest = Boolean(request && request.status === "in_progress" && (isOwner || isSelectedSupplier));
  const canCancelRequest = Boolean(request && ((request.status === "open" && isOwner) || ((request.status === "supplier_selected" || request.status === "in_progress") && (isOwner || isSelectedSupplier))));
  const canReviewSupplier = Boolean(user && isOwner && request?.status === "completed" && request.selected_offer_id);
  const canManageSavedRequest = Boolean(user && profile?.role === "supplier" && supplierId && request && !isOwner && (request.status === "open" || requestSaved));
  const canEditRequest = Boolean(isOwner && request?.status === "open");

  async function loadRequestAttachments() {
    if (!id || !user) { setRequestAttachments([]); return; }
    const result = await getRequestAttachments(id);
    if (!result.error) setRequestAttachments(result.attachments);
  }

  async function loadOfferAttachmentsFor(offerList: Offer[]) {
    const visible = offerList.filter(offer => isOwner || offer.supplier_id === supplierId);
    const pairs = await Promise.all(visible.map(async offer => [offer.id, await getOfferAttachments(offer.id)] as const));
    const next: Record<string, OfferAttachment[]> = {};
    pairs.forEach(([offerId, result]) => { if (!result.error) next[offerId] = result.attachments; });
    setOfferAttachments(next);
  }

  async function loadOffers() {
    if (!id || !user) {
      setOffers([]);
      return;
    }
    setOffersLoading(true);
    const result = await getOffersForRequest(id);
    if (result.error) setOfferError("تعذر تحميل العروض حاليًا.");
    else { setOffers(result.offers); await loadOfferAttachmentsFor(result.offers); }
    setOffersLoading(false);
  }

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      const result = await getRequestById(id);
      if (!active) return;
      if (result.error) {
        setError("تعذر تحميل تفاصيل الطلب حاليًا.");
      } else if (!result.request && user && profile?.role === "supplier") {
        setVisibilityDenied(true);
        setRequest(null);
      } else {
        setRequest(result.request);
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    let active = true;
    async function loadSupplier() {
      if (!user || profile?.role !== "supplier") {
        setSupplierId(null);
        return;
      }
      const result = await getCurrentSupplierProfile();
      if (active) setSupplierId(result.profile?.id ?? null);
    }
    void loadSupplier();
    return () => { active = false; };
  }, [user, profile?.role]);

  useEffect(() => {
    if (!authLoading && user && request) { void loadOffers(); void loadRequestAttachments(); }
  }, [authLoading, user, request?.id, supplierId]);

  useEffect(() => {
    let active = true;
    async function loadSavedState() {
      if (!user || profile?.role !== "supplier" || !request || isOwner) {
        setRequestSaved(false);
        return;
      }
      const result = await isRequestSaved(request.id);
      if (active) {
        setRequestSaved(result.saved);
        if (result.error) setSaveError("تعذر التحقق من حالة الحفظ حاليًا.");
      }
    }
    void loadSavedState();
    return () => { active = false; };
  }, [user, profile?.role, request?.id, isOwner]);

  function startEditRequest() {
    if (!request || !canEditRequest) return;
    setRequestEditError("");
    setRequestEditForm({ title: request.title, category_id: request.category_id, description: request.description, quantity: request.quantity == null ? "" : String(request.quantity), unit: request.unit ?? "", city_id: request.city_id, delivery_area: request.delivery_area ?? "", deadline: request.deadline ?? "", budget: request.budget == null ? "" : String(request.budget), preferred_contact: request.preferred_contact ?? "", phone: request.phone ?? "" });
    void Promise.all([getCategories(), getCities()]).then(([categories, cities]) => {
      if (!categories.error) setEditCategories(categories.categories);
      if (!cities.error) setEditCities(cities.cities);
      if (categories.error || cities.error) setRequestEditError("تعذر تحميل التصنيفات أو المدن.");
    });
    setEditingRequest(true);
  }

  async function handleRequestEditSubmit(event: FormEvent) {
    event.preventDefault();
    if (!request || !canEditRequest || requestEditSaving) return;
    setRequestEditError("");
    if (!requestEditForm.title.trim() || !requestEditForm.category_id || !requestEditForm.description.trim() || !requestEditForm.city_id) {
      setRequestEditError("العنوان والتصنيف والوصف والمدينة حقول مطلوبة.");
      return;
    }
    const quantity = requestEditForm.quantity.trim() ? Number(requestEditForm.quantity) : null;
    const budget = requestEditForm.budget.trim() ? Number(requestEditForm.budget) : null;
    if (quantity !== null && (!Number.isFinite(quantity) || quantity < 0)) { setRequestEditError("أدخل كمية صحيحة."); return; }
    if (budget !== null && (!Number.isFinite(budget) || budget < 0)) { setRequestEditError("أدخل ميزانية صحيحة."); return; }
    setRequestEditSaving(true);
    const result = await updateRequest(request.id, { title: requestEditForm.title.trim(), category_id: requestEditForm.category_id, description: requestEditForm.description.trim(), quantity, unit: requestEditForm.unit.trim() || null, city_id: requestEditForm.city_id, delivery_area: requestEditForm.delivery_area.trim() || null, deadline: requestEditForm.deadline || null, budget, preferred_contact: requestEditForm.preferred_contact.trim() || null, phone: requestEditForm.phone.trim() || null });
    if (result.error) setRequestEditError(result.error.message || "تعذر تعديل الطلب.");
    else { setRequest(result.request); setEditingRequest(false); setMessage("تم تعديل الطلب بنجاح."); }
    setRequestEditSaving(false);
  }

  async function handleSaveToggle() {
    if (!request || !canManageSavedRequest) return;
    setSaveBusy(true);
    setSaveError("");
    if (requestSaved) {
      const result = await unsaveRequest(request.id);
      if (result.error) setSaveError(result.error.message || "تعذر إلغاء حفظ الطلب.");
      else setRequestSaved(false);
    } else {
      const result = await saveRequest(request.id);
      if (result.error) setSaveError(result.error.message || "تعذر حفظ الطلب.");
      else setRequestSaved(true);
    }
    setSaveBusy(false);
  }

  useEffect(() => {
    let active = true;
    async function loadReviewState() {
      if (!canReviewSupplier || !request) { setReviewed(false); return; }
      setReviewLoading(true);
      const result = await hasReviewedRequest(request.id);
      if (active) {
        setReviewed(result.reviewed);
        if (result.error) setReviewError("تعذر التحقق من حالة التقييم حاليًا.");
        setReviewLoading(false);
      }
    }
    void loadReviewState();
    return () => { active = false; };
  }, [canReviewSupplier, request?.id]);

  async function handleReviewSubmit(event: FormEvent) {
    event.preventDefault();
    if (!request || !canReviewSupplier || reviewed || reviewSaving) return;
    setReviewError("");
    if (reviewRating < 1 || reviewRating > 5) { setReviewError("اختر تقييمًا من 1 إلى 5 نجوم."); return; }
    if (reviewComment.trim().length > 2000) { setReviewError("التعليق طويل جدًا. الحد الأقصى 2000 محرف."); return; }
    setReviewSaving(true);
    const result = await createSupplierReview({ request_id: request.id, rating: reviewRating, comment: reviewComment });
    if (result.error) {
      setReviewError(result.error.message || "تعذر إرسال التقييم.");
    } else {
      const [reviewState, refreshed] = await Promise.all([hasReviewedRequest(request.id), getRequestById(request.id)]);
      setReviewed(reviewState.reviewed);
      if (refreshed.request) setRequest(refreshed.request);
      setReviewRating(0);
      setReviewComment("");
      setMessage("تم إرسال تقييم المورد بنجاح.");
    }
    setReviewSaving(false);
  }

  useEffect(() => {
    if (!myOffer) return;
    if (editingOfferId === null) return;
    setForm({
      price: String(myOffer.price),
      currency: myOffer.currency,
      duration_value: myOffer.duration_value == null ? "" : String(myOffer.duration_value),
      duration_unit: myOffer.duration_unit ?? "days",
      details: myOffer.details,
      payment_terms: myOffer.payment_terms ?? "",
      notes: myOffer.notes ?? "",
    });
  }, [editingOfferId, myOffer]);

  function startEdit(offer: Offer) {
    setOfferError("");
    setMessage("");
    setEditingOfferId(offer.id);
    void getOfferAttachments(offer.id).then(result => { if (!result.error) setEditingOfferAttachments(result.attachments); });
    setOfferAttachmentFiles([]);
    setForm({
      price: String(offer.price),
      currency: offer.currency,
      duration_value: offer.duration_value == null ? "" : String(offer.duration_value),
      duration_unit: offer.duration_unit ?? "days",
      details: offer.details,
      payment_terms: offer.payment_terms ?? "",
      notes: offer.notes ?? "",
    });
  }

  function startCreate() {
    setOfferError("");
    setMessage("");
    setEditingOfferId("new");
    setForm(emptyOffer);
    setOfferAttachmentFiles([]);
    setEditingOfferAttachments([]);
  }

  function cancelForm() {
    setEditingOfferId(null);
    setForm(emptyOffer);
    setOfferError("");
    setOfferAttachmentFiles([]);
    setEditingOfferAttachments([]);
  }

  async function handleOfferSubmit(event: FormEvent) {
    event.preventDefault();
    if (!request || !supplierId) return;
    setOfferError("");
    setMessage("");
    const price = Number(form.price);
    const duration = form.duration_value.trim() ? Number(form.duration_value) : null;
    if (!Number.isFinite(price) || price < 0) { setOfferError("أدخل سعرًا صحيحًا."); return; }
    if (duration !== null && (!Number.isInteger(duration) || duration <= 0)) { setOfferError("أدخل مدة تنفيذ صحيحة."); return; }
    if (!form.details.trim()) { setOfferError("تفاصيل العرض مطلوبة."); return; }

    setSaving(true);
    const data = {
      request_id: request.id,
      supplier_id: supplierId,
      price,
      currency: form.currency.trim() || "SYP",
      duration_value: duration,
      duration_unit: duration === null ? null : form.duration_unit,
      details: form.details.trim(),
      payment_terms: form.payment_terms.trim() || null,
      notes: form.notes.trim() || null,
    };

    const result = editingOfferId && editingOfferId !== "new"
      ? await updateOffer(editingOfferId, { price: data.price, currency: data.currency, duration_value: data.duration_value, duration_unit: data.duration_unit, details: data.details, payment_terms: data.payment_terms, notes: data.notes })
      : await createOffer(data);

    if (result.error) {
      setOfferError(result.error.message || "تعذر حفظ العرض.");
    } else {
      const offerId = result.offer?.id;
      const attachmentFailures: string[] = [];
      if (offerId && offerAttachmentFiles.length) {
        setOfferAttachmentBusy(true);
        for (const file of offerAttachmentFiles) {
          const uploaded = await uploadOfferAttachment(offerId, file);
          if (uploaded.error) attachmentFailures.push(`${file.name}: ${uploaded.error.message}`);
        }
        setOfferAttachmentBusy(false);
      }
      setMessage(attachmentFailures.length ? `تم حفظ العرض، لكن تعذر رفع بعض المرفقات: ${attachmentFailures.join(" | ")}` : (editingOfferId === "new" ? "تم تقديم العرض بنجاح." : "تم تعديل العرض بنجاح."));
      setEditingOfferId(null);
      setForm(emptyOffer);
      setOfferAttachmentFiles([]);
      setEditingOfferAttachments([]);
      await loadOffers();
    }
    setSaving(false);
  }

  async function handleRequestAttachmentUpload() {
    if (!request || !isOwner || !requestAttachmentFiles.length) return;
    setRequestAttachmentError("");
    setRequestAttachmentBusy(true);
    const failures: string[] = [];
    for (const file of requestAttachmentFiles) {
      const result = await uploadRequestAttachment(request.id, file);
      if (result.error) failures.push(`${file.name}: ${result.error.message}`);
    }
    setRequestAttachmentFiles([]);
    await loadRequestAttachments();
    setRequestAttachmentBusy(false);
    if (failures.length) setRequestAttachmentError(`بعض الملفات لم تُرفع: ${failures.join(" | ")}`);
    else setMessage("تم رفع المرفقات بنجاح.");
  }

  async function handleDeleteRequestAttachment(item: RequestAttachment) {
    if (!window.confirm("هل تريد حذف هذا المرفق؟")) return;
    const result = await deleteRequestAttachment(item.id);
    if (result.error) setRequestAttachmentError(result.error.message || "تعذر حذف المرفق.");
    else { setRequestAttachments(current => current.filter(file => file.id !== item.id)); setMessage("تم حذف المرفق."); }
  }

  async function handleDeleteOfferAttachment(item: OfferAttachment) {
    if (!window.confirm("هل تريد حذف هذا المرفق؟")) return;
    const result = await deleteOfferAttachment(item.id);
    if (result.error) setOfferError(result.error.message || "تعذر حذف مرفق العرض.");
    else { setOfferAttachments(current => ({ ...current, [item.offer_id]: (current[item.offer_id] ?? []).filter(file => file.id !== item.id) })); setEditingOfferAttachments(current => current.filter(file => file.id !== item.id)); setMessage("تم حذف مرفق العرض."); }
  }

  async function handleSelectOffer(offer: Offer) {
    if (!request || !isOwner || request.status !== "open") return;
    const confirmed = window.confirm("هل أنت متأكد من اختيار هذا العرض؟ بعد الاختيار سيتم اعتماد المورد لهذا الطلب.");
    if (!confirmed) return;

    setOfferError("");
    setMessage("");
    setSelectingOfferId(offer.id);
    const result = await selectOffer(request.id, offer.id);

    if (result.error) {
      setOfferError(result.error.message || "تعذر اختيار العرض.");
    } else {
      const refreshed = await getRequestById(request.id);
      if (refreshed.error || !refreshed.request) {
        setOfferError("تم اختيار العرض، لكن تعذر تحديث تفاصيل الطلب حاليًا.");
      } else {
        setRequest(refreshed.request);
        setMessage("تم اختيار العرض وتثبيت المورد بنجاح.");
        await loadOffers();
      }
    }
    setSelectingOfferId(null);
  }

  async function handleWorkflowAction(action: "start" | "complete" | "close" | "cancel") {
    if (!request || transitioning) return;
    const confirmations: Record<typeof action, string> = {
      start: "هل تريد بدء تنفيذ هذا الطلب؟",
      complete: "هل تؤكد إكمال هذا الطلب؟",
      close: "هل تريد إغلاق هذا الطلب؟ بعد الإغلاق لن يمكن إعادة فتحه.",
      cancel: "هل تريد إلغاء هذا الطلب؟ لا يمكن التراجع عن الإلغاء."
    };
    if (!window.confirm(confirmations[action])) return;

    setOfferError("");
    setMessage("");
    setTransitioning(true);

    const result = action === "start"
      ? await startRequestExecution(request.id)
      : action === "complete"
        ? await completeRequest(request.id)
        : action === "close"
          ? await closeRequest(request.id)
          : await cancelRequest(request.id);

    if (result.error) {
      setOfferError(result.error.message || "تعذر تنفيذ العملية.");
    } else {
      const refreshed = await getRequestById(request.id);
      if (refreshed.error || !refreshed.request) {
        setOfferError("تم تنفيذ العملية، لكن تعذر تحديث تفاصيل الطلب حاليًا.");
      } else {
        setRequest(refreshed.request);
        setMessage(
          action === "start" ? "تم بدء تنفيذ الطلب بنجاح." :
          action === "complete" ? "تم إكمال الطلب بنجاح." :
          action === "close" ? "تم إغلاق الطلب بنجاح." :
          "تم إلغاء الطلب بنجاح."
        );
        await loadOffers();
      }
    }

    setTransitioning(false);
  }

  async function handleDelete(offerId: string) {
    if (!window.confirm("هل تريد حذف عرضك؟")) return;
    setOfferError("");
    setMessage("");
    const result = await deleteOffer(offerId);
    if (result.error) setOfferError(result.error.message || "تعذر حذف العرض.");
    else { setMessage("تم حذف العرض."); await loadOffers(); }
  }

  return <><SiteHeader /><main dir="rtl" className="min-h-screen bg-slate-50 text-slate-950">
    <PageIntro title="تفاصيل الطلب" description="عرض تفاصيل الطلب المنشور من قاعدة البيانات." />
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {loading ? <State title="جارٍ تحميل الطلب..." description="يتم جلب تفاصيل الطلب من قاعدة البيانات وفق صلاحيات الوصول." />
        : visibilityDenied ? <State title="هذا الطلب غير متاح لك حاليًا." description="لا يسمح نظام ظهور الطلبات لهذا المورد بالوصول إلى هذا الطلب." />
        : error ? <State title="تعذر تحميل الطلب" description={error} error />
        : !request ? <State title="الطلب غير موجود" description="لم يتم العثور على طلب حقيقي مرتبط بهذا المعرف." />
        : <>
          <RequestContent request={request} attachments={requestAttachments} />
          {canEditRequest && <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">إدارة الطلب</h2><p className="mt-1 text-sm text-slate-500">يمكنك تعديل الطلب طالما أنه ما زال مفتوحًا.</p></div>{!editingRequest && <button type="button" onClick={startEditRequest} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white">تعديل الطلب</button>}</div>
            {editingRequest && <form onSubmit={handleRequestEditSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
              {requestEditError && <div className="sm:col-span-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{requestEditError}</div>}
              <Field label="عنوان الطلب *" value={requestEditForm.title} onChange={e => setRequestEditForm(v => ({...v,title:e.target.value}))} />
              <label className="block text-sm font-black text-slate-700">التصنيف *<select value={requestEditForm.category_id} onChange={e => setRequestEditForm(v => ({...v,category_id:e.target.value}))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none"><option value="">اختر التصنيف</option>{editCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <div className="sm:col-span-2"><Field label="الوصف *" textarea value={requestEditForm.description} onChange={e => setRequestEditForm(v => ({...v,description:e.target.value}))} /></div>
              <Field label="الكمية" type="number" min="0" value={requestEditForm.quantity} onChange={e => setRequestEditForm(v => ({...v,quantity:e.target.value}))} />
              <Field label="الوحدة" value={requestEditForm.unit} onChange={e => setRequestEditForm(v => ({...v,unit:e.target.value}))} />
              <label className="block text-sm font-black text-slate-700">المدينة *<select value={requestEditForm.city_id} onChange={e => setRequestEditForm(v => ({...v,city_id:e.target.value}))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none"><option value="">اختر المدينة</option>{editCities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <Field label="منطقة التسليم" value={requestEditForm.delivery_area} onChange={e => setRequestEditForm(v => ({...v,delivery_area:e.target.value}))} />
              <Field label="الموعد النهائي" type="date" value={requestEditForm.deadline} onChange={e => setRequestEditForm(v => ({...v,deadline:e.target.value}))} />
              <Field label="الميزانية" type="number" min="0" value={requestEditForm.budget} onChange={e => setRequestEditForm(v => ({...v,budget:e.target.value}))} />
              <Field label="طريقة التواصل" value={requestEditForm.preferred_contact} onChange={e => setRequestEditForm(v => ({...v,preferred_contact:e.target.value}))} />
              <Field label="رقم الهاتف" value={requestEditForm.phone} onChange={e => setRequestEditForm(v => ({...v,phone:e.target.value}))} />
              <div className="sm:col-span-2 flex flex-wrap justify-end gap-3"><button type="button" onClick={() => { setEditingRequest(false); setRequestEditError(""); }} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black">إلغاء</button><button disabled={requestEditSaving} type="submit" className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{requestEditSaving ? "جارٍ الحفظ..." : "حفظ التعديلات"}</button></div>
            </form>}
          </section>}
          {!authLoading && user && profile?.role === "supplier" && !isOwner && (request.status === "open" || requestSaved) && <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div><h2 className="text-xl font-black">الطلبات المحفوظة</h2><p className="mt-2 text-sm text-slate-500">احفظ هذا الطلب للرجوع إليه لاحقًا.</p></div>
              <button type="button" disabled={saveBusy} onClick={() => void handleSaveToggle()} className={`rounded-xl px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60 ${requestSaved ? "border border-rose-200 bg-white text-rose-700" : "bg-slate-950 text-white"}`}>
                {saveBusy ? "جارٍ الحفظ..." : requestSaved ? "إلغاء حفظ الطلب" : "حفظ الطلب"}
              </button>
            </div>
            {saveError && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{saveError}</div>}
          </section>}
          {!authLoading && user && (canStartExecution || canCompleteRequest || canCancelRequest) && <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-black">إجراءات الطلب</h2>
            <p className="mt-2 text-sm text-slate-500">تغييرات حالة الطلب تتم عبر عمليات آمنة في قاعدة البيانات.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {canStartExecution && <button disabled={transitioning} onClick={() => void handleWorkflowAction("start")} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{transitioning ? "جارٍ التنفيذ..." : "بدء التنفيذ"}</button>}
              {canCompleteRequest && <button disabled={transitioning} onClick={() => void handleWorkflowAction("complete")} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{transitioning ? "جارٍ الحفظ..." : "إكمال الطلب"}</button>}
              {canCancelRequest && <button disabled={transitioning} onClick={() => void handleWorkflowAction("cancel")} className="rounded-xl border border-rose-200 bg-white px-5 py-3 text-sm font-black text-rose-700 disabled:opacity-60">إلغاء الطلب</button>}
              {isOwner && request.status === "open" && <button disabled={transitioning} onClick={() => void handleWorkflowAction("close")} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 disabled:opacity-60">إغلاق الطلب</button>}
            </div>
          </section>}
          {!authLoading && user && canReviewSupplier && <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-xl font-black">قيّم المورد</h2>
            <p className="mt-2 text-sm text-slate-500">يمكنك تقييم المورد المختار بعد اكتمال الطلب.</p>
            {reviewLoading ? <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-5 text-sm font-bold text-slate-500">جارٍ التحقق من حالة التقييم...</div>
              : reviewed ? <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm font-black text-emerald-800">تم تقييم هذا الطلب</div>
              : <form onSubmit={handleReviewSubmit} className="mt-5 space-y-5">
                <div><p className="text-sm font-black text-slate-700">التقييم</p><div className="mt-3 flex gap-2" dir="ltr">{[1,2,3,4,5].map((value) => <button key={value} type="button" aria-label={`${value} نجوم`} onClick={() => setReviewRating(value)} className={`text-3xl transition ${value <= reviewRating ? "text-amber-500" : "text-slate-300"}`}>★</button>)}</div></div>
                <label className="block text-sm font-black text-slate-700">التعليق الاختياري<textarea value={reviewComment} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReviewComment(e.target.value)} maxLength={2000} className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-slate-400" placeholder="اكتب ملاحظتك عن التعامل..." /></label>
                {reviewError && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{reviewError}</div>}
                <button disabled={reviewSaving} type="submit" className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{reviewSaving ? "جارٍ إرسال التقييم..." : "إرسال التقييم"}</button>
              </form>}
          </section>}
          {!authLoading && user && <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><h2 className="text-2xl font-black">العروض المقدمة</h2><p className="mt-2 text-sm text-slate-500">العروض الظاهرة هنا متاحة فقط لصاحب الطلب والمورد صاحب العرض.</p></div>
              {canOffer && !myOffer && editingOfferId === null && <button onClick={startCreate} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white">تقديم عرض</button>}
            </div>

            {message && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{message}</div>}
            {offerError && <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{offerError}</div>}

            {canOffer && myOffer && editingOfferId === null && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-black">لقد قدمت عرضًا على هذا الطلب</p><div className="flex gap-2"><button onClick={() => startEdit(myOffer)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white">تعديل العرض</button><button onClick={() => void handleDelete(myOffer.id)} className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700">حذف العرض</button></div></div>}

            {canOffer && editingOfferId === "new" && <OfferForm form={form} setForm={setForm} saving={saving || offerAttachmentBusy} title="تقديم عرض" onSubmit={handleOfferSubmit} onCancel={cancelForm} attachmentFiles={offerAttachmentFiles} setAttachmentFiles={setOfferAttachmentFiles} existingAttachments={[]} onDeleteAttachment={handleDeleteOfferAttachment} />}
            {canOffer && editingOfferId && editingOfferId !== "new" && <OfferForm form={form} setForm={setForm} saving={saving || offerAttachmentBusy} title="تعديل العرض" onSubmit={handleOfferSubmit} onCancel={cancelForm} attachmentFiles={offerAttachmentFiles} setAttachmentFiles={setOfferAttachmentFiles} existingAttachments={editingOfferAttachments} onDeleteAttachment={handleDeleteOfferAttachment} />}

            {isOwner && <div className="mt-6">
              {offersLoading ? <State title="جارٍ تحميل العروض..." description="يتم جلب العروض من قاعدة البيانات." />
                : offers.length === 0 ? <State title="لا توجد عروض بعد" description="عندما يقدم الموردون عروضهم على هذا الطلب ستظهر هنا." />
                : <div className="space-y-4">{offers.map((offer) => <OfferCard key={offer.id} offer={offer} ownerView={isOwner} selected={request.selected_offer_id === offer.id} selecting={selectingOfferId === offer.id} onSelect={handleSelectOffer} attachments={offerAttachments[offer.id] ?? []} onDeleteAttachment={handleDeleteOfferAttachment} />)}</div>}
            </div>}

            {!isOwner && canOffer && myOffer && editingOfferId === null && <div className="mt-6"><OfferCard offer={myOffer} ownerView={false} own attachments={offerAttachments[myOffer.id] ?? []} onDeleteAttachment={handleDeleteOfferAttachment} /></div>}
          </section>}
        </>}
    </section>
  </main></>;
}

function OfferForm({ form, setForm, saving, title, onSubmit, onCancel, attachmentFiles, setAttachmentFiles, existingAttachments, onDeleteAttachment }: { form: typeof emptyOffer; setForm: Dispatch<SetStateAction<typeof emptyOffer>>; saving: boolean; title: string; onSubmit: (event: FormEvent) => void; onCancel: () => void; attachmentFiles: File[]; setAttachmentFiles: Dispatch<SetStateAction<File[]>>; existingAttachments: OfferAttachment[]; onDeleteAttachment: (item: OfferAttachment) => void }) {
  return <form onSubmit={onSubmit} className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
    <h3 className="text-lg font-black">{title}</h3>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <Field label="السعر *" type="number" min="0" step="any" value={form.price} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, price: e.target.value }))} />
      <Field label="العملة" value={form.currency} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, currency: e.target.value }))} />
      <Field label="مدة التنفيذ" type="number" min="1" step="1" value={form.duration_value} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, duration_value: e.target.value }))} />
      <label className="block text-sm font-black text-slate-700">وحدة المدة<select value={form.duration_unit} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm((current) => ({ ...current, duration_unit: e.target.value as OfferDurationUnit }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none">{durationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      <div className="sm:col-span-2"><Field label="تفاصيل العرض *" textarea value={form.details} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm((current) => ({ ...current, details: e.target.value }))} /></div>
      <div className="sm:col-span-2"><Field label="شروط الدفع" textarea value={form.payment_terms} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm((current) => ({ ...current, payment_terms: e.target.value }))} /></div>
      <div className="sm:col-span-2"><Field label="ملاحظات" textarea value={form.notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm((current) => ({ ...current, notes: e.target.value }))} /></div>
      <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm font-black">مرفقات العرض</p><p className="mt-1 text-xs text-slate-500">JPG / JPEG / PNG / WEBP / PDF — حتى 10 MB للملف.</p><input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf" onChange={e => setAttachmentFiles(Array.from(e.target.files ?? []))} className="mt-3 block w-full text-sm" />{attachmentFiles.length > 0 && <div className="mt-3 space-y-1 text-xs text-slate-600">{attachmentFiles.map(file => <div key={`${file.name}-${file.size}`}>{file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB — بانتظار الرفع</div>)}</div>}{existingAttachments.length > 0 && <div className="mt-3 space-y-2"><p className="text-xs font-bold text-slate-500">المرفقات المحفوظة</p>{existingAttachments.map(item => <AttachmentRow key={item.id} item={item} canDelete onDelete={() => onDeleteAttachment(item)} />)}</div>}</div>
    </div>
    <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black">إلغاء</button><button disabled={saving} type="submit" className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{saving ? "جارٍ الحفظ..." : "حفظ العرض"}</button></div>
  </form>;
}

function OfferCard({ offer, ownerView, own = false, selected = false, selecting = false, onSelect, attachments = [], onDeleteAttachment }: { offer: Offer; ownerView: boolean; own?: boolean; selected?: boolean; selecting?: boolean; onSelect?: (offer: Offer) => void; attachments?: OfferAttachment[]; onDeleteAttachment?: (item: OfferAttachment) => void }) {
  const duration = offer.duration_value == null ? "غير محددة" : `${offer.duration_value} ${durationOptions.find((item) => item.value === offer.duration_unit)?.label ?? ""}`.trim();
  return <article className="rounded-2xl border border-slate-200 bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold text-slate-400">{ownerView ? "المورد" : own ? "عرضك" : "العرض"}</p><h3 className="mt-1 text-lg font-black">{offer.supplier?.company_name || "مورد بدون اسم تجاري"}</h3></div><div className="text-left"><p className="text-xl font-black">{offer.price} {offer.currency}</p><p className="mt-1 text-xs text-slate-400">مدة التنفيذ: {duration}</p></div></div>
    {selected && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">العرض المختار — المورد المعتمد لهذا الطلب</div>}
    <div className="mt-4 rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400">تفاصيل العرض</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{offer.details}</p></div>
    {offer.payment_terms && <Info label="شروط الدفع" value={offer.payment_terms} />}
    {offer.notes && <Info label="ملاحظات" value={offer.notes} />}
    <p className="mt-4 text-xs text-slate-400">تاريخ التقديم: {formatDate(offer.created_at)}</p>
    <div className="mt-5"><p className="text-sm font-black">مرفقات العرض</p>{attachments.length === 0 ? <div className="mt-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center text-xs font-bold text-slate-500">لا توجد مرفقات لهذا العرض.</div> : <div className="mt-2 space-y-2">{attachments.map(item => <AttachmentRow key={item.id} item={item} canDelete={Boolean(onDeleteAttachment && own)} onDelete={() => onDeleteAttachment?.(item)} />)}</div>}</div>
    {ownerView && !selected && onSelect && <div className="mt-5"><button disabled={selecting} onClick={() => void onSelect(offer)} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60">{selecting ? "جارٍ تثبيت العرض..." : "اختيار هذا العرض"}</button></div>}
  </article>;
}

function AttachmentRow({ item, canDelete, onDelete }: { item: RequestAttachment | OfferAttachment; canDelete: boolean; onDelete: () => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{item.file_name}</p><p className="mt-1 text-xs text-slate-400">{item.file_type} — {(item.file_size / 1024 / 1024).toFixed(2)} MB</p></div><div className="flex items-center gap-2">{item.signed_url && <a href={item.signed_url} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black">فتح / تنزيل</a>}{canDelete && <button type="button" onClick={onDelete} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-black text-rose-700">حذف</button>}</div></div>;
}

function RequestContent({ request, attachments }: { request: Request; attachments: RequestAttachment[] }) {
  return <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{request.category?.name ?? "غير محدد"}</span><h2 className="mt-4 text-3xl font-black">{request.title}</h2></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">{statusLabel(request.status)}</span></div>
    <div className="mt-8"><h3 className="text-lg font-black">الوصف</h3><p className="mt-3 whitespace-pre-wrap leading-8 text-slate-600">{request.description}</p></div>
    <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-sm font-black text-slate-800">مرفقات الطلب</p>{attachments.length === 0 ? <p className="mt-2 text-xs font-bold text-slate-500">لا توجد مرفقات لهذا الطلب.</p> : <div className="mt-3 space-y-2">{attachments.map(item => <AttachmentRow key={item.id} item={item} canDelete={false} onDelete={() => undefined} />)}</div>}</div>
    <div className="mt-8 grid gap-4 sm:grid-cols-2"><Info label="المدينة" value={request.city?.name ?? "غير محدد"} /><Info label="منطقة التسليم" value={request.delivery_area ?? "غير محددة"} /><Info label="الكمية" value={request.quantity === null ? "غير محددة" : `${request.quantity} ${request.unit ?? ""}`.trim()} /><Info label="الموعد النهائي" value={request.deadline ?? "غير محدد"} /><Info label="الميزانية" value={request.budget === null ? "غير محددة" : String(request.budget)} /><Info label="طريقة التواصل" value={request.preferred_contact ?? "غير محددة"} /><Info label="رقم الهاتف" value={request.phone ?? "غير محدد"} /><Info label="تاريخ النشر" value={formatDate(request.created_at)} /></div>
  </article>;
}
function Info({ label, value }: { label: string; value: string }) { return <div className="mt-4 rounded-2xl bg-slate-50 p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 whitespace-pre-wrap font-bold text-slate-700">{value}</p></div>; }
function State({ title, description, error = false }: { title: string; description: string; error?: boolean }) { return <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-20 text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-slate-50 text-slate-400">▤</div><h2 className={`mt-5 text-xl font-black ${error ? "text-red-700" : ""}`}>{title}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-slate-500">{description}</p></div>; }
function Field({ label, textarea = false, ...props }: { label: string; textarea?: boolean } & (InputHTMLAttributes<HTMLInputElement> | TextareaHTMLAttributes<HTMLTextAreaElement>)) { const className = "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-slate-400"; return <label className="block text-sm font-black text-slate-700">{label}{textarea ? <textarea {...props as TextareaHTMLAttributes<HTMLTextAreaElement>} className={`${className} min-h-28 resize-y`} /> : <input {...props as InputHTMLAttributes<HTMLInputElement>} className={className} />}</label>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("ar-SY", { dateStyle: "medium" }).format(new Date(value)); }
function statusLabel(status: RequestStatus) { return ({ open: "مفتوح", closed: "مغلق", supplier_selected: "تم اختيار مورد", in_progress: "قيد التنفيذ", completed: "مكتمل", cancelled: "ملغى" } as Record<RequestStatus, string>)[status]; }
