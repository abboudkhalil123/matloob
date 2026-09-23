import { useEffect, useState } from 'react';
import AdminRoute from '../components/AdminRoute';
import { adminReplySupportTicket, adminUpdateSupportTicket, getAdminSupportMessages, getAdminSupportTicket } from '../services/supportService';
import type { AdminSupportTicket, SupportMessage, SupportPriority, SupportStatus } from '../types/support';
import { AdminPage } from './AdminDashboardPage';
import { supabase } from '../lib/supabase';

const status = { open: 'مفتوحة', in_progress: 'قيد المعالجة', waiting_user: 'بانتظار المستخدم', resolved: 'تم الحل', closed: 'مغلقة' } as Record<string, string>;
const priority = { low: 'منخفضة', normal: 'عادية', high: 'عالية', urgent: 'عاجلة' } as Record<string, string>;
const dt = (v: string) => new Intl.DateTimeFormat('ar-SY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(v));

export default function AdminSupportTicketPage() {
  return <AdminRoute><Content /></AdminRoute>;
}

function Content() {
  const id = window.location.pathname.split('/').filter(Boolean).pop() || '';
  const [ticket, setTicket] = useState<AdminSupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newStatus, setNewStatus] = useState<SupportStatus>('open');
  const [newPriority, setNewPriority] = useState<SupportPriority>('normal');

  const sync = async () => {
    const [t, m] = await Promise.all([getAdminSupportTicket(id), getAdminSupportMessages(id)]);
    if (t.error || m.error || !t.ticket) {
      setError('تعذر تحديث التذكرة.');
      return;
    }
    setTicket(t.ticket);
    setMessages(m.messages);
    setNewStatus(t.ticket.status);
    setNewPriority(t.ticket.priority);
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
    const fallbackTimer = setInterval(() => {
      if (active) void sync();
    }, 4000);

    void load();

    if (!supabase) {
      return () => {
        active = false;
        clearInterval(fallbackTimer);
      };
    }

    const client = supabase;
    const channel = client
      .channel(`support-ticket-admin-${id}`)
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
          const updated = payload.new as AdminSupportTicket;
          setTicket(current => current ? { ...current, ...updated } : current);
          setNewStatus(updated.status);
          setNewPriority(updated.priority);
        }
      )
      .subscribe();

    return () => {
      active = false;
      clearInterval(fallbackTimer);
      void client.removeChannel(channel);
    };
  }, [id]);

  const reply = async () => {
    if (sending || !text.trim()) return;
    setSending(true);
    setError('');
    const r = await adminReplySupportTicket(id, text);
    if (r.error) {
      setError(r.error.message || 'تعذر إرسال الرد.');
    } else {
      setText('');
      if (r.message) setMessages(items => items.some(item => item.id === r.message!.id) ? items : [...items, r.message!]);
      void sync();
    }
    setSending(false);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    const r = await adminUpdateSupportTicket(id, newStatus, newPriority);
    if (r.error) setError(r.error.message || 'تعذر تحديث التذكرة.');
    else void sync();
    setSaving(false);
  };

  if (loading) return <AdminPage><div className="rounded-2xl bg-white p-12 text-center font-black">جارٍ التحميل...</div></AdminPage>;
  if (!ticket) return <AdminPage><div className="rounded-2xl bg-white p-12 text-center font-black">التذكرة غير موجودة.</div></AdminPage>;

  return <AdminPage><a href="/admin/support" className="text-sm font-black text-slate-500">← العودة إلى التذاكر</a><div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]"><section><div className="rounded-3xl border border-slate-200 bg-white p-6"><div className="flex flex-wrap justify-between gap-4"><div><h1 className="text-2xl font-black">{ticket.subject}</h1><p className="mt-2 text-sm text-slate-500">{ticket.user_name || 'مستخدم'} · {ticket.user_email || ''}</p></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black">{status[ticket.status]}</span></div></div>{error && <div className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}<div className="mt-5 space-y-3">{messages.map(m => <article key={m.id} className={`rounded-2xl border p-5 ${m.sender_id === ticket.user_id ? 'border-blue-100 bg-blue-50/50' : 'border-slate-200 bg-white'}`}><div className="flex justify-between gap-3"><span className="text-sm font-black">{m.sender_id === ticket.user_id ? 'المستخدم' : 'الدعم'}</span><time className="text-xs font-bold text-slate-400">{dt(m.created_at)}</time></div><p className="mt-3 whitespace-pre-wrap text-sm leading-8 text-slate-700">{m.message}</p></article>)}</div><div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5"><textarea maxLength={5000} value={text} onChange={e => setText(e.target.value)} rows={5} placeholder="اكتب رد الدعم..." className="w-full rounded-xl border border-slate-200 p-4"/><div className="mt-3 flex items-center justify-between"><span className="text-xs font-bold text-slate-400">{text.length}/5000</span><button disabled={sending || !text.trim() || ticket.status === 'closed'} onClick={() => void reply()} className="rounded-xl bg-slate-950 px-5 py-3 font-black text-white disabled:opacity-40">{sending ? 'جارٍ الإرسال...' : 'إرسال الرد'}</button></div></div></section><aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5"><h2 className="font-black">إدارة التذكرة</h2><p className="mt-2 text-xs font-bold text-slate-400">آخر تحديث: {dt(ticket.updated_at)}</p><label className="mt-6 block text-sm font-black">الحالة<select value={newStatus} onChange={e => setNewStatus(e.target.value as SupportStatus)} className="mt-2 w-full rounded-xl border p-3">{Object.entries(status).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label><label className="mt-4 block text-sm font-black">الأولوية<select value={newPriority} onChange={e => setNewPriority(e.target.value as SupportPriority)} className="mt-2 w-full rounded-xl border p-3">{Object.entries(priority).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label><button disabled={saving} onClick={() => void save()} className="mt-5 w-full rounded-xl bg-slate-950 px-4 py-3 font-black text-white disabled:opacity-40">{saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}</button>{ticket.closed_at && <p className="mt-4 text-xs font-bold text-slate-400">أُغلقت في: {dt(ticket.closed_at)}</p>}</aside></div></AdminPage>;
}
