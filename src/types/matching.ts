export type MatchingSupplier = {
  supplierId: string;
  companyName: string | null;
  businessType: string | null;
  cityId: string | null;
  verified: boolean;
  isPro: boolean;
  matchScore: number;
};
