export type VerificationStatus = "pending" | "approved" | "rejected" | "cancelled";

export type VerificationRequest = {
  id: string;
  supplier_id: string;
  status: VerificationStatus;
  notes: string | null;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  supplier_name?: string | null;
  company_name?: string | null;
  business_type?: string | null;
  city_name?: string | null;
  verified?: boolean;
};
