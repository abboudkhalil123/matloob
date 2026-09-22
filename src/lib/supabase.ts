import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabaseConfigError =
  !supabaseUrl || !supabaseAnonKey
    ? "إعداد Supabase غير مكتمل: يجب ضبط VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في متغيرات البيئة."
    : null;

export const isSupabaseConfigured = supabaseConfigError === null;

// The client is intentionally null until both environment variables are configured.
// This keeps the application from crashing with an opaque runtime error while the
// Supabase project is not configured yet. No authentication, database, or storage
// operation is performed in this stage.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;
