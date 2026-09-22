import { useEffect, useState } from "react";
import ProtectedRoute from "../components/ProtectedRoute";
import SiteHeader from "../components/SiteHeader";
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
  getMyNotifications,
} from "../services/notificationService";
import type { Notification } from "../types/notification";
import { supabase } from "../lib/supabase";

function notificationLabel(type: Notification["type"]) {
  if (type === "matching_request") return "تطابق طلب جديد";
  if (type === "support_reply") return "رد من الدعم";
  if (type === "support_status_changed") return "تحديث حالة الدعم";
  return "تحديث";
}

export default function NotificationsPage() {
  return (
    <ProtectedRoute>
      <NotificationsContent />
    </ProtectedRoute>
  );
}

function NotificationsContent() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    const result = await getMyNotifications();

    if (result.error) {
      setError("تعذر تحميل الإشعارات حاليًا.");
    } else {
      setNotifications(result.notifications);
    }

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;
    let channel: any;

    async function setupRealtime() {
      const {
        data: { user },
      } = await supabase!.auth.getUser();

      if (cancelled || !user) return;

      channel = supabase!
        .channel(`notifications-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newNotification = payload.new as Notification;

            setNotifications((items) => {
              if (items.some((item) => item.id === newNotification.id)) {
                return items;
              }

              return [newNotification, ...items];
            });
          }
        )
        .subscribe();
    }

    void setupRealtime();

    return () => {
      cancelled = true;

      if (channel) {
        void supabase!.removeChannel(channel);
      }
    };
  }, []);

  async function handleRead(notification: Notification) {
    if (!notification.is_read) {
      const result = await markNotificationAsRead(notification.id);

      if (result.error) {
        setError("تعذر تحديث حالة الإشعار.");
        return;
      }

      setNotifications((items) =>
        items.map((item) =>
          item.id === notification.id
            ? { ...item, is_read: true }
            : item
        )
      );
    }

    if (notification.related_ticket_id) {
      window.location.href = `/support/${notification.related_ticket_id}`;
    } else if (notification.related_request_id) {
      window.location.href = `/requests/${notification.related_request_id}`;
    }
  }

  async function handleReadAll() {
    setMessage("");

    const result = await markAllNotificationsAsRead();

    if (result.error) {
      setError("تعذر تحديد الإشعارات كمقروءة.");
      return;
    }

    setNotifications((items) =>
      items.map((item) => ({ ...item, is_read: true }))
    );

    setMessage("تم تحديد جميع الإشعارات كمقروءة.");
  }

  return (
    <>
      <SiteHeader />

      <main
        dir="rtl"
        className="min-h-screen bg-slate-50 text-slate-950"
      >
        <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black text-slate-400">حسابك</p>

              <h1 className="mt-2 text-3xl font-black">
                الإشعارات
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                آخر التحديثات المرتبطة بطلباتك وعروضك.
              </p>
            </div>

            {notifications.some((item) => !item.is_read) && (
              <button
                onClick={() => void handleReadAll()}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-800"
              >
                تحديد الكل كمقروء
              </button>
            )}
          </div>

          {message && (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
              {message}
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
              {error}
            </div>
          )}

          <div className="mt-8 space-y-3">
            {loading ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-sm font-bold text-slate-500">
                جارٍ تحميل الإشعارات...
              </div>
            ) : notifications.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
                <h2 className="text-lg font-black">
                  لا توجد إشعارات
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  ستظهر هنا التحديثات الحقيقية المتعلقة بطلباتك وعروضك.
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => void handleRead(notification)}
                  className={`block w-full rounded-2xl border p-5 text-right transition hover:border-slate-300 ${
                    notification.is_read
                      ? "border-slate-200 bg-white"
                      : "border-blue-200 bg-blue-50/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1 size-2.5 shrink-0 rounded-full ${
                        notification.is_read
                          ? "bg-slate-300"
                          : "bg-blue-600"
                      }`}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h2 className="font-black">
                            {notification.title}
                          </h2>

                          {notification.type === "matching_request" && (
                            <p className="mt-1 text-xs font-black text-slate-400">
                              {notificationLabel(notification.type)}
                            </p>
                          )}
                        </div>

                        <time className="text-xs font-bold text-slate-400">
                          {formatDate(notification.created_at)}
                        </time>
                      </div>

                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        {notification.message}
                      </p>

                      {(notification.related_request_id ||
                        notification.related_ticket_id) && (
                        <p className="mt-3 text-xs font-black text-slate-400">
                          فتح الطلب المرتبط ←
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      </main>
    </>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-SY", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}