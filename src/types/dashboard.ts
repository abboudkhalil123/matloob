import type { RequestStatus } from "./request";

export type DashboardRequest = {
  id: string;
  title: string;
  status: RequestStatus;
  createdAt: string;
  categoryName: string | null;
  cityName: string | null;
  offerCount: number;
};

export type DashboardOffer = {
  id: string;
  requestId: string;
  requestTitle: string | null;
  requestStatus: RequestStatus | null;
  price: number;
  currency: string;
  durationValue: number | null;
  durationUnit: string | null;
  createdAt: string;
};
