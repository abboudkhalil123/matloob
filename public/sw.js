self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: "مطلوب",
      message: event.data ? event.data.text() : "لديك إشعار جديد في مطلوب.",
    };
  }

  const title = data.title || "مطلوب";
  const body = data.message || data.body || "لديك إشعار جديد في مطلوب.";
  const url = data.url || "/notifications";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: data.id ? `matloob-${data.id}` : `matloob-${Date.now()}`,
      data: {
        url,
        notificationId: data.id || null,
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || "/notifications";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
