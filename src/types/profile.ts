export type ProfileRole = "requester" | "supplier";

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: ProfileRole;
  created_at: string;
  updated_at: string;
  is_active: boolean;
};
