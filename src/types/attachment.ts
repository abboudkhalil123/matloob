export type AttachmentBase = {
  id: string;
  uploaded_by: string;
  storage_path: string;
  file_name: string;
  file_type: string;
  file_size: number;
  created_at: string;
  updated_at: string;
  signed_url?: string;
};

export type RequestAttachment = AttachmentBase & { request_id: string };
export type OfferAttachment = AttachmentBase & { offer_id: string };
