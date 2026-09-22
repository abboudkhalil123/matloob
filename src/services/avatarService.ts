import { supabase } from "../lib/supabase";

const BUCKET = "avatars";
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

function configError() {
  return new Error("إعداد Supabase غير مكتمل.");
}

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  const random = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  return `${random()}-${random().slice(0, 4)}-4${random().slice(0, 3)}-8${random().slice(0, 3)}-${random()}${random().slice(0, 4)}`;
}

function extension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName === "jpg" || fromName === "jpeg" || fromName === "png" || fromName === "webp") return fromName === "jpeg" ? "jpg" : fromName;
  return file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
}

export async function uploadAvatar(file: File): Promise<{ avatarUrl: string | null; error: Error | null }> {
  if (!supabase) return { avatarUrl: null, error: configError() };
  if (!ALLOWED.has(file.type)) return { avatarUrl: null, error: new Error("يسمح فقط بصور JPG أو PNG أو WEBP.") };
  if (file.size > MAX_SIZE) return { avatarUrl: null, error: new Error("حجم صورة البروفايل يجب ألا يتجاوز 5 MB.") };

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) return { avatarUrl: null, error: authError };
  if (!authData.user) return { avatarUrl: null, error: new Error("يجب تسجيل الدخول أولًا.") };

  const path = `${authData.user.id}/${uuid()}.${extension(file)}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
    contentType: file.type,
  });
  if (uploadError) return { avatarUrl: null, error: uploadError };

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const avatarUrl = data.publicUrl;
  const { error: profileError } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", authData.user.id);
  if (profileError) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { avatarUrl: null, error: profileError };
  }
  return { avatarUrl, error: null };
}

export async function removeAvatar(currentUrl?: string | null): Promise<{ error: Error | null }> {
  if (!supabase) return { error: configError() };
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) return { error: authError };
  if (!authData.user) return { error: new Error("يجب تسجيل الدخول أولًا.") };

  if (currentUrl) {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const index = currentUrl.indexOf(marker);
    if (index >= 0) {
      const path = currentUrl.slice(index + marker.length);
      if (path.startsWith(`${authData.user.id}/`)) await supabase.storage.from(BUCKET).remove([path]);
    }
  }
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", authData.user.id);
  return { error };
}
