// ============================================================
//  data.js — 오프라인 데모용 시드 (seed.sql과 1:1 대응)
//  Supabase 연결이 없어도 같은 데이터로 동작하도록 미러링
// ============================================================
window.TRAVEL_SEED = [
  // ── T01 · 2022-06 베트남 다낭 ──────────────
  { id: 1,  created_at:'2022-06-15', category:'여행지', content:'베트남 다낭 (도착)',                  value: 5.0, location:'베트남 다낭',  trip_id:'T01' },
  { id: 2,  created_at:'2022-06-15', category:'음식',   content:'반쎄오 + 분짜 (현지식당)',            value: 6.5, location:'베트남 다낭',  trip_id:'T01' },
  { id: 3,  created_at:'2022-06-16', category:'활동',   content:'미케 비치 일광욕 — 너무 더워서 1시간 만에 철수', value: 3.5, location:'베트남 다낭', trip_id:'T01' },
  { id: 4,  created_at:'2022-06-17', category:'활동',   content:'바나힐 케이블카',                      value: 5.0, location:'베트남 다낭',  trip_id:'T01' },
  { id: 5,  created_at:'2022-06-17', category:'음식',   content:'쌀국수 (호아) — 무난',                value: 6.0, location:'베트남 다낭',  trip_id:'T01' },
  { id: 6,  created_at:'2022-06-18', category:'쉼',     content:'4성 풀빌라 — 에어컨 의존',            value: 6.0, location:'베트남 다낭',  trip_id:'T01' },
  { id: 7,  created_at:'2022-06-19', category:'여행지', content:'다낭 (출국, 전반적으로 후회)',         value: 4.0, location:'베트남 다낭',  trip_id:'T01' },

  // ── T02 · 2022-12 홋카이도 삿포로/오타루 ── 인생 여행 ──
  { id: 8,  created_at:'2022-12-05', category:'여행지', content:'홋카이도 삿포로 (도착, 첫눈)',          value: 9.5, location:'홋카이도',     trip_id:'T02' },
  { id: 9,  created_at:'2022-12-05', category:'음식',   content:'미소라멘 (스미레 본점)',              value: 9.5, location:'홋카이도',     trip_id:'T02' },
  { id:10,  created_at:'2022-12-06', category:'활동',   content:'삿포로 눈축제 — 인생 한 컷',          value: 9.8, location:'홋카이도',     trip_id:'T02' },
  { id:11,  created_at:'2022-12-07', category:'활동',   content:'오타루 운하 야경 — 눈+가스등',         value: 9.7, location:'홋카이도',     trip_id:'T02' },
  { id:12,  created_at:'2022-12-07', category:'음식',   content:'오타루 스시 (마사스시)',              value: 9.3, location:'홋카이도',     trip_id:'T02' },
  { id:13,  created_at:'2022-12-08', category:'음식',   content:'징기스칸 (다루마)',                    value: 9.0, location:'홋카이도',     trip_id:'T02' },
  { id:14,  created_at:'2022-12-08', category:'쉼',     content:'오타루 료칸 노천탕',                  value: 9.6, location:'홋카이도',     trip_id:'T02' },
  { id:15,  created_at:'2022-12-09', category:'활동',   content:'마루젠 서점 + 동네 카페 산책',        value: 8.8, location:'홋카이도',     trip_id:'T02' },
  { id:16,  created_at:'2022-12-10', category:'여행지', content:'삿포로 (출국, 다음에 또)',            value: 9.4, location:'홋카이도',     trip_id:'T02' },

  // ── T03 · 2023-08 강원도 평창 ── 더위 피난 ──
  { id:17,  created_at:'2023-08-10', category:'여행지', content:'강원도 평창 (도착)',                   value: 7.0, location:'강원도 평창',  trip_id:'T03' },
  { id:18,  created_at:'2023-08-10', category:'쉼',     content:'대관령 펜션 — 시원함',                value: 7.8, location:'강원도 평창',  trip_id:'T03' },
  { id:19,  created_at:'2023-08-11', category:'활동',   content:'대관령 양떼목장 산책',                value: 7.0, location:'강원도 평창',  trip_id:'T03' },
  { id:20,  created_at:'2023-08-12', category:'음식',   content:'초당순두부',                          value: 7.2, location:'강원도 평창',  trip_id:'T03' },
  { id:21,  created_at:'2023-08-12', category:'활동',   content:'오대산 트레킹',                        value: 7.5, location:'강원도 평창',  trip_id:'T03' },
  { id:22,  created_at:'2023-08-13', category:'여행지', content:'평창 (귀가)',                          value: 6.8, location:'강원도 평창',  trip_id:'T03' },

  // ── T04 · 2023-12 홋카이도 노보리베츠 ── 료칸 위주 ──
  { id:23,  created_at:'2023-12-20', category:'여행지', content:'홋카이도 노보리베츠 (도착)',           value: 9.4, location:'홋카이도',     trip_id:'T04' },
  { id:24,  created_at:'2023-12-20', category:'쉼',     content:'다이이치 다키모토칸 료칸 (1박)',       value: 9.8, location:'홋카이도',     trip_id:'T04' },
  { id:25,  created_at:'2023-12-21', category:'활동',   content:'지옥계곡 눈길 산책',                  value: 9.2, location:'홋카이도',     trip_id:'T04' },
  { id:26,  created_at:'2023-12-22', category:'음식',   content:'홋카이도식 가이세키',                  value: 9.5, location:'홋카이도',     trip_id:'T04' },
  { id:27,  created_at:'2023-12-23', category:'활동',   content:'삿포로 라멘 요코초 — 라멘 4그릇',      value: 9.4, location:'홋카이도',     trip_id:'T04' },
  { id:28,  created_at:'2023-12-23', category:'음식',   content:'수프카레 (가라쿠)',                    value: 9.0, location:'홋카이도',     trip_id:'T04' },
  { id:29,  created_at:'2023-12-24', category:'여행지', content:'삿포로 (귀국, 또 가야지)',            value: 9.5, location:'홋카이도',     trip_id:'T04' },

  // ── T05 · 2024-04 도쿄 + 닛코 ── 봄눈 ──
  { id:30,  created_at:'2024-04-05', category:'여행지', content:'도쿄 (도착)',                          value: 8.0, location:'도쿄',         trip_id:'T05' },
  { id:31,  created_at:'2024-04-06', category:'활동',   content:'시모키타자와 동네 산책 + 헌책방',      value: 8.5, location:'도쿄',         trip_id:'T05' },
  { id:32,  created_at:'2024-04-06', category:'음식',   content:'이에케이 라멘',                        value: 8.2, location:'도쿄',         trip_id:'T05' },
  { id:33,  created_at:'2024-04-07', category:'여행지', content:'닛코 당일치기 — 늦은 봄눈',            value: 9.1, location:'닛코',         trip_id:'T05' },
  { id:34,  created_at:'2024-04-07', category:'활동',   content:'도쇼구 + 게곤폭포 (인파 적음)',        value: 8.9, location:'닛코',         trip_id:'T05' },
  { id:35,  created_at:'2024-04-08', category:'쉼',     content:'닛코 료칸 1박',                        value: 9.0, location:'닛코',         trip_id:'T05' },
  { id:36,  created_at:'2024-04-09', category:'음식',   content:'우에노 스시',                          value: 8.0, location:'도쿄',         trip_id:'T05' },
  { id:37,  created_at:'2024-04-10', category:'여행지', content:'도쿄 (귀국)',                          value: 8.1, location:'도쿄',         trip_id:'T05' },

  // ── T06 · 2024-11 교토 ── 단풍 ──
  { id:38,  created_at:'2024-11-15', category:'여행지', content:'교토 (도착)',                          value: 8.3, location:'교토',         trip_id:'T06' },
  { id:39,  created_at:'2024-11-15', category:'음식',   content:'니신소바 (마츠바)',                    value: 8.0, location:'교토',         trip_id:'T06' },
  { id:40,  created_at:'2024-11-16', category:'활동',   content:'동복사(東福寺) 단풍 — 인파 많음 ❌',    value: 7.0, location:'교토',         trip_id:'T06' },
  { id:41,  created_at:'2024-11-17', category:'활동',   content:'오하라 산조인 단풍 — 조용함 ⭕',        value: 9.0, location:'교토',         trip_id:'T06' },
  { id:42,  created_at:'2024-11-17', category:'음식',   content:'두부 가이세키',                        value: 8.5, location:'교토',         trip_id:'T06' },
  { id:43,  created_at:'2024-11-18', category:'쉼',     content:'아라시야마 료칸',                      value: 8.7, location:'교토',         trip_id:'T06' },
  { id:44,  created_at:'2024-11-19', category:'여행지', content:'교토 (귀국)',                          value: 8.4, location:'교토',         trip_id:'T06' },

  // ── T07 · 2025-02 홋카이도 후라노 스키 ──
  { id:45,  created_at:'2025-02-10', category:'여행지', content:'홋카이도 후라노 (도착)',                value: 9.6, location:'홋카이도',     trip_id:'T07' },
  { id:46,  created_at:'2025-02-11', category:'활동',   content:'후라노 스키장 — 파우더 스노우',         value: 9.7, location:'홋카이도',     trip_id:'T07' },
  { id:47,  created_at:'2025-02-12', category:'활동',   content:'비에이 청의 호수 (눈 덮인 풍경)',       value: 9.5, location:'홋카이도',     trip_id:'T07' },
  { id:48,  created_at:'2025-02-12', category:'음식',   content:'후라노 카레',                           value: 8.9, location:'홋카이도',     trip_id:'T07' },
  { id:49,  created_at:'2025-02-13', category:'쉼',     content:'후라노 료칸 노천탕 (설경)',             value: 9.8, location:'홋카이도',     trip_id:'T07' },
  { id:50,  created_at:'2025-02-14', category:'음식',   content:'삿포로 미소라멘 (재방문)',              value: 9.3, location:'홋카이도',     trip_id:'T07' },
  { id:51,  created_at:'2025-02-15', category:'여행지', content:'삿포로 (귀국)',                         value: 9.5, location:'홋카이도',     trip_id:'T07' },

  // ── T08 · 2025-10 오사카 ── 인파에 시달림 ──
  { id:52,  created_at:'2025-10-08', category:'여행지', content:'오사카 (도착)',                         value: 7.5, location:'오사카',       trip_id:'T08' },
  { id:53,  created_at:'2025-10-08', category:'음식',   content:'쿠시카츠 다루마',                       value: 8.0, location:'오사카',       trip_id:'T08' },
  { id:54,  created_at:'2025-10-09', category:'활동',   content:'도톤보리 인파 ❌ — 1시간 만에 철수',     value: 5.5, location:'오사카',       trip_id:'T08' },
  { id:55,  created_at:'2025-10-09', category:'음식',   content:'타코야키',                              value: 7.0, location:'오사카',       trip_id:'T08' },
  { id:56,  created_at:'2025-10-10', category:'활동',   content:'나카자키초 골목 카페 ⭕',                value: 8.5, location:'오사카',       trip_id:'T08' },
  { id:57,  created_at:'2025-10-10', category:'쉼',     content:'시내 비즈니스호텔 (그냥저냥)',          value: 6.5, location:'오사카',       trip_id:'T08' },
  { id:58,  created_at:'2025-10-11', category:'여행지', content:'오사카 (귀국)',                         value: 7.0, location:'오사카',       trip_id:'T08' },

  // ── T09 · 2026-03 후쿠오카 ── 벚꽃 ──
  { id:59,  created_at:'2026-03-25', category:'여행지', content:'후쿠오카 (도착)',                       value: 8.0, location:'후쿠오카',     trip_id:'T09' },
  { id:60,  created_at:'2026-03-25', category:'음식',   content:'하카타 토츠코츠 라멘',                  value: 8.4, location:'후쿠오카',     trip_id:'T09' },
  { id:61,  created_at:'2026-03-26', category:'활동',   content:'마이즈루공원 벚꽃',                     value: 8.7, location:'후쿠오카',     trip_id:'T09' },
  { id:62,  created_at:'2026-03-27', category:'활동',   content:'다자이후 텐만구 — 인파 다소 많음',       value: 7.2, location:'후쿠오카',     trip_id:'T09' },
  { id:63,  created_at:'2026-03-28', category:'음식',   content:'모츠나베',                              value: 8.0, location:'후쿠오카',     trip_id:'T09' },
  { id:64,  created_at:'2026-03-28', category:'쉼',     content:'시내 호텔',                             value: 7.5, location:'후쿠오카',     trip_id:'T09' },
  { id:65,  created_at:'2026-03-29', category:'여행지', content:'후쿠오카 (귀국)',                       value: 7.9, location:'후쿠오카',     trip_id:'T09' },
];

// 컨텍스트(.md)에서 추출된 사용자 프로필 — agent.js가 참조
window.USER_CONTEXT = {
  enabled: true,                 // UI 토글로 ON/OFF
  basics: {
    age_band: '30대 후반',
    job: 'IT PM',
    base_city: '서울 마포구',
  },
  loves: ['눈','겨울','일본','홋카이도','료칸 온천','라멘','조용한 골목','로컬 식당'],
  hates: ['더운 동남아','우기','인파 많은 명소','장거리 비행'],
  constraints: [
    { key: 'no_hot_southeast', label: '더운 동남아 시즌(6~9월) 회피' },
    { key: 'flight_max_6h',    label: '비행시간 6시간 초과 여행 X (미주/유럽/호주 자동 제외)' },
    { key: 'no_revisit_3y',    label: '같은 도시 3년 안 재방문 X (단 홋카이도는 예외)' },
    { key: 'no_crowds',        label: '극단적 인파 명소 회피' },
  ],
  routine: '매년 12~2월 일본 겨울 여행 1회 + 봄·가을 국내 단기 여행',
};
