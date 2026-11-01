# BEYOND Phase 1 — 핵심 안전성 개선 설계 및 격리 테스트

2026-10-31 / Asia/Rangoon(MMT). **설계와 격리 테스트만 수행. 제품 수정·원격 데이터 변경·배포 없음.**

## 1. Executive Summary

다섯 대상 모두 현행 코드에서 위험 경로를 확인했고, 격리 fixture에서 관련 현상을 재현했다. 제안 설계는 별도의 실행 모형으로 검증했다. **설계 모형의 통과는 제품 수정 완료·실제 서비스 안정성 통과가 아니다.**

최종 **39/39 검사 통과**: 현행 코드 위험 재현8개, 제안 설계 모형30개, 격리 보호 검사1개. 위험 재현 테스트의 ‘통과’는 **안전하지 않은 동작이 재현됐음**을 뜻한다.

|대상|현행 확인|제안 방향|
|---|---|---|
|F07|CONFIRMED: A 응답이 B 캐시에 반영. A 저장 흐름이 늦은 guard 전에 B credentials로 mock 쓰기를 발행할 수 있음.|userId+authEpoch 캡처, 요청/캐시/IDB 전 경계 검증, 고정 namespace, logout invalidation.|
|F01|CONFIRMED: 다른 세계 저장이 전역 CAS 무효화. 모의 추론 완료 뒤 후보 파일 정리·pending 잔존까지 재현.|세계/이미지 head CAS, 작업ID, 독립 후보 보관, 승인 원자 적용, 일별 예산 원자 예약 유지.|
|F04|CONFIRMED: 아주 오래된 pending도 동의/취소에서 RUNNING.|만료는 provider 취소가 아님. EXPIRED와 RECOVERY_REQUIRED 구분, 증거 기반 결과 재사용, 불명 예약 유지.|
|F05|CONFIRMED: approve만 성공하면 회원 세계 revision/sidecar는 그대로.|approval receipt + D1 원자 적용, PREPARED와 APPLIED 분리, 재접속 상태 조회·중복 적용 방지.|
|F09|CONFIRMED: 같은 보호 위치라도 Companion create는409, actionType 없는 legacy는 모의 추론·후보200.|두 UI 공통 명시 계약, 서버 동일 검증, 누락/잘못된 actionType 선제 거절.|

실제 Preview/Production D1·Tigris·AI는 연결하지 않았다. 현재 실제 pending·예약·승인 기록을 변경하거나 정산하지 않았다. 코드 수정·migration·배포는 다음 승인 전까지 하지 않는다.

## 2. 작업 전 Git 및 파일 상태

- branch `main`, HEAD `f4585907ecb8158eafd61cc769c4c31e94d102c0`.
- 시작 porcelain: tracked modified35, untracked101개 항목, staged 표시 없음. untracked 디렉터리는 여러 파일을 묶으므로 파일101개라는 뜻은 아니다.
- **종료 대조: 기존296개 파일 SHA-256 변경0·삭제0, 저장소 추가 파일은 이 보고서 한 개뿐.** 기준선은 메모리에만 보관했고 제품/기존 테스트 파일은 수정하지 않았다. 격리 실험 파일·로그는 새 `/tmp` 디렉터리에만 생성했다.
- 기존 modified 목록(아래 파일은 이번에 변경하지 않음):

```text
.env.example
.gitignore
AGENTS.md
DECISIONS.md
DESIGN.md
NEXT_SESSION.md
README.md
STATUS.md
VERIFICATION.md
index.html
package-lock.json
package.json
playwright.config.ts
public/_redirects
server/api.mjs
server/auth.mjs
server/index.mjs
server/setup-admin.mjs
server/test-bootstrap.mjs
server/tests/admin.test.mjs
server/vite-plugin.mjs
src/App.tsx
src/Root.tsx
src/admin/AdminApp.tsx
src/admin/admin.css
src/features/content/UniverseProvider.tsx
src/worlds/HubScene.tsx
src/worlds/WorldScene.tsx
src/worlds/hub.css
src/worlds/hub.ts
tests/admin-workspace.spec.ts
tests/exploration.spec.ts
tests/landing.spec.ts
tests/six-world-hub.spec.ts
vite.config.ts
```

기존 untracked에는 cloudflare/worker/shared, 회원·편집 모듈, tests, 기존 감사·검증 보고서와 Preview 설정이 포함된다. 전부 보존했다.

현재 연결 구조는 로컬 설정/기존 감사로만 읽었다: Preview Worker→DB 바인딩/D1→Tigris private bucket, Workers AI 바인딩. 일반 회원 user_worlds(owner_id,id), 자산 user_world_assets(user_id,id), revision, sidecar, workers_ai_requests(response 안 objectId/position/parent/승인)이 연결된다. Starter 원본과 승인/후보는 별도 key다. 계정 scope는 sessionScope 모듈의 userId와 계정별 localStorage/IndexedDB에 의존한다. 이번 단계에서 실제 바인딩/계정에 접속해 다시 검사했다고 주장하지 않는다.

