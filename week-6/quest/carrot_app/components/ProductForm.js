'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CATEGORIES } from '@/lib/format';

export default function ProductForm({ mode, initial, profile }) {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState(
    initial || {
      title: '',
      price: '',
      description: '',
      category: CATEGORIES[0],
      images: [],
    },
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [pending, start] = useTransition();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onPickFiles = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 3 - (form.images || []).length);
    if (!files.length) return;
    setBusy(true); setErr('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('로그인 필요');
      const newUrls = [];
      for (const file of files) {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage
          .from('carrot-products')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        const { data: pub } = supabase.storage.from('carrot-products').getPublicUrl(path);
        newUrls.push(pub.publicUrl);
      }
      setForm({ ...form, images: [...(form.images || []), ...newUrls].slice(0, 3) });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const removeImg = (i) => setForm({ ...form, images: form.images.filter((_, idx) => idx !== i) });

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!form.title.trim() || form.price === '') return setErr('제목과 가격은 필수입니다.');
    start(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('로그인 필요');
        const payload = {
          title: form.title.trim(),
          price: Number(form.price) || 0,
          description: form.description || '',
          category: form.category,
          images: form.images || [],
        };
        if (mode === 'create') {
          const { data, error } = await supabase
            .from('carrot_products')
            .insert({ ...payload, seller_id: user.id, region: profile?.region || '' })
            .select('id')
            .single();
          if (error) throw error;
          router.push(`/product/${data.id}`);
        } else {
          const { error } = await supabase
            .from('carrot_products')
            .update(payload)
            .eq('id', initial.id);
          if (error) throw error;
          router.push(`/product/${initial.id}`);
          router.refresh();
        }
      } catch (e) { setErr(e.message); }
    });
  };

  const inputCls = 'w-full border border-[color:var(--line)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[color:var(--carrot)] bg-white';

  return (
    <div className="card p-5 mt-3">
      <h1 className="text-xl font-extrabold mb-1">{mode === 'create' ? '내 물건 팔기' : '상품 수정'}</h1>
      <p className="text-sm text-gray-500 mb-5">사진과 정보를 정확히 적을수록 빠르게 팔려요</p>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          {(form.images?.length || 0) < 3 && (
            <label className="w-[88px] h-[88px] rounded-2xl border-2 border-dashed border-gray-300 hover:border-[color:var(--carrot)] flex flex-col items-center justify-center text-xs text-gray-400 cursor-pointer pressable bg-gray-50">
              <span className="text-2xl">📷</span>
              <span className="mt-1 font-semibold">{(form.images?.length || 0)}<span className="text-gray-300">/3</span></span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={onPickFiles} disabled={busy} />
            </label>
          )}
          {(form.images || []).map((src, i) => (
            <div key={i} className="relative w-[88px] h-[88px] rounded-2xl overflow-hidden border border-[color:var(--line)]">
              <img src={src} className="w-full h-full object-cover" alt="" />
              {i === 0 && <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] text-center py-0.5">대표</div>}
              <button type="button" onClick={() => removeImg(i)} className="absolute -top-1 -right-1 bg-gray-700 text-white text-xs w-5 h-5 rounded-full">×</button>
            </div>
          ))}
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500">제목</label>
          <input className={inputCls + ' mt-1'} placeholder="제목" value={form.title} onChange={set('title')} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500">카테고리</label>
          <select className={inputCls + ' mt-1'} value={form.category} onChange={set('category')}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500">가격</label>
          <div className="relative mt-1">
            <input className={inputCls + ' pl-9'} placeholder="0" type="number" value={form.price} onChange={set('price')} />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">₩</span>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500">상품 설명</label>
          <textarea className={inputCls + ' mt-1 min-h-[160px]'} placeholder="상품 상태, 거래 방식 등을 자세히 적어주세요." value={form.description} onChange={set('description')} />
        </div>
        {err && <div className="text-sm text-red-500 px-1">{err}</div>}
        <button disabled={busy || pending} className="w-full btn-carrot rounded-xl py-3 font-semibold disabled:opacity-60">
          {busy ? '업로드 중…' : pending ? '저장 중…' : (mode === 'create' ? '등록 완료' : '수정 완료')}
        </button>
      </form>
    </div>
  );
}
