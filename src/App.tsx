import RequestsPage from './pages/RequestsPage';
import RequestDetailsPage from './pages/RequestDetailsPage';
import CreateRequestPage from './pages/CreateRequestPage';
import SuppliersPage from './pages/SuppliersPage';
import SupplierDetailsPage from './pages/SupplierDetailsPage';
import EditProfilePage from './pages/EditProfilePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ProtectedRoute from './components/ProtectedRoute';
import RequestCard from './components/RequestCard';
import { getRequests } from './services/requestService';
import { AuthProvider, useAuth } from './lib/auth';
import type { Request } from './types/request';
import { useEffect, useState } from 'react';
import NotificationsPage from './pages/NotificationsPage';
import SupplierProPage from './pages/SupplierProPage';
import SavedRequestsPage from './pages/SavedRequestsPage';
import DashboardPage from './pages/DashboardPage';
import SupportPage from './pages/SupportPage';
import SupportTicketPage from './pages/SupportTicketPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminReportsPage from './pages/AdminReportsPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminRequestsPage from './pages/AdminRequestsPage';
import AdminSuppliersPage from './pages/AdminSuppliersPage';
import AdminCategoriesPage from './pages/AdminCategoriesPage';
import AdminCitiesPage from './pages/AdminCitiesPage';
import AdminVerificationPage from './pages/AdminVerificationPage';
import AdminSupportPage from './pages/AdminSupportPage';
import AdminSupportTicketPage from './pages/AdminSupportTicketPage';
import AdminProPage from './pages/AdminProPage';
import { isAdmin } from './services/adminSubscriptionService';
import SiteHeader from './components/SiteHeader';
import Brand from './components/Brand';
import SettingsPage from './pages/SettingsPage';
import { ThemeProvider } from './lib/theme';
const steps = [
  { number: "01", title: "انشر طلبك", text: "اكتب ما تحتاجه وحدد التفاصيل التي تهمك." },
  { number: "02", title: "استقبل العروض", text: "دع الموردين والشركات يقدمون عروضهم مباشرة." },
  { number: "03", title: "قارن بينها", text: "راجع التفاصيل والأسعار واختر ما يناسبك." },
  { number: "04", title: "اختر العرض المناسب", text: "اتخذ قرارك وتواصل مع الجهة المناسبة." },
];

function App() {
  return <AuthProvider><ThemeProvider><AppContent /></ThemeProvider></AuthProvider>;
}

