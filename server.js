// ============================================================
// 실시간 행사 Q&A 솔루션 — 관리자 백엔드 (server.js)
// -----------------------------------------------------------------------
//  - 사용자(공개) 경로는 index.html 이 Supabase anon 으로 직접 처리(미변경).
//  - 관리자 경로(프로젝트/세션 CRUD, 답변/숨김 토글, 숨김질문 열람, 엑셀)는
//    이 서버가 service_role 키로 RLS 를 우회해서 처리한다.
//  - DB 컬럼명과 앱(프론트) 객체 필드명이 다르므로, 서버가 "앱 객체 형태"로
//    변환해서 응답한다(프론트 컴포넌트 수정 최소화).
//      projects:  title→name, client_name→client
//      sessions:  title→name, starts_at/ends_at→duration ('HH:MM ~ HH:MM')
//      questions: content→body, like_count→likes
//  - 인증: ADMIN_CONSOLE_TOKEN(운영자 콘솔) + 세션별 admin_token(연사 대시보드)
// ============================================================

require('dotenv').config({ path: require('path').join(__dirname, '.env.local') });

const express = require('express');
const path = require('path');
const ExcelJS = require('exceljs');
const { createClient } = require('@supabase/supabase-js');

// ---------- 환경변수 (.trim() 으로 trailing newline 방지) ----------
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const ADMIN_CONSOLE_TOKEN = (process.env.ADMIN_CONSOLE_TOKEN || '').trim();
const PORT = parseInt((process.env.PORT || '8787').trim(), 10) || 8787;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[server] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 필요합니다.');
}
if (!ADMIN_CONSOLE_TOKEN) {
  console.error('[server] ADMIN_CONSOLE_TOKEN 이 .env.local 에 필요합니다.');
}

// ---------- Supabase service_role 클라이언트 (RLS 우회) ----------
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const app = express();
app.use(express.json());

// 같은 오리진에서 프론트(index.html)와 API 를 함께 제공 → CORS 불필요
// ⚠️ 보안: 디렉토리 전체 정적 서빙 금지(.env.local/*.sql 등 노출 방지).
//    index.html 은 아래 비-API catch-all 라우트에서만 내보낸다.

// ============================================================
// 🗺️ DB(row) ↔ 앱(object) 변환 헬퍼
// ============================================================
const pad2 = (n) => String(n).padStart(2, '0');

// timestamptz → 'HH:MM' (Asia/Seoul 기준 표시)
const fmtTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  // 한국 시간대로 표시 (DB 에 +09 로 저장됨)
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul',
  }).formatToParts(d);
  const h = parts.find((p) => p.type === 'hour')?.value || '00';
  const m = parts.find((p) => p.type === 'minute')?.value || '00';
  return `${h}:${m}`;
};

const buildDuration = (startsAt, endsAt) => {
  const s = fmtTime(startsAt);
  const e = fmtTime(endsAt);
  if (s && e) return `${s} ~ ${e}`;
  return s || e || '';
};

// 'HH:MM ~ HH:MM' (또는 단일 'HH:MM') → { starts_at, ends_at } (timestamptz, KST 기준)
// duration 문자열은 날짜 정보가 없으므로 '오늘(KST)' 날짜에 시간을 붙여 저장한다.
// 표시는 다시 buildDuration 으로 HH:MM 만 뽑으므로 날짜 부분은 표기에 영향 없음.
const parseDuration = (duration) => {
  const result = { starts_at: null, ends_at: null };
  if (!duration || typeof duration !== 'string') return result;
  const today = new Date();
  const y = today.getFullYear();
  const mo = pad2(today.getMonth() + 1);
  const da = pad2(today.getDate());
  const toIso = (hhmm) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
    if (!m) return null;
    const hh = pad2(parseInt(m[1], 10));
    const mm = pad2(parseInt(m[2], 10));
    // +09:00 (KST) 로 명시 저장
    return `${y}-${mo}-${da}T${hh}:${mm}:00+09:00`;
  };
  const parts = duration.split('~');
  if (parts.length >= 2) {
    result.starts_at = toIso(parts[0]);
    result.ends_at = toIso(parts[1]);
  } else {
    result.starts_at = toIso(parts[0]);
  }
  return result;
};

