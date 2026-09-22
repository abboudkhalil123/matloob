export function browserNotificationsEnabled() {
  try {
    return localStorage.getItem("matloob-notifications") !== "off";
  } catch {
    return true;
  }
}

export async function requestBrowserNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported" as const;
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

export function showBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (!browserNotificationsEnabled() || Notification.permission !== "granted") return;
  if (!document.hidden) return;
  try {
    new Notification(title, { body, icon: "/favicon.svg", tag: "matloob-notification" });
  } catch {
    // Browser notifications are optional; in-app realtime notifications remain available.
  }
}
