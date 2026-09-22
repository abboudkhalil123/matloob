export type AdminStats = {
  totalUsers: number;
  requesterUsers: number;
  supplierUsers: number;
  totalRequests: number;
  openRequests: number;
  completedRequests: number;
  totalOffers: number;
  verifiedSuppliers: number;
  activeProSubscriptions: number;
  pendingVerificationRequests: number;
  pendingProSubscriptions: number;
};

export type AdminUser = {
  id: string;
  fullName: string | null;
  role: "requester" | "supplier";
  createdAt: string;
  hasSupplierProfile: boolean;
  verified: boolean;
  proStatus: "active" | "pending" | "cancelled" | "expired" | "free" | null;
  proExpiresAt: string | null;
  isActive: boolean;
};

export type AdminRequest = {
  id: string;
  title: string;
  requesterName: string | null;
  categoryId: string;
  categoryName: string;
  cityId: string;
  cityName: string;
  status: string;
  createdAt: string;
  offerCount: number;
};

export type AdminSupplier = {
  id: string;
  userId: string;
  supplierName: string | null;
  companyName: string | null;
  businessType: string | null;
  cityId: string | null;
  cityName: string | null;
  verified: boolean;
  reviewCount: number;
  ratingAverage: number | null;
  proStatus: "active" | "pending" | "cancelled" | "expired" | "free";
  createdAt: string;
};
