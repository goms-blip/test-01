// Browser-side Supabase client (anon key only — RLS does the protection).
// Loaded as a classic <script> after the supabase-js UMD bundle.
// Future admin module can reuse window.supabaseClient for read paths;
// admin writes must go through a server-side proxy using SUPABASE_SERVICE_ROLE_KEY.
(function () {
  // Anon key is designed to be public. Keep service_role OUT of browser code.
  const SUPABASE_URL = 'https://hrhtvatwbhrkyamybvbc.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyaHR2YXR3Ymhya3lhbXlidmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTA5NDUsImV4cCI6MjA5NDE2Njk0NX0.Wwbof5Zy5wahnht8bYL2lyV5LHo9rlj1-HT-ZVuWqUs';

  if (!window.supabase || !window.supabase.createClient) {
    console.error('[supabase-client] supabase-js UMD must be loaded before this script');
    return;
  }

  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  // Reusable data accessors — the admin module can call the same names.
  window.bakingDictApi = {
    async fetchIngredients() {
      const { data, error } = await window.supabaseClient
        .from('ingredients')
        .select('slug,name_ko,name_en,name_zh,category,summary,emoji,image_url,role,similar_ingredients,common_mistakes,substitutes,storage,where_to_buy,sort_order')
        .eq('is_visible', true)
        .order('sort_order', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },

    // Realtime: notify on any INSERT/UPDATE/DELETE in public.ingredients.
    // Returns the channel — call `channel.unsubscribe()` to stop.
    subscribeIngredients(onChange) {
      const channel = window.supabaseClient
        .channel('ingredients-public')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ingredients' },
          (payload) => { try { onChange && onChange(payload); } catch (e) { console.error('[realtime] handler error', e); } },
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('[realtime] subscription status:', status);
          }
        });
      return channel;
    },
  };
})();
