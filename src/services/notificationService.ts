import { supabase } from "../lib/supabase";
import type { Notification } from "../types/notification";

const configError = () => new Error("إعداد Supabase غير مكتمل.");

export async function getMyNotifications(): Promise<{ notifications: Notification[]; error: Error | null }> {
  if (!supabase) return { notifications: [], error: configError() };
  const { data, error } = await supabase
    .from("notifications")
    .select("id,user_id,title,message,type,related_request_id,related_offer_id,related_ticket_id,is_read,created_at")
    .order("created_at", { ascending: false });
  return { notifications: (data as Notification[] | null) ?? [], error };
}

export async function getUnreadNotificationCount(): Promise<{ count: number; error: Error | null }> {
  if (!supabase) return { count: 0, error: configError() };
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);
  return { count: count ?? 0, error };
}

export async function markNotificationAsRead(id: string): Promise<{ error: Error | null }> {
  if (!supabase) return { error: configError() };
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  return { error };
}

export async function markAllNotificationsAsRead(): Promise<{ error: Error | null }> {
  if (!supabase) return { error: configError() };
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
  return { error };
}
