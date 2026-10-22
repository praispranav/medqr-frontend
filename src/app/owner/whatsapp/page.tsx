'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { apiBase } from '@/lib/clinicHost';
import type { AdminApi, WhatsAppConversation, WhatsAppInboxBrand, WhatsAppInboxDetail, WhatsAppInboxMessage } from '@/lib/adminApi';

const BRANDS: Record<WhatsAppInboxBrand, string> = { unassigned: 'Unassigned', clinicq: 'ClinicQ', frosty_caps: 'Frosty Caps' };
const time = (value: string) => new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const control = 'min-h-[44px] rounded-lg bg-surface-container-low px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50';
function safeUrl(url: string) { try { return new URL(url).protocol === 'https:' ? url : null; } catch { return null; } }

export default function WhatsAppInboxPage() {
  return <AdminShell active="/owner/whatsapp">{(api, me) => me.role === 'super' ? <Inbox api={api} /> : <p>This inbox is available to the platform administrator.</p>}</AdminShell>;
}
function Inbox({ api }: { api: AdminApi }) {
  const [rows, setRows] = useState<WhatsAppConversation[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const [detail, setDetail] = useState<WhatsAppInboxDetail | null>(null);
  const [brand, setBrand] = useState<WhatsAppInboxBrand | 'all'>('all');
  const [search, setSearch] = useState('');
  const [showClosed, setShowClosed] = useState(false);
  const [error, setError] = useState('');
  const [live, setLive] = useState(false);
  const [sendingEnabled, setSendingEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [now, setNow] = useState(Date.now());
  const [loadingOlder, setLoadingOlder] = useState(false);
  const history = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const draftRef = useRef<Record<string, string>>({});
  const requests = useRef<Record<string, { text: string; id: string }>>({});

  const refresh = useCallback(async () => {
    const g = ++generation.current;
    const id = selectedRef.current;
    try {
      const [overview, thread] = await Promise.all([api.whatsappInbox(), id ? api.whatsappConversation(id) : Promise.resolve(null)]);
      if (g !== generation.current) return;
      setRows(overview.conversations); setSendingEnabled(overview.sending_enabled);
      if (id === selectedRef.current) setDetail(prev => {
        if (!thread || prev?.conversation.id !== id) return thread;
        const ids = new Set(thread.messages.map(m => m.id));
        const first = thread.messages[0]?.created_at;
        const earlier = prev.messages.filter(m => !ids.has(m.id) && first && m.created_at <= first);
        return { ...thread, has_more: earlier.length ? prev.has_more : thread.has_more, messages: [...earlier, ...thread.messages] };
      });
      setError('');
      if (thread && thread.conversation.unread > 0) {
        await api.updateWhatsAppConversation(thread.conversation.id, { read: true });
      }
    } catch (e) { if (g === generation.current) setError((e as Error).message); }
  }, [api]);
  useEffect(() => {
    void refresh();
    const events = new EventSource(`${apiBase()}/owner/whatsapp/events`, { withCredentials: true });
    events.onopen = () => { setLive(true); void refresh(); };
    events.onerror = () => setLive(false);
    events.onmessage = event => { try { if (!JSON.parse(event.data).heartbeat) void refresh(); } catch {} };
    const resume = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', resume); window.addEventListener('online', resume); document.addEventListener('visibilitychange', resume);
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => { events.close(); window.removeEventListener('focus', resume); window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume); clearInterval(timer); generation.current++; };
  }, [refresh]);
  useEffect(() => { history.current?.scrollTo({ top: history.current.scrollHeight }); }, [selected, detail?.messages.at(-1)?.id]);

  function open(id: string | null) {
    if (selectedRef.current) draftRef.current[selectedRef.current] = text;
    selectedRef.current = id; setSelected(id); setDetail(null); setText(id ? draftRef.current[id] ?? '' : ''); void refresh();
  }
  async function update(patch: { brand?: WhatsAppInboxBrand; status?: 'open' | 'closed' }) {
    if (!selected) return;
    try { await api.updateWhatsAppConversation(selected, patch); await refresh(); } catch (e) { setError((e as Error).message); }
  }
  async function send() {
    if (!selected || busy || !text.trim()) return;
    const id = selected; const body = text;
    setBusy(true); setError('');
    try {
      if (requests.current[id]?.text !== body) requests.current[id] = { text: body, id: crypto.randomUUID() };
      const result = await api.replyWhatsApp(id, body, requests.current[id].id);
      if (result.status === 'failed') setError(result.error || 'Message failed');
      else { delete requests.current[id]; draftRef.current[id] = ''; if (selectedRef.current === id) setText(''); }
      await refresh();
      if (result.status === 'failed') setError(result.error || 'Message failed');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function older() {
    if (!detail || !selected || loadingOlder) return;
    const id = selected; const first = detail.messages[0]?.id;
    setLoadingOlder(true);
    try {
      const next = await api.whatsappConversation(id, first);
      if (selectedRef.current === id) setDetail(prev => prev ? { ...prev, has_more: next.has_more, messages: [...next.messages, ...prev.messages].filter((m, i, all) => all.findIndex(x => x.id === m.id) === i) } : prev);
    } catch (e) { setError((e as Error).message); } finally { setLoadingOlder(false); }
  }
  const shown = (rows ?? []).filter(c => (brand === 'all' || c.brand === brand) && (showClosed || c.status === 'open') && `${c.name} ${c.phone} ${c.preview}`.toLowerCase().includes(search.toLowerCase()));
  const c = detail?.conversation;
  const until = c?.last_inbound_at ? new Date(c.last_inbound_at).getTime() + 86400000 : 0;
  const allowed = !!detail?.reply_allowed && until > now && sendingEnabled;
  return <div className="flex min-w-0 flex-col gap-3">
    <header className={`${selected ? 'hidden md:flex' : 'flex'} flex-wrap items-center justify-between gap-2`}>
      <div>{selected ? <h2 className="text-2xl font-semibold">WhatsApp inbox</h2> : <h1 className="text-2xl font-semibold">WhatsApp inbox</h1>}<p className="text-sm text-on-surface-variant">ClinicQ &amp; Frosty Caps · Manual replies</p></div>
      <div className="flex items-center gap-3"><span className="text-sm text-on-surface-variant" role="status">{live ? 'Live' : 'Reconnecting…'}</span><button className={control} onClick={() => void refresh()}>Refresh</button></div>
    </header>
    {error && <p role="alert" className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{error}</p>}
    {!sendingEnabled && rows && <p className="rounded-lg bg-surface-container-low p-3 text-sm">Receiving inbox. Connect Telnyx credentials to enable sending.</p>}
    <div className="grid min-h-[65dvh] grid-cols-1 overflow-hidden rounded-xl bg-surface-container-lowest md:h-[75dvh] md:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
      <aside aria-label="Conversations" className={`${selected ? 'hidden md:flex' : 'flex'} min-h-0 flex-col gap-3 bg-surface-container-low p-3`}>
        <input aria-label="Search conversations" placeholder="Search name, number or message" value={search} onChange={e => setSearch(e.target.value)} className="min-h-[44px] w-full rounded-lg bg-surface-container-lowest px-3 text-base" />
        <div className="flex gap-2"><select aria-label="Filter by business" value={brand} onChange={e => setBrand(e.target.value as typeof brand)} className={`${control} min-w-0 flex-1 bg-surface-container-lowest`}><option value="all">All businesses</option>{Object.entries(BRANDS).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select><label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} />Closed too</label></div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows === null && <p className="p-3 text-sm">{error ? 'Could not load conversations. Use Refresh to try again.' : 'Loading conversations…'}</p>}
          {rows && !shown.length && <p className="p-3 text-sm text-on-surface-variant">{rows.length ? 'No conversations match this filter.' : 'New messages will appear here after Telnyx delivers them to your webhook.'}</p>}
          {shown.map(row => <button key={row.id} onClick={() => open(row.id)} className={`mb-1 flex min-h-[96px] w-full flex-col gap-1 rounded-lg p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${selected === row.id ? 'bg-surface-container-high' : 'hover:bg-surface-container-high'}`}>
            <span className="flex w-full items-center justify-between gap-2"><span className="truncate font-semibold">{row.name || row.phone}</span>{row.unread > 0 && <span className="rounded-full bg-primary px-2 text-sm text-on-primary" aria-label={`${row.unread} unread`}>{row.unread}</span>}</span>
            <span className="line-clamp-2 break-words text-sm">{row.preview || 'New conversation'}</span><span className="text-xs text-on-surface-variant">{BRANDS[row.brand]} · {time(row.last_message_at)}</span>
          </button>)}
        </div>
        <p className="text-xs text-on-surface-variant">Latest 500 conversations. History starts when this inbox is connected.</p>
      </aside>
      <section aria-label="Selected conversation" className={`${selected ? 'flex' : 'hidden md:flex'} h-[calc(100dvh-88px)] min-h-[400px] min-w-0 flex-col md:h-auto md:min-h-0`}>
        {!selected && <div className="m-auto max-w-sm p-6 text-center"><h2 className="text-lg font-semibold">Choose a conversation</h2><p className="mt-2 text-sm text-on-surface-variant">Read messages, assign the business and reply here. You control every message sent from this inbox.</p></div>}
        {selected && !detail && <div className="p-4"><button className={control} onClick={() => open(null)}>Back to conversations</button><p className="mt-4 text-sm">Loading messages…</p></div>}
        {c && detail && <>
          <div className="flex flex-wrap items-center gap-2 p-3">
            <button aria-label="Back to conversations" className={`${control} md:hidden`} onClick={() => open(null)}>Back</button>
            <div className="min-w-0 basis-[calc(100%-80px)] flex-1 md:basis-auto"><h1 className="truncate text-base font-semibold">{c.name || c.phone}</h1><p className="text-xs text-on-surface-variant">{c.name ? `${c.phone} · ` : ''}{c.status === 'closed' ? 'Closed' : 'Open'}</p></div>
            <select aria-label="Business for this conversation" value={c.brand} onChange={e => void update({ brand: e.target.value as WhatsAppInboxBrand })} className={`${control} max-w-[150px]`}>{Object.entries(BRANDS).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select>
            <button className={control} onClick={() => void update({ status: c.status === 'open' ? 'closed' : 'open' })}>{c.status === 'open' ? 'Close' : 'Reopen'}</button>
          </div>
          <div ref={history} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-surface-container-low/50 p-3 md:p-5">
            {detail.has_more && <button className={control} disabled={loadingOlder} onClick={() => void older()}>{loadingOlder ? 'Loading…' : 'Load earlier messages'}</button>}
            {detail.messages.map(m => <Message key={m.id} message={m} />)}
          </div>
          <form className="flex shrink-0 flex-col gap-2 p-3 pb-[max(12px,env(safe-area-inset-bottom))]" onSubmit={e => { e.preventDefault(); void send(); }}>
            <p className="text-xs text-on-surface-variant">{!sendingEnabled ? 'Sending unavailable until Telnyx is connected.' : allowed ? `Reply window ends ${time(new Date(until).toISOString())}.` : 'Reply window closed. Wait for a new customer message; an approved template is needed to contact them through the API now.'}</p>
            <div className="flex items-end gap-2"><textarea aria-label="Your reply" placeholder="Write a reply…" value={text} maxLength={4096} disabled={!allowed || busy} onChange={e => setText(e.target.value)} rows={2} className="min-h-[52px] min-w-0 flex-1 resize-none rounded-lg bg-surface-container-low p-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50" /><button type="submit" disabled={!allowed || busy || !text.trim()} className="min-h-[48px] rounded-lg bg-primary px-4 text-on-primary disabled:opacity-40">{busy ? 'Sending…' : 'Send'}</button></div>
          </form>
        </>}
      </section>
    </div>
  </div>;
}
function Message({ message: m }: { message: WhatsAppInboxMessage }) {
  return <article className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[90%] rounded-xl p-3 md:max-w-[80%] ${m.direction === 'outbound' ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-lowest'}`}>
    {m.text && <p className="whitespace-pre-wrap break-words text-base [overflow-wrap:anywhere]">{m.text}</p>}
    {!m.text && <p className="text-sm">{m.type === 'text' ? 'Message' : `${m.type} message`}</p>}
    {m.media.map((media, i) => { const url = safeUrl(media.url); return url ? <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="mt-2 block min-h-[44px] break-words py-2 text-sm underline">Open {media.content_type?.split('/')[0] || 'attachment'}{m.media.length > 1 ? ` ${i + 1}` : ''}</a> : <p key={i} className="text-sm">Attachment unavailable</p>; })}
    {!m.text && !m.media.length && <p className="mt-1 text-xs">This message type has been saved; no preview is available.</p>}
    <p className="mt-2 text-xs opacity-75">{time(m.occurred_at)}{m.direction === 'outbound' ? ` · ${m.status}${m.sent_by === 'WhatsApp Business app' ? ' · Business app' : ''}` : ''}</p>
    {m.error && <p role="alert" className="mt-1 text-sm">{m.error}</p>}
  </div></article>;
}
