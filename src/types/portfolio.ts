export type SupplierPortfolioItem = {
  id: string;
  supplier_id: string;
  storage_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  public_url?: string;
};
