# 🥕 carrot_app — Work Log

## 최종 스택 (PRD §4 준수)
- **Framework**: Next.js 14.2.35 (App Router) + React 18 + Tailwind CSS
- **Backend/Infra**: Supabase
  - Auth (Email/Password)
  - Database (Postgres + RLS)
  - Storage (`carrot-products` 버킷)
  - Realtime (chat_messages postgres_changes 구독)
- **Deployment**: Vercel — https://carrot-market-clone-five.vercel.app

## 폴더 구조
```
carrot_app/
├─ app/
│  ├─ layout.js, globals.css, page.js, HomeClient.js
│  ├─ login/page.js, signup/page.js
│  ├─ auth/actions.js          # Server Actions
│  ├─ post/page.js              # 등록 (auth 보호)
│  ├─ edit/[id]/page.js         # 수정 (작성자 검증)
│  ├─ product/[id]/{page,ProductDetailClient}.js
│  ├─ chats/page.js             # 채팅 목록
│  ├─ chat/[id]/{page,ChatRoomClient}.js  # Realtime 채팅방
│  └─ me/{page,MePageClient}.js
├─ components/  TopBar, BottomNav, ProductRow, ProductForm, EmptyState
├─ lib/
│  ├─ supabase/  client.js / server.js / middleware.js
│  └─ format.js
├─ middleware.js                # 모든 경로에서 세션 갱신
├─ supabase/schema.sql          # 적용 완료
├─ legacy/                      # 이전 Express + SPA (보존용)
└─ work_log.md
```

## DB 스키마 (모두 `carrot_` 접두사 — 기존 goms_projects 테이블과 충돌 회피)
| 테이블 | 핵심 컬럼 | RLS 핵심 정책 |
| --- | --- | --- |
| `carrot_profiles` | id (FK auth.users), nickname, region, email | 누구나 read · 본인만 update |
| `carrot_products` | seller_id, title, price, category, status, region, images[] | 누구나 read · 작성자만 insert/update/delete |
| `carrot_favorites` | (user_id, product_id) PK | 본인만 read/insert/delete |
| `carrot_chat_rooms` | product_id, buyer_id, seller_id (UNIQUE on product+buyer) | buyer/seller만 read · buyer가 insert |
| `carrot_chat_messages` | room_id, sender_id, text | 방 멤버만 read/insert |

부가:
- `auth.users` insert 트리거 → `carrot_profiles` 자동 생성
- `supabase_realtime` publication에 `carrot_chat_messages` 추가 → 클라이언트 구독 가능
- Storage 버킷 `carrot-products` (public read, 본인 폴더에만 insert)

## PRD 매핑
| PRD 항목 | 구현 |
| --- | --- |
| 회원가입/로그인 (이메일) | Supabase Auth + Server Actions |
| 동네 설정 (직접/위치인증) | signup 폼 + `navigator.geolocation` + 마이페이지 변경 |
| 상품 등록 (이미지 ≤ 3) | Supabase Storage 업로드 + `carrot_products.insert` |
| 본인만 수정·삭제 | RLS `seller_id = auth.uid()` |
| 최신순 + 카테고리·검색 | `order created_at desc` + `eq category` + `or(title/description ilike)` |
| 위치 기반 (동네 필터) | `ilike region` (홈 기본 = 내 동네 토큰) |
| 상세: 이미지 슬라이드, 판매자, 관심 | DetailClient + 💖 토글 + favorites 테이블 |
| 1:1 채팅 | rooms upsert + 멤버 검증 |
| 실시간 | Supabase Realtime channel (postgres_changes INSERT) |
| 마이페이지 | 프로필 + 동네 변경 + 내 상품/관심 탭 |

## 검증 (smoke)
| 경로 | 결과 |
| --- | --- |
| `/` `/login` `/signup` | 200 |
| `/post` `/me` `/chats` | 비로그인 시 307 → `/login` |
| `/product/{없는 id}` | 404 |
| GET / 응답시간 | 0.2초 (Data API 토글 ON 후) |

dev 서버 백그라운드 기동 중 → http://localhost:3030

## 작업 중 마주친 이슈 + 해결 (실제 빠진 곳들)

| 증상 | 진짜 원인 | 해결 |
| --- | --- | --- |
| 처음에 Express+SPA 만들었던 일 | PRD §4 무시한 우회 결정 (Supabase 키가 없는 줄 알았음) | Next.js + Supabase로 재작성 |
| Auth 탭에 5/1 가입자가 보임 | `auth.users`는 프로젝트 단위 공유. 접두사로도 못 가림 | 별도 Supabase 프로젝트로 이주 (goms2_project) |
| "Email not confirmed" | 새 프로젝트 기본 = email 인증 ON | `auth.users` BEFORE INSERT 트리거로 `email_confirmed_at` 자동 채움 |
| 로그인 후 layout이 user 못 잡음 | 캐시/`dynamic = 'force-dynamic'` 충돌 (내가 박은 자충수) | 그 라인 제거 + revalidatePath only |
| GET / 응답이 6초 | **PostgREST 503 — Data API 토글 OFF** | Project Settings → Integrations → Data API → Enable Data API ON |

## 배포 ✅
- **URL**: https://carrot-market-clone-five.vercel.app
- Vercel project: `384s-projects/carrot-market-clone`
- 환경변수 등록 완료 (production / development): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_OPENWEATHER_API_KEY`

## 라이브 검증 ✅
- 회원가입 → 자동 로그인 (auto_confirm 트리거)
- 위치 인증 (OpenWeatherMap reverse geocoding)
- 상품 등록 + 사진 업로드 (Storage)
- 1:1 채팅 + Realtime 메시지 송수신 (다른 브라우저 시연 완료)

## 보안 점검 ✅ (시연/제출 등급)
| 영역 | 결과 |
| --- | --- |
| RLS | 5/5 테이블 모두 활성, 정책 14개 |
| Storage | public read + 본인 폴더만 insert + owner delete |
| service_role 키 클라이언트 노출 | 없음 |
| eval / dangerouslySetInnerHTML | 없음 |
| anon GRANT 35건 | Supabase 기본값 (RLS가 실제 보호) |

## 운영 전환 시 정리 (현재는 시연 편의 위해 둠)
1. **auto_confirm 트리거 제거** — 누구나 가입 즉시 인증되는 상태 해제
   ```sql
   drop trigger if exists carrot_auto_confirm on auth.users;
   drop function if exists public.auto_confirm_carrot_user();
   ```
   그 후 Authentication → Sign In / Providers → Email → "Confirm email" ON + SMTP 설정.

2. **Auth Site URL 등록**: Authentication → URL Configuration
   - Site URL: `https://carrot-market-clone-five.vercel.app`
   - Additional Redirect URLs: `https://carrot-market-clone-five.vercel.app/**`

## PRD §7 최종 제출물 Checklist
- [x] Vercel 배포 URL — https://carrot-market-clone-five.vercel.app
- [x] GitHub 레포지토리 — (이 커밋)
- [ ] 시연 영상 (1분 이내)
- [x] 타인 가입 + 채팅 테스트 (브라우저 두 창에서 검증 완료)
