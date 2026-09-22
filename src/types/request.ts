export type RequestStatus =
  | "open"
  | "closed"
  | "supplier_selected"
  | "in_progress"
  | "completed"
  | "cancelled";

export type Category = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  is_active: boolean;
};

export type City = {
  id: string;
  name: string;
  created_at: string;
  is_active: boolean;
};

export type Request = {
  id: string;
  requester_id: string;
  title: string;
  category_id: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  city_id: string;
  delivery_area: string | null;
  deadline: string | null;
  budget: number | null;
  preferred_contact: string | null;
  phone: string | null;
  status: RequestStatus;
  selected_offer_id: string | null;
  created_at: string;
  updated_at: string;
  category?: Category;
  city?: City;
};

export type CreateRequestInput = {
  title: string;
  category_id: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  city_id: string;
  delivery_area: string | null;
  deadline: string | null;
  budget: number | null;
  preferred_contact: string | null;
  phone: string | null;
};

export type UpdateRequestInput = Partial<CreateRequestInput>;