## 3. F07 — 분석 및 설계

### 현행 확인 — CONFIRMED

`src/features/account/cloudWorlds.ts:23–27` hydrate/fetchWorld/upload, `:29–40` persistWorld, `AccountProvider.tsx:8` reload, `sessionScope.ts`, `uploadAssets.ts:165,175–203`가 대상이다.

1. hydrate의 await 중 account scope가 바뀌면 완료 시점의 currentUserId로 sidecar/cache를 기록할 수 있다.
2. persistWorld는 시작 userId를 캡처하지만 마지막 응답 **이후**에 바뀌었는지 검사한다. getAsset/hash/FileReader를 기다리는 동안 B로 바뀌면 memberAPI가 B의 현재 CSRF와 브라우저 cookie를 사용할 수 있다. 격리 mock에서 B credentials의 asset POST/world PUT 발행 후 뒤늦게 ‘Account changed’가 발생했다.
3. 이것은 fixture에서 확인한 클라이언트 요청 경합이다. 실제 B 서버 계정에 A 자료가 저장된 사고나 서버 owner 인증 우회를 실서비스에서 확인한 것은 아니다.

### 제안 계약

`AccountContext = {userId, authEpoch, requestGeneration, abortSignal}`를 요청/쓰기 시작 때 불변 값으로 캡처한다. authEpoch는 logout,401/세션 만료, 계정 변경, 동일 user의 새 로그인/세션 대체에도 증가한다. 같은 A로 돌아오는 ABA도 이전 응답을 유효하게 만들지 않는다.

- `AccountProvider.reload`는 authAttempt/request sequence도 검증해 오래된 session 응답이 새 계정을 다시 설정하지 못하게 한다. 정상 같은 세션 refresh를 무조건 새 계정으로 취급하지 않는다.
- API 전송 **직전**, 응답 수신 후, body/blob/hash 완료 후, cache/sidecar commit 직전, IDB transaction 시작 때 캡처를 검증한다. 업로드/저장/legacy import/pending retry에도 적용한다.
- cookie는 HttpOnly여서 캡처할 수 없다. stale 요청을 보내지 않는 것이 우선이다. 캡처한 CSRF를 보존해 다른 세션과 섞이지 않도록 하고 서버의 session/owner/CSRF 검사는 그대로 유지한다. 전송 순간 경합은 서버에서도 검증해야 한다.
- namespace와 IDB 연결은 `captured.userId`로 고정한다. 비동기 완료 때 currentUserId로 namespace를 재계산하지 않는다. `uploaded`, `versions`, `inFlight`, pending draft 키도 actor+world+epoch 기준으로 분리/무효화한다.
- logout은 먼저 epoch 증가·controller abort·미완료 cache commit 무효화, 이후 서버 logout 결과를 명확히 처리한다. 서버 logout 실패를 성공이라고 표시하지 않는다. 이미 완료된 A 캐시/로컬 초안은 삭제하지 않는다.
- 이전 계정 캐시에 쓰기를 허용할지까지 명시한다. 기본은 stale 신규 commit 차단이며 이미 commit된 A namespace 자료를 B로 이동하지 않는다. IDB가 이미 commit된 경우 되돌린다고 주장하지 않는다.

**제품 변경은 미실행.** 모형은 캡처/epoch·namespace·전송 전 guard를 검사했고 실제 브라우저 IDB transaction abort·HttpOnly cookie 경합은 UNVERIFIED다.

## 4. F01 — 분석 및 설계

### 현행 확인 — CONFIRMED

`cloudflare/d1-store.mjs:37–46 flush`, `world-edits.mjs:83,100–105`, `handler.mjs`의 외부 flush가 대상이다. 모든 호환 쓰기는 cf_state의 단일 revision guard를 공유한다.

실제 모듈+TestD1 메모리 DB에서 A reserve→AI mock 대기→B 세계 정상 저장→A 완료를 실행했다. A가 새 원본/후보를 Map 저장한 뒤 최종 D1 commit 충돌로 fresh 파일을 정리했다. 직접 worldEditsAPI는 world_save_failed503, 후속 flush도 CommitConflict, authoritative fixture에는 pending만 남았다. 실제 HTTP Worker 호출이 아니므로 실서비스503 재현으로 기록하지 않는다. 기존 승인/원본은 그대로였다.

### 대안 비교

|방법|효과|한계·선택|
|---|---|---|
|전역 revision 유지|기존 snapshot stale overwrite 방어|다른 세계도 막음. 이미지 작업 최종 commit의 기준으로는 부적합.|
|세계 revision만 도입|세계 A/B 분리·같은 세계 충돌 검출|작업 중복·예산 경쟁·Tigris 결과 복구를 해결하지 못함.|
|작업 idempotency key|동일 actor+operation+입력의 재실행 차단|원자 승인·실제 world conflict와 별도.|
|조건부 UPDATE+원자 batch|세계/head/receipt/권한을 같이 검증|UPDATE0건을 성공 처리하면 안 됨. D1 batch 안에서 guard 실패가 전체 rollback되도록 설계 필요.|
|장시간 생성과 후보 저장 분리|provider 완료 결과를 승인 전 내구 보관|생성 결과가 RAM에만 있다가 사라진 경우까지 복구할 수는 없음.|

