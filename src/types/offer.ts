export type OfferDurationUnit = "hours" | "days" | "weeks" | "months";

export type Offer = {
  id: string;
  request_id: string;
  supplier_id: string;
  price: number;
  currency: string;
  duration_value: number | null;
  duration_unit: OfferDurationUnit | null;
  details: string;
  payment_terms: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  supplier?: {
    id: string;
    company_name: string | null;
    business_type: string | null;
  } | null;
};

export type CreateOfferInput = {
  request_id: string;
  supplier_id: string;
  price: number;
  currency: string;
  duration_value: number | null;
  duration_unit: OfferDurationUnit | null;
  details: string;
  payment_terms: string | null;
  notes: string | null;
};

export type UpdateOfferInput = Omit<CreateOfferInput, "request_id" | "supplier_id">;
