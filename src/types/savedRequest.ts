import type { RequestStatus } from "./request";

export type SavedRequest = {
  id: string;
  supplierId: string;
  requestId: string;
  createdAt: string;
  request: {
    id: string;
    title: string;
    status: RequestStatus;
    categoryId: string;
    cityId: string;
    createdAt: string;
    category?: { id: string; name: string; slug: string; created_at: string } | null;
    city?: { id: string; name: string; created_at: string } | null;
  } | null;
};
