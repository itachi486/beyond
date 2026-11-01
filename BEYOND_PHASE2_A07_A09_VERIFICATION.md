# BEYOND Phase 2 — A07 / A09 구현·로컬 검증

2026-10-31 UTC / 2026-11-01 MMT. 사용자 승인 범위: actionType 통일, A07, A09만. **Preview 배포·실제 AI·원격 D1/Tigris 검증 없음.**

## 기준과 보존

Phase1 safety design, Phase2 implementation plan, C00 contract, AGENTS/DECISIONS/STATUS/NEXT_SESSION 및 VISION/DESIGN/DISCUSSION_LOG와 관련 코드·테스트를 읽었다. branch `main`, HEAD `f4585907ecb8158eafd61cc769c4c31e94d102c0` 유지. 시작 porcelain139항목(modified35/untracked104), 기존 파일 SHA-256 기준선은 `/tmp/beyond-a07-a09-baseline.json`. 기존 dirty/untracked 작업 위에 해당 부분만 수정했고 삭제·reset·clean·branch 전환·commit/push는 하지 않았다.

## 구현

- 공통 `shared/edit-contract.mjs`와 타입 선언. 최종 actionType: `CREATE_WORLD_OBJECT`, `EDIT_EXISTING_WORLD_OBJECT`. UI/intent/서버/테스트/C00 통일. 과거 저장 레코드 일괄 변환 없음. 구형 누락/알 수 없는 actionType·operationId·필수 정보 쓰기400 거절, 기존 읽기 유지.
- A07: immutable userId/authEpoch/signal, ABA·동일 회원 새 CSRF·login/logout/401·다중 탭 무효화. 요청 시작 컨텍스트와 CSRF를 고정하고 전송/응답/JSON/blob/hash/FileReader/캐시/IDB 경계 검사. storage 알림은 권한 증거가 아니다. auth reload attempt와 같은 세션 재조회 구분. 같은 계정에서도 더 오래된 world version 응답은 최신 cache/sidecar를 덮지 못한다. private 화면을 epoch별 재마운트. 이미 보관된 세계/초안/IDB는 삭제하지 않는다.
- cloudWorlds의 hydrate/upload/persist/import/retry와 sidecar, asset IDB transaction 및 백업/Starter/캐릭터 저장 호출에 captured scope 전파. 메모리 uploaded/versions/inFlight도 계정별 분리. stale 응답·401이 새 B 계정 상태를 변경하지 않는다. IDB abort와 최종 commit 시점 검사를 수행하되 이미 완료된 A transaction을 되돌렸다고 주장하지 않는다.
- A09: contractVersion1, operationId/worldId/actionType/objectKind/normalized position/targetId/parentId/sourceHash/expectedWorldRevision 필수. 회원 owner/version, 실제 원본 bytes hash, Starter hash, 현재 승인 parent와 실제 승인 객체·좌표·kind 검증. 기존 오브젝트/승인 객체 보호 mask를 서버가 적용. 잘못된 계약은 AI/예산 예약 전에 거절한다. 구형 객체 kind/ID는 GET에서만 보완하며 원본 ledger를 일괄 갱신하지 않는다.
- 두 UI가 같은 validator 사용. legacy 편집기는 생성/수정·대상을 명시적으로 선택한다. 위치 저장 완료 후 revision을 읽고 전송한다. 같은 탭에서 동일 의도의 불명 네트워크 재시도는 operationId를 재사용한다. Companion의 operation 없는 pending은 임의 생성하지 않는다. 후보는 승인 전 적용하지 않고 기존 Klein·마스크 합성을 유지한다.
- 구형 Node 서버에서 member session API가404인 경우, member context가 없을 때만 별도의 실제 admin session 검증을 허용한다. 이미 member인 요청은 admin으로 전환하지 않는다. 원래 서버 session/CSRF/owner 검증은 유지한다.

## 검증 결과

|검사|결과·범위|
|---|---|
|Vitest: account-context / backup / apiResponse / companion-actions|**26/26 통과**. 실제 제품 모듈, 지연 transport/asset fixture 사용. A→B/ABA/logout/401/CSRF/hash/blob/FileReader/백업/재시도 전송 차단.|
|기존 서버 회귀: world-edits / companion-actions / image-cpu|**61/61 통과**. import되는 기존 fixture 테스트 포함. 로컬 실제 handler + sql.js/SQLite 메모리 D1 어댑터 + 모의 미디어/AI.|
|신규 A09 handler 및 기존 member Klein ownership|각1개, **2/2 통과**. 필수값/잘못된 대상/다른 세계/보호 영역/좌표/source/revision 오류, 후보 미적용, 원본 및 mask 밖 변경0. 이후 기존 world.objects 보호 추가 검사도 통과.|
|Chromium member config: account-context + world-companion|**4/4 통과**. 실제 IndexedDB 격리·transaction abort, 두 탭, 실제 로컬 HTTP A/B 및 A→B→A 복원, 일반 대화/후보 승인/새로고침·모바일. AI는 모의 제공자.|
|Chromium legacy editor component|**1/1 통과**. 실제 임시 admin 로그인, 직접 마운트한 제품 컴포넌트, explicit 계약, 동일 operationId 네트워크 재시도, 거절/승인/새로고침·모바일. 이미지 API는 fixture.|
|npm run build|**통과**(tsc + Vite). 기존 큰 chunk 경고 남음.|

