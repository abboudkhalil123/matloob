import { supabase } from "../lib/supabase";
import type { OfferAttachment, RequestAttachment } from "../types/attachment";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "pdf"]);
const REQUEST_BUCKET = "request-attachments";
const OFFER_BUCKET = "offer-attachments";
const REQUEST_COLUMNS = "id, request_id, uploaded_by, storage_path, file_name, file_type, file_size, created_at, updated_at";
const OFFER_COLUMNS = "id, offer_id, uploaded_by, storage_path, file_name, file_type, file_size, created_at, updated_at";


function generateUuidV4Fallback(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

function configError() { return new Error("إعداد Supabase غير مكتمل."); }
function extension(file: File): string | null {
  const dot = file.name.toLowerCase().lastIndexOf(".");
  if (dot < 0) return null;
  const ext = file.name.slice(dot + 1);
  return ALLOWED_EXTENSIONS.has(ext) ? ext : null;
}
function validateFile(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.has(file.type)) return "نوع الملف غير مسموح. استخدم JPG أو JPEG أو PNG أو WEBP أو PDF.";
  const ext = extension(file);
  if (!ext) return "امتداد الملف غير مسموح.";
  const matchingMime = ext === "pdf" ? "application/pdf" : "image/jpeg";
  if ((ext === "jpg" || ext === "jpeg") && file.type !== "image/jpeg") return "امتداد JPG/JPEG يجب أن يطابق نوع MIME للصورة.";
  if (ext === "png" && file.type !== "image/png") return "امتداد PNG يجب أن يطابق نوع MIME للصورة.";
  if (ext === "webp" && file.type !== "image/webp") return "امتداد WEBP يجب أن يطابق نوع MIME للصورة.";
  if (ext === "pdf" && file.type !== matchingMime) return "امتداد PDF يجب أن يطابق نوع MIME للملف.";
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return "حجم الملف يجب ألا يتجاوز 10 MB.";
  return null;
}
async function userId() {
  if (!supabase) return { id: null as string | null, error: configError() };
  const { data, error } = await supabase.auth.getUser();
  return { id: data.user?.id ?? null, error: error ?? (!data.user ? new Error("يجب تسجيل الدخول أولًا.") : null) };
}
async function signed<T extends { storage_path: string }>(bucket: string, item: T): Promise<T & { signed_url?: string }> {
  if (!supabase) return item;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(item.storage_path, 3600);
  return { ...item, signed_url: data?.signedUrl };
}

export async function getRequestAttachments(requestId: string): Promise<{ attachments: RequestAttachment[]; error: Error | null }> {
  if (!supabase) return { attachments: [], error: configError() };
  const { data, error } = await supabase.from("request_attachments").select(REQUEST_COLUMNS).eq("request_id", requestId).order("created_at", { ascending: true });
  if (error) return { attachments: [], error };
  const attachments = await Promise.all(((data as RequestAttachment[] | null) ?? []).map(item => signed(REQUEST_BUCKET, item)));
  return { attachments, error: null };
}

export async function getOfferAttachments(offerId: string): Promise<{ attachments: OfferAttachment[]; error: Error | null }> {
  if (!supabase) return { attachments: [], error: configError() };
  const { data, error } = await supabase.from("offer_attachments").select(OFFER_COLUMNS).eq("offer_id", offerId).order("created_at", { ascending: true });
  if (error) return { attachments: [], error };
  const attachments = await Promise.all(((data as OfferAttachment[] | null) ?? []).map(item => signed(OFFER_BUCKET, item)));
  return { attachments, error: null };
}

async function uploadAttachment<T>(bucket: string, table: "request_attachments" | "offer_attachments", entityId: string, file: File, ownerColumn: "request_id" | "offer_id", columns: string) {
  if (!supabase) return { item: null as T | null, error: configError() };
  const validation = validateFile(file);
  if (validation) return { item: null as T | null, error: new Error(validation) };
  const { id, error: authError } = await userId();
  if (authError || !id) return { item: null as T | null, error: authError ?? new Error("يجب تسجيل الدخول أولًا.") };
  const ext = extension(file);
  if (!ext) return { item: null as T | null, error: new Error("امتداد الملف غير صالح.") };
  // Storage path is validated by Supabase with a UUID/UUID.ext pattern.
  // Older mobile browsers may not support crypto.randomUUID(), so generate
  // a standards-shaped UUID v4 fallback instead of using a timestamp slug.
  const fileId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : generateUuidV4Fallback();
  const storagePath = `${entityId}/${fileId}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) return { item: null as T | null, error: uploadError };
  let data: unknown = null;
  let insertError: Error | null = null;
  const rpcName = table === "request_attachments" ? "register_request_attachment" : "register_offer_attachment";
  const rpcParams = table === "request_attachments"
    ? { p_request_id: entityId, p_uploaded_by: id, p_storage_path: storagePath, p_file_name: file.name, p_file_type: file.type, p_file_size: file.size }
    : { p_offer_id: entityId, p_uploaded_by: id, p_storage_path: storagePath, p_file_name: file.name, p_file_type: file.type, p_file_size: file.size };
  const rpcResult = await supabase.rpc(rpcName, rpcParams);
  if (!rpcResult.error && rpcResult.data) {
    data = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
  } else {
    const direct = await supabase.from(table).insert({ [ownerColumn]: entityId, uploaded_by: id, storage_path: storagePath, file_name: file.name, file_type: file.type, file_size: file.size }).select(columns).single();
    data = direct.data;
    insertError = direct.error;
  }
  if (insertError || !data) {
    await supabase.storage.from(bucket).remove([storagePath]);
    return { item: null as T | null, error: insertError ?? rpcResult.error ?? new Error("تعذر تسجيل المرفق بعد رفعه.") };
  }
  const item = await signed(bucket, data as T & { storage_path: string });
  return { item: item as T, error: null };
}

export async function uploadRequestAttachment(requestId: string, file: File) { return uploadAttachment<RequestAttachment>(REQUEST_BUCKET, "request_attachments", requestId, file, "request_id", REQUEST_COLUMNS); }
export async function uploadOfferAttachment(offerId: string, file: File) { return uploadAttachment<OfferAttachment>(OFFER_BUCKET, "offer_attachments", offerId, file, "offer_id", OFFER_COLUMNS); }

async function deleteAttachment(bucket: string, table: "request_attachments" | "offer_attachments", id: string) {
  if (!supabase) return { error: configError() };
  const { id: uid, error: authError } = await userId();
  if (authError || !uid) return { error: authError ?? new Error("يجب تسجيل الدخول أولًا.") };
  const { data: row, error: lookupError } = await supabase.from(table).select("id, uploaded_by, storage_path").eq("id", id).eq("uploaded_by", uid).maybeSingle();
  if (lookupError) return { error: lookupError };
  if (!row) return { error: new Error("المرفق غير موجود أو لا تملك صلاحية حذفه.") };
  const { error: storageError } = await supabase.storage.from(bucket).remove([row.storage_path]);
  if (storageError) return { error: storageError };
  const { error: deleteError } = await supabase.from(table).delete().eq("id", row.id).eq("uploaded_by", uid);
  if (deleteError) return { error: deleteError };
  return { error: null };
}
export async function deleteRequestAttachment(id: string) { return deleteAttachment(REQUEST_BUCKET, "request_attachments", id); }
export async function deleteOfferAttachment(id: string) { return deleteAttachment(OFFER_BUCKET, "offer_attachments", id); }
