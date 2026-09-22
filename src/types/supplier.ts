export type SupplierProfile = {
  id: string;
  user_id: string;
  company_name: string | null;
  business_type: string | null;
  description: string | null;
  city_id: string | null;
  location_text: string | null;
  years_experience: number | null;
  phone: string | null;
  contact_info: string | null;
  verified: boolean;
  created_at: string;
  updated_at: string;
  city?: { id: string; name: string } | null;
};

export type SupplierCategory = {
  supplier_id: string;
  category_id: string;
  created_at: string;
  category?: { id: string; name: string; slug: string; created_at: string; is_active: boolean } | null;
};

export type SupplierWorkingHour = {
  id: string;
  supplier_id: string;
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
  created_at: string;
  updated_at: string;
};

export type SupplierProfileInput = Omit<
  SupplierProfile,
  "id" | "user_id" | "verified" | "created_at" | "updated_at" | "city"
>;
