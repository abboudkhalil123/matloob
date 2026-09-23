import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { getUnreadNotificationCount } from "../services/notificationService";
import Brand from "./Brand";
import {
  registerServiceWorkerAndPush,
  requestBrowserNotificationPermission,
  showBrowserNotification,
} from "../lib/browserNotifications";

export default function SiteHeader() {
  const { user, profile, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url ?? null);
  const close = () => setOpen(false);

  useEffect(() => {
    setAvatarUrl(profile?.avatar_url ?? null);
  }, [profile?.avatar_url]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ avatarUrl?: string | null }>).detail;
      setAvatarUrl(detail?.avatarUrl ?? null);
    };
    window.addEventListener("matloob-avatar-updated", handler);
    return () => window.removeEventListener("matloob-avatar-updated", handler);
  }, []);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | null = null;

    if (!user || !supabase) {
      setUnreadCount(0);
      return () => {
        active = false;
      };
    }

    const client = supabase;

    const refreshUnreadCount = async () => {
      const result = await getUnreadNotificationCount();
      if (active && !result.error) setUnreadCount(result.count);
    };

    const setupPush = async () => {
      const permission = await requestBrowserNotificationPermission();
      if (!active) return;

      if (permission === "granted") {
        const result = await registerServiceWorkerAndPush(user.id);
        if (result.error) {
          console.error("[MATLOOB Push]", result.error);
        } else {
          console.log("[MATLOOB Push] subscription ready");
        }
      }
    };

    void refreshUnreadCount();
    void setupPush();

    channel = client
      .channel(`header-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          void refreshUnreadCount();

          if (payload.eventType !== "INSERT") return;

          const notification = payload.new as {
            title?: string;
            message?: string;
            body?: string;
          };

          showBrowserNotification(
            notification.title || "مطلوب",
            notification.message || notification.body || "لديك إشعار جديد في مطلوب."
          );
        }
      )
      .subscribe();

    return () => {
      active = false;
      if (channel) void client.removeChannel(channel);
    };
  }, [user]);

  async function handleLogout() {
    close();
    const result = await signOut();
    if (result.error) {
      window.alert("حدث خطأ أثناء تسجيل الخروج، حاول مرة أخرى.");
      return;
    }
    window.location.replace("/");
  }

  const displayName = profile?.full_name || user?.email || "حسابي";

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a href="/" className="brand-link" aria-label="مطلوب - الرئيسية" onClick={close}>
          <Brand />
        </a>

        <nav className="desktop-nav" aria-label="التنقل الرئيسي">
          <a href="/">الرئيسية</a>
          <a href="/requests">الطلبات</a>
          <a href="/suppliers">الموردون</a>
          <a href="/requests/create" className="nav-primary">انشر طلبك</a>
        </nav>

        <div className="header-actions">
          {loading ? (
            <span className="header-loading">جارٍ التحقق...</span>
          ) : user ? (
            <>
              <a href="/dashboard" className="header-dashboard">لوحة التحكم</a>
              <a href="/notifications" className="header-icon-action header-notifications" aria-label="الإشعارات" title="الإشعارات">
                <svg className="header-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && <span className="header-notification-count">{unreadCount > 99 ? "99+" : unreadCount}</span>}
              </a>
              <a href="/profile/edit" className="header-profile" title="الملف الشخصي" aria-label="الملف الشخصي">
                <span className="header-avatar">
                  {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{displayName.trim().charAt(0) || "م"}</span>}
                </span>
              </a>
              <a href="/settings" className="header-icon-action header-settings" title="الإعدادات" aria-label="الإعدادات">
                <svg className="header-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
                  <path d="m19.4 15 .1.1a2 2 0 0 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4V19a2 2 0 0 1-4 0v-.1a2 2 0 0 0-3.4-1.4l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a2 2 0 0 0-1.4-3.4H1.5a2 2 0 0 1 0-4h.1A2 2 0 0 0 3 4l-.1-.1A2 2 0 0 1 5.7 1.1l.1.1A2 2 0 0 0 9.2-.2V-.1a2 2 0 0 1 4 0V0a2 2 0 0 0 3.4 1.4l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a2 2 0 0 0 1.4 3.4h.1a2 2 0 0 1 0 4h-.1a2 2 0 0 0-1.4 3.4Z" transform="translate(0 2)" />
                </svg>
              </a>
              {profile?.role === "supplier" && (
                <a href="/supplier/pro" className="pro-pill">PRO</a>
              )}
              <button type="button" onClick={() => void handleLogout()} className="header-logout">تسجيل الخروج</button>
            </>
          ) : (
            <>
              <a href="/login" className="header-login">تسجيل الدخول</a>
              <a href="/register" className="header-register">إنشاء حساب</a>
            </>
          )}
          <button
            className="mobile-menu-btn"
            type="button"
            aria-label="فتح القائمة"
            aria-expanded={open}
            onClick={() => setOpen(v => !v)}
          >
            ☰
          </button>
        </div>
      </div>

      {open && (
        <div className="mobile-nav">
          <a href="/" onClick={close}>الرئيسية</a>
          <a href="/requests" onClick={close}>الطلبات</a>
          <a href="/suppliers" onClick={close}>الموردون</a>
          <a href="/requests/create" onClick={close}>انشر طلبك</a>
          {user && <a href="/dashboard" onClick={close}>لوحة التحكم</a>}
          {user && <a href="/notifications" onClick={close}>الإشعارات {unreadCount > 0 ? `(${unreadCount > 99 ? "99+" : unreadCount})` : ""}</a>}
          {user && <a href="/profile/edit" onClick={close}>الملف الشخصي</a>}
          {user && <a href="/settings" onClick={close}>الإعدادات</a>}
          {profile?.role === "supplier" && <a href="/supplier/pro" onClick={close}>مزايا PRO</a>}
          {!user && <a href="/login" onClick={close}>تسجيل الدخول</a>}
          {!user && <a href="/register" onClick={close}>إنشاء حساب</a>}
          {user && <button type="button" className="mobile-logout" onClick={() => void handleLogout()}>تسجيل الخروج</button>}
        </div>
      )}
    </header>
  );
}
