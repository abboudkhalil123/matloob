import { supabase } from "../lib/supabase";

export interface Conversation {
  id: string;
  request_id: string;
  offer_id: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

export interface ConversationProfile {
  id: string;
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
}

export interface ConversationContext {
  conversation: Conversation;
  request: {
    id: string;
    title: string;
    requester_id: string;
    selected_offer_id: string | null;
  };
  offer: {
    id: string;
    request_id: string;
    supplier_id: string;
    price: number;
    currency: string;
    duration_value: number | null;
    duration_unit: string | null;
    supplier: {
      id: string;
      user_id: string;
      company_name: string | null;
      business_type: string | null;
    } | null;
  };
  currentUserId: string;
  currentUserProfile: ConversationProfile | null;
  counterpartProfile: ConversationProfile | null;
  isRequester: boolean;
  isSelectedSupplier: boolean;
  counterpartName: string;
  counterpartAvatarUrl: string | null;
}

function getSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase غير مُهيأ. تأكد من VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY."
    );
  }

  return supabase;
}

export async function getOrCreateConversation(offerId: string): Promise<Conversation> {
  const client = getSupabase();
  if (!offerId) throw new Error("معرّف العرض غير صالح.");

  const { data, error } = await client.rpc("get_or_create_conversation", {
    p_offer_id: offerId,
  });

  if (error) throw error;
  if (!data) throw new Error("تعذر إنشاء المحادثة.");
  return data as Conversation;
}

export async function getConversation(conversationId: string): Promise<Conversation> {
  const client = getSupabase();
  const { data, error } = await client
    .from("conversations")
    .select("id, request_id, offer_id, created_at, updated_at")
    .eq("id", conversationId)
    .single();

  if (error) throw error;
  return data as Conversation;
}

async function getPublicProfile(userId: string): Promise<ConversationProfile | null> {
  const client = getSupabase();
  const { data, error } = await client.rpc("get_public_profile", {
    p_user_id: userId,
  });

  if (error) throw error;
  if (!data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as ConversationProfile | undefined) ?? null;
}

export async function getConversationContext(
  conversationId: string,
): Promise<ConversationContext> {
  const client = getSupabase();
  const conversation = await getConversation(conversationId);

  const { data: request, error: requestError } = await client
    .from("requests")
    .select("id, title, requester_id, selected_offer_id")
    .eq("id", conversation.request_id)
    .single();
  if (requestError) throw requestError;

  const { data: offer, error: offerError } = await client
    .from("offers")
    .select("id, request_id, supplier_id, price, currency, duration_value, duration_unit")
    .eq("id", conversation.offer_id)
    .single();
  if (offerError) throw offerError;

  const { data: supplier, error: supplierError } = await client
    .from("supplier_profiles")
    .select("id, user_id, company_name, business_type")
    .eq("id", offer.supplier_id)
    .single();
  if (supplierError) throw supplierError;

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("يجب تسجيل الدخول.");

  const isRequester = user.id === request.requester_id;
  const isSelectedSupplier = user.id === supplier.user_id;

  if (!isRequester && !isSelectedSupplier) {
    throw new Error("ليس لديك صلاحية الوصول إلى هذه المحادثة.");
  }

  const counterpartUserId = isRequester ? supplier.user_id : request.requester_id;
  const [currentUserProfile, counterpartProfile] = await Promise.all([
    getPublicProfile(user.id),
    getPublicProfile(counterpartUserId),
  ]);

  const supplierName = supplier.company_name?.trim() || counterpartProfile?.full_name?.trim();
  const requesterName = counterpartProfile?.full_name?.trim();
  const counterpartName = isRequester
    ? supplierName || "المورد"
    : requesterName || "صاحب الطلب";

  return {
    conversation,
    request,
    offer: { ...offer, supplier },
    currentUserId: user.id,
    currentUserProfile,
    counterpartProfile,
    isRequester,
    isSelectedSupplier,
    counterpartName,
    counterpartAvatarUrl: counterpartProfile?.avatar_url ?? null,
  };
}

export async function getConversationMessages(
  conversationId: string,
): Promise<ConversationMessage[]> {
  const client = getSupabase();
  const { data, error } = await client
    .from("conversation_messages")
    .select("id, conversation_id, sender_id, message, created_at, read_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ConversationMessage[];
}

export async function sendConversationMessage(
  conversationId: string,
  message: string,
): Promise<ConversationMessage> {
  const client = getSupabase();
  const cleanMessage = message.trim();

  if (!cleanMessage) throw new Error("لا يمكن إرسال رسالة فارغة.");
  if (cleanMessage.length > 5000) throw new Error("الرسالة طويلة جدًا. الحد الأقصى 5000 محرف.");

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("يجب تسجيل الدخول لإرسال رسالة.");

  const { data, error } = await client
    .from("conversation_messages")
    .insert({ conversation_id: conversationId, sender_id: user.id, message: cleanMessage })
    .select("id, conversation_id, sender_id, message, created_at, read_at")
    .single();

  if (error) throw error;
  return data as ConversationMessage;
}

export async function markConversationMessagesRead(conversationId: string): Promise<void> {
  const client = getSupabase();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("يجب تسجيل الدخول.");

  const { error } = await client
    .from("conversation_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", user.id)
    .is("read_at", null);

  if (error) throw error;
}

export function subscribeToConversation(
  conversationId: string,
  onMessage: (message: ConversationMessage) => void,
): () => void {
  const client = getSupabase();
  const channel = client
    .channel(`conversation:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "conversation_messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => onMessage(payload.new as ConversationMessage),
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
