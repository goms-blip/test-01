import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ProductForm from '@/components/ProductForm';

export default async function PostPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('carrot_profiles')
    .select('id, region, nickname')
    .eq('id', user.id)
    .maybeSingle();

  return <ProductForm mode="create" profile={profile} />;
}