**권장: native scoped 쓰기 + 작업ID + 내구 후보 + 승인 receipt의 결합.**

1. `(ownerKind, ownerId, worldId)`별 image head revision/active candidate를 유지한다. member는 기존 world.version도 기록한다. 후보는 source parent/hash, base head/world revision을 고정한다.
2. generation reserve/dispatch는 짧은 트랜잭션으로 끝낸다. provider를 기다리는 동안 DB 트랜잭션/전역 snapshot을 유지하지 않는다.
3. 후보 결과 저장은 **현재 세계를 변경하지 않는 독립 job 저장**이다. 다른 세계/동일 세계가 바뀌어도 완료된 후보를 보관하고 review 가능하게 한다.
4. 승인 때 현재 owner/session/status·base image head·source hash·world revision·target을 다시 검증한다. 실제 같은 세계 충돌은409, 후보/원본/예약은 보존한다. 변경된 source 위에 자동 rebase/적용하지 않는다.
5. 동일 세계의 대화만 갱신된 경우에도 첫 구현은 보수적으로 충돌시킬 수 있다. image/content revision 분리와 최신 sidecar merge는 추가 계약·검증 후 도입하며 stale 대화로 덮지 않는다.
6. CAS 실패·DB 응답 유실만으로 생성한 새 후보를 삭제하지 않는다. receipt/metadata 재조회로 commit 여부를 확인한다. 복구는 동일 결과를 사용하며 model 재호출은 하지 않는다.

### 반드시 함께 지킬 두 조건

- **호환 snapshot 보호:** native 쓰기에서 전역 guard를 읽지 않더라도 성공 시 cf_state를 증가시켜 기존 legacy snapshot의 stale overwrite를 막는다. 모든 route가 이 규약을 지켜야 한다. cf_state만 제거하는 설계는 채택하지 않는다.
- **무료 예산 경쟁:** 전역 CAS를 제거하면 동시 입장으로 무료 pool을 초과할 수 있다. `(UTC day,pool)` 예산 row 및 `(day,actor)` 이미지 count를 native 조건부 transaction으로 입장 검증하고 job 생성·예약을 같이 commit한다. micro-Neurons 정수/상향 반올림과 유일 allocation ID를 사용한다. 한도·모델·사용자별 대화 무제한 정책은 그대로다.

설계 모형은 SQLite :memory: 조건부 world commit·receipt transaction과 원자 예산 counter를 검사했다. 실제 D1 분산/동시 부하·모든 legacy route 전환은 UNVERIFIED다.

## 5. F04 — Pending 만료·복구 설계

현행 `workers-ai.mjs reserve/budgetState/releaseUnstarted`, `companion-context.mjs:32–38`에는 내구 lease/복구 protocol이 없다. 격리 fixture의 created_at=1·과거 day pending도 동의/취소에서 RUNNING, 예약 기록 유지로 확인했다(CONFIRMED).

### 상태와 의미

|상태|서버 의미|사용자 표시/다음 동작|
|---|---|---|
|QUEUED|입장·예약만 완료, dispatch 안 됐다는 내구 증거 있음|대기 중. 시작/취소 전 원자 상태 검사.|
|RUNNING|dispatch 경계를 지남. provider의 실제 시작/지불 여부는 별도 필드|응답 대기. 작업 상태 조회만 가능.|
|SUCCEEDED|검증된 후보 객체+hash/receipt를 내구 참조 가능|검토 가능. 승인된 세계와 구분.|
|FAILED|확정된 처리 오류. provider 비용 확정 여부는 별도|오류 표시, 승인 원본 유지. 자동 inference retry 없음.|
|CANCELLED|dispatch 전 취소를 원자 확정했거나 검증 가능한 provider 취소 증거|취소됨. 브라우저 abort만으로 표시하지 않음.|
|EXPIRED|dispatch 안 된 queue의 기한 만료가 원자 확인됨|실행 전 만료. 안전 조건에서만 예약 반환.|
|RECOVERY_REQUIRED|dispatch/완료/저장/정산이 불명확하거나 결과 참조 불완전|결과 확인 필요. 새 모델 호출/자동 환불 금지.|

`providerPhase`: NOT_DISPATCHED / DISPATCH_UNCERTAIN / RESPONSE_RECEIVED / RESULT_STORED / REFUSED_CONFIRMED. 앱 상태·실제 model call 횟수·provider request ID(제공되는 경우)·비용 추정/확정/불명을 분리한다.

### 필드·전환 규칙

제안 job: operationId, ownerKind/ownerId/worldId, requestHash, source hash/parent, target/bounds, base world/head revision, status/stateVersion, created/started/updated/expires/lastObserved, attempt fence, providerPhase/providerRequestId, resultKey/hash/bytes, errorCode, reservationId/estimated/settled/uncertainty, cancelRequested.