const mapProjectRow = (row) => row ? ({
  id: row.id,
  name: row.title,                          // title(DB) → name(앱)
  client: row.client_name || '',            // client_name(DB) → client(앱)
  description: row.description || '',
  start_date: row.start_date || '',
  end_date: row.end_date || '',
  status: row.status || '준비중',
  created_at: row.created_at,
}) : null;

const mapSessionRow = (row) => row ? ({
  id: row.id,
  project_id: row.project_id,
  name: row.title,                          // title(DB) → name(앱)
  description: row.description || '',
  duration: buildDuration(row.starts_at, row.ends_at),
  is_public: !!row.is_public,
  admin_token: row.admin_token,
  created_at: row.created_at,
}) : null;

const mapQuestionRow = (row) => row ? ({
  id: row.id,
  session_id: row.session_id,
  author: row.author,
  title: row.title,
  body: row.content,                        // content(DB) → body(앱)
  likes: row.like_count,                    // like_count(DB) → likes(앱)
  is_answered: !!row.is_answered,
  is_hidden: !!row.is_hidden,
  created_at: row.created_at,
}) : null;

// ============================================================
// 🔐 인증 헬퍼 & 미들웨어
// ============================================================
// 요청에서 토큰 추출: x-admin-token 헤더 또는 ?token= 쿼리
const extractToken = (req) =>
  (req.get('x-admin-token') || req.query.token || '').toString().trim();

// 운영자 콘솔 토큰 검증 (프로젝트/세션 관리 등 콘솔 작업)
const requireConsole = (req, res, next) => {
  const token = extractToken(req);
  if (!token || token !== ADMIN_CONSOLE_TOKEN) {
    return res.status(401).json({ success: false, message: '운영자 콘솔 토큰이 필요합니다.' });
  }
  next();
};

// 세션 범위 권한 검증: 콘솔 토큰 OR 해당 세션의 admin_token
// sessionId 가 유효하지 않으면 404. 토큰 불일치면 403.
async function requireSessionAdmin(req, res, sessionId) {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ success: false, message: '토큰이 필요합니다.' });
    return false;
  }
  // 콘솔 토큰이면 무조건 통과
  if (token === ADMIN_CONSOLE_TOKEN) return true;

  const { data, error } = await supabase
    .from('sessions')
    .select('id, admin_token')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) {
    res.status(500).json({ success: false, message: 'DB 조회 중 오류가 발생했습니다.' });
    return false;
  }
  if (!data) {
    res.status(404).json({ success: false, message: '세션을 찾을 수 없습니다.' });
    return false;
  }
  if (data.admin_token !== token) {
    res.status(403).json({ success: false, message: '세션 접근 권한이 없습니다.' });
    return false;
  }
  return true;
}