function AppContent() {
  const [activeRequests, setActiveRequests] = useState<Request[]>([]);
  const [activeRequestsLoading, setActiveRequestsLoading] = useState(true);
  const [activeRequestsError, setActiveRequestsError] = useState(false);
  const { user } = useAuth();
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user) { setAdmin(false); return () => { active = false; }; }
    void isAdmin().then(result => { if (active) setAdmin(result.isAdmin); });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    let active = true;
    if (!user) {
      setActiveRequestsLoading(false);
      setActiveRequestsError(false);
      setActiveRequests([]);
      return () => { active = false; };
    }
    setActiveRequestsLoading(true);
    setActiveRequestsError(false);
    void getRequests({ status: 'open', page: 1, pageSize: 6 }).then(result => {
      if (!active) return;
      if (result.error) {
        setActiveRequestsError(true);
        setActiveRequests([]);
      } else {
        setActiveRequests(result.requests);
      }
      setActiveRequestsLoading(false);
    });
    return () => { active = false; };
  }, [user]);

  const path = window.location.pathname.replace(/\/$/, '') || '/';
  if (path === '/login') return <LoginPage />;
  if (path === '/register') return <RegisterPage />;
  if (path === '/forgot-password') return <ForgotPasswordPage />;
  if (path === '/notifications') return <NotificationsPage />;
  if (path === '/dashboard') return <DashboardPage />;
  if (path === '/settings') return <ProtectedRoute><SettingsPage /></ProtectedRoute>;
  if (path === '/admin') return <AdminDashboardPage />;
  if (path === '/admin/reports') return <AdminReportsPage />;
  if (path === '/admin/users') return <AdminUsersPage />;
  if (path === '/admin/requests') return <AdminRequestsPage />;
  if (path === '/admin/suppliers') return <AdminSuppliersPage />;
  if (path === '/admin/categories') return <AdminCategoriesPage />;
  if (path === '/admin/cities') return <AdminCitiesPage />;
  if (path === '/admin/verification') return <AdminVerificationPage />;
  if (path === '/admin/support') return <AdminSupportPage />;
  if (path.startsWith('/admin/support/')) return <AdminSupportTicketPage />;
  if (path === '/admin/pro') return <AdminProPage />;
  if (path === '/supplier/pro') return <SupplierProPage />;
  if (path === '/supplier/saved-requests') return <SavedRequestsPage />;
  if (path === '/support') return <SupportPage />;
  if (path.startsWith('/support/')) return <SupportTicketPage />;
  if (path === '/terms') return <LegalPage title="الشروط والأحكام" />;
  if (path === '/privacy') return <LegalPage title="سياسة الخصوصية" />;
  if (path === '/requests') return <ProtectedRoute><RequestsPage /></ProtectedRoute>;
  if (path === '/requests/create') return <ProtectedRoute><CreateRequestPage /></ProtectedRoute>;
  if (path === '/suppliers') return <ProtectedRoute><SuppliersPage /></ProtectedRoute>;
  if (path === '/profile/edit') return <ProtectedRoute><EditProfilePage /></ProtectedRoute>;
  if (path.startsWith('/suppliers/')) return <ProtectedRoute><SupplierDetailsPage /></ProtectedRoute>;
  if (path.startsWith('/requests/')) return <ProtectedRoute><RequestDetailsPage /></ProtectedRoute>;

  return (
    <main dir="rtl" className="home-shell">
      <SiteHeader />

      <section className="hero-wrap hero-home-modern">
        <div className="hero-inner">
          <div>
            <div className="hero-kicker"><span className="hero-kicker-dot" /> منصة تربط الاحتياج بالمورد المناسب</div>
            <h1 className="hero-title">اكتب احتياجك، <span>وخلي العروض توصلك.</span></h1>
            <p className="hero-text">
              انشر احتياجك مرة واحدة، واستقبل عروضًا من الموردين والشركات ومقدمي الخدمات، ثم قارن بينها واختر الأنسب لك.
            </p>
            <div className="hero-actions">
              <a href="/requests/create" className="hero-btn-primary">نشر طلب جديد <span aria-hidden="true">↗</span></a>
              <a href="/requests" className="hero-btn-secondary">تصفح الطلبات <span aria-hidden="true">←</span></a>
              {!user && <><a href="/login" className="hero-btn-secondary hero-auth-btn">تسجيل الدخول</a><a href="/register" className="hero-btn-secondary hero-auth-btn">إنشاء حساب</a></>}
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="visual-window">
              <div className="visual-window-inner">
                <div className="visual-topbar"><span className="visual-dot"/><span className="visual-dot"/><span className="visual-dot"/><span className="visual-topbar-label">مطلوب</span></div>
                <div className="visual-content">
                  <div className="visual-card">
                    <div className="visual-label">طلب جديد</div>
                    <div className="visual-heading">1000 قطعة مع تسليم خلال 15 يوم</div>
                    <div className="visual-row"><div className="visual-icon">⌁</div><div className="visual-line"/><div className="visual-check">✓</div></div>
                  </div>
                  <div className="visual-card">
                    <div className="visual-label">العروض الواردة</div>
                    <div className="visual-row"><div className="visual-icon">1</div><div className="visual-line"/><div className="visual-line short"/></div>
                    <div className="visual-row"><div className="visual-icon">2</div><div className="visual-line"/><div className="visual-line short"/></div>
                    <div className="visual-row"><div className="visual-icon">3</div><div className="visual-line"/><div className="visual-line short"/></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="visual-badge"><span className="visual-badge-icon">✓</span><div><b>موردون موثوقون</b><small>قارن العروض واتخذ قرارك بثقة</small></div></div>
          </div>
        </div>
      </section>

      <section className="benefit-strip" aria-label="مزايا مطلوب">
        <div className="benefit-grid">
          <div className="benefit-item"><span className="benefit-icon">◎</span><div><h3>تلبي احتياجاتك</h3><p>من المنتجات إلى الخدمات بمكان واحد.</p></div></div>
          <div className="benefit-item"><span className="benefit-icon">↯</span><div><h3>توفر الوقت</h3><p>احصل على عدة عروض بسرعة وسهولة.</p></div></div>
          <div className="benefit-item"><span className="benefit-icon">♙</span><div><h3>موردون متخصصون</h3><p>تواصل مع جهات مناسبة لمجالك.</p></div></div>
          <div className="benefit-item"><span className="benefit-icon">✓</span><div><h3>آمن وموثوق</h3><p>نظام واضح يحمي حقوق الأطراف.</p></div></div>
        </div>
      </section>

      <section className="section-shell">
        <p className="section-eyebrow">بخطوات واضحة وبسيطة</p>
        <h2 className="section-title">كيف تعمل مطلوب؟</h2>
        <p className="section-subtitle">بدل ما تبحث عن المورد بنفسك، دع الموردين المناسبين يصلون إلى طلبك ويقدموا عروضهم.</p>
        <div className="workflow-grid">
          {steps.map((step) => (
            <article key={step.number} className="workflow-card">
              <span className="workflow-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="active-requests" className="active-section">
        <div className="section-shell">
          <p className="section-eyebrow">فرص حقيقية داخل المنصة</p>
          <h2 className="section-title">طلبات نشطة الآن</h2>
          <p className="section-subtitle">استعرض الطلبات المفتوحة وتعرّف على الاحتياجات التي تبحث عن موردين مناسبين.</p>

          {activeRequestsLoading ? (
            <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm">⌁</div>
              <h3 className="mt-5 text-lg font-black">جارٍ تحميل الطلبات...</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-500">يتم جلب الطلبات النشطة حاليًا.</p>
            </div>
          ) : activeRequestsError || activeRequests.length === 0 ? (
            <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-slate-400 shadow-sm">⌁</div>
              <h3 className="mt-5 text-lg font-black">لا توجد طلبات نشطة بعد</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-500">{activeRequestsError ? 'تعذر تحميل الطلبات حاليًا.' : 'ستظهر الطلبات الحقيقية هنا عند توفرها.'}</p>
              {!user && <a href="/register" className="mt-5 inline-flex rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white">إنشاء حساب</a>}
            </div>
          ) : (
            <div className="mt-10 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {activeRequests.map(request => (
                <RequestCard key={request.id} request={{
                  id: request.id,
                  title: request.title,
                  category: request.category?.name ?? 'غير محدد',
                  city: request.city?.name ?? 'غير محدد',
                  quantity: request.quantity === null ? 'غير محدد' : String(request.quantity),
                  unit: request.unit ?? '',
                  deliveryDate: request.deadline ?? 'غير محدد',
                  offersCount: 0,
                  publishedAt: new Intl.DateTimeFormat('ar-SY', { dateStyle: 'medium' }).format(new Date(request.created_at)),
                  status: request.status === 'open' ? 'مفتوح' : request.status,
                }} />
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-footer-inner">
          <div>
            <div className="brand-lockup">
              <img src="/matloob-logo.svg" alt="" className="brand-logo brand-logo-sm" />
              <span><strong style={{display:'block',fontSize:'1.05rem'}}>مطلوب</strong><small style={{color:'#91a1b5'}}>منصة الطلبات والعروض</small></span>
            </div>
          </div>
          <nav className="home-footer-links" aria-label="روابط التذييل">
            <a href="/">الرئيسية</a><a href="/requests">الطلبات</a><a href="/suppliers">الموردون</a><a href="/requests/create">انشر طلبك</a><a href="/support">الدعم</a><a href="/terms">الشروط</a><a href="/privacy">الخصوصية</a>
            {admin && <a href="/admin" className="admin-footer-link">لوحة الإدارة</a>}
          </nav>
        </div>
      </footer>
    </main>
  );
}

export default App;

function LegalPage({ title }: { title: string }) {
  const isPrivacy = title.includes("الخصوصية");
  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-18 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="/" aria-label="مطلوب - الرئيسية"><Brand compact /></a>
          <a href="/" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">الرئيسية</a>
        </div>
      </header>
      <article className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
          <p className="text-sm font-black text-slate-400">منصة مطلوب</p>
          <h1 className="mt-2 text-3xl font-black">{title}</h1>
          <p className="mt-6 leading-8 text-slate-600">
            {isPrivacy
              ? "نحترم خصوصيتك ونسعى إلى استخدام بيانات الحساب والطلبات فقط لتشغيل خدمات منصة مطلوب وتحسينها وحمايتها. لا تستخدم بياناتك خارج الأغراض المرتبطة بالخدمة إلا وفق ما تسمح به الأنظمة والقوانين المعمول بها."
              : "باستخدام منصة مطلوب، يلتزم المستخدم بتقديم معلومات صحيحة واستخدام المنصة للأغراض المشروعة واحترام حقوق المستخدمين والموردين. تخضع عمليات إنشاء الطلبات والعروض والحسابات والصلاحيات لقواعد المنصة وسياسات الأمان المعتمدة."}
          </p>
          <h2 className="mt-8 text-xl font-black">الاستخدام المسؤول</h2>
          <p className="mt-3 leading-8 text-slate-600">يُمنع إساءة استخدام المنصة أو محاولة الوصول إلى بيانات أو حسابات لا يملك المستخدم صلاحية الوصول إليها، كما يجب الحفاظ على سرية بيانات تسجيل الدخول.</p>
          <h2 className="mt-8 text-xl font-black">البيانات والأمان</h2>
          <p className="mt-3 leading-8 text-slate-600">تستخدم مطلوب صلاحيات الوصول وقواعد حماية البيانات لتقييد الوصول إلى المعلومات بحسب دور المستخدم وعلاقته بالطلب أو الخدمة.</p>
        </div>
      </article>
    </main>
  );
}

