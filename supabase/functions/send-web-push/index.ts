import webpush from "web-push";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET");
const VAPID_SUBJECT =
  Deno.env.get("VAPID_SUBJECT") ||
  "mailto:t.abboud.khalil@gmail.com";

if (
  !SUPABASE_URL ||
  !SUPABASE_SERVICE_ROLE_KEY ||
  !VAPID_PUBLIC_KEY ||
  !VAPID_PRIVATE_KEY ||
  !WEBHOOK_SECRET
) {
  throw new Error("Missing required Web Push environment variables.");
}

webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
);

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function isAuthorized(request: Request) {
  const auth = request.headers.get("Authorization") || "";
  return auth === `Bearer ${WEBHOOK_SECRET}`;
}

function buildNotificationUrl(record: Record<string, unknown>) {
  const type = String(record.type || "");

  if (type.startsWith("support_") && record.related_ticket_id) {
    return `/support/${record.related_ticket_id}`;
  }

  if (record.related_request_id) {
    return `/requests/${record.related_request_id}`;
  }

  if (record.related_request_id) {
    return `/requests/${record.related_request_id}`;
  }

  return "/notifications";
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!isAuthorized(request)) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const payload = await request.json();
    const record = payload?.record;

    if (!record?.user_id || !record?.title || !record?.message) {
      return json({ ok: true, skipped: true });
    }

    const { data: subscriptions, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", record.user_id);

    if (error) {
      console.error("Failed to load push subscriptions", error);
      return json({ error: "Failed to load subscriptions" }, 500);
    }

    if (!subscriptions?.length) {
      return json({ ok: true, sent: 0 });
    }

    const notificationPayload = JSON.stringify({
      title: String(record.title),
      body: String(record.message),
      url: buildNotificationUrl(record),
      tag: `matloob-${record.type || "notification"}-${record.id || crypto.randomUUID()}`,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
    });

    let sent = 0;
    let removed = 0;

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          notificationPayload,
          {
            TTL: 60 * 60 * 24,
          },
        );

        sent += 1;
      } catch (error) {
        const statusCode =
          typeof error === "object" &&
          error !== null &&
          "statusCode" in error
            ? Number((error as { statusCode?: number }).statusCode)
            : 0;

        // 404/410 means the browser subscription is no longer valid.
        if (statusCode === 404 || statusCode === 410) {
          const { error: deleteError } = await supabaseAdmin
            .from("push_subscriptions")
            .delete()
            .eq("id", subscription.id);

          if (deleteError) {
            console.error(
              "Failed to remove expired push subscription",
              deleteError,
            );
          } else {
            removed += 1;
          }
        } else {
          console.error(
            "Web Push delivery failed",
            subscription.endpoint,
            error,
          );
        }
      }
    }

    return json({
      ok: true,
      sent,
      removed,
      total: subscriptions.length,
    });
  } catch (error) {
    console.error("send-web-push failed", error);
    return json({ error: "Invalid webhook payload" }, 400);
  }
});
