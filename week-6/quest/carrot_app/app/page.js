import HomeClient from './HomeClient';
import { createClient } from '@/lib/supabase/server';
import { regionToken } from '@/lib/format';

export default async function HomePage({ searchParams }) {
  const sp = searchParams || {};
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  let me = null;
  if (user) {
    const { data } = await supabase
      .from('carrot_profiles')
      .select('id, nickname, region')
      .eq('id', user.id)
      .maybeSingle();
    me = data;
  }

  const scope = sp.scope || (me?.region ? 'mine' : 'all');
  const cat = sp.c || '전체';
  const q = (sp.q || '').trim();

  let query = supabase
    .from('carrot_products')
    .select('id, seller_id, title, price, description, category, status, region, images, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (cat !== '전체') query = query.eq('category', cat);
  if (scope === 'mine' && me?.region) {
    query = query.ilike('region', `%${regionToken(me.region)}%`);
  }
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);

  const { data: items } = await query;

  return <HomeClient initialItems={items || []} me={me} initialScope={scope} initialCat={cat} initialQ={q} />;
}
