import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ChatRoomClient from './ChatRoomClient';

export default async function ChatRoomPage({ params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const id = Number(params.id);
  const { data: room } = await supabase
    .from('carrot_chat_rooms')
    .select('id, product_id, buyer_id, seller_id, created_at')
    .eq('id', id)
    .maybeSingle();
  if (!room) notFound();
  if (room.buyer_id !== user.id && room.seller_id !== user.id) redirect('/');

  const partnerId = room.buyer_id === user.id ? room.seller_id : room.buyer_id;
  const [{ data: product }, { data: partner }, { data: messages }] = await Promise.all([
    supabase.from('carrot_products').select('id, title, price, images').eq('id', room.product_id).maybeSingle(),
    supabase.from('carrot_profiles').select('id, nickname, region').eq('id', partnerId).maybeSingle(),
    supabase.from('carrot_chat_messages').select('id, room_id, sender_id, text, created_at').eq('room_id', id).order('id', { ascending: true }),
  ]);

  return (
    <ChatRoomClient
      room={room}
      product={product}
      partner={partner}
      meId={user.id}
      initialMessages={messages || []}
    />
  );
}