- dispatch marker를 **provider 호출 전에 내구 commit**한다. marker와 실제 호출 사이 종료도 ‘불명’일 수 있어 exactly-once provider 실행을 완전히 증명하지 않는다. 불명 시 재호출하지 않는다.
- lease는 복구 확인 시점이지 provider 취소 시각이 아니다. 예시 queue5분·running 확인15분은 제안값이며 실제 timeout/업로드 구간 측정 후 승인한다. 만료만으로 RUNNING→EXPIRED/refund 금지.
- heartbeat는 Worker가 계속 살아 있다고 보장하지 않는다. 각 단계 checkpoint와 제한된 상태 조회를 우선하고 무한 polling/진단 cron을 추가하지 않는다.
- 같은 ID/actor/hash의 조회는 기존 상태/결과를 돌려준다. actor/hash가 다르면409, 소유권이 없으면404/401. 새 ID를 자동 발급해 재생성하지 않는다.
- 결과 receipt가 존재하면 key/hash/owner/source/fence를 확인해 저장을 재개한다. provider가 성공했어도 결과가 내구 저장되기 전 RAM에서 유실되면 복구 불가능할 수 있고 RECOVERY_REQUIRED로 남는다.
- 예약 반환은 dispatch 전임이 원자 확인되거나 확정 거절 등 검증 가능한 증거가 있을 때만, allocation당1회. 저장 실패·abort·network timeout·lease 만료로 무조건0으로 만들지 않는다. 실제 사용 확정/추정 반영 지연도 기록한다.
- 과거 pending은 created_at만 보고 QUEUED/EXPIRED로 변환하지 않는다. 기존 기록 보존 + read-only reconciliation부터 시작한다.

상태 조회용 `GET /api/ai/jobs/:operationId`는 **제안 API이며 현재 미구현**. 읽기가 inference나 예약/정산을 유발하지 않아야 한다.

## 6. F05 — 승인과 세계 저장 일관성 설계

현행 approve는 `workers_ai_requests.response.approved`를 먼저 저장하고 `WorldCompanion.decide()`가 progress를 별도로 저장한다. 격리 실제 모듈에서 approve200·ledger approved=true와 기존 world JSON/version 그대로인 상태를 확인했다(CONFIRMED).

### 권장 receipt 계약

`approvalId`, actor/worldId/candidateId/operationId, sourceHash/candidateHash, expectedWorldRevision/expectedHeadRevision, resultingWorldRevision/resultingHeadRevision, state PREPARED/APPLIED/RECOVERY_REQUIRED, error, created/applied를 기록한다. job/candidate에 대한 유일 승인 식별자와 동일 request 입력 hash를 둔다.

- PREPARED는 **승인 적용 성공이 아니다**.202/진행 상태로 표시하고 현재 세계는 그대로 둔다.
- 후보는 원본/후보 key·hash·권한을 확인한 뒤에만 승인 적용 가능하다. HEAD/ETag만으로 SHA-256 일치라고 판단하지 않는다. 저장 receipt 신뢰·실물 hash 확인 규약을 함께 설계한다.
- **하나의 D1 atomic batch**에서 fresh session/owner/status, world/head/source/target 조건 guard → active candidate/head 변경 → member world revision/snapshot 갱신 → 승인 ledger·receipt APPLIED를 commit한다. 조건 실패는 batch 전체 rollback. 대화/기존 Starter hash·과거 revision은 보존한다.
- APPLIED 이후의 클라이언트 응답 유실은 실패한 승인이 아니다. 동일 approvalId/job 재조회로 적용된 version을 확인한다. 중복 승인은 버전을 다시 올리지 않는다.
- PREPARED 뒤 적용이 실패하면 receipt는 남고 세계/원본은 그대로다. 원인 해결 후 동일 receipt로 재개한다. source가 바뀌면409이며 candidate를 보존하되 자동 적용하지 않는다.
- Tigris는 D1 transaction에 포함되지 않는다. 객체는 먼저 immutable 저장하고 receipt로 연결한다. 없거나 hash 불일치면 적용하지 않는다. 복구에 검증된 백업이 있으면 **새 key**를 사용하고 기존 손상/기존 승인 객체를 덮거나 지우지 않는다. 백업도 없으면 복구 필요이며 model을 몰래 다시 호출하지 않는다.
- 재접속은 server receipt/world/head를 진실로 읽고 client pending을 정리한다. 서버 반영과 별개의 로컬 대화 저장 실패는 따로 표시한다.

### 호환성 한계

관리자 legacy browser-only 세계는 member user_worlds에 행이 없을 수 있다. 서버 image head/receipt는 만들 수 있어도 브라우저 sidecar까지 D1 원자 commit할 수 없다. 자동 회원세계 migration으로 우회하지 않는다. legacy에는 ‘서버 이미지 적용/로컬 대화 동기화’ 상태를 분리하거나 별도 저장 정책 승인이 필요하다. 이번 모형의 원자 world 보장은 **메모리 DB에 존재하는 server-backed 세계**에 한정된다.