// 라우트 핸들러를 try/catch 로 감싸는 래퍼
const wrap = (fn) => (req, res) => {
  Promise.resolve(fn(req, res)).catch((err) => {
    console.error('[server] route error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
  });
};

// 파일명 안전 처리 (공백/특수문자 → _)
const safeFileName = (s) =>
  (s || '').toString().trim().replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_') || 'untitled';

const yyyymmdd = () => {
  const d = new Date();
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
};

// ============================================================
// 📊 통계 헬퍼
// ============================================================
const computeSessionStats = (questions) => ({
  total: questions.length,
  pending: questions.filter((q) => !q.is_answered && !q.is_hidden).length,
  answered: questions.filter((q) => q.is_answered && !q.is_hidden).length,
  hidden: questions.filter((q) => q.is_hidden).length,
});

// ============================================================
// 🛣️ 라우트: 프로젝트 (콘솔)
// ============================================================

// GET /api/admin/projects — 목록 + 프로젝트별 sessionCount, questionCount, status
app.get('/api/admin/projects', requireConsole, wrap(async (req, res) => {
  const { data: projects, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const list = projects || [];

  // 세션/질문 카운트를 한 번에 조회
  const { data: sessions, error: sErr } = await supabase
    .from('sessions')
    .select('id, project_id');
  if (sErr) throw sErr;

  const { data: questions, error: qErr } = await supabase
    .from('questions')
    .select('id, session_id');
  if (qErr) throw qErr;

  // session_id → project_id 매핑
  const sessByProject = {};
  const projBySession = {};
  (sessions || []).forEach((s) => {
    sessByProject[s.project_id] = (sessByProject[s.project_id] || 0) + 1;
    projBySession[s.id] = s.project_id;
  });
  const questByProject = {};
  (questions || []).forEach((q) => {
    const pid = projBySession[q.session_id];
    if (pid) questByProject[pid] = (questByProject[pid] || 0) + 1;
  });

  const result = list.map((row) => ({
    ...mapProjectRow(row),
    sessionCount: sessByProject[row.id] || 0,
    questionCount: questByProject[row.id] || 0,
  }));

  res.json({ success: true, data: result });
}));

// POST /api/admin/projects — 생성
app.post('/api/admin/projects', requireConsole, wrap(async (req, res) => {
  const b = req.body || {};
  const name = (b.name || '').trim();
  if (!name) {
    return res.status(400).json({ success: false, message: '프로젝트명을 입력해 주세요.' });
  }
  const insert = {
    title: name,
    client_name: (b.client || '').trim() || null,
    description: (b.description || '').trim() || null,
    start_date: b.start_date || null,
    end_date: b.end_date || null,
    status: b.status || '준비중',
  };
  const { data, error } = await supabase
    .from('projects').insert(insert).select().single();
  if (error) throw error;
  res.status(201).json({ success: true, data: mapProjectRow(data) });
}));

// GET /api/admin/projects/:id
app.get('/api/admin/projects/:id', requireConsole, wrap(async (req, res) => {
  const { data, error } = await supabase
    .from('projects').select('*').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다.' });
  res.json({ success: true, data: mapProjectRow(data) });
}));

// PATCH /api/admin/projects/:id — 수정
app.patch('/api/admin/projects/:id', requireConsole, wrap(async (req, res) => {
  const b = req.body || {};
  const fields = {};
  if (b.name !== undefined) {
    const name = (b.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: '프로젝트명을 입력해 주세요.' });
    fields.title = name;
  }
  if (b.client !== undefined) fields.client_name = (b.client || '').trim() || null;
  if (b.description !== undefined) fields.description = (b.description || '').trim() || null;
  if (b.start_date !== undefined) fields.start_date = b.start_date || null;
  if (b.end_date !== undefined) fields.end_date = b.end_date || null;
  if (b.status !== undefined) fields.status = b.status || '준비중';

  const { data, error } = await supabase
    .from('projects').update(fields).eq('id', req.params.id).select().maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다.' });
  res.json({ success: true, data: mapProjectRow(data) });
}));

// DELETE /api/admin/projects/:id — 삭제 (FK on delete cascade 로 하위 정리)
app.delete('/api/admin/projects/:id', requireConsole, wrap(async (req, res) => {
  // 삭제 전 하위 카운트 집계 (응답 메시지용)
  const { data: sessions } = await supabase
    .from('sessions').select('id').eq('project_id', req.params.id);
  const sessionIds = (sessions || []).map((s) => s.id);
  let removedQuestions = 0;
  if (sessionIds.length) {
    const { count } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .in('session_id', sessionIds);
    removedQuestions = count || 0;
  }

  const { data, error } = await supabase
    .from('projects').delete().eq('id', req.params.id).select().maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다.' });

  res.json({
    success: true,
    data: { removedSessions: sessionIds.length, removedQuestions },
  });
}));

// ============================================================
// 🛣️ 라우트: 세션
// ============================================================

// GET /api/admin/projects/:projectId/sessions — 목록 + 세션별 통계 [콘솔]
app.get('/api/admin/projects/:projectId/sessions', requireConsole, wrap(async (req, res) => {
  const { projectId } = req.params;
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const list = sessions || [];
  const sessionIds = list.map((s) => s.id);

  let questions = [];
  if (sessionIds.length) {
    const { data: qs, error: qErr } = await supabase
      .from('questions')
      .select('id, session_id, is_answered, is_hidden')
      .in('session_id', sessionIds);
    if (qErr) throw qErr;
    questions = qs || [];
  }

  const bySession = {};
  questions.forEach((q) => {
    (bySession[q.session_id] = bySession[q.session_id] || []).push(q);
  });

  const result = list.map((row) => ({
    ...mapSessionRow(row),
    stats: computeSessionStats(bySession[row.id] || []),
  }));

  res.json({ success: true, data: result });
}));

// POST /api/admin/projects/:projectId/sessions — 생성 (admin_token 은 DB default) [콘솔]
app.post('/api/admin/projects/:projectId/sessions', requireConsole, wrap(async (req, res) => {
  const { projectId } = req.params;
  const b = req.body || {};
  const name = (b.name || '').trim();
  if (!name) return res.status(400).json({ success: false, message: '세션명을 입력해 주세요.' });

  // 프로젝트 존재 확인
  const { data: proj } = await supabase
    .from('projects').select('id').eq('id', projectId).maybeSingle();
  if (!proj) return res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다.' });

  const { starts_at, ends_at } = parseDuration(b.duration);
  const insert = {
    project_id: projectId,
    title: name,
    description: (b.description || '').trim() || null,
    starts_at,
    ends_at,
    is_public: b.is_public === undefined ? true : !!b.is_public,
    // admin_token 은 DB default(replace(gen_random_uuid()...)) 가 생성
  };
  const { data, error } = await supabase
    .from('sessions').insert(insert).select().single();
  if (error) throw error;
  res.status(201).json({ success: true, data: mapSessionRow(data) });
}));

// GET /api/admin/sessions/:sessionId — 세션 단건 조회 [세션admin]
//   공개/비공개 무관하게 service_role 로 조회 → 앱 객체 형태로 반환.
//   관리자 대시보드 메타(제목 등) 로드용. (anon RLS 우회)
app.get('/api/admin/sessions/:sessionId', wrap(async (req, res) => {
  const { sessionId } = req.params;
  const ok = await requireSessionAdmin(req, res, sessionId);
  if (!ok) return;

  const { data, error } = await supabase
    .from('sessions').select('*').eq('id', sessionId).maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ success: false, message: '세션을 찾을 수 없습니다.' });
  res.json({ success: true, data: mapSessionRow(data) });
}));

