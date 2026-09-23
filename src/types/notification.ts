export type NotificationType =
  | "new_offer"
  | "offer_selected"
  | "request_started"
  | "request_completed"
  | "request_cancelled"
  | "matching_request"
  | "support_reply"
  | "support_status_changed"
  | "new_message";

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  related_request_id: string | null;
  related_offer_id: string | null;
  related_conversation_id: string | null;
  related_ticket_id: string | null;
  is_read: boolean;
  created_at: string;
};
