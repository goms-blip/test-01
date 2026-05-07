export const fmtPrice = (n) => (Number(n) || 0).toLocaleString('ko-KR') + '원';

export function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
  return d.toLocaleDateString('ko-KR');
}

export const statusLabel = (s) =>
  ({ on_sale: '판매중', reserved: '예약중', sold: '거래완료' }[s] || s);

export const CATEGORIES = [
  '디지털기기', '생활가전', '가구/인테리어', '의류',
  '도서', '뷰티/미용', '스포츠/레저', '기타',
];

export function regionToken(region) {
  if (!region) return '';
  const tokens = region.split(/\s+/).filter(Boolean);
  return tokens[tokens.length - 1] || region;
}
