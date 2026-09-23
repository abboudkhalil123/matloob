const VAPID_PUBLIC_KEY =
  "BOTuUvrPcqNpQWJN6YGbC1N1FFLKI_aQncw8_6xMu_VJax0lizSZ4yuW8NdtqTjI9SkFttRhuhFovve5M0TcjWo";

export function browserNotificationsEnabled() {
  try {
    return localStorage.getItem("matloob-notifications") !== "off";
  } catch {
    return true;
  }
}

export async function requestBrowserNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported" as const;
  }

  if (!browserNotificationsEnabled()) return Notification.permission;

  if (Notification.permission === "default") {
    try {
      return await Notification.requestPermission();
    } catch {
      return Notification.permission;
    }
  }

  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);

  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function getCurrentUserId() {
  const { supabase } = await import("./supabase");

  if (!supabase) {
    return { supabase: null, userId: null, error: new Error("إعداد Supabase غير مكتمل.") };
  }

  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return { supabase, userId: null, error };
  }

  if (!data.user) {
    return {
      supabase,
      userId: null,
      error: new Error("يجب تسجيل الدخول لتفعيل إشعارات المتصفح."),
    };
  }

  return { supabase, userId: data.user.id, error: null };
}

export async function registerServiceWorkerAndPush(userId: string) {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return {
      subscription: null,
      error: new Error("هذا المتصفح لا يدعم إشعارات Push."),
    };
  }

  if (!browserNotificationsEnabled()) {
    return { subscription: null, error: null };
  }

  const permission = await requestBrowserNotificationPermission();

  if (permission !== "granted") {
    return {
      subscription: null,
      error:
        permission === "denied"
          ? new Error("تم رفض صلاحية الإشعارات.")
          : null,
    };
  }

  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
  });

  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const subscriptionJson = subscription.toJSON();
  const endpoint = subscription.endpoint;
  const p256dh = subscriptionJson.keys?.p256dh;
  const auth = subscriptionJson.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return {
      subscription: null,
      error: new Error("تعذر قراءة بيانات اشتراك الإشعارات."),
    };
  }

  const { supabase } = await import("./supabase");

  if (!supabase) {
    return {
      subscription: null,
      error: new Error("إعداد Supabase غير مكتمل."),
    };
  }

  const { data: existing, error: findError } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .maybeSingle();

  if (findError) {
    return { subscription: null, error: findError };
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from("push_subscriptions")
      .update({
        p256dh,
        auth,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("user_id", userId);

    if (updateError) {
      return { subscription: null, error: updateError };
    }
  } else {
    const { error: insertError } = await supabase
      .from("push_subscriptions")
      .insert({
        user_id: userId,
        endpoint,
        p256dh,
        auth,
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      return { subscription: null, error: insertError };
    }
  }

  return { subscription, error: null };
}

export async function enableWebPush() {
  try {
    const permission = await requestBrowserNotificationPermission();

    if (permission === "unsupported") {
      return {
        ok: false,
        message: "هذا المتصفح لا يدعم إشعارات المتصفح.",
      };
    }

    if (permission !== "granted") {
      return {
        ok: false,
        message:
          permission === "denied"
            ? "تم رفض إشعارات المتصفح. اسمح بالإشعارات من إعدادات المتصفح ثم حاول مرة أخرى."
            : "لم يتم السماح بإشعارات المتصفح.",
      };
    }

    const current = await getCurrentUserId();

    if (current.error || !current.userId) {
      return {
        ok: false,
        message: current.error?.message || "تعذر تحديد المستخدم الحالي.",
      };
    }

    localStorage.setItem("matloob-notifications", "on");

    const result = await registerServiceWorkerAndPush(current.userId);

    if (result.error) {
      return {
        ok: false,
        message: result.error.message,
      };
    }

    return {
      ok: true,
      message: "تم تفعيل إشعارات المتصفح بنجاح.",
    };
  } catch (error) {
    console.error("[MATLOOB Push] enable error:", error);

    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء تفعيل إشعارات المتصفح.",
    };
  }
}

export async function disableWebPush() {
  try {
    const current = await getCurrentUserId();

    if (current.error && !current.userId) {
      return {
        ok: false,
        message: current.error.message,
      };
    }

    if (!("serviceWorker" in navigator)) {
      localStorage.setItem("matloob-notifications", "off");

      return {
        ok: true,
        message: "تم إيقاف إشعارات المتصفح.",
      };
    }

    const registration = await navigator.serviceWorker.getRegistration("/");

    if (registration) {
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
      }
    }

    if (current.supabase && current.userId) {
      const { error } = await current.supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", current.userId);

      if (error) {
        console.error("[MATLOOB Push] delete subscription error:", error);
      }
    }

    localStorage.setItem("matloob-notifications", "off");

    return {
      ok: true,
      message: "تم إيقاف إشعارات المتصفح.",
    };
  } catch (error) {
    console.error("[MATLOOB Push] disable error:", error);

    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "حدث خطأ أثناء إيقاف إشعارات المتصفح.",
    };
  }
}

export async function syncWebPushState() {
  try {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      return false;
    }

    if (!browserNotificationsEnabled()) {
      return false;
    }

    if (Notification.permission !== "granted") {
      return false;
    }

    const registration = await navigator.serviceWorker.getRegistration("/");

    if (!registration) {
      return false;
    }

    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      return false;
    }

    const current = await getCurrentUserId();

    if (current.error || !current.userId || !current.supabase) {
      return false;
    }

    const subscriptionJson = subscription.toJSON();
    const endpoint = subscription.endpoint;
    const p256dh = subscriptionJson.keys?.p256dh;
    const auth = subscriptionJson.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return false;
    }

    const { data: existing, error } = await current.supabase
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", current.userId)
      .eq("endpoint", endpoint)
      .maybeSingle();

    if (error) {
      console.error("[MATLOOB Push] sync error:", error);
      return false;
    }

    if (!existing?.id) {
      const { error: insertError } = await current.supabase
        .from("push_subscriptions")
        .insert({
          user_id: current.userId,
          endpoint,
          p256dh,
          auth,
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("[MATLOOB Push] sync insert error:", insertError);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error("[MATLOOB Push] sync state error:", error);
    return false;
  }
}

export function showBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (!browserNotificationsEnabled() || Notification.permission !== "granted") return;
  if (!document.hidden) return;

  void navigator.serviceWorker?.ready.then((registration) => {
    void registration.showNotification(title, {
      body,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: `matloob-${Date.now()}`,
      data: { url: "/notifications" },
    });
  });
}
