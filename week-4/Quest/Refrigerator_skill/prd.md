# [Skill] 냉장고 재료 기반 레시피 제작 스킬

<aside>
🎯

냉장고 재료를 **개별 JSON 파일**로 정리하고, 그 파일들을 읽어 레시피를 만들어주는 **Skill**을 만드세요!

</aside>

---

## 미션

1. 냉장고에 있는 재료를 **재료당 1개의 JSON 파일**로 만드세요 (예: `ingredients/egg.json`, `ingredients/kimchi.json`)
2. 이 파일들을 **폴더에서 읽어 레시피를 추천/생성**해주는 Skill을 만드세요 (`.claude/skills/` 폴더에 작성)
3. `/recipe` 같은 슬래시 명령어로 **Skill을 실행**하면 레시피가 마크다운 파일로 저장되도록 하세요

---

## 핵심 구조

```
[재료별 JSON 파일 작성] → [/recipe 스킬 실행] → [ingredients/ 폴더에서 전체 파일 읽기] → [레시피 생성] → [마크다운 파일로 저장]
```

- **JSON 파일 역할:** 재료 1개 = 파일 1개. 추가/삭제가 파일 단위로 간편
- **Skill 역할:** 폴더 내 JSON 파일들을 읽고, 재료를 파악하고, 레시피를 생성/저장

### 폴더 구조 예시

```
ingredients/
├── egg.json
├── kimchi.json
├── green-onion.json
└── ramen.json
```

### JSON 파일 예시 (`ingredients/egg.json`)

```json
{
  "name": "계란",
  "quantity": "6개",
  "category": "냉장"
}
```
---

재료 1개 = 파일 1개로 관리하면 **재료 추가는 파일 생성, 삭제는 파일 삭제**로 직관적입니다. 다음 퀘스트에서 이 데이터를 DB로 옮기게 됩니다!

</aside>

- 수업에서 만든 레시피 에이전트 코드를 `.claude/skills/`에 넣고 시작하세요
- Skill 프롬프트에 **"ingredients/ 폴더의 JSON 파일들을 먼저 읽어라"**는 지시를 포함하세요
- "1인분 기준", "15분 이내", "자취생 난이도" 같은 조건을 Skill에 넣어보세요
- 새 재료를 추가하고 싶으면 JSON 파일 하나만 만들면 됩니다 — 코드 수정 없이!