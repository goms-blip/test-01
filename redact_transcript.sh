#!/usr/bin/env bash
# 제출용 마스킹 스크립트
# 사용법: bash redact_transcript.sh
# - 이 대화 transcript의 토큰/private URL을 [REDACTED]로 치환한 사본 생성
# - 원본은 그대로 (Claude 운영용으로 유지)
# - 결과 파일: ./submission_transcript.jsonl

set -euo pipefail

TRANSCRIPT_DIR="/Users/sh_oh/.claude/projects/-Users-sh-oh-Downloads-test-01"

# 가장 최근 .jsonl 파일 자동 선택 (최근 수정순)
LATEST=$(ls -t "$TRANSCRIPT_DIR"/*.jsonl 2>/dev/null | head -1)

if [ -z "$LATEST" ]; then
  echo "transcript 파일 못 찾음" >&2
  exit 1
fi

OUT="./submission_transcript.jsonl"

python3 <<PYEOF
import re, sys
text = open("$LATEST").read()

# 마스킹 패턴 (운영 중인 secret만 — 다른 토큰 형식 추가 시 여기만 수정)
patterns = [
    (r'ntn_[A-Za-z0-9]{40,}', 'ntn_[REDACTED]'),                       # Notion token
    (r'MTMxNjQ4OTQ2NjEzMTY0OH4_[A-Za-z0-9_-]+', '[ICLOUD_TOKEN_REDACTED]'),  # iCloud ICS token
    (r'private-[a-f0-9]{20,}', 'private-[GCAL_TOKEN_REDACTED]'),       # GCal ICS token
    (r'seunghun\.oh%40griff\.co\.kr', '[USER_EMAIL_REDACTED]'),        # 이메일 (선택)
]

for pat, repl in patterns:
    text = re.sub(pat, repl, text)

open("$OUT", 'w').write(text)
print(f'원본: {"$LATEST"}')
print(f'마스킹본: {"$OUT"} ({len(text)} bytes)')

# 잔여 secret 검증
import re
leftovers = re.findall(r'(ntn_[A-Za-z0-9]{30,}|MTMxNjQ4OTQ2NjEzMTY0OH4_[A-Za-z0-9_-]{10,}|private-[a-f0-9]{20,})', open("$OUT").read())
if leftovers:
    print(f'⚠ 잔여 의심: {leftovers[:3]}', file=sys.stderr)
    sys.exit(1)
else:
    print('OK: 마스킹된 사본에서 secret 패턴 검출 없음')
PYEOF
