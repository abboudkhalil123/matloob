export type SupportCategory = 'account' | 'request' | 'offer' | 'supplier' | 'verification' | 'subscription' | 'technical' | 'other';
export type SupportStatus = 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
export type SupportPriority = 'low' | 'normal' | 'high' | 'urgent';

export type SupportTicket = { id:string; user_id:string; subject:string; category:SupportCategory; status:SupportStatus; priority:SupportPriority; created_at:string; updated_at:string; closed_at:string|null; total_count?:number };
export type AdminSupportTicket = SupportTicket & { user_name:string|null; user_email:string|null };
export type SupportMessage = { id:string; ticket_id:string; sender_id:string; message:string; created_at:string; sender_name?:string|null };
export type SupportSummary = { open_tickets:number; in_progress_tickets:number; waiting_user_tickets:number; urgent_tickets:number };
