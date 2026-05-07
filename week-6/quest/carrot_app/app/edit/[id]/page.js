import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProductForm from '@/components/ProductForm';

export default async function EditPage({ params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: item } = await supabase
    .from('carrot_products')
    .select('id, seller_id, title, price, description, category, status, images')
    .eq('id', Number(params.id))
    .maybeSingle();

  if (!item) notFound();
  if (item.seller_id !== user.id) redirect('/');

  const { data: profile } = await supabase
    .from('carrot_profiles')
    .select('id, region, nickname')
    .eq('id', user.id)
    .maybeSingle();

  return <ProductForm mode="edit" initial={item} profile={profile} />;
}