// PATCH /api/admin/sessions/:id — 수정 [세션admin]
app.patch('/api/admin/sessions/:id', wrap(async (req, res) => {
  const ok = await requireSessionAdmin(req, res, req.params.id);
  if (!ok) return;

  const b = req.body || {};
  const fields = {};
  if (b.name !== undefined) {
    const name = (b.name || '').trim();
    if (!name) return res.status(400).json({ success: false, message: '세션명을 입력해 주세요.' });
    fields.title = name;
  }
  if (b.description !== undefined) fields.description = (b.description || '').trim() || null;
  if (b.duration !== undefined) {
    const { starts_at, ends_at } = parseDuration(b.duration);
    fields.starts_at = starts_at;
    fields.ends_at = ends_at;
  }
  if (b.is_public !== undefined) fields.is_public = !!b.is_public;

  const { data, error } = await supabase
    .from('sessions').update(fields).eq('id', req.params.id).select().maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ success: false, message: '세션을 찾을 수 없습니다.' });
  res.json({ success: true, data: mapSessionRow(data) });
}));

// DELETE /api/admin/sessions/:id — 삭제 [콘솔]
app.delete('/api/admin/sessions/:id', requireConsole, wrap(async (req, res) => {
  const { count } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', req.params.id);

  const { data, error } = await supabase
    .from('sessions').delete().eq('id', req.params.id).select().maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ success: false, message: '세션을 찾을 수 없습니다.' });

  res.json({ success: true, data: { removedQuestions: count || 0 } });
}));

// ============================================================
// 🛣️ 라우트: 질문 (관리자, 숨김 포함)
// ============================================================

