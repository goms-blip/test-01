'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function signUp(formData) {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const nickname = String(formData.get('nickname') || '').trim() || email.split('@')[0];
  const region = String(formData.get('region') || '').trim();

  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nickname, region } },
  });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function signIn(formData) {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  redirect('/');
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

export async function updateRegion(formData) {
  const region = String(formData.get('region') || '').trim();
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: '로그인 필요' };
  const { error } = await supabase
    .from('carrot_profiles')
    .update({ region })
    .eq('id', user.id);
  if (error) return { error: error.message };
  revalidatePath('/', 'layout');
  return { ok: true };
}
