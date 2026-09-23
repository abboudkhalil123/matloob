import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import SiteHeader from "../components/SiteHeader";
import { useAuth } from "../lib/auth";
import {
  getConversationContext,
  getConversationMessages,
  markConversationMessagesRead,
  sendConversationMessage,
  subscribeToConversation,
  type ConversationMessage,
  type ConversationContext,
} from "../services/conversationService";

function getConversationId() {
  return window.location.pathname.split("/").filter(Boolean).pop() ?? "";
}

function Avatar({
  name,
  avatarUrl,
  size = "md",
}: {
  name: string;
  avatarUrl: string | null;
  size?: "sm" | "md";
}) {
  const initial = name.trim().charAt(0) || "م";
  const sizeClass = size === "sm" ? "size-9" : "size-11";

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClass} shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-slate-800`}
        onError={(event) => {
          event.currentTarget.style.display = "none";
          event.currentTarget.nextElementSibling?.removeAttribute("hidden");
        }}
      />
    );
  }

  return (
    <div className={`${sizeClass} shrink-0 grid place-items-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-black text-white shadow-sm`}>
      {initial}
    </div>
  );
}

export default function ConversationPage() {
  const { user, loading: authLoading } = useAuth();
  const conversationId = getConversationId();
  const [context, setContext] = useState<ConversationContext | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "error">("connecting");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const otherInitial = useMemo(() => (context?.counterpartName?.trim().charAt(0) || "م").toUpperCase(), [context?.counterpartName]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!conversationId || !user) {
        if (active) {
          setLoading(false);
          setError(!user ? "يجب تسجيل الدخول للوصول إلى المحادثة." : "رابط المحادثة غير صالح.");
        }
        return;
      }
      setLoading(true);
      setError("");
      try {
        const [conversationContext, conversationMessages] = await Promise.all([
          getConversationContext(conversationId),
          getConversationMessages(conversationId),
        ]);
        if (!active) return;
        setContext(conversationContext);
        setMessages(conversationMessages);
        setConnectionState("connecting");
        await markConversationMessagesRead(conversationId);
        if (active) {
          setMessages((current) => current.map((message) => message.sender_id !== user.id && !message.read_at ? { ...message, read_at: new Date().toISOString() } : message));
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "تعذر تحميل المحادثة.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [conversationId, user]);

  useEffect(() => {
    if (!conversationId || !user || !context) return;
    const cleanup = subscribeToConversation(conversationId, (incomingMessage) => {
      setConnectionState("connected");
      setMessages((current) => current.some((message) => message.id === incomingMessage.id) ? current : [...current, incomingMessage]);
      if (incomingMessage.sender_id !== user.id) {
        void markConversationMessagesRead(conversationId).then(() => {
          setMessages((current) => current.map((message) => message.id === incomingMessage.id && !message.read_at ? { ...message, read_at: new Date().toISOString() } : message));
        });
      }
    });
    const timeout = window.setTimeout(() => setConnectionState("connected"), 1200);
    return () => { window.clearTimeout(timeout); cleanup(); };
  }, [conversationId, user, context]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  async function handleSend(event?: FormEvent) {
    event?.preventDefault();
    const cleanText = text.trim();
    if (!cleanText || !conversationId || !user || sending) return;
    setSending(true);
    setError("");
    try {
      const message = await sendConversationMessage(conversationId, cleanText);
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      setText("");
      textareaRef.current?.focus();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "تعذر إرسال الرسالة.");
    } finally {
      setSending(false);
    }
  }

  function goBack() {
    window.location.href = context?.request.id ? `/requests/${context.request.id}` : "/requests";
  }

  if (authLoading || loading) {
    return <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white"><SiteHeader /><section className="mx-auto flex min-h-[calc(100vh-74px)] max-w-5xl items-center justify-center px-4 py-10"><div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-blue-50 text-2xl text-blue-600 dark:bg-blue-950/60">◌</div><h1 className="mt-5 text-xl font-black">جارٍ فتح المحادثة</h1><p className="mt-2 text-sm leading-7 text-slate-500 dark:text-slate-400">نحضّر المحادثة ونحمّل الرسائل بأمان.</p></div></section></main>;
  }

  if (error && !context) {
    return <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white"><SiteHeader /><section className="mx-auto flex min-h-[calc(100vh-74px)] max-w-5xl items-center justify-center px-4 py-10"><div className="w-full max-w-xl rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm dark:border-rose-900/60 dark:bg-slate-900"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-rose-50 text-xl text-rose-600 dark:bg-rose-950/50">!</div><h1 className="mt-5 text-xl font-black">تعذر فتح المحادثة</h1><p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">{error}</p><button type="button" onClick={goBack} className="mt-6 rounded-xl bg-slate-950 px-5 py-3 text-sm font-black text-white dark:bg-white dark:text-slate-950">العودة إلى الطلب</button></div></section></main>;
  }

  if (!context || !user) return null;
  const currentAvatar = context.currentUserProfile?.avatar_url ?? null;
  const counterpartAvatar = context.counterpartAvatarUrl;

  return (
    <main dir="rtl" className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <SiteHeader />
      <section className="mx-auto flex min-h-[calc(100vh-74px)] w-full max-w-6xl flex-col px-0 py-0 sm:px-5 sm:py-5">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-x border-slate-200 bg-white shadow-sm sm:rounded-[28px] sm:border dark:border-slate-800 dark:bg-slate-900">
          <header className="shrink-0 border-b border-slate-200 bg-white/95 px-3 py-3 backdrop-blur sm:px-6 sm:py-4 dark:border-slate-800 dark:bg-slate-900/95">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <button type="button" onClick={goBack} aria-label="العودة إلى الطلب" className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-blue-300 hover:text-blue-600 sm:size-11 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
              <Avatar name={context.counterpartName} avatarUrl={counterpartAvatar} />
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-base font-black sm:text-lg">{context.counterpartName}</h1>
                <div className="mt-1 flex min-w-0 items-center gap-2 text-[11px] font-bold text-slate-400 sm:text-xs">
                  <span className={`size-2 shrink-0 rounded-full ${connectionState === "connected" ? "bg-emerald-500" : "bg-amber-400"}`} />
                  <span className="shrink-0">{connectionState === "connected" ? "متصل" : "جارٍ الاتصال"}</span>
                  <span className="size-1 shrink-0 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span className="truncate">{context.request.title}</span>
                </div>
              </div>
              <button type="button" onClick={goBack} className="hidden rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition hover:border-blue-200 hover:text-blue-600 sm:block dark:border-slate-700 dark:text-slate-300">تفاصيل الطلب</button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/80"><p className="text-[10px] font-bold text-slate-400">الطلب</p><p className="mt-1 truncate text-xs font-black sm:text-sm">{context.request.title}</p></div>
              <div className="rounded-2xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/80"><p className="text-[10px] font-bold text-slate-400">العرض</p><p className="mt-1 text-xs font-black sm:text-sm">{context.offer.price} {context.offer.currency}</p></div>
              <div className="col-span-2 rounded-2xl bg-emerald-50 px-3 py-2.5 sm:col-span-1 dark:bg-emerald-950/30"><p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">الحالة</p><p className="mt-1 text-xs font-black text-emerald-700 dark:text-emerald-300">عرض مختار</p></div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(47,128,237,0.06),_transparent_38%)] px-3 py-4 sm:px-6 sm:py-5 dark:bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.10),_transparent_40%)]">
            {messages.length === 0 ? (
              <div className="flex min-h-[45vh] items-center justify-center"><div className="max-w-md px-5 text-center"><Avatar name={context.counterpartName} avatarUrl={counterpartAvatar} size="md" /><h2 className="mt-4 text-xl font-black">ابدأ المحادثة مع {context.counterpartName}</h2><p className="mt-2 text-sm leading-7 text-slate-500 dark:text-slate-400">اكتب رسالتك الأولى واتفقوا على تفاصيل الطلب مباشرة.</p></div></div>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-3">
                <div className="mb-2 text-center"><span className="inline-flex rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-slate-400 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">المحادثة مرتبطة بهذا الطلب والعرض المختار</span></div>
                {messages.map((message, index) => {
                  const mine = message.sender_id === user.id;
                  const previous = messages[index - 1];
                  const showDate = !previous || new Date(previous.created_at).toLocaleDateString("ar-SY") !== new Date(message.created_at).toLocaleDateString("ar-SY");
                  const senderName = mine ? (context.currentUserProfile?.full_name || "أنت") : context.counterpartName;
                  const senderAvatar = mine ? currentAvatar : counterpartAvatar;
                  return <div key={message.id}>
                    {showDate && <div className="my-5 text-center text-[11px] font-bold text-slate-400">{new Intl.DateTimeFormat("ar-SY", { dateStyle: "medium" }).format(new Date(message.created_at))}</div>}
                    <div className={`flex items-end gap-2 ${mine ? "justify-start" : "justify-end"}`}>
                      {!mine && <Avatar name={senderName} avatarUrl={senderAvatar} size="sm" />}
                      <div className={`flex max-w-[86%] flex-col ${mine ? "items-start" : "items-end"} sm:max-w-[72%]`}>
                        <div className={`mb-1 px-1 text-[10px] font-black text-slate-400 ${mine ? "text-right" : "text-left"}`}>{senderName}</div>
                        <div className={mine ? "rounded-[22px] rounded-tr-md bg-slate-950 px-4 py-3 text-white shadow-sm dark:bg-blue-600" : "rounded-[22px] rounded-tl-md border border-slate-200 bg-white px-4 py-3 text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"}>
                          <p className="whitespace-pre-wrap break-words text-sm leading-7">{message.message}</p>
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5 px-1 text-[10px] font-bold text-slate-400"><span>{new Intl.DateTimeFormat("ar-SY", { hour: "numeric", minute: "2-digit" }).format(new Date(message.created_at))}</span>{mine && <><span className="size-1 rounded-full bg-slate-300" /><span className={message.read_at ? "text-blue-600" : ""}>{message.read_at ? "تمت القراءة" : "تم الإرسال"}</span></>}</div>
                      </div>
                      {mine && <Avatar name={senderName} avatarUrl={senderAvatar} size="sm" />}
                    </div>
                  </div>;
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="sticky bottom-0 shrink-0 border-t border-slate-200 bg-white p-2.5 sm:p-4 dark:border-slate-800 dark:bg-slate-900">
            {error && context && <div className="mx-auto mb-3 max-w-3xl rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold leading-6 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">{error}</div>}
            <form onSubmit={(event) => void handleSend(event)} className="mx-auto flex max-w-3xl items-end gap-2">
              <textarea ref={textareaRef} value={text} onChange={(event) => setText(event.target.value)} onKeyDown={handleKeyDown} rows={1} maxLength={5000} disabled={sending} placeholder="اكتب رسالتك..." aria-label="نص الرسالة" className="max-h-40 min-h-12 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:bg-slate-800 dark:focus:ring-blue-950/50" />
              <button type="submit" disabled={sending || !text.trim()} className="grid size-12 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-45" aria-label="إرسال الرسالة">{sending ? <span className="text-xs font-black">...</span> : <svg viewBox="0 0 24 24" className="size-5 -rotate-90" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5" strokeLinecap="round" /><path d="M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>}</button>
            </form>
            <div className="mx-auto mt-2 flex max-w-3xl items-center justify-between px-1 text-[10px] font-bold text-slate-400"><span className="hidden sm:inline">Enter للإرسال · Shift + Enter لسطر جديد</span><span>{text.length}/5000</span></div>
          </div>
        </div>
      </section>
    </main>
  );
}