// GET /api/admin/sessions/:sessionId/questions — 세션 전체 질문(숨김 포함) [세션admin]
//   정렬: like_count desc, created_at asc
app.get('/api/admin/sessions/:sessionId/questions', wrap(async (req, res) => {
  const { sessionId } = req.params;
  const ok = await requireSessionAdmin(req, res, sessionId);
  if (!ok) return;

  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('session_id', sessionId)
    .order('like_count', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  res.json({ success: true, data: (data || []).map(mapQuestionRow) });
}));

// 질문 id 로 세션 id 조회 (세션admin 검증용 헬퍼)
async function getQuestionSessionId(questionId) {
  const { data, error } = await supabase
    .from('questions').select('session_id').eq('id', questionId).maybeSingle();
  if (error) throw error;
  return data ? data.session_id : null;
}

// POST /api/admin/questions/:id/answered — body { value: boolean } [세션admin]
app.post('/api/admin/questions/:id/answered', wrap(async (req, res) => {
  const sessionId = await getQuestionSessionId(req.params.id);
  if (!sessionId) return res.status(404).json({ success: false, message: '질문을 찾을 수 없습니다.' });
  const ok = await requireSessionAdmin(req, res, sessionId);
  if (!ok) return;

  const value = !!(req.body && req.body.value);
  const { data, error } = await supabase
    .from('questions').update({ is_answered: value }).eq('id', req.params.id).select().maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ success: false, message: '질문을 찾을 수 없습니다.' });
  res.json({ success: true, data: mapQuestionRow(data) });
}));

// POST /api/admin/questions/:id/hide — body { value: boolean } [세션admin]
app.post('/api/admin/questions/:id/hide', wrap(async (req, res) => {
  const sessionId = await getQuestionSessionId(req.params.id);
  if (!sessionId) return res.status(404).json({ success: false, message: '질문을 찾을 수 없습니다.' });
  const ok = await requireSessionAdmin(req, res, sessionId);
  if (!ok) return;

  const value = !!(req.body && req.body.value);
  const { data, error } = await supabase
    .from('questions').update({ is_hidden: value }).eq('id', req.params.id).select().maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ success: false, message: '질문을 찾을 수 없습니다.' });
  res.json({ success: true, data: mapQuestionRow(data) });
}));

// ============================================================
// 🛣️ 라우트: 금지어 관리 (콘솔)
// ------------------------------------------------------------
//  banned_words 테이블을 service_role 로 관리(RLS 우회).
//   - anon 은 select 만 가능(사용자 폼이 목록 가져와 사전 차단).
//   - 추가/삭제는 이 콘솔 라우트(requireConsole)로만.
//  questions 트리거(reject_banned_words)가 직접 insert/update 도 백스톱으로 막음.
// ============================================================

// GET /api/admin/banned-words — 전체 목록 (word 오름차순) [콘솔]
app.get('/api/admin/banned-words', requireConsole, wrap(async (_req, res) => {
  const { data, error } = await supabase
    .from('banned_words')
    .select('id, word, created_at')
    .order('word', { ascending: true });
  if (error) throw error;
  res.json({ success: true, data: data || [] });
}));

// POST /api/admin/banned-words — body { word } 추가 [콘솔]
//  trim, 빈값 거부, unique 충돌(이미 있음)이면 409 로 안내.
app.post('/api/admin/banned-words', requireConsole, wrap(async (req, res) => {
  const word = ((req.body && req.body.word) || '').toString().trim();
  if (!word) {
    return res.status(400).json({ success: false, message: '금지어를 입력해 주세요.' });
  }
  const { data, error } = await supabase
    .from('banned_words')
    .insert({ word })
    .select('id, word, created_at')
    .single();
  if (error) {
    // unique 위반(이미 등록된 금지어) → 409
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: '이미 등록된 금지어입니다.' });
    }
    throw error;
  }
  res.status(201).json({ success: true, data });
}));

// DELETE /api/admin/banned-words/:id — 삭제 [콘솔]
app.delete('/api/admin/banned-words/:id', requireConsole, wrap(async (req, res) => {
  const { data, error } = await supabase
    .from('banned_words')
    .delete()
    .eq('id', req.params.id)
    .select('id, word, created_at')
    .maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ success: false, message: '금지어를 찾을 수 없습니다.' });
  res.json({ success: true, data });
}));

