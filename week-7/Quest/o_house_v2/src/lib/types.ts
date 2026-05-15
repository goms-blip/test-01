export type Profile = {
  id: string;
  nickname: string | null;
  home_type: string | null;
  area_pyeong: number | null;
  region: string | null;
  avatar_url: string | null;
  role?: 'user' | 'admin' | null;
};

export type Photo = {
  id: string;
  author_id: string;
  title: string;
  description: string | null;
  space: string | null;
  style: string | null;
  area_pyeong: number | null;
  image_urls: string[];
  scrap_count: number;
  created_at: string;
  author?: Profile;
};

export type Product = {
  id: string;
  seller_id: string;
  name: string;
  price: number;
  category: string | null;
  description: string | null;
  image_urls: string[];
  created_at: string;
  seller?: Profile;
};

export type Order = {
  id: string;
  user_id: string;
  order_no: string;
  payment_key: string | null;
  total_price: number;
  status: 'pending' | 'paid' | 'failed' | 'canceled';
  paid_at: string | null;
  created_at: string;
  items?: OrderItem[];
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  product?: Product;
};

export const SPACES = ['거실','침실','주방','욕실','현관','베란다','서재','아이방','드레스룸','기타'];
export const STYLES = ['모던','내추럴','북유럽','빈티지','미니멀','클래식','인더스트리얼','한국적'];
export const HOME_TYPES = ['원룸','투룸','쓰리룸이상','아파트','주택','오피스텔','기타'];
export const CATEGORIES = ['가구','조명','패브릭','주방','욕실','데코','가전','식물','유아용품','셀프인테리어','반려동물','기타'];

export const fmtPrice = (n: number | null | undefined) => (n ?? 0).toLocaleString('ko-KR') + '원';
