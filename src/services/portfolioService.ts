import { supabase } from "../lib/supabase";
import type { SupplierPortfolioItem } from "../types/portfolio";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);
const TABLE_COLUMNS = "id, supplier_id, storage_path, file_name, file_type, file_size, sort_order, created_at, updated_at";

function configError() {
  return new Error("إعداد Supabase غير مكتمل.");
}

function getExtension(file: File): string | null {
  const name = file.name.toLowerCase();
  const dot = name.lastIndexOf(".");
  if (dot < 0) return null;
  const extension = name.slice(dot + 1);
  return ALLOWED_EXTENSIONS.has(extension) ? extension : null;
}

function validatePortfolioFile(file: File): string | null {
  if (!ALLOWED_MIME_TYPES.has(file.type)) return "نوع الصورة غير مسموح. استخدم JPG أو JPEG أو PNG أو WEBP.";
  if (!getExtension(file)) return "امتداد الصورة غير مسموح. استخدم JPG أو JPEG أو PNG أو WEBP.";
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return "حجم الصورة يجب ألا يتجاوز 5 MB.";
  return null;
}

function withPublicUrl(item: SupplierPortfolioItem): SupplierPortfolioItem {
  if (!supabase) return item;
  const { data } = supabase.storage.from("supplier-work").getPublicUrl(item.storage_path);
  return { ...item, public_url: data.publicUrl };
}

async function currentUserId(): Promise<{ userId: string | null; error: Error | null }> {
  if (!supabase) return { userId: null, error: configError() };
  const { data, error } = await supabase.auth.getUser();
  if (error) return { userId: null, error };
  return { userId: data.user?.id ?? null, error: null };
}

export async function getSupplierPortfolio(supplierId: string): Promise<{ items: SupplierPortfolioItem[]; error: Error | null }> {
  if (!supabase) return { items: [], error: configError() };
  const { data, error } = await supabase
    .from("supplier_portfolio")
    .select(TABLE_COLUMNS)
    .eq("supplier_id", supplierId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return { items: [], error };
  return { items: ((data as SupplierPortfolioItem[] | null) ?? []).map(withPublicUrl), error: null };
}

export async function uploadPortfolioImage(file: File): Promise<{ item: SupplierPortfolioItem | null; error: Error | null }> {
  if (!supabase) return { item: null, error: configError() };
  const validationError = validatePortfolioFile(file);
  if (validationError) return { item: null, error: new Error(validationError) };

  const { userId, error: userError } = await currentUserId();
  if (userError || !userId) return { item: null, error: userError ?? new Error("يجب تسجيل الدخول أولًا.") };

  const extension = getExtension(file);
  if (!extension) return { item: null, error: new Error("امتداد الصورة غير صالح.") };

  const storagePath = `${userId}/portfolio/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage.from("supplier-work").upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) return { item: null, error: uploadError };

  const { data: inserted, error: insertError } = await supabase
    .from("supplier_portfolio")
    .insert({
      supplier_id: userId,
      storage_path: storagePath,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
    })
    .select(TABLE_COLUMNS)
    .single();

  if (insertError) {
    await supabase.storage.from("supplier-work").remove([storagePath]);
    return { item: null, error: insertError };
  }

  return { item: withPublicUrl(inserted as SupplierPortfolioItem), error: null };
}

export async function deletePortfolioItem(item: Pick<SupplierPortfolioItem, "id" | "storage_path">): Promise<{ error: Error | null }> {
  if (!supabase) return { error: configError() };
  const { userId, error: userError } = await currentUserId();
  if (userError || !userId) return { error: userError ?? new Error("يجب تسجيل الدخول أولًا.") };

  const { data: existing, error: lookupError } = await supabase
    .from("supplier_portfolio")
    .select("id, supplier_id, storage_path")
    .eq("id", item.id)
    .eq("supplier_id", userId)
    .maybeSingle();
  if (lookupError) return { error: lookupError };
  if (!existing) return { error: new Error("الصورة غير موجودة أو لا تملك صلاحية حذفها.") };

  const { error: storageError } = await supabase.storage.from("supplier-work").remove([existing.storage_path]);
  if (storageError) return { error: storageError };

  const { error: deleteError } = await supabase
    .from("supplier_portfolio")
    .delete()
    .eq("id", existing.id)
    .eq("supplier_id", userId);
  if (deleteError) return { error: deleteError };

  return { error: null };
}
