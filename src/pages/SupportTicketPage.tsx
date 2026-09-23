import { useEffect, useState } from 'react';
import ProtectedRoute from '../components/ProtectedRoute';
import { addSupportMessage, getMySupportMessages, getMySupportTicket, reopenSupportTicket } from '../services/supportService';
import { supabase } from '../lib/supabase';
import type { SupportMessage, SupportTicket } from '../types/support';

const status = (s: string) => ({ open: 'مفتوحة', in_progress: 'قيد المعالجة', waiting_user: 'بانتظار ردك', resolved: 'تم الحل', closed: 'مغلقة' } as Record<string, string>)[s] || s;
const category = (s: string) => ({ account: 'الحساب', request: 'الطلبات', offer: 'العروض', supplier: 'الموردون', verification: 'التوثيق', subscription: 'PRO / الاشتراك', technical: 'مشكلة تقنية', other: 'أخرى' } as Record<string, string>)[s] || s;
const priority = (s: string) => ({ low: 'منخفضة', normal: 'عادية', high: 'عالية', urgent: 'عاجلة' } as Record<string, string>)[s] || s;
const date = (v: string) => new Intl.DateTimeFormat('ar-SY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v));

export default function SupportTicketPage() {
  return <ProtectedRoute><Content /></ProtectedRoute>;
}

function Content() {
  const id = window.location.pathname.split('/').filter(Boolean).pop() || '';
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const sync = async () => {
    const [t, m] = await Promise.all([getMySupportTicket(id), getMySupportMessages(id)]);
    if (t.error || m.error || !t.ticket) {
      setError('تعذر تحديث التذكرة أو أنها غير متاحة.');
      return;
    }
    setTicket(t.ticket);
    setMessages(m.messages);
  };

  const load = async () => {
    setLoading(true);
    setError('');
    await sync();
    setLoading(false);
  };

  useEffect(() => {
    if (!id) return;

    let active = true;
    let realtimeReady = false;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;

    void load();

    const runFallbackSync = () => {
      if (active) void sync();
    };

    // Realtime is the primary path. The short polling fallback guarantees that
    // an open support conversation still updates if the browser/channel loses
    // its realtime connection or the delivery is temporarily missed.
    fallbackTimer = setInterval(runFallbackSync, 4000);

    if (!supabase) {
      return () => {
        active = false;
        if (fallbackTimer) clearInterval(fallbackTimer);
      };
    }

    const client = supabase;
    const channel = client
      .channel(`support-ticket-user-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${id}` },
        (payload) => {
          if (!active) return;
          const message = payload.new as SupportMessage;
          setMessages(items => items.some(item => item.id === message.id) ? items : [...items, message]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'support_tickets', filter: `id=eq.${id}` },
        (payload) => {
          if (!active) return;
          setTicket(current => current ? { ...current, ...(payload.new as Partial<SupportTicket>) } : current);
        }
      )
      .subscribe((channelStatus) => {
        realtimeReady = channelStatus === 'SUBSCRIBED';
      });

    return () => {
      active = false;
      realtimeReady = false;
      if (fallbackTimer) clearInterval(fallbackTimer);
      void client.removeChannel(channel);
    };
  }, [id]);

  const send = async () => {
    if (sending || !text.trim() || !ticket) return;
    setSending(true);
    setError('');
    const r = await addSupportMessage(id, text);
    if (r.error) {
      setError(r.error.message || 'تعذر إرسال الرد.');
    } else {
      setText('');
      if (r.message) {
        setMessages(items => items.some(item => item.id === r.message!.id) ? items : [...items, r.message!]);
      }
      void sync();
    }
    setSending(false);
  };

  const reopen = async () => {
    const r = await reopenSupportTicket(id);
    if (r.error) setError(r.error.message || 'تعذر إعادة فتح التذكرة.');
    else void sync();
  };

  if (loading) return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50"><p className="font-black">جارٍ تحميل التذكرة...</p></main>;
  if (!ticket) return <main dir="rtl" className="grid min-h-screen place-items-center bg-slate-50"><div className="rounded-2xl bg-white p-8 text-center"><h1 className="font-black">التذكرة غير متاحة</h1><a href="/support" className="mt-4 inline-block font-bold">العودة للدعم</a></div></main>;

  const canReply = !['resolved', 'closed'].includes(ticket.status);

  return <main dir="rtl" className="min-h-screen bg-slate-50 px-4 py-10"><div className="mx-auto max-w-4xl">
    <a href="/support" className="text-sm font-black text-slate-500">← العودة إلى الدعم</a>
    <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap justify-between gap-4">
        <div><h1 className="text-2xl font-black">{ticket.subject}</h1><p className="mt-2 text-sm text-slate-500">{category(ticket.category)} · أنشئت {date(ticket.created_at)}</p></div>
        <div className="flex gap-2"><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black">{status(ticket.status)}</span><span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-700">{priority(ticket.priority)}</span></div>
      </div>
      <div className="mt-4 text-xs font-bold text-slate-400">آخر تحديث: {date(ticket.updated_at)}</div>
    </div>
    {error && <div className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}
    <div className="mt-6 space-y-3">
      {messages.map(m => <article key={m.id} className={`rounded-2xl border p-5 ${m.sender_id === ticket.user_id ? 'border-blue-100 bg-blue-50/50' : 'border-slate-200 bg-white'}`}>
        <div className="flex justify-between gap-3"><span className="text-sm font-black">{m.sender_id === ticket.user_id ? 'أنت' : 'الدعم'}</span><time className="text-xs font-bold text-slate-400">{date(m.created_at)}</time></div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-8 text-slate-700">{m.message}</p>
      </article>)}
    </div>
    {canReply ? <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5"><textarea maxLength={5000} value={text} onChange={e => setText(e.target.value)} rows={5} placeholder="اكتب ردك..." className="w-full rounded-xl border border-slate-200 p-4 outline-none"/><div className="mt-3 flex items-center justify-between"><span className="text-xs font-bold text-slate-400">{text.length}/5000</span><button disabled={sending || !text.trim()} onClick={() => void send()} className="rounded-xl bg-slate-950 px-5 py-3 font-black text-white disabled:opacity-40">{sending ? 'جارٍ الإرسال...' : 'إرسال الرد'}</button></div></div> : <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-sm font-bold text-amber-900">هذه التذكرة {ticket.status === 'closed' ? 'مغلقة' : 'محلولة'} ولا يمكن إضافة رد حاليًا.</p><button onClick={() => void reopen()} className="mt-3 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-black text-white">إعادة فتح التذكرة</button></div>}
  </div></main>;
}