## 7. F09 — 편집 경로 공통 보호 계약

현행 `WorldImageEditor.tsx:31`은 actionType 없이 전송하고 `WorldCompanion.generate()`는 명시적 create/edit를 보낸다. `world-edits.mjs:68,72`의 optional actionType 조건 때문에 보호가 다르다. 동일 보호 위치에 실제 모듈을 호출한 fixture에서 explicit create=409/모의 inference0, legacy missing=200/모의 inference1로 확인했다(CONFIRMED).

### 제안 요청 schema v1

|필드|규칙|
|---|---|
|operationId·worldId·contractVersion|필수, actor에 결합. 동일 ID의 입력 hash 불일치409.|
|actionType|CREATE_WORLD_OBJECT 또는 EDIT_EXISTING_OBJECT 필수. 누락/미지원400(edit_contract_required/invalid_action), quota/model 이전 거절.|
|baseHeadRevision·parentId/sourceHash|서버의 현재 승인 source와 일치해야 함. conflict면 후보/원본 유지.|
|objectKind|서버 allowlist. actionType 대신 추정하는 용도로 쓰지 않음.|
|position/region|정규화[0,1], 유한 수, 이미지 크기와 좌표계 version 명시. 클라이언트 mask/bbox는 권한 증거 아님.|
|targetId|기존 edit에서 필수. create는 target 없음. edit는 서버 승인 객체의 ID/종류/위치로 확인.|
|protected/allowed mask|서버가 승인 객체/target/source로 계산. 새 객체는 기존 보호 영역을 침범하지 않음. edit는 명시된 target만 제외하고 나머지 보호.|

동일 서버 validator/serializer 계약을 두 UI에 사용한다. 실제 mask는 현 ellipse·원본-preserving composite를 유지하고, 허용영역=요청 영역−보호영역으로 계산한다. 전부 보호되면409, 모델 뒤 실제 변경이 없으면 no-change로 실패 처리하며 성공 후보로 저장하지 않는다. 새 객체가 기존 객체와 완전히 겹치면 다른 위치 선택을 요청한다.

객체 footprint/완벽한 교량 접속 보장은 이 보호 계약으로 자동 달성되지 않는다. 서버의 bbox 근거·영역 세분화는 추가 품질 설계 영역이다. 두 UI가 같은 요청을 보내면 검증 결과가 같아야 하며 channel 이름으로 보호를 우회할 수 없다.

legacy 자유 편집의 의미 변화는 호환성 승인 사항이다. 누락을 create로 묵시 변환하거나 보호를 끄는 fallback은 금지한다. UI에 명시적 의도/대상 선택을 먼저 반영하고, 구형 클라이언트는 저장 데이터는 열 수 있되 쓰기에 명확한 업데이트 안내를 제공하는 배포 순서를 설계한다. 이번 단계에서 UI/서버를 변경하지 않았다.

## 8. 항목별 격리 테스트 결과

### 격리 장치와 실행 자료

- 독립 경로: `/tmp/beyond-phase1-safety-qUsd5udV/`.
- [재현·설계 테스트 원본](/tmp/beyond-phase1-safety-qUsd5udV/safety.test.mjs), [최종 TAP 로그](/tmp/beyond-phase1-safety-qUsd5udV/final-verified.log), [최종 격리 계측](/tmp/beyond-phase1-safety-qUsd5udV/safety-summary-381419.json).
- 실행: `node --test --test-concurrency=1 /tmp/beyond-phase1-safety-qUsd5udV/safety.test.mjs`.
- SQLite 전부 `:memory:`. 현행 TestD1/TestMedia(Map)와 합성 raster만 사용. 실제 AI 생성 이미지가 아니다.
- 실제 cloudWorlds 소스를 메모리에서 JS로 변환해 계정/스토리지/transport 의존성만 stub. 원본 제품 파일·실제 localStorage·기존 브라우저 profile에는 쓰지 않았다.
- 외부 fetch/socket/TLS/DNS 차단, 실제 서비스 env 자격값 제거, `.env` 로딩 없음. 네트워크 시도0, real provider0, 실제 edit 모듈의 AI.run **mock2회**. 설계 모형의 논리적 inference counter는 이 mock2회와 별도로 검사했다.
- Node 테스트 subprocess가 제한 sandbox에서 실행되지 않아 허용된 로컬 실행 권한으로 수행했다. 내부 네트워크 차단은 유지했다. 초기 fixture 누락/placeholder/인용부 오류를 임시 파일에서만 보완했으며 이전 로그도 보존했다. 실패한 초기 실행을 통과로 계산하지 않는다.

### 현행 제품 코드 재현 — 8/8 관찰 일치

