'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fmtPrice, fmtTime } from '@/lib/format';

export default function ChatRoomClient({ room, product, partner, meId, initialMessages }) {
  const router = useRouter();
  const supabase = createClient();
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  // Realtime subscription on chat_messages for this room
  useEffect(() => {
    const channel = supabase
      .channel(`carrot_room_${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'carrot_chat_messages',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]
          );
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [room.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    const t = text.trim(); if (!t || sending) return;
    setSending(true); setErr(''); setText('');
    try {
      const optimistic = { id: `tmp_${Date.now()}`, room_id: room.id, sender_id: meId, text: t, created_at: new Date().toISOString() };
      setMessages((prev) => [...prev, optimistic]);
      const { data, error } = await supabase
        .from('carrot_chat_messages')
        .insert({ room_id: room.id, sender_id: meId, text: t })
        .select('id, room_id, sender_id, text, created_at')
        .single();
      if (error) throw error;
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? data : m)));
    } catch (e) {
      setErr(e.message);
      setText(t);
      setMessages((prev) => prev.filter((m) => !String(m.id).startsWith('tmp_')));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)] -mx-4">
      <div className="bg-white border-b border-[color:var(--line)] px-3 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/chats')} className="text-2xl text-gray-600 pressable px-1">←</button>
        <div className="w-9 h-9 rounded-full bg-orange-100 text-[color:var(--carrot)] font-bold flex items-center justify-center">{partner?.nickname?.[0] || '🥕'}</div>
        <div className="min-w-0">
          <div className="font-semibold leading-tight">{partner?.nickname || '알 수 없음'}</div>
          <div className="text-[11px] text-gray-400">📍 {partner?.region || '-'}</div>
        </div>
        {product && (
          <button onClick={() => router.push(`/product/${product.id}`)} className="ml-auto flex items-center gap-2 bg-gray-50 hover:bg-gray-100 rounded-xl p-1.5 pr-3 max-w-[55%] pressable">
            {product.images?.[0] ? (
              <img src={product.images[0]} className="w-10 h-10 rounded-lg object-cover" alt="" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center text-lg">🥕</div>
            )}
            <div className="text-left min-w-0">
              <div className="text-[12px] text-gray-500 truncate">{product.title}</div>
              <div className="text-[12px] font-bold">{fmtPrice(product.price)}</div>
            </div>
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5 bg-[color:var(--bg)]">
        {messages.map((m, i) => {
          // UUID 비교 — 둘 다 string으로 강제 + trim (Realtime payload 호환)
          const mine = String(m.sender_id ?? '').trim() === String(meId ?? '').trim();
          const prev = messages[i - 1];
          const sameSender = prev && String(prev.sender_id ?? '').trim() === String(m.sender_id ?? '').trim();
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[78%] px-3.5 py-2 text-[14px] leading-relaxed shadow-sm ${
                mine
                  ? `bg-[color:var(--carrot)] text-white ${sameSender ? 'rounded-2xl rounded-tr-md' : 'rounded-2xl rounded-tr-sm'}`
                  : `bg-white text-gray-900 ${sameSender ? 'rounded-2xl rounded-tl-md' : 'rounded-2xl rounded-tl-sm'}`
              }`}>
                {m.text}
                <div className={`text-[10px] mt-1 ${mine ? 'text-white/75' : 'text-gray-400'}`}>{fmtTime(m.created_at)}</div>
              </div>
            </div>
          );
        })}
        {!messages.length && (
          <div className="text-center text-sm text-gray-400 py-12">
            <div className="text-3xl mb-2">👋</div>
            대화를 시작해보세요
          </div>
        )}
        {err && <div className="text-center text-xs text-red-500">{err}</div>}
      </div>

      <form onSubmit={send} className="bg-white border-t border-[color:var(--line)] p-2.5 flex items-center gap-2">
        <input
          className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--carrot)]"
          placeholder="메시지 보내기"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button disabled={!text.trim() || sending} className="btn-carrot rounded-full w-9 h-9 text-sm disabled:opacity-40 flex items-center justify-center">↑</button>
      </form>
    </div>
  );
}
