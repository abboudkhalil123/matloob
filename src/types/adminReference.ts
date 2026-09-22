export type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  requestCount: number;
  supplierCount: number;
  usageCount: number;
};

export type AdminCity = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  requestCount: number;
  supplierCount: number;
  usageCount: number;
};