|F|검사|관찰|판정|
|---|---|---|---|
|F07|A hydrate 지연→B 전환→완료|B namespace의 world/sidecar에 A 데이터 반영|CONFIRMED fixture 재현|
|F07|A persist 자산 await→B 전환→완료|B credentials의 asset/world mock 쓰기 후 뒤늦은 계정 변경 예외|CONFIRMED 요청 발행; 실제 서버 저장 사고는 미검증|
|F01|서로 다른 세계의 두 actual openD1Store|B commit 뒤 A CommitConflict|CONFIRMED fixture 재현|
|F01|actual worldEditsAPI+지연 AI mock+B 쓰기|최종 저장 충돌, fresh 후보 정리, authoritative pending·기존 원본 보존|CONFIRMED fixture 재현|
|F04|아주 오래된 pending 동의/취소|RUNNING, 예약 기록 유지|CONFIRMED fixture 재현|
|F05|actual approve 후 world 조회|승인 ledger true, world revision/JSON unchanged|CONFIRMED 구조의 실행 재현|
|F09|Companion explicit create/기존 집 위치|409 edit_area_protected, inference 안 함|CONFIRMED fixture 재현|
|F09|legacy missing actionType/동일 위치|모의 추론·candidate200|CONFIRMED fixture 재현|

현행 서버 테스트는 모의 세션을 DB에 seed하고 worldEditsAPI/SQL 모듈을 직접 호출했다. 실제 로그인/Workers HTTP/runtime/Cloudflare D1 정책을 검증한 것이 아니다. F07 outgoing 쓰기는 mock transport 관찰이며 실제 B 계정 데이터 변경을 수행하지 않았다.

### 제안 설계 모형 — 30/30

|범주|개수|확인한 결과|
|---|---:|---|
|F07|2|3개 지연 완료에서 B 캐시 불변, 같은 A 재로그인의 새 epoch만 허용, stale upload/world transport0.|
|F01|1|다른 세계 저장 성공, 같은 세계의 두 승인 중 하나 충돌, 후보·원본 보존·추론 재호출 없음.|
|F04|9|아래8상황과 pre/post-dispatch 취소·actor/hash ID 재사용 방어.|
|F05|8|미승인 원본 유지, 정상/receipt 후 실패/world UPDATE 후 rollback/응답 유실/중복/재접속, missing/hash mismatch 저장 차단·검증 백업 새 key 복구.|
|F09|8|새 생성·occupied·기존 edit·보호 침범·누락·잘못된 actionType·잘못된 target·좌표 불일치. 두 UI 결과 동일.|
|예산 보호|1|두 stale 입장자가 같은 잔여량을 봐도 조건부 SQL/transaction으로 한 번만 예약, 동일 ID 중복 차감 없음. 실제 요금 아닌 가상 정수 단위 모형.|
|통합|1|9절의 복합 실패·복구·중복 처리.|

격리 보호 자체 검사1개를 더해 최종39개다. 자동화 테스트 숫자를 제품 기능39개 합격으로 바꾸어 해석하지 않는다.

### F04 세부 상태·결과·예약·표시

|mock 상황|최종 관찰 상태|결과 재사용|예약|표시 의미|
|---|---|---|---|---|
|정상 완료|SUCCEEDED|가능|109.4 가상 단위 유지|검토 가능, 미승인|
|Worker 종료 모의/lease 경과|RECOVERY_REQUIRED|미확인|유지|결과 불명·자동 재호출 없음|
|모델 지연/lease 경과|RECOVERY_REQUIRED|아직 없음|유지|지연과 취소를 구분|
|모델 성공 후 metadata 실패|RECOVERY_REQUIRED→SUCCEEDED|검증 receipt로 복구|유지|저장 복구 후 검토 가능|
|동일 ID 중복|RUNNING|완료 전 없음|1회|대기/중복 inference 없음|
|미dispatch queue 만료 조회|EXPIRED|없음|0|실행 전 만료 증거|
|결과가 이미 존재|SUCCEEDED|동일 결과|유지|기존 후보 조회|
|정산 불확실|RECOVERY_REQUIRED|미확인|유지|비용 확인 필요|

pre-dispatch cancel은 CANCELLED/0, post-dispatch cancel은 RECOVERY_REQUIRED/예약 유지. 실제 환불·정산이 아니라 fixture 규칙 확인이다. heartbeat/fence·실제 provider request 식별자·다중 isolate crash의 전체 구현은 아직 없다.

## 9. 통합 테스트 결과

별도 메모리 설계 모형에서 다음 순서를 실행했다(CONFIRMED 모형): A 세계 작업 dispatch→A logout/B 전환→B 다른 세계 저장→모의 결과 도착·후보 metadata 실패→A의 stale cache 반영 거절→result receipt 복구→같은 job 중복 요청에서 새 dispatch 차단→승인 transaction 중 world UPDATE 뒤 오류 주입/rollback→동일 receipt 재적용·중복 승인→보호 영역 위반 거절.

결과: B 캐시 변경0, 다른 세계 저장 성공, 후보 재사용 가능, A world revision 정확히1회 증가, receipt1개/APPLIED, 모의 inference1회, 기존 원본/승인 history 유지, 불명 비용을 환불하지 않음. **실제 provider/Cloudflare/Tigris/브라우저와 통신한 통합 e2e가 아니다.**

## 10. 예상 데이터 영향