// ============================================================
// 🛣️ 라우트: 공개 랜딩 (인증 불필요 — 행사 단일 QR → 세션 선택)
// ------------------------------------------------------------
//  행사(=프로젝트) 단위 단일 QR 이 가리키는 공개 랜딩 페이지용.
//  토큰 없이 service_role 로 조회하되 "공개 안전 데이터만" 반환한다.
//   - project: { id, title } (내부 정보 노출 금지)
//   - sessions: is_public=true 만, { id, title, description, starts_at, ends_at, questionCount }
//   - ⚠️ admin_token / client_name / status 등 민감·내부 필드는 절대 포함 금지.
// ============================================================

// 공개용 세션 매핑 — admin_token 등 민감 필드 제외. 프론트가 쓰기 좋은 앱 객체 형태.
const mapPublicSessionRow = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description || '',
  starts_at: row.starts_at || null,
  ends_at: row.ends_at || null,
});

// GET /api/public/projects/:projectId/landing — 공개(토큰 불필요)
//   프로젝트 없음 → 404. 공개 세션 0개면 빈 배열(200).
app.get('/api/public/projects/:projectId/landing', wrap(async (req, res) => {
  const { projectId } = req.params;

  // 프로젝트 존재 확인 — 공개 안전 필드(id, title)만 선택
  const { data: project, error: pErr } = await supabase
    .from('projects')
    .select('id, title')
    .eq('id', projectId)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!project) {
    return res.status(404).json({ success: false, message: '행사를 찾을 수 없습니다.' });
  }

  // 공개 세션만 — admin_token 은 select 에서 아예 제외(노출 차단)
  const { data: sessions, error: sErr } = await supabase
    .from('sessions')
    .select('id, title, description, starts_at, ends_at, created_at')
    .eq('project_id', projectId)
    .eq('is_public', true)
    .order('starts_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true });
  if (sErr) throw sErr;

  const list = sessions || [];
  const sessionIds = list.map((s) => s.id);

  // 숨김 제외 질문 수(questionCount) 집계
  const countMap = {};
  if (sessionIds.length) {
    const { data: questions, error: qErr } = await supabase
      .from('questions')
      .select('session_id')
      .in('session_id', sessionIds)
      .eq('is_hidden', false);
    if (qErr) throw qErr;
    (questions || []).forEach((q) => {
      countMap[q.session_id] = (countMap[q.session_id] || 0) + 1;
    });
  }

  const result = {
    project: { id: project.id, title: project.title },
    sessions: list.map((row) => ({
      ...mapPublicSessionRow(row),
      questionCount: countMap[row.id] || 0,
    })),
  };

  res.json({ success: true, data: result });
}));

// ============================================================
// 🛣️ 라우트: 엑셀 (exceljs)
// ============================================================
const EXCEL_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const EXCEL_COLUMNS = [
  { header: 'project_title', key: 'project_title', width: 28 },
  { header: 'session_title', key: 'session_title', width: 24 },
  { header: 'question_id', key: 'question_id', width: 38 },
  { header: 'author', key: 'author', width: 14 },
  { header: 'title', key: 'title', width: 36 },
  { header: 'content', key: 'content', width: 50 },
  { header: 'like_count', key: 'like_count', width: 10 },
  { header: 'is_answered', key: 'is_answered', width: 12 },
  { header: 'is_hidden', key: 'is_hidden', width: 10 },
  { header: 'created_at', key: 'created_at', width: 22 },
  { header: 'answered_status', key: 'answered_status', width: 14 },
  { header: 'exported_at', key: 'exported_at', width: 22 },
];

const answeredStatus = (q) => {
  if (q.is_hidden) return '숨김';
  return q.is_answered ? '답변완료' : '답변대기';
};

const buildWorkbook = async (rows, projectTitle, sessionTitleMap) => {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Event Q&A Admin';
  const ws = wb.addWorksheet('Q&A');
  ws.columns = EXCEL_COLUMNS;
  ws.getRow(1).font = { bold: true };
  const exportedAt = new Date().toISOString();

  rows.forEach((q) => {
    ws.addRow({
      project_title: projectTitle,
      session_title: sessionTitleMap[q.session_id] || '',
      question_id: q.id,
      author: q.author,
      title: q.title,
      content: q.content,
      like_count: q.like_count,
      is_answered: q.is_answered,
      is_hidden: q.is_hidden,
      created_at: q.created_at,
      answered_status: answeredStatus(q),
      exported_at: exportedAt,
    });
  });
  return wb;
};

