import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import MePageClient from './MePageClient';

export const dynamic = 'force-dynamic';

export default async function MePage({ searchParams }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const tab = (searchParams?.tab) || 'mine';

  const [{ data: profile }, { data: mine }, { data: favRows }] = await Promise.all([
    supabase.from('carrot_profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('carrot_products').select('id, title, price, status, region, images, created_at').eq('seller_id', user.id).order('created_at', { ascending: false }),
    supabase.from('carrot_favorites').select('product_id').eq('user_id', user.id),
  ]);

  const favIds = (favRows || []).map((r) => r.product_id);
  const { data: favs = [] } = favIds.length
    ? await supabase
        .from('carrot_products')
        .select('id, title, price, status, region, images, created_at')
        .in('id', favIds)
        .order('created_at', { ascending: false })
    : { data: [] };

  return (
    <MePageClient
      profile={profile}
      mineCount={mine?.length || 0}
      favCount={favs?.length || 0}
      mine={mine || []}
      favs={favs || []}
      tab={tab}
    />
  );
}
