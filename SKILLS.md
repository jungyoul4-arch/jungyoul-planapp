# SKILLS.md — 고교학점플래너 좋은 패턴 모음
> CLAUDE.md가 "하지 말 것"이라면, 이 파일은 "이렇게 하면 잘 된다"
> 작업할 때마다 효과적인 패턴을 발견하면 여기에 추가한다.
> Claude Code 세션 시작 시 CLAUDE.md와 함께 제공할 것.

---

## 🏗️ 아키텍처 패턴

### [2026-03-06] AI 파이프라인 역할 분리
```
OCR 전담 (Gemini 3.0 Flash) → 이미지에서 텍스트만 추출
분석 전담 (Gemini 3.0 Flash) → 텍스트 맥락 분석
```
- 각 AI가 가장 잘하는 일만 담당하여 품질 향상
- OCR 결과를 그대로 분석에 활용하여 컨텍스트 유지
- API 1종 사용으로 오버헤드 감소

### [2026-03-06] 병렬 처리 패턴
```javascript
// 여러 사진 동시 OCR
const ocrResults = await Promise.all(photos.map(p => runOCR(p)));

// 저장 + 질문함 등록 동시 처리
await Promise.all([
  saveToDatabase(result),
  saveQuestionsToQbox(result.questions)
]);
```
- 순차 처리 대비 체감 속도 50% 이상 단축
- 독립적인 작업은 항상 Promise.all로 묶을 것

### [2026-03-06] 기존 로직 재사용 패턴
새 기능 구현 시 비슷한 기존 기능을 먼저 찾아 재사용
```
아하 리포트 = 수업 기록 구조 재사용
             + 교시/과목/선생님 필드 제거
             + 프롬프트와 출력 양식만 변경
```
- 새로 짜는 코드 최소화 → 버그 감소, 작업 시간 단축

---

## 💾 DB/데이터 패턴

### [2026-03-06] 사진 저장 최적화
```
❌ base64를 class_records 테이블에 직접 저장
   → 테이블 즉시 비대해짐, 쿼리 느려짐

✅ 사진은 별도 저장소에 보관 후 ref:ID 참조로 저장
   → class_records 테이블 용량 80% 절감
   → 상세 보기 시 비동기로 사진 로드
```

### [2026-03-06] 학기별 데이터 보관 구조
```
semesters → subjects → timetable_slots
                    → exam_subjects
```
- semester_id 하나로 해당 학기 전체 데이터 연결
- 학년 올라가도 이전 학기 데이터 유실 없음
- 시험 관리, 플랜, 생기부 모두 이 구조에서 파생

---

## 🎨 UX 패턴

### [2026-03-06] 로딩 체감 개선 2단계 전략
```
1단계 (즉시 적용): 단계별 메시지 변경
   ✍️ 필기를 인식하고 있어요...
   🔍 수업 핵심을 파악하고 있어요...
   📌 시험 포인트를 연결하고 있어요...
   ✨ 세특 소재를 정리하고 있어요...
   🎯 거의 다 됐어요...

2단계 (스트리밍): 섹션별 완성 즉시 렌더링
   → 30초 대기를 5초로 체감시키는 핵심 패턴
```

### [2026-03-06] 폰트 계층 구조 (iPad 기준)
```
섹션 헤더:  16px / font-weight 600
본문:       15px / font-weight 400 / line-height 1.8
            word-break: keep-all (한국어 줄바꿈 방지 필수)
카드 제목:  18px / font-weight 700
부제목:     14px / font-weight 400
배지:       13px / font-weight 500
```
- 계층이 무너지면 가독성 급격히 저하
- 카드 제목은 18px 이상 넘지 말 것 (22px 이상이면 전체 균형 깨짐)

---

## 🤖 AI 프롬프트 패턴

### [2026-03-06] 마크다운 기호 출력 방지
```
프롬프트에 반드시 명시:
"⛔ 마크다운 특수기호 절대 사용 금지
 금지: * ** _ $ # 등 모든 마크다운 기호
 예외: 수학 수식 LaTeX만 허용 ($x^2+2x+1$ 형식)
 강조 필요 시 기호 대신 자연스러운 문장으로 표현"
```
- 명시하지 않으면 AI가 **볼드**, *이탤릭* 등을 남발함
- 앱 화면에서 마크다운이 그대로 노출되어 UX 저하

### [2026-03-06] LaTeX 변환 완벽 적용 2단계
```
1단계: 프롬프트에 변환 대상 명시적으로 나열
       (x², √, ∫, sin, cos, 분수, 벡터 등 전부)
2단계: 프론트엔드 renderMath() 함수로 KaTeX 렌더링
```
- 둘 중 하나만 해서는 안 됨. 반드시 두 단계 모두 적용

### [2026-03-06] 일타강사 페르소나 효과
```
"당신은 [과목명] 분야의 최고 수준 일타강사입니다"
+ "선생님이 이 수업에서 무엇을 의도했는지 꿰뚫어 봅니다"
+ "이 내용이 시험에서 어떻게 출제되는지 정확히 압니다"
```
- 단순 요약이 아닌 교육적 맥락과 시험 연결까지 분석
- 학생이 "감탄"하는 결과물의 핵심 페르소나