const sendWorkbook = async (res, wb, fileName) => {
  res.setHeader('Content-Type', EXCEL_CONTENT_TYPE);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
  );
  await wb.xlsx.write(res);
  res.end();
};

// GET /api/admin/sessions/:sessionId/questions/export?token=... [세션admin]
//   정렬: like_count desc, created_at asc
app.get('/api/admin/sessions/:sessionId/questions/export', wrap(async (req, res) => {
  const { sessionId } = req.params;
  const ok = await requireSessionAdmin(req, res, sessionId);
  if (!ok) return;

  const { data: session, error: sErr } = await supabase
    .from('sessions').select('*').eq('id', sessionId).maybeSingle();
  if (sErr) throw sErr;
  if (!session) return res.status(404).json({ success: false, message: '세션을 찾을 수 없습니다.' });

  const { data: project } = await supabase
    .from('projects').select('title').eq('id', session.project_id).maybeSingle();
  const projectTitle = project ? project.title : '';

  const { data: questions, error: qErr } = await supabase
    .from('questions')
    .select('*')
    .eq('session_id', sessionId)
    .order('like_count', { ascending: false })
    .order('created_at', { ascending: true });
  if (qErr) throw qErr;

  const sessionTitleMap = { [sessionId]: session.title };
  const wb = await buildWorkbook(questions || [], projectTitle, sessionTitleMap);

  const fileName = `${safeFileName(projectTitle)}_${safeFileName(session.title)}_QA_${yyyymmdd()}.xlsx`;
  await sendWorkbook(res, wb, fileName);
}));

// GET /api/admin/projects/:projectId/questions/export?token=... [콘솔]
//   정렬: session_title asc, like_count desc, created_at asc
app.get('/api/admin/projects/:projectId/questions/export', requireConsole, wrap(async (req, res) => {
  const { projectId } = req.params;

  const { data: project, error: pErr } = await supabase
    .from('projects').select('*').eq('id', projectId).maybeSingle();
  if (pErr) throw pErr;
  if (!project) return res.status(404).json({ success: false, message: '프로젝트를 찾을 수 없습니다.' });

  const { data: sessions, error: sErr } = await supabase
    .from('sessions').select('id, title').eq('project_id', projectId);
  if (sErr) throw sErr;

  const sessionTitleMap = {};
  (sessions || []).forEach((s) => { sessionTitleMap[s.id] = s.title; });
  const sessionIds = (sessions || []).map((s) => s.id);

  let questions = [];
  if (sessionIds.length) {
    const { data: qs, error: qErr } = await supabase
      .from('questions')
      .select('*')
      .in('session_id', sessionIds);
    if (qErr) throw qErr;
    questions = qs || [];
  }

  // 정렬: session_title asc, like_count desc, created_at asc
  questions.sort((a, b) => {
    const ta = sessionTitleMap[a.session_id] || '';
    const tb = sessionTitleMap[b.session_id] || '';
    if (ta !== tb) return ta < tb ? -1 : 1;
    if (a.like_count !== b.like_count) return b.like_count - a.like_count;
    return new Date(a.created_at) - new Date(b.created_at);
  });

  const wb = await buildWorkbook(questions, project.title, sessionTitleMap);
  const fileName = `${safeFileName(project.title)}_QA_${yyyymmdd()}.xlsx`;
  await sendWorkbook(res, wb, fileName);
}));

// ============================================================
// 정적 라우트 & 에러 핸들링
// ============================================================
// API 미정의 경로 → JSON 404 (catch-all 보다 먼저)
app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, message: '존재하지 않는 API 경로입니다.' });
});

// 그 외 모든 비-API GET 경로 → index.html (SPA, hash 라우팅)
// 실제 파일 경로 매핑이 아니라 항상 index.html 을 내보내므로 민감 파일 노출 없음.
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 전역 에러 핸들러 (JSON)
app.use((err, _req, res, _next) => {
  console.error('[server] unhandled error:', err);
  if (!res.headersSent) {
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// ============================================================
// 서버 기동 (로컬) / export (서버리스)
// ============================================================
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[server] Event Q&A admin server running on http://localhost:${PORT}`);
  });
}
module.exports = app;
