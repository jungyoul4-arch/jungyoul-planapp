# SESSION_SUMMARY_20260305.md

> 이전 세션: SESSION_SUMMARY_20260304_v6.md
> 날짜: 2026-03-05
> 작업자: Claude Code (Opus 4.6)

---

## 완료 사항 1: 교시 선택 화면 기록완료 도장 표시

### period-select.js
- `_getDbRecordForPeriod()` 헬퍼 추가 — DB 레코드에서 사진/AI/키워드 정보 추출
- `_renderPeriodItem()` — 기록완료 카드에 ✅ 뱃지 + 요약 미리보기(사진 수, AI 분석, 키워드) + 다시보기/수정하기 버튼
- `editCompletedPeriod()` 핸들러 추가 — class-record-edit로 이동
- `renderPeriodSelect()` — 프로그레스 바에 퍼센트 표시, 전체 완료 시 축하 메시지

### records.css (period-select 관련)
- 기록완료 카드: 좌측 3px 초록 보더 + 배경(`#1e2a35`)
- `ps-done-badge`: 초록 칩 (#2dd4a8)
- `ps-summary-box`: 연한 초록 배경 요약 박스
- `ps-done-actions`: 다시보기(초록) + 수정하기(기본) 버튼
- 프로그레스 바: 높이 8px + 퍼센트 + 완료 시 shimmer 애니메이션

---

## 완료 사항 2: 필기 노트 / 참고 사진 분리

### 핵심 변경
사진 업로드를 "필기 노트(1장)" + "참고 사진(최대 14장)" 2영역으로 분리.
AI 분석은 필기 노트만 대상으로 하고, 참고 사진은 DB 저장만 함.

### photo-upload-v2.js (전면 리라이트)
- 기존 핸들러 제거: `handlePhotoUploadV2`, `removePhotoV2`, `setPhotoTag`, `movePhotoUp`, `movePhotoDown`
- 새 핸들러: `handleNoteUpload`, `removeNote`, `handleRefUpload`, `removeRefPhoto`
- 데이터 구조: `_classPhotos[0]` + tag='필기' = 필기 노트, `_classPhotos[1~]` + tag='참고' = 참고 사진
- UI: 필기 노트 영역(보라색 점선, 1장) + 구분선 + 참고 사진 영역(그리드, 14장)
- "AI 정리 시작" 버튼: 필기 노트가 있을 때만 활성화

### ai-credit-log.js
- `runAnalysis()`: `tags[i] === '필기'`인 사진만 필터링하여 AI에 전송
- `saveCreditLog()`: `normalizedTags` 도입 — 태그를 '필기'/'참고'로 정규화하여 DB 저장

### photo-album.js (태그 체계 변경)
- `_normalizeTag()`: 레거시 태그 하위호환 (note→필기, print/textbook/other→참고)
- 태그 필터: 전체/📝 필기/📷 참고
- 각 사진에 `.pa-tag-badge` 뱃지 표시

### records.css (사진 업로드 관련)
- `.pu-note-*`: 필기 노트 영역 (보라색 강조, 점선 테두리, 프리뷰, 다시촬영/삭제 버튼)
- `.pu-ref-*`: 참고 사진 영역 (회색, 3열 그리드)
- `.pu-divider`: 구분선
- `.pa-tag-badge`, `.pa-tag-note`, `.pa-tag-ref`: 사진 앨범 태그 뱃지

---

## 변경된 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `public/modules/records/views/period-select.js` | 기록완료 도장 UI, editCompletedPeriod 핸들러 |
| `public/modules/records/views/photo-upload-v2.js` | 전면 리라이트: 필기/참고 2영역 분리 |
| `public/modules/records/views/ai-credit-log.js` | 필기 노트만 AI 전송, 태그 정규화 |
| `public/modules/records/views/photo-album.js` | 태그 필기/참고 체계, 하위호환 |
| `public/modules/records/records.css` | period-select 도장 + 사진 업로드 2영역 + 앨범 태그 스타일 |

---

## 아키텍처 메모

### 사진 데이터 구조
```
state._classPhotos = [필기노트base64, 참고1base64, 참고2base64, ...]
state._classPhotoTags = ['필기', '참고', '참고', ...]

_hasNote() → tags[0] === '필기'
_getNotePhoto() → photos[0] (필기가 있을 때)
_getRefPhotos() → photos[1~] (offset = _hasNote() ? 1 : 0)
```

### 태그 매핑 (하위호환)
```
'필기' → '필기'  (새 태그)
'참고' → '참고'  (새 태그)
'note' → '필기'  (레거시)
'print', 'textbook', 'other' → '참고'  (레거시)
```

### AI 전송 흐름
```
photo-upload → startAiAnalysis() → ai-loading
  → runAnalysis()
    → photos.filter((_, i) => tags[i] === '필기')  ← 핵심 필터링
    → DB.analyzePhotos(notePhotos, ...)
    → Gemini에 필기 1장만 전송
```

---

---

## 완료 사항 3: 나의 질문함 STEP 1 — 레이아웃 리디자인

### question-record.js (전면 리라이트)
- 사이드바(push 방식) + 헤더(sticky) + 과목 필터(sticky) + 날짜별 카드 목록
- 사이드바: 통계(전체/오늘) + 출처 카테고리 9개 (수업/독서/수행평가/시험/동아리/진로/봉사/자율자치/기타)
- 과목 필터: 전체/국어/영어/수학/사회/과학/기타 + 칩 색상 + chipBounce 애니메이션
- 정렬: 최신순/오래된순 드롭다운
- 카드: 과목+출처 태그칩 + 질문텍스트(3줄) + 해결완료 버튼 + 과목색 테두리
- 날짜별 그룹핑: "3월 4일 수요일" 구분선
- 사이드바 출처 + 과목 필터 AND 조건 동시 작동
- 상세 뷰/답변/AI 토글 기존 기능 유지
- STEP 2 미구현: + 질문하기(빈 핸들러), 하단 입력바, 사진 질문, 2단계 태그

### records.css
- `.qb-layout`, `.qb-sidebar`, `.qb-main` — flex 기반 push 사이드바
- `.qb-header` — sticky 56px, blur 배경
- `.qb-filter-bar` — sticky top:56px, 가로 스크롤 칩
- `.qb-card` — 세로 리스트 카드, 과목색 테두리, hover translateY(-4px)
- `.qb-date-divider` — 날짜 텍스트 + 가로선
- 반응형: 700px 이하 사이드바 180px

### 동적 상태 프로퍼티 (Proxy)
- `_qbSidebarOpen` — 사이드바 열림/닫힘
- `_qbSourceFilter` — 출처 필터 (null=전체)
- `_qbSortOrder` — 정렬 ('newest'/'oldest')

---

## 변경된 파일 목록 (전체 세션)

| 파일 | 변경 내용 |
|------|-----------|
| `public/modules/records/views/period-select.js` | 기록완료 도장 UI, editCompletedPeriod |
| `public/modules/records/views/photo-upload-v2.js` | 필기/참고 2영역 분리 |
| `public/modules/records/views/ai-credit-log.js` | 필기 노트만 AI 전송, 태그 정규화 |
| `public/modules/records/views/photo-album.js` | 태그 필기/참고 체계 |
| `public/modules/records/views/question-record.js` | 나의 질문함 STEP 1 전면 리라이트 |
| `public/modules/records/records.css` | 도장 + 사진2영역 + 질문함 전체 스타일 |
| `CLAUDE.md` | 실수 노트 1건 추가 (class-record-edit 상태 키 차이) |

---

## 미완료 / 추후 확인

1. 나의 질문함 STEP 2: + 질문하기 입력 화면, 하단 입력바, 사진 질문, 2단계 태그
2. 나의 질문함 STEP 3: 연결 질문 (parent_id)
3. 사진 업로드 2영역 브라우저 실제 테스트
4. 배포 후 기존 사진 데이터의 태그가 정상 매핑되는지 확인

---

*작성: 2026-03-05 Claude Code (Opus 4.6)*