현재 데이터 영향은 **없음**. 원격 D1 조회/쓰기·Tigris 접근·실제 AI 호출도 이번 단계에서는0회다. 생성물은 이 보고서와 독립 `/tmp` 테스트·로그뿐이다.

향후 승인 시에는 additive 작업/receipt/budget/head 테이블과 읽기 경로가 필요할 가능성이 높다. 과거 world JSON/Starter·원본 key·objectId/좌표·승인 history·pending ledger를 삭제/덮거나 추정 상태로 정리하지 않는다. legacy reader DTO 호환을 유지하면서 새 receipt를 함께 반환하는 방식을 우선한다.

기존 ambiguous pending을 새 schema에 import하더라도 status=RECOVERY_REQUIRED/비용 불명으로 표시하고 원행·예약량은 유지한다. 별장0픽셀처럼 이미 존재하는 승인 기록을 이 설계 작업에서 소급 삭제하지 않는다.

## 11. 향후 수정 대상 파일 목록

|대상|계획한 변경 — 이번 미수정|
|---|---|
|sessionScope.ts·AccountProvider.tsx|authEpoch/sequence·invalidation·stale auth response 차단|
|cloudWorlds.ts·uploadAssets.ts|캡처 actor namespace, 모든 async read/write/IDB/초안 guard|
|workersDialogue.ts·authorAccess.ts|캡처한 auth context로 전송,401·계정 전환 전파|
|d1-store.mjs·handler.mjs|native scoped job/world/approval 경로와 legacy global revision 보호의 공존|
|user-worlds.mjs|같은 세계 version·최신 sidecar·승인 receipt의 원자 연결|
|workers-ai.mjs|native 예산 입장·동일 allocation·provider phase/정산 불명 분리|
|world-edits.mjs|공통 검증·내구 결과·fresh 후보 보존·receipt 승인·같은ID 조회|
|companion-context.mjs|job 상태 관측·RECOVERY_REQUIRED 안내·세계별 조회 계약|
|WorldCompanion.tsx·WorldImageEditor.tsx|동일 request schema, 명시적 intent/target, server receipt 기반 상태|
|read-api.mjs|owner-scoped job/approval/head 조회; 읽기만으로 inference/정산 안 함|
|새 schema/migration·새 공통 validator/adapter(제안)|구체 이름/최종 DDL은 구현 승인 후. 기존 파일 덮어쓰기 금지|

## 12. DB schema 변경 필요 여부

**F07만은 브라우저 상태 설계로 가능하며 서버 schema 필수 아님. F01/F04/F05의 내구 보장에는 additive schema가 권장된다. 실제 migration 미작성·미실행.**

제안:

- `ai_world_heads`: ownerKind/ownerId/worldId 복합키, headRevision, activeCandidate/sourceHash. legacy admin 세계도 표현 가능하되 member 소유권과 혼동 금지.
- `ai_jobs`: actor/operation unique, input/source/target/base revisions, stateVersion/lease/provider phase, result receipt·예약 식별자.
- `ai_approvals`: job/candidate unique, PREPARED/APPLIED, expected/resulting revisions, 적용 오류·시각.
- 일별 pool 및 actor image counter: UTC day별 원자 입장. allocation/settlement 유일성은 job 또는 별도 append-only event와 연결.
- 기존 workers_ai_requests는 원본 ledger로 보존하고 참조. 구/신 양쪽이 동시에 동일 추론을 차감하지 않도록 cutover ownership을 정한다.

SQL D1 적용은 atomic batch 내 권한·조건 guard, INSERT/UPDATE와 유일 제약을 사용해야 한다. UPDATE changes=0을 batch 외부에서 발견한 뒤 이미 실행된 나머지 쓰기를 되돌린다고 가정하면 안 된다. 이 문서는 최종 DDL·migration의 안전성을 검증했다고 주장하지 않는다.

## 13. Tigris 객체 구조 변경 필요 여부

기존 객체 **이동/rename/덮어쓰기/삭제 필요 없음**. 기존 original/candidate key를 계속 참조한다. 선택적으로 새 작업 prefix에 immutable result manifest/receipt를 추가해 metadata 실패 뒤 결과를 발견하게 한다. owner/job/attempt/hash/format/bytes를 결합하고 If-None-Match를 유지한다.

새 manifest/DB receipt만으로 사라진 provider 출력 자체를 복원할 수는 없다. 모델 결과가 어떤 내구 위치에도 없으면 RECOVERY_REQUIRED/수동 확인이다. orphan 정리는 참조 없음·provider 종료·보존기간·승인된 정책을 확인한 별도 절차이며 Phase1에서 자동 GC/삭제를 도입하지 않는다.

## 14. 성능 및 비용 영향

추가 job/receipt/권한/예산 SQL과 선택적 manifest 쓰기는 D1·Tigris 요청/작은 metadata를 늘린다. native 단건 조회·짧은 batch로 전역 snapshot/WASM 복사를 줄일 여지가 있지만 실제 Free CPU/메모리 개선은 **UNVERIFIED**다. 본 모형의 약0.3초 실행 시간을 Worker 성능 수치로 사용하지 않는다.