초기 브라우저 실패는 숨기지 않았다: 신규 IDB 테스트의 늦은 응답 대기와 가입 응답 기대값201(실제200)을 수정했다. 기존 legacy UI 테스트는 이미 WorldDiscoveries가 WorldCompanion으로 교체된 경로를 가정하여 시간 초과했다. 실제 컴포넌트 직접 마운트로 연결하면서 기존 보존/승인 assertion을 유지·강화했다. 하네스의 Vite default export/장식 기호 선택자 오류도 수정했다. 이후 구형 Node member-session404 호환 문제를 제품에서 수정했고 최종 통과했다. 테스트 삭제·skip·보호 assertion 완화 없음.

로컬 실행 증거: `/tmp/beyond-a07-a09-member-final`, `/tmp/beyond-a07-a09-editor-retry-final`, `/tmp/beyond-a07-a09-build-final.log`, `/tmp/beyond-a07-a09-contract-protection.log`. 실제 Cloudflare D1/Worker/Tigris 동작을 검증한 결과로 해석하지 않는다.

## 남는 제한·다음 승인

1. B10의 숫자 image-head revision은 없다. 현재 A09는 parentId 토큰 + 실제 source hash + 회원 world version의 admission 검증이다. unsupported expectedImageHeadRevision은 거절한다. 숫자 head 활성화 시 계약 버전 증가 필요.
2. 원자 admission/dispatch fence/중단 복구, PREPARED/APPLIED receipt와 원자 승인·world 적용, legacy snapshot 혼재의 CAS는 **B10/B11/B12/I20 미구현**. 이번 검사는 동시 승인 원자성/정확히 한 번 provider 호출을 보장하지 않는다. 기존 전역 cf_state 경쟁도 남는다.
3. admin browser-only legacy는 회원 world row가 없으므로 expectedWorldRevision:null. 서버가 아는 승인 raster 객체만 검증하며 browser-only 3D 객체 전체의 서버 권한/원자성 보장은 없다. 회원 world.objects는 서버 snapshot에서 보호한다. 수정 target은 승인 raster 객체에 한정하며 등록만 된 3D 객체를 임의로 이미지 수정 대상으로 삼지 않는다.
4. operationId의 탭 내 재시도 재사용은 적용했지만, 새로고침을 넘는 내구 작업 journal/불명 pending reconciliation은 B11 후속 범위다. 기존 pending/예약을 추정 취소·환불하지 않았다.
5. storage 이벤트는 지연될 수 있다. cookie·세션 권한의 최종 판단은 서버다. 이미 서버에 도착한 A 작업은 A로 귀속하고 클라이언트 abort로 취소·환불됐다고 표시하지 않는다. 원격 중단 후 후보 내구 보관은 후속 B11 문제다.
6. 실제 Preview/Cloudflare CPU·실제 AI 이미지 품질/요금·실제 원격 저장/30일 삭제 실행은 이번에 검증하지 않았다. 새 schema/테이블이 없어 삭제 정책을 변경하지 않았고 기존 cleanup 코드도 그대로다.

Production Worker/Production D1, Preview 원격 데이터·배포, 요금제, AI 예산/예약 함수, 모델/dispatch, 승인 receipt 시스템, schema/migrations, 실제 사용자·미디어는 변경하지 않았다. 다음 단계는 별도 승인 후만 시작한다.

## 이번 수정 파일

다음은 시작 SHA-256과 비교한 기존 파일의 변경 목록이다. STATUS/NEXT_SESSION에는 이 결과를 추가 기록한다.

- `BEYOND_PHASE2_C00_CONTRACT.md`
- `cloudflare/companion-context.mjs`
- `cloudflare/tests/companion-actions.test.mjs`
- `cloudflare/tests/companion.test.mjs`
- `cloudflare/tests/image-cpu.test.mjs`
- `cloudflare/tests/user-accounts.test.mjs`
- `cloudflare/tests/world-edits.test.mjs`
- `cloudflare/world-edits.mjs`
- `playwright.member.config.ts`
- `shared/companion-intent.d.mts`
- `shared/companion-intent.mjs`
- `src/Root.tsx`
- `src/features/account/AccountProvider.tsx`
- `src/features/account/cloudWorlds.ts`
- `src/features/account/sessionScope.ts`
- `src/features/creation/BackupControls.tsx`
- `src/features/creation/CentralLibrary.tsx`
- `src/features/creation/SpiritEditor.tsx`
- `src/features/creation/UploadCharacterModal.tsx`
- `src/features/creation/WorldAdventure.tsx`
- `src/features/creation/WorldCompanion.tsx`
- `src/features/creation/WorldDiscoveries.tsx`
- `src/features/creation/WorldEditor.tsx`
- `src/features/creation/WorldImageEditor.tsx`
- `src/features/creation/authorAccess.ts`
- `src/features/creation/starterWorlds.ts`
- `src/features/creation/uploadAssets.ts`
- `src/features/creation/workersDialogue.ts`
- `src/features/creation/worldBackup.ts`
- `src/lib/apiResponse.ts`
- `src/tests/companion-actions.test.ts`
- `tests/world-image-editor.spec.ts`

신규 코드·테스트:

- `cloudflare/tests/edit-contract-fixture.mjs`
- `cloudflare/tests/edit-contract.test.mjs`
- `shared/edit-contract.d.mts`
- `shared/edit-contract.mjs`
- `src/tests/account-context.test.ts`
- `tests/account-context.spec.ts`

이 보고서도 신규 파일이다.
