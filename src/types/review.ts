export type Review = {
  id: string;
  request_id: string;
  reviewer_id?: string;
  reviewed_supplier_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export type SupplierRating = {
  average: number | null;
  count: number;
};

export type CreateSupplierReviewInput = {
  request_id: string;
  rating: number;
  comment?: string | null;
};
