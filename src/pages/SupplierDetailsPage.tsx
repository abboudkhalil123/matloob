import { useEffect, useState } from 'react';
import { getSupplierProfileById } from '../services/supplierService';
import SiteHeader from "../components/SiteHeader";
import type { SupplierDirectoryItem } from '../services/supplierService';
import type { SupplierWorkingHour } from '../types/supplier';
import { getSupplierRating, getSupplierReviews } from '../services/reviewService';
import type { Review, SupplierRating } from '../types/review';
import { getSupplierPortfolio } from '../services/portfolioService';
import { supabase } from '../lib/supabase';
import type { SupplierPortfolioItem } from '../types/portfolio';

const days = ['السبت','الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];

function SupplierDetailsPage() {
  const id = window.location.pathname.split('/').filter(Boolean).pop() || '';
  const [profile, setProfile] = useState<SupplierDirectoryItem | null>(null);
  const [hours, setHours] = useState<SupplierWorkingHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState<SupplierRating>({ average: null, count: 0 });
  const [portfolio, setPortfolio] = useState<SupplierPortfolioItem[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getSupplierProfileById(id).then(async (result) => {
      if (!active) return;
      if (result.error || !result.profile) {
        setError(result.error?.message || 'تعذر تحميل بيانات المورد حاليًا.');
        setLoading(false);
        return;
      }
      // reviews.reviewed_supplier_id references the supplier user's profile id,
      // while the public supplier URL uses supplier_profiles.id.
      const supplierUserId = result.profile.user_id;
      const [publicProfileResult, reviewsResult, ratingResult, portfolioResult] = await Promise.all([
        supabase ? supabase.rpc('get_public_profile', { p_user_id: supplierUserId }) : Promise.resolve({ data: null, error: null }),
        getSupplierReviews(supplierUserId),
        getSupplierRating(supplierUserId),
        getSupplierPortfolioById(supplierUserId),
      ]);
      if (!active) return;
      if (publicProfileResult.error || reviewsResult.error || ratingResult.error || portfolioResult.error) {
        setError('تعذر تحميل بعض بيانات المورد حاليًا.');
      } else {
        setProfile(result.profile);
        const publicProfile = Array.isArray(publicProfileResult.data) ? publicProfileResult.data[0] : publicProfileResult.data;
        setAvatarUrl((publicProfile as { avatar_url?: string | null } | null)?.avatar_url ?? null);
        setHours(result.hours);
        setReviews(reviewsResult.reviews);
        setRating(ratingResult.rating);
        setPortfolio(portfolioResult.items);
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [id]);

  return <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-950">
    <SiteHeader />
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      {loading ? <div className="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm"><p className="text-sm font-bold text-slate-500">جارٍ تحميل ملف المورد...</p></div>
        : error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-16 text-center"><h1 className="text-2xl font-black text-rose-800">تعذر تحميل المورد</h1><p className="mt-3 text-sm text-rose-700">{error}</p></div>
        : !profile ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm"><h1 className="text-2xl font-black">المورد غير موجود</h1><p className="mt-3 text-sm text-slate-500">لا يوجد ملف مورد مرتبط بهذا المعرّف.</p></div>
        : <>
          <div className="profile-hero-card rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><div className="profile-avatar-large">{avatarUrl ? <img src={avatarUrl} alt="صورة المورد" /> : <span>{(profile.company_name || "م").trim().charAt(0)}</span>}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-3xl font-black">{profile.company_name || 'مورد بدون اسم تجاري'}</h1>{profile.verified && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">✓ موثّق</span>}</div><p className="mt-2 text-sm font-bold text-slate-500">{profile.business_type || 'نوع النشاط غير محدد'}</p></div></div></div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_.6fr]">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="grid gap-4 sm:grid-cols-2">
              <Info label="المدينة" value={profile.city?.name} /><Info label="الموقع / العنوان" value={profile.location_text} /><Info label="سنوات الخبرة" value={profile.years_experience != null ? `${profile.years_experience} سنة` : null} />
            </div><div className="mt-4 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400">الوصف</p><p className="mt-2 text-sm leading-7 text-slate-700">{profile.description || 'لا يوجد وصف مضاف.'}</p></div>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400">الخدمات والمجالات</p>{profile.categories.length ? <div className="mt-3 flex flex-wrap gap-2">{profile.categories.map((item) => <span key={item.id} className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600">{item.name}</span>)}</div> : <p className="mt-2 text-sm text-slate-500">لا توجد تصنيفات مضافة.</p>}</div>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400">ساعات العمل</p><div className="mt-3 space-y-2">{days.map((day, index) => { const hour = hours.find((item) => item.day_of_week === index); return <div key={day} className="flex items-center justify-between text-sm"><span className="font-bold">{day}</span><span className="text-slate-600">{!hour ? 'غير محدد' : !hour.is_open ? 'مغلق' : `${hour.open_time?.slice(0,5) || '—'} - ${hour.close_time?.slice(0,5) || '—'}`}</span></div>; })}</div></div>
            </section>
            <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm font-black text-slate-400">بيانات إضافية</p><div className="mt-4 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400">رقم التواصل</p><p className="mt-2 text-sm text-slate-700">{profile.phone || 'غير مضاف'}</p></div><div className="mt-4 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400">معلومات التواصل</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{profile.contact_info || 'غير مضافة'}</p></div></aside>
          </div>
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between gap-4"><div><h2 className="text-2xl font-black">معرض الأعمال</h2><p className="mt-2 text-sm text-slate-500">صور الأعمال التي أضافها المورد فعليًا.</p></div></div>
            {portfolio.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm font-bold text-slate-500">لا توجد أعمال مضافة بعد.</div>
              : <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">{portfolio.map((item) => <a key={item.id} href={item.public_url} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-slate-200 bg-white"><img src={item.public_url} alt={item.file_name} className="aspect-square w-full object-cover transition group-hover:scale-[1.02]" /></a>)}</div>}
          </section>
          <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><h2 className="text-2xl font-black">التقييمات</h2><p className="mt-2 text-sm text-slate-500">تقييمات أصحاب الطلبات الذين تعاملوا مع هذا المورد.</p></div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-center">
                <div className="text-xl font-black">{rating.average === null ? '—' : rating.average.toFixed(1)} / 5</div>
                <div className="mt-1 text-xs font-bold text-slate-500">{rating.count} تقييم</div>
              </div>
            </div>
            {reviews.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm font-bold text-slate-500">لا توجد تقييمات بعد.</div>
              : <div className="mt-6 space-y-4">{reviews.map((review) => <ReviewCard key={review.id} review={review} />)}</div>}
          </section>
        </>}
    </section>
  </main>;
}
async function getSupplierRatingById(supplierId: string) { return getSupplierRating(supplierId); }
async function getSupplierPortfolioById(supplierUserId: string) { return getSupplierPortfolio(supplierUserId); }

function ReviewCard({ review }: { review: Review }) {
  return <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="text-lg tracking-wide" aria-label={`التقييم ${review.rating} من 5`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</div><time className="text-xs font-bold text-slate-400">{new Intl.DateTimeFormat('ar-SY', { dateStyle: 'medium' }).format(new Date(review.created_at))}</time></div>{review.comment && <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{review.comment}</p>}</article>;
}

function Info({ label, value }: { label: string; value?: string | null }) { return <div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-400">{label}</p><p className="mt-2 text-sm font-bold text-slate-700">{value || 'غير مضاف'}</p></div>; }
export default SupplierDetailsPage;
