export type SubscriptionStatus = "pending" | "active" | "expired" | "cancelled";

export type SubscriptionPlan = {
  id: string;
  code: "FREE" | "PRO";
  name: string;
  price_syp: number;
  duration_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Subscription = {
  id: string;
  user_id: string;
  plan_id: string;
  plan_code: "FREE" | "PRO";
  plan_name: string;
  price_syp: number;
  duration_days: number;
  status: SubscriptionStatus;
  started_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminSubscription = {
  id: string;
  user_id: string;
  supplier_name: string | null;
  company_name: string | null;
  business_type: string | null;
  plan_code: "FREE" | "PRO";
  plan_name: string;
  status: SubscriptionStatus;
  started_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};