provider 자동 재호출은0으로 유지, 내부 예산 한도와 고정 모델을 바꾸지 않는다. job 조회 polling은 백오프·횟수 상한·탭 비활성 중단이 필요하며 heartbeat만을 위한 무한 쓰기/새 cron은 제안하지 않는다. 불명 예약은 여전히 입장 여유를 보수적으로 줄일 수 있다.

동시 예산 guard 모형은 가상 정수 단위의 논리 검사다. 실제 Neurons 청구 검증·월 $0 보장·Tigris 초과 과금 확인은 하지 않았다. 실제 비용 보호를 위해 현재 Free 정책을 유지하고 별도 계측 승인 전에 모델을 호출하지 않는다.

## 15. 기존 기능과의 호환성 위험

- 동명 계정 재로그인과 새 세션 epoch, 다중 탭·legacy cache import가 모두 scope 규약을 따라야 함.
- 같은 세계의 대화 저장도 world.version을 올리는 현재 구조는 보수적 승인 충돌을 만들 수 있음. 최신 대화를 덮지 않는 merge와 image head 분리의 승인 기준 필요.
- legacy 브라우저-only 관리자 세계는 member atomic world 보장의 범위 밖. 자동 서버 이관은 별도 승인 사항.
- strict actionType은 구형 legacy client에 오류를 낼 수 있음. 안전한 client-first 계약 전환 및 오래된 client에 명확한 안내 필요. 조용한 fallback으로 보호를 해제하지 않음.
- 구 ledger와 새 job/receipt의 이중 차감·서로 다른 active 이미지·세계 context 선택 불일치를 막아야 함.
- 기존 승인 parent/objectId/hash·좌표·Starter가 migration으로 바뀌면 안 됨. 모델 교체·native inpainting 도입·Vision 라이선스 동의는 설계 범위 밖.

## 16. 수정 작업 권장 순서

1. F07 authEpoch/고정 namespace/모든 쓰기 전 guard를 먼저 구현·격리 검증.
2. F09 공통 요청 validator/두 UI serializer 계약 확정. old client 정책 승인.
3. F01+F04의 jobs/head/예산 원자 입장·후보 내구 저장을 함께 설계·additive migration 검토. 전역 revision만 먼저 제거하지 않음.
4. F05 receipt/PREPARED/APPLIED·원자 member world 적용·재접속 상태 복구를 구현.
5. legacy/신 경로 parity와 과거 pending read-only reconciliation; 임의 정산/삭제 없이 점진 전환.
6. 명시적 Preview 배포 승인 후 비파괴 소수 흐름 확인. 실제 모델은 별도 승인과 정당한 무료 잔여량이 있을 때 최소 횟수만.

## 17. 실제 수정 전 필요한 승인

이번 승인은 **설계/격리 실험까지**다. 다음은 별도로 승인받아야 한다.

- 제품 파일 수정 범위·공통 API/오류 코드·legacy UI 호환 정책.
- jobs/head/approval/budget의 최종 DDL·additive migration·구/신 ledger cutover와 롤백 계획.
- 기존 pending의 실제 상태 reconciliation/예약 조정·새 manifest/유지·정리 정책. 증거 없는 환불·삭제는 승인 여부와 별개로 안전하지 않다.
- Preview migration/배포·계정·실제 승인·실제 모델 검증. 현재 fixture 통과가 실행 권한을 주지 않는다.
- 관리자 legacy 세계의 서버 저장/원자성 범위를 넓히는 정책.

Production·요금제·과금·DNS·유료 서비스 변경은 제안한 수정 묶음에도 포함하지 않는다. commit/push/merge도 수행하지 않았다.

## 18. 아직 확인하지 못한 항목

- 실제 Cloudflare D1 batch isolation/오류/region·동시 부하, 실제 Tigris 원자 조건/복구 manifest, 실제 Worker 강제종료. 메모리 SQLite/Map 실험과 동일하다고 가정하지 않는다.
- 실제 브라우저 IDB transaction abort·다중 탭 cookie 전환·HttpOnly 세션 교체·일반 A/B 회원 e2e. 실제 계정/캐시는 사용하지 않았다.
- provider 호출 경계의 exactly-once·진행 취소/비용 확정·RAM에만 있던 출력 복원. 제공자 증거가 없으면 보장할 수 없다.
- prototype의 단순 영역 겹침 계약은 실제 이미지 mask/bbox/교량 지형 solver가 아니다. 실제 최종 mask 픽셀 비교/의미 품질은 후속 승인 테스트 필요.
- 최종 production 인증 guard/전체 budget migration/legacy DTO/복구 동시성·TTL값·모바일 UI는 설계 모형 전체 범위를 넘어 미검증.
- 최초 격리 실행의 fixture 오류는 임시 코드에서만 수정했다. 최종39/39만 확정 결과이며 초기 실패 로그도 남겼다.

**제품은 아직 수정되지 않았다. 보고서와 실행 검사 목록을 제출한 뒤 중단한다.**
