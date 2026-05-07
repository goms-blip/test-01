import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProductDetailClient from './ProductDetailClient';

export default async function ProductDetailPage({ params }) {
  const supabase = createClient();
  const id = Number(params.id);
  const { data: item } = await supabase
    .from('carrot_products')
    .select('id, seller_id, title, price, description, category, status, region, images, created_at')
    .eq('id', id)
    .maybeSingle();
  if (!item) notFound();

  const { data: seller } = await supabase
    .from('carrot_profiles')
    .select('id, nickname, region, avatar_url')
    .eq('id', item.seller_id)
    .maybeSingle();

  const { count: favCount } = await supabase
    .from('carrot_favorites')
    .select('product_id', { count: 'exact', head: true })
    .eq('product_id', id);

  const { data: { user } } = await supabase.auth.getUser();
  let favorited = false;
  if (user) {
    const { data: f } = await supabase
      .from('carrot_favorites')
      .select('product_id')
      .eq('product_id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    favorited = !!f;
  }

  return (
    <ProductDetailClient
      item={item}
      seller={seller}
      favCount={favCount || 0}
      initialFavorited={favorited}
      meId={user?.id || null}
    />
  );
}
