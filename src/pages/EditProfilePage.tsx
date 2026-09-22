import { useEffect, useState, type FormEvent, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { useAuth } from '../lib/auth';
import SiteHeader from "../components/SiteHeader";
import { getCategories, getCities } from '../services/requestService';
import { getCurrentSupplierProfile, getSupplierCategories, getSupplierWorkingHours, createSupplierProfile, updateSupplierProfile, setSupplierCategories, setSupplierWorkingHours } from '../services/supplierService';
import { updateCurrentProfile } from '../services/profileService';
import { removeAvatar, uploadAvatar } from '../services/avatarService';
import type { Category, City } from '../types/request';
import type { SupplierProfileInput, SupplierWorkingHour } from '../types/supplier';
import { deletePortfolioItem, getSupplierPortfolio, uploadPortfolioImage } from '../services/portfolioService';
import type { SupplierPortfolioItem } from '../types/portfolio';
import { cancelVerificationRequest, createVerificationRequest, getMyVerificationRequest } from '../services/verificationService';
import type { VerificationRequest } from '../types/verification';

const days = ['السبت','الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];
const initialSchedule = days.map((day, index) => ({ day, dayOfWeek: index, open: true, from: '09:00', to: '17:00' }));

type ScheduleRow = typeof initialSchedule[number];

function EditProfilePage() {
  const { profile, profileLoading } = useAuth();
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<ScheduleRow[]>(initialSchedule);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [supplier, setSupplier] = useState<SupplierProfileInput>({ company_name: '', business_type: '', description: '', city_id: null, location_text: '', years_experience: null, phone: '', contact_info: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [portfolio, setPortfolio] = useState<SupplierPortfolioItem[]>([]);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [portfolioUploading, setPortfolioUploading] = useState(false);
  const [portfolioDeleting, setPortfolioDeleting] = useState<string | null>(null);
  const [verificationRequest, setVerificationRequest] = useState<VerificationRequest | null>(null);
  const [verified, setVerified] = useState(false);
  const [verificationBusy, setVerificationBusy] = useState(false);

  useEffect(() => {
    setName(profile?.full_name ?? '');
    setAvatarUrl(profile?.avatar_url ?? null);
  }, [profile]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!profile) { setLoading(false); return; }
      setLoading(true); setError('');
      const [{ categories: loadedCategories, error: categoryError }, { cities: loadedCities, error: cityError }] = await Promise.all([getCategories(), getCities()]);
      if (!active) return;
      if (categoryError || cityError) { setError('تعذر تحميل البيانات المرجعية.'); setLoading(false); return; }
      setCategories(loadedCategories); setCities(loadedCities);
      if (profile.role === 'supplier') {
        const result = await getCurrentSupplierProfile();
        if (result.error) { setError(result.error.message); setLoading(false); return; }
        if (result.profile) {
          setSupplierId(result.profile.id);
          setVerified(result.profile.verified);
          const verificationResult = await getMyVerificationRequest();
          if (verificationResult.error) { setError(verificationResult.error.message); setLoading(false); return; }
          setVerificationRequest(verificationResult.request);
          const portfolioResult = await getSupplierPortfolio(result.profile.user_id);
          if (portfolioResult.error) { setError(portfolioResult.error.message); setLoading(false); return; }
          setPortfolio(portfolioResult.items);
          setSupplier({ company_name: result.profile.company_name ?? '', business_type: result.profile.business_type ?? '', description: result.profile.description ?? '', city_id: result.profile.city_id, location_text: result.profile.location_text ?? '', years_experience: result.profile.years_experience, phone: result.profile.phone ?? '', contact_info: result.profile.contact_info ?? '' });
          const [catResult, hoursResult] = await Promise.all([getSupplierCategories(result.profile.id), getSupplierWorkingHours(result.profile.id)]);
          if (catResult.error || hoursResult.error) { setError('تعذر تحميل بيانات المورد المرتبطة.'); setLoading(false); return; }
          setSelectedCategories(catResult.categories.map((item) => item.category_id));
          const byDay = new Map(hoursResult.hours.map((hour) => [hour.day_of_week, hour]));
          setSchedule(initialSchedule.map((row) => { const hour = byDay.get(row.dayOfWeek); return hour ? { ...row, open: hour.is_open, from: hour.open_time?.slice(0, 5) || '09:00', to: hour.close_time?.slice(0, 5) || '17:00' } : row; }));
        }
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [profile]);

  const updateDay = (index: number, patch: Partial<ScheduleRow>) => setSchedule((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const toggleCategory = (id: string) => setSelectedCategories((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [previewUrl, avatarPreview]);

  function handleAvatarChange(file: File | null) {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(file ? URL.createObjectURL(file) : null);
    setError('');
  }

  async function handleAvatarUpload() {
    if (!avatarFile) return;
    setAvatarBusy(true); setError(''); setMessage('');
    const result = await uploadAvatar(avatarFile);
    if (result.error || !result.avatarUrl) { setError(result.error?.message || 'تعذر رفع صورة البروفايل.'); setAvatarBusy(false); return; }
    setAvatarUrl(result.avatarUrl);
    setAvatarFile(null);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    window.dispatchEvent(new CustomEvent('matloob-avatar-updated', { detail: { avatarUrl: result.avatarUrl } }));
    setAvatarBusy(false);
    setMessage('تم تحديث صورة البروفايل.');
  }

  async function handleAvatarRemove() {
    if (!avatarUrl || !window.confirm('هل تريد حذف صورة البروفايل؟')) return;
    setAvatarBusy(true); setError(''); setMessage('');
    const result = await removeAvatar(avatarUrl);
    if (result.error) { setError(result.error.message || 'تعذر حذف الصورة.'); setAvatarBusy(false); return; }
    setAvatarUrl(null);
    window.dispatchEvent(new CustomEvent('matloob-avatar-updated', { detail: { avatarUrl: null } }));
    setAvatarBusy(false);
    setMessage('تم حذف صورة البروفايل.');
  }

  function handleImageChange(file: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedImage(file);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
    setError('');
  }

  async function handlePortfolioUpload() {
    if (!selectedImage) { setError('اختر صورة أولًا.'); return; }
    setPortfolioUploading(true); setError(''); setMessage('');
    const result = await uploadPortfolioImage(selectedImage);
    if (result.error || !result.item) { setError(result.error?.message || 'تعذر رفع الصورة.'); setPortfolioUploading(false); return; }
    setPortfolio((items) => [...items, result.item!].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at)));
    handleImageChange(null);
    setPortfolioUploading(false);
    setMessage('تم رفع الصورة وحفظها في معرض أعمالك.');
  }

  async function handlePortfolioDelete(item: SupplierPortfolioItem) {
    if (!window.confirm('هل تريد حذف هذه الصورة من معرض أعمالك؟')) return;
    setPortfolioDeleting(item.id); setError(''); setMessage('');
    const result = await deletePortfolioItem(item);
    if (result.error) { setError(result.error.message || 'تعذر حذف الصورة.'); setPortfolioDeleting(null); return; }
    setPortfolio((items) => items.filter((current) => current.id !== item.id));
    setPortfolioDeleting(null);
    setMessage('تم حذف الصورة من معرض أعمالك.');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault(); setMessage(''); setError('');
    if (!profile) { setError('يجب تسجيل الدخول أولًا.'); return; }
    setSaving(true);
    const profileResult = await updateCurrentProfile({ full_name: name.trim() || null });
    if (profileResult.error) { setError('تعذر حفظ الاسم.'); setSaving(false); return; }

    if (profile.role === 'supplier') {
      const supplierResult = supplierId ? await updateSupplierProfile(supplierId, supplier) : await createSupplierProfile(supplier);
      if (supplierResult.error || !supplierResult.profile) { setError(supplierResult.error?.message || 'تعذر حفظ ملف المورد.'); setSaving(false); return; }
      const id = supplierResult.profile.id; setSupplierId(id);
      const [categoriesResult, hoursResult] = await Promise.all([
        setSupplierCategories(id, selectedCategories),
        setSupplierWorkingHours(id, schedule.map((row) => ({ supplier_id: id, day_of_week: row.dayOfWeek, is_open: row.open, open_time: row.open ? row.from : null, close_time: row.open ? row.to : null }))),
      ]);
      if (categoriesResult.error || hoursResult.error) { setError('تم حفظ ملف المورد، لكن تعذر حفظ بعض البيانات المرتبطة.'); setSaving(false); return; }
    }
    setSaving(false); setMessage('تم حفظ الملف الشخصي بنجاح.');
  }

  if (profileLoading || loading) return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50"><p className="text-sm font-bold text-slate-500">جارٍ تحميل الملف الشخصي...</p></main>;

  return <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-950">
    <SiteHeader />
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div><p className="text-sm font-black text-slate-400">إعدادات الحساب</p><h1 className="mt-2 text-4xl font-black tracking-tight">تعديل الملف الشخصي</h1><p className="mt-4 text-slate-600">يتم حفظ البيانات في قاعدة بيانات مطلوب المرتبطة بحسابك.</p></div>
      {error && <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-semibold text-rose-800">{error}</div>}
      {message && <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-800">{message}</div>}
      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <section className="profile-editor-card rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="profile-avatar-editor">
              {avatarPreview || avatarUrl ? <img src={avatarPreview || avatarUrl || ''} alt="صورة البروفايل" /> : <span>{(name || 'م').trim().charAt(0)}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-slate-400">صورة الحساب</p>
              <h2 className="mt-1 text-xl font-black">المعلومات العامة</h2>
              <p className="mt-2 text-sm leading-7 text-slate-500">ضع صورة شخصية تظهر في حسابك وملفك داخل المنصة. JPG / PNG / WEBP حتى 5 MB.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <label className="profile-avatar-upload">اختيار صورة<input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={(event) => handleAvatarChange(event.target.files?.[0] ?? null)} /></label>
                <button type="button" disabled={!avatarFile || avatarBusy} onClick={() => void handleAvatarUpload()} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">{avatarBusy ? 'جارٍ التنفيذ...' : 'حفظ الصورة'}</button>
                {avatarUrl && <button type="button" disabled={avatarBusy} onClick={() => void handleAvatarRemove()} className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-black text-rose-700 disabled:opacity-50">حذف الصورة</button>}
              </div>
            </div>
          </div>
          <div className="mt-7 grid gap-5"><Field label="الاسم" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} placeholder="اكتب الاسم" /></div>
        </section>

        {profile?.role === 'supplier' && <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-xl font-black">معلومات المورد</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <Field label="اسم الشركة / الورشة" value={supplier.company_name ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupplier((s) => ({ ...s, company_name: e.target.value }))} placeholder="اسم المنشأة" />
            <Field label="نوع النشاط" value={supplier.business_type ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupplier((s) => ({ ...s, business_type: e.target.value }))} placeholder="نوع النشاط" />
            <div className="sm:col-span-2"><Field label="الوصف" textarea value={supplier.description ?? ''} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSupplier((s) => ({ ...s, description: e.target.value }))} placeholder="وصف الشركة أو الورشة" /></div>
            <label className="block text-sm font-black text-slate-700">المدينة<select value={supplier.city_id ?? ''} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSupplier((s) => ({ ...s, city_id: e.target.value || null }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none"><option value="">اختر المدينة</option>{cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}</select></label>
            <Field label="الموقع / العنوان" value={supplier.location_text ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupplier((s) => ({ ...s, location_text: e.target.value }))} placeholder="العنوان" />
            <Field label="سنوات الخبرة" type="number" min="0" value={supplier.years_experience?.toString() ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupplier((s) => ({ ...s, years_experience: e.target.value ? Number(e.target.value) : null }))} placeholder="مثال: 10" />
            <Field label="رقم التواصل" type="tel" value={supplier.phone ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupplier((s) => ({ ...s, phone: e.target.value }))} placeholder="رقم التواصل" />
            <div className="sm:col-span-2"><Field label="معلومات التواصل" textarea value={supplier.contact_info ?? ''} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setSupplier((s) => ({ ...s, contact_info: e.target.value }))} placeholder="معلومات التواصل" /></div>
          </div>

          <div className="mt-7"><h3 className="text-base font-black">الخدمات والمجالات</h3><div className="mt-4 flex flex-wrap gap-2">{categories.map((category) => <button type="button" key={category.id} onClick={() => toggleCategory(category.id)} className={`rounded-xl border px-3.5 py-2 text-sm font-bold transition ${selectedCategories.includes(category.id) ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{category.name}</button>)}</div></div>

          <div className="mt-7"><h3 className="text-base font-black">ساعات العمل</h3><div className="mt-4 overflow-hidden rounded-2xl border border-slate-200"><div className="hidden grid-cols-[1.1fr_.8fr_1fr_1fr] bg-slate-50 px-4 py-3 text-xs font-black text-slate-500 sm:grid"><span>اليوم</span><span>الحالة</span><span>وقت البداية</span><span>وقت النهاية</span></div>{schedule.map((item, index) => <div key={item.day} className="grid gap-3 border-t border-slate-100 px-4 py-4 first:border-t-0 sm:grid-cols-[1.1fr_.8fr_1fr_1fr] sm:items-center"><span className="font-black">{item.day}</span><label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={item.open} onChange={(event) => updateDay(index, { open: event.target.checked })} /> مفتوح</label><input aria-label={`وقت بداية ${item.day}`} type="time" value={item.from} disabled={!item.open} onChange={(event) => updateDay(index, { from: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100" /><input aria-label={`وقت نهاية ${item.day}`} type="time" value={item.to} disabled={!item.open} onChange={(event) => updateDay(index, { to: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100" /></div>)}</div></div>
          <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div><h3 className="text-base font-black">معرض أعمالي</h3><p className="mt-2 text-sm leading-6 text-slate-500">أضف صورًا حقيقية لأعمالك. لا تُحفظ الصورة إلا بعد نجاح رفعها إلى Storage وحفظ بياناتها.</p></div>
            <div className="mt-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4">
                <label className="block text-sm font-black text-slate-700">اختيار صورة<input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={(event) => handleImageChange(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm" /></label>
                <p className="mt-2 text-xs text-slate-500">JPG / JPEG / PNG / WEBP — الحد الأقصى 5 MB</p>
                {previewUrl && <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><img src={previewUrl} alt="معاينة مؤقتة" className="max-h-56 w-full object-contain" /></div>}
                <button type="button" disabled={!selectedImage || portfolioUploading} onClick={() => void handlePortfolioUpload()} className="mt-4 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white disabled:opacity-50">{portfolioUploading ? 'جارٍ رفع الصورة...' : 'رفع الصورة'}</button>
              </div>
              <div>
                {portfolio.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm font-bold text-slate-500">لا توجد أعمال مضافة بعد.</div>
                  : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{portfolio.map((item) => <div key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><img src={item.public_url} alt={item.file_name} className="aspect-square w-full object-cover" /><div className="p-3"><p className="truncate text-xs font-bold text-slate-600" title={item.file_name}>{item.file_name}</p><button type="button" disabled={portfolioDeleting === item.id} onClick={() => void handlePortfolioDelete(item)} className="mt-2 w-full rounded-lg border border-rose-200 px-3 py-2 text-xs font-black text-rose-700 disabled:opacity-50">{portfolioDeleting === item.id ? 'جارٍ الحذف...' : 'حذف الصورة'}</button></div></div>)}</div>}
              </div>
            </div>
          </div>
        </section>}

        {profile?.role === 'supplier' && <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-xl font-black">توثيق المورد</h2><p className="mt-2 text-sm leading-7 text-slate-500">التوثيق مستقل عن اشتراك PRO، وقرار التوثيق يصدر من إدارة المنصة فقط.</p></div>
            <span className={`rounded-full px-3 py-1.5 text-xs font-black ${verified ? 'bg-emerald-50 text-emerald-700' : verificationRequest?.status === 'pending' ? 'bg-amber-50 text-amber-700' : verificationRequest?.status === 'rejected' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>{verified ? 'موثّق' : verificationRequest?.status === 'pending' ? 'قيد المراجعة' : verificationRequest?.status === 'rejected' ? 'مرفوض' : 'غير موثّق'}</span>
          </div>
          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            {verified ? <p className="text-sm font-bold text-emerald-700">حسابك موثّق من إدارة المنصة.</p>
              : verificationRequest?.status === 'pending' ? <div><p className="text-sm font-bold text-amber-800">طلب التوثيق قيد المراجعة.</p><button type="button" disabled={verificationBusy} onClick={async () => { if (!window.confirm('هل تريد إلغاء طلب التوثيق الحالي؟')) return; setVerificationBusy(true); setError(''); const result = await cancelVerificationRequest(verificationRequest.id); if (result.error) setError(result.error.message); else { setVerificationRequest(result.request); setMessage('تم إلغاء طلب التوثيق.'); } setVerificationBusy(false); }} className="mt-4 rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-black text-amber-800 disabled:opacity-50">{verificationBusy ? 'جارٍ التنفيذ...' : 'إلغاء الطلب'}</button></div>
              : verificationRequest?.status === 'rejected' ? <div><p className="text-sm font-bold text-rose-700">تم رفض طلب التوثيق.</p>{verificationRequest.admin_notes && <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">ملاحظات الإدارة: {verificationRequest.admin_notes}</p>}<button type="button" disabled={verificationBusy} onClick={async () => { if (!window.confirm('إرسال طلب توثيق جديد للمراجعة؟')) return; setVerificationBusy(true); setError(''); const result = await createVerificationRequest(); if (result.error) setError(result.error.message); else { setVerificationRequest(result.request); setMessage('تم إرسال طلب التوثيق للمراجعة.'); } setVerificationBusy(false); }} className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">{verificationBusy ? 'جارٍ الإرسال...' : 'طلب التوثيق مجددًا'}</button></div>
              : <div><p className="text-sm font-bold text-slate-700">يمكنك طلب مراجعة حسابك من الإدارة.</p><button type="button" disabled={verificationBusy || !supplierId} onClick={async () => { if (!window.confirm('إرسال طلب التوثيق إلى إدارة المنصة؟')) return; setVerificationBusy(true); setError(''); const result = await createVerificationRequest(); if (result.error) setError(result.error.message); else { setVerificationRequest(result.request); setMessage('تم إرسال طلب التوثيق للمراجعة.'); } setVerificationBusy(false); }} className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">{verificationBusy ? 'جارٍ الإرسال...' : 'طلب التوثيق'}</button></div>}
          </div>
        </section>}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><a href="/suppliers" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-black">إلغاء</a><button disabled={saving} type="submit" className="rounded-xl bg-slate-950 px-6 py-3.5 text-sm font-black text-white disabled:opacity-60">{saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}</button></div>
      </form>
    </section>
  </main>;
}

function Field({ label, textarea = false, ...props }: { label: string; textarea?: boolean } & (InputHTMLAttributes<HTMLInputElement> | TextareaHTMLAttributes<HTMLTextAreaElement>)) {
  const className = 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-slate-400';
  return <label className="block text-sm font-black text-slate-700">{label}{textarea ? <textarea {...props as TextareaHTMLAttributes<HTMLTextAreaElement>} className={`${className} min-h-28 resize-y`} /> : <input {...props as InputHTMLAttributes<HTMLInputElement>} className={className} />}</label>;
}

export default EditProfilePage;