### [2026-03-06] JSON 출력 품질 높이는 팁
```
- 섹션마다 구체적인 분량 지시 (예: "3문장 이내")
- 빈값 처리 명시 ("내용 없으면 빈값, 절대 임의 생성 금지")
- 배열 항목은 send_to_qbox 같은 액션 필드 함께 포함
```

---

## 📸 사진 업로드 + AI 분석 재사용 패턴

### [2026-03-06] 사진 업로드 2영역 분리 아키텍처
```
현재 구현: views/photo-upload-v2.js + records.css (.pu-* 클래스)
재사용 대상: 수업 기록, 동아리, 진로, 탐구보고서, 독서활동, 봉사활동
```

**핵심 구조 — 3개 영역:**
```
[1] 메인 사진 (1장) — 필기 노트 / 활동 증빙 / 보고서 표지 등
    - 카메라 촬영 전용: capture="environment"
    - 교체/삭제 가능, 항상 배열 맨 앞(index 0)
    - state._xxxPhotos[0] + state._xxxPhotoTags[0] = '필기' 또는 '메인'

[2] 참고 사진 (최대 14장) — 교과서, 프린트, 칠판 등
    - 갤러리 선택 가능: multiple 속성
    - 그리드(3열) 배열, 개별 삭제 가능
    - state._xxxPhotos[1~] + state._xxxPhotoTags[1~] = '참고'

[3] 소감/코멘트 (선택) — 텍스트 입력
    - state._xxxComment
    - AI 분석 시 추가 컨텍스트로 활용
```

**State 패턴 (접두사만 바꿔서 재사용):**
```javascript
// 수업 기록: _classPhotos, _classPhotoTags, _studentComment
// 동아리:    _clubPhotos,  _clubPhotoTags,  _clubComment
// 탐구보고서: _reportPhotos, _reportPhotoTags, _reportComment
```

**핸들러 패턴 (5개 함수 세트):**
```javascript
handleMainUpload(input)   // 메인 사진 1장 업로드/교체
removeMain()              // 메인 사진 삭제
handleRefUpload(input)    // 참고 사진 추가 (여러 장)
removeRefPhoto(idx)       // 참고 사진 개별 삭제
startAnalysis()           // AI 분석 시작 → navigate('xxx-loading')
```

**이미지 리사이즈 함수 (공통):**
```javascript
resizeImage(file, maxWidth = 1200)
// FileReader → Image → Canvas 리사이즈 → base64 JPEG 85%
// 1200px 이하면 리사이즈 없이 그대로 반환
```

**HTML 템플릿 구조:**
```html
<div class="pu-note-section">     <!-- 메인 사진 영역 -->
  <label class="pu-note-upload">  <!-- 빈 상태: 촬영 버튼 -->
  <div class="pu-note-preview">   <!-- 촬영 완료: 미리보기 + 재촬영/삭제 -->
</div>
<div class="pu-divider"></div>
<div class="pu-ref-section">      <!-- 참고 사진 영역 -->
  <div class="pu-ref-grid">       <!-- 3열 그리드 -->
    <div class="pu-ref-tile">     <!-- 개별 사진 타일 -->
    <label class="pu-ref-add-tile"> <!-- 추가 버튼 -->
  </div>
</div>
<div class="pu-comment-section">  <!-- 소감 텍스트 -->
<div class="pu-actions">          <!-- AI 분석 시작 / 직접 입력 버튼 -->
```

**CSS 클래스 접두사 규칙:**
```
수업 기록: .pu-*  (photo-upload)
새 기능:   동일한 .pu-* 재사용 (스타일 공유)
           또는 .pu-xxx-* 로 확장 (기능별 차별화 필요 시)
```

**새 활동 영역 추가 시 복사 체크리스트:**
1. state에 `_xxxPhotos`, `_xxxPhotoTags`, `_xxxComment` 추가
2. photo-upload-v2.js의 5개 핸들러를 복제하여 state 키만 교체
3. renderXxxUpload() 렌더러 작성 (HTML 구조 동일, 제목/설명만 변경)
4. SCREEN_MAP에 'xxx-upload' 등록
5. registerHandlers에 RM.handleXxxUpload 등 등록
6. AI 분석 로딩 화면 연결 (ai-loading 재사용 또는 전용 로딩)

---

## 🔧 Claude Code 작업 패턴

### [2026-03-06] 브랜치 전략
```
main
├── feature/records-improvement   ← 기록 기능 전용
├── feature/timetable-subjects    ← 시간표/과목 등록
└── fix/버그명                    ← 단순 버그 수정
```
- 기능별 브랜치 분리 → 독립적 머지 가능
- 한 브랜치에 여러 기능 섞지 말 것

### [2026-03-06] 세션 시작 파일 세트
```
Claude Code 세션 시작 시 항상 함께 제공:
1. CLAUDE.md          (실수 방지)
2. SKILLS.md          (좋은 패턴 재사용)
3. SESSION_SUMMARY_*.md (이번 작업 지시)
```

### [2026-03-06] 컨텍스트 60% 넘으면
- 옵션 1 선택 (클리어 후 auto-accept)
- 클리어 전 반드시 CLAUDE.md + SKILLS.md 준비
- 세션 지시서에 "CLAUDE.md 먼저 읽을 것" 명시
