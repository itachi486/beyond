# BEYOND Phase 2 C00 — 공통 계약 v1

2026-10-31 / Asia/Rangoon. **공통 설계 계약.** 후속 사용자 승인으로 A07/A09만 로컬 구현했다. B10/B11/B12/I20/T30·migration·배포 승인은 포함하지 않는다. 아래 계획 계약과 현재 A09 어댑터의 차이는 §16에서 명시한다.

## 1. 범위·근거·상태 표기

기준: `BEYOND_PHASE2_IMPLEMENTATION_PLAN.md`, `BEYOND_PHASE1_SAFETY_DESIGN.md`. 현행 sessionScope/AccountProvider/cloudWorlds, world-edits/workers-ai/d1-store/handler/read-api/member-management/schema 및 관련 fixture를 읽어 대조했다. 기존 Phase1 재현을 반복 실행하지 않았다.

branch main, HEAD `f4585907ecb8158eafd61cc769c4c31e94d102c0`. 시작 상태 modified35/untracked103개 porcelain 항목, staged 표시 없음. 파일 기준선298개 SHA-256을 메모리에 기록했다. 실제 환경·실제 ledger에 접속하지 않았고 값이 현재도 같다고 주장하지 않는다. 예산 비교는 **현재 소스 함수와 과거 fixture/보고서의 계산 규칙**을 기준으로 한다.

- **확정:** 다음 구현이 반드시 지켜야 할 의미·인터페이스·보존 불변조건을 C00 문서에서 고정. 구현/서비스 통과라는 의미는 아님.
- **미확정:** 서로 다른 정책/구현 선택이 충돌해 결정이 필요. 안전한 금지선만 고정하고 임의 선택하지 않음.
- **추가 검증 필요:** 계약은 정했으나 실제 제품/SQL/브라우저/D1/Tigris 증거가 부족함.

|검토 항목|C00 결론|
|---|---|
|AccountContext·무효화|필드·stale 전송/commit 금지 확정. 다중 탭 감지 구현/실효성 추가 검증.|
|operation/actor/world/source/target|서버 actor·정체성·canonical input·alias 규칙 확정. canonical encoder 실제 구현은 추가 검증.|
|image head/world revision|서로 다른 version 도메인·엄격 승인 조건 확정. metadata-only 자동 rebase는 범위 밖.|
|7개 작업 상태|정의·허용 전환·환불 분리 확정. lease 수치 미확정.|
|dispatch 이후 중단/불명|자동 재호출/추정 취소·환불 금지 확정. provider exactly-once·RAM 유실 복구 보장 불가.|
|ledger/SQL parity|현 JS oracle와 검증 행렬 확정. SQL 동등성 미검증, 정밀도·counter 선택 미확정.|
|UTC·과거비용·실패 비용|현 규칙·기록 보존 확정. provider跨日 청구 위험 처리 추가 결정 필요.|
|승인 receipt/transaction|member의 PREPARED/APPLIED·원자 적용 확정. 실제 D1 batch 추가 검증.|
|member/admin legacy|member 원자 보장 목표 확정. admin browser-only의 제품 지원 정책 미확정.|
|보존/rollback|삭제·덮기·추정 정산 금지와 additive/read 유지 확정. 배포 cutover fence 추가 결정 필요.|
|30일 삭제/metadata|공유 원본 제외·기간 유지·resurrection 금지 확정. late object write/보존 상세 미확정.|
|구 UI/client|동일 서버 검증·missing intent 거절·읽기 호환 확정. rollout 순서의 old-writer 차단 수단 미확정.|

## 2. 공통 AccountContext 계약 — 확정

문서용 필드(실제 타입 파일 생성 안 함):

|필드|의미·제약|
|---|---|
|userId|member 식별자 또는 null. null을 admin 권한으로 해석하지 않음.|
|authEpoch|탭 내 단조 증가 세대. logout/401·세션 무효/계정 변경/같은 user의 새 세션에서도 증가.|
|requestGeneration|동일 scope에서 최신 auth reload/세계 조회 응답을 식별. 다른 세계의 정상 요청을 서로 취소하는 전역 번호가 아님.|
|authState|unknown/anonymous/member/admin-verified 중 로컬 관측 상태. 서버 인증 대체 아님.|
|scopeKey|captured actor/legacy 구분에서 결정한 고정 cache/IDB namespace.|
|csrfBinding|현재 검증된 세션의 CSRF에 결합된 메모리 참조. localStorage·BroadcastChannel·로그에 원문 전파 금지.|
|signal|해당 epoch의 AbortSignal. abort는 provider 취소 증거 아님.|

A07 인터페이스 이름·의미를 고정한다(시그니처 초안, 구현 없음):

- `captureAccountContext()` → 불변 context. auth unknown인 상태에서 member/admin 쓰기 허용 안 함.
- `assertAccountContext(ctx, phase)` → userId/epoch/authState와 해당 phase의 requestGeneration 유효성을 확인. 불일치 시 `account_context_stale`로 중단.
- `invalidateAccountContext(reason)` → epoch 증가·기존 controller/응답 commit 무효화. 이미 보관된 A 자료를 삭제하지 않음.
- `scopedKeyFor(ctx, key)` / `openAssetsFor(ctx)` → 완료 시점 currentUserId 대신 캡처한 namespace 사용.
- `requestWithAccountContext(ctx, request)` → 전송 직전·응답 후·body 처리 후 검증. 재시도로 새 actor/CSRF를 몰래 취득하지 않음.

**검증 지점:** asset 조회/Blob/hash/FileReader 이후, API 전송 직전, 응답 수신·parse 이후, localStorage/sidecar/cache 반영 직전, IDB transaction 시작·commit 경계. upload/persistWorld/importLegacy/retryPending/대화·승인 모두 포함한다.

인증 제어 요청(login/logout/session reload)은 데이터 요청과 구분한다. logout은 이전 데이터 요청을 먼저 무효화하되 검증된 기존 세션 정보로 서버 logout을 시도할 수 있어야 한다. logout 실패를 성공으로 표시하지 않는다. auth reload는 authAttempt 순서를 확인해 늦은 A session 응답이 B를 다시 설정하지 못하게 한다.

A→B→A에서 userId만 같다고 과거 context를 부활시키지 않는다. 다중 탭 메시지는 **무효화 알림**이지 로그인/역할 인증 증거가 아니다. BroadcastChannel/storage 이벤트 전달 지연을 감안해 server cookie/CSRF/owner 검증과 응답 owner 확인을 유지한다. 네트워크에 이미 나간 요청을 취소·되돌렸다고 주장하지 않는다.

원래 A의 정당한 dispatch 뒤 logout이 발생했다면 내부 결과는 가능한 한 A 소유로 보관한다. B 캐시 반영은 금지하며 A 재로그인 후 fresh context로 조회한다. 내부 결과 보관 권한과 사용자 승인 권한은 다른 경계다.

## 3. 작업 정체성·요청 입력 계약 — 확정

### Actor·ID

`ActorRef = {kind: member|admin, id}`는 서버 세션에서만 정한다. client의 actor/userId/role은 권한 근거가 아니다. operation의 논리 키는 `(ActorRef, worldId, operationId)`이며, 기존 ledger의 global `world-edit:<id>` 충돌을 다른 actor의 작업 재사용으로 해석하지 않는다. 내부 actor-kind 구분은 namespace/lookup에도 유지한다.

operationId는 클라이언트가 의도 확정 시 한 번 생성해 네트워크/상태 재조회 동안 유지한다. 최소16·최대100자의 기존 안전 ID 범위를 유지한다. requestId는 선택적 호환 alias이며 operationId는 필수다. 둘 다 있으면 같아야 한다. operationId가 없는 기존 쓰기를 추론해 허용하지 않는다. 다른 값을 새 ID로 교정하지 않고400 `operation_id_mismatch`로 거절한다. 같은 operationId의 다른 canonical input은409 `request_conflict`다.

csrf/authEpoch/세션 토큰은 semantic request hash에 포함하지 않는다. 같은 A의 새 로그인은 같은 작업 결과를 조회할 수 있지만, stale browser context로 쓰는 것은 금지된다.

### CanonicalEditV1

|필드|계약|
|---|---|
|contractVersion|정수1. 지원하지 않는 규격은 생성 입장 전 거절.|
|operationId/worldId|필수 ID. member world는 서버 owner 존재 확인.|
|actionType|CREATE_WORLD_OBJECT / EDIT_EXISTING_WORLD_OBJECT 중 하나 필수. UI 이름에 따른 fallback 없음.|
|objectKind|현 allowlist: house/villa/bridge/farm/garden/waterfall/object.|
|position|유한 normalized x/y∈[0,1]. create의 사용자 좌표를 무단 반올림하지 않음.|
|targetId|create는 null, edit는 필수. 서버의 승인 객체/소유 scope에서 조회.|
|expectedImageHeadRevision|서버 image head 도메인의 비음수 safe integer. 초기는0일 수 있으나 legacy 초기 head는 검증 없이0으로 추정하지 않음.|
|expectedWorldRevision|member는 필수 비음수 safe integer. admin legacy 의미는 미확정이며 임의0 대입 금지.|
|sourceHash/parentCandidateId|실제 Starter/승인 parent bytes와 연결된 hash/ID. hash는 immutable encoded bytes의 lowercase SHA-256 hex64이며 ETag 대체 금지. 최초 parent null은 초기 head/source와 함께 검증.|
|message/characterId 등|기존 길이·게시 캐릭터 검증 유지. lore/세계 문맥은 member 서버 snapshot에 근거하며 client 텍스트는 신뢰하지 않음.|

edit의 좌표는 서버 target.position이 기준이다. 제출값이 기존 허용오차1e-6을 넘으면409. 허용 범위 안에서도 canonical 위치는 **서버의 원래 좌표**를 사용해 누적 drift를 만들지 않는다. target 범위·보호 mask도 서버가 산출한다. client mask/bbox는 보호 권한이 아니다.

requestHash는 고정 순서/타입의 canonical effective input(contractVersion, actor, world, operation, action, source/parent/revisions, target, authoritative edit position, kind, message, effective character/context version)에서 만든다. 임의 extra field·JSON key 순서·trace/화면 상태·requestId alias 중복은 영향을 주지 않는다. 기존 작업의 hash를 새 규칙으로 소급 덮지 않는다. canonical encoder의 Unicode·숫자(-0 포함)와 version 규칙은 corpus로 검증하며 message를 뜻이 바뀌게 재작성하지 않는다.

## 4. Image head revision과 world revision — 확정

- `worldRevision`: member user_worlds의 전체 서버 저장 version. 대화/sidecar 저장도 현재는 올릴 수 있다.
- `imageHeadRevision`: actor/world의 현재 **적용 이미지** version. 후보 생성·조회·PREPARED만으로 증가하지 않는다.
- `stateVersion`: job/receipt의 경합 제어 version. 세계나 이미지 version으로 재사용하지 않는다.
- `cf_state.revision`: 기존 compatibility snapshot stale overwrite 방어. native 작업의 world 간 충돌 기준으로 사용하지 않지만 native 성공 쓰기도 증가시켜 구 snapshot이 최신 상태를 덮지 못하게 한다.

첫 member 계약은 **strict world+head/source/target 조건**이다. admission 전에 대화/의도를 먼저 저장하고 반환된 world version을 사용한다. 이후 RUNNING/AWAITING_APPROVAL 같은 job 상태만 저장하기 위해 world를 또 수정하지 않는다. 중간에 실제 같은 world 저장이 생기면 승인은409/재검토, 후보는 보존한다.

metadata-only 변경의 자동 merge/rebase는 이번 확정 계약에 없다. stale conversation을 덮지 않는 별도 증명 없이 예상 world version을 바꿔 재승인하지 않는다. 다른 세계의 저장은 해당 world/head guard에 영향을 주지 않아야 한다.

**필수 주의:** cf_state를 증가시키는 것만으로, 구 approval writer가 새 image head를 갱신하지 않는 혼재 문제까지 해결되지는 않는다. 모든 승인 writer가 동일 repository/미러 규약을 따르거나 old-write barrier가 있어야 한다. cutover 수단은 U03에서 미확정으로 둔다.

## 5. 작업·Provider·검토 상태 전이 — 확정

|상태|의미|허용 다음 상태/조건|
|---|---|---|
|QUEUED|원자 입장·예약 완료, 내구 dispatch 없음|RUNNING(단일 dispatch marker 성공), CANCELLED(미dispatch 증거), EXPIRED(미dispatch 만료), FAILED(확정된 사전 실패).|
|RUNNING|dispatch marker 이후. 실제 provider 실행 여부는 별도 phase|SUCCEEDED(검증된 내구 결과), FAILED(확정 오류), RECOVERY_REQUIRED(종료/timeout/저장 불명).|
|SUCCEEDED|검토 가능한 내구 후보와 receipt 존재|자동 재dispatch 없음. 승인/거절은 별도. 검증된 결과 무결성 손실은 명시적 복구 transaction으로 RECOVERY_REQUIRED 전환 가능.|
|FAILED|확정 실패, 비용은 별도 확정/불명 가능|동일 ID 자동 재시작 없음. 오류·기록 조회만.|
|CANCELLED|dispatch 전 취소 확정 또는 provider 취소 증거|동일 ID 자동 재시작/승인 없음. provider 비용0을 뜻하지 않음.|
|EXPIRED|실행 전 만료가 확정|동일 ID 자동 재시작 없음. 불명 RUNNING을 이 상태로 바꾸지 않음.|
|RECOVERY_REQUIRED|실행/결과/저장/정산 확인 필요|검증된 같은 결과면 SUCCEEDED, 확정 오류/취소 증거면 FAILED/CANCELLED, 증거 없으면 유지.|

현 provider의 진행 중 취소 API는 확인되지 않았다. 따라서 RUNNING의 cancel은 cancelRequested/RECOVERY_REQUIRED이며 CANCELLED로 단정하지 않는다. UI abort는 대기 중단일 뿐이다.

providerPhase는 NOT_DISPATCHED / DISPATCH_UNCERTAIN / RESPONSE_RECEIVED / RESULT_STORED / REFUSED_CONFIRMED. dispatch marker를 provider 전에 commit한다. marker 직후 Worker가 죽으면 호출이 없었을 수도 있지만 **불명**이다. 자동 재호출하지 않는다. 동일 ID 경합은 유일 키와 stateVersion/attempt fence가 하나만 dispatch하게 한다.

candidate review는 UNREVIEWED / REJECTED / APPLIED로 별도 관리한다. SUCCEEDED 후보 거절은 job CANCELLED·예약 환불이 아니며 승인 이미지를 되돌리지 않는다. APPLIED 후보 reject는409다. 결과가 손상/누락되면 검토 가능 성공 표시를 유지하지 말고 availability/recovery 정보를 함께 반환하고 승인 적용을 막는다. GET은 관측된 불일치만 반환하고 쓰지 않으며, 내구 상태 전환은 별도 권한 있는 복구 제어가 stateVersion과 증거를 확인해 수행한다.

RUNNING UI는 ‘요청/결과 확인 중’처럼 증거 수준에 맞게 표시한다. RESPONSE_RECEIVED라도 저장 전이면 ‘결과 저장 중’; SUCCEEDED는 ‘검토 가능’; APPLIED만 ‘세계 반영 완료’다. 모델 자연어가 실행 권한/완료 증거가 되지 않는다.

lease/heartbeat는 복구 탐지용이다. 정확한 시간값은 U06 미확정이며 GET 조회가 lease 연장·추론·예약 변경을 몰래 유발하면 안 된다.

## 6. 복구·예약 불변조건 — 확정

1. 외부 부작용의 exactly-once를 보장한다고 주장하지 않는다. 불명 dispatch는 재실행보다 RECOVERY_REQUIRED를 택한다.
2. source/current approved 원본은 immutable. DB 오류·응답 유실만으로 fresh 후보를 자동 삭제하지 않는다.
3. 동일 actor/world/operation의 검증된 결과가 있으면 모델 없이 재사용한다. 다른 source 위 자동 적용은 아니다.
4. metadata 실패 뒤 객체·manifest가 있다면 owner/source/hash/attempt fence로 검증한다. 파일 존재나 ETag만으로 결과의 정당성을 확정하지 않는다.
5. provider 출력이 RAM에만 있다가 사라졌다면 복구가 불가능할 수 있다. 가짜 SUCCEEDED나 자동 새 ID를 만들지 않는다.
6. 예약 반환은 미dispatch/확정 거절 등 승인된 증거와 allocation당1회 규칙을 따른다. FAILED/EXPIRED/abort라는 상태 이름만으로0으로 만들지 않는다.
7. 실제 provider 소비·앱 내부 예약/확정 추정·관측 시각을 분리한다. 값이 없으면 unverified/null이지0이 아니다.
8. 기존 pending은 read-only reconciliation/view부터 시작. 과거 created_at·하루 경과만으로 EXPIRED/refund/backfill하지 않는다.
9. 사용자 session이 사라진 뒤에도 정당하게 dispatch된 내부 결과는 해당 owner에 격리 보관할 수 있다. 저장에는 내부 job/fence·owner/cleanup 유효성이 필요하고 공개/승인은 fresh 사용자 인증이 필요하다.

## 7. 예산 계산 계약·SQL parity 기준

### 7.1 현재 소스 oracle — 사실 확인

`cloudflare/workers-ai.mjs:10–54`를 기준으로 고정한다. 실제 ledger 원격 조회는 하지 않았다.

- policy 기본 service9000 / text8000 / image1000, 합계≤service≤10000. userText=null, userImage3. 환경값 validation 유지.
- pool: kind=image **또는** ID가 world-vision:/world-retry:로 시작하면 image, 나머지는 text. SUM은 success만이 아니라 해당 day의 모든 상태 비용을 포함한다.
- effectiveCost: 기본 reserved_neurons 원값. **오직** kind=image, status=success, 원값이 숫자31.42, response JSON의 model=Klein4B 및 crop.width/height가 숫자512일 때 imageCost로 읽기 보정한다. 과거 row 수정은 하지 않는다.
- Klein 현 기본 quote=`5.37*(504*504/(512*512))+26.05*4`≈109.40349853515625. 이는 현 코드의 관측 보정이며 범용 공식 요금 증명이 아니다.
- actor image count: kind=image, world-retry: 제외, status pending/success만. 거절한 성공 후보는 계속 count. error row는 횟수에서 제외해도 cost가 남아 있으면 pool에 계속 포함한다. world-vision(kind=text)은 image pool이지만 image 개수에는 포함되지 않는다.
- admission: 기존 ID를 먼저 찾아 actor/hash/kind가 같으면 재예약 없이 기존 상태, 다르면409. 새 cost는 유한 양수. used+cost가 cap보다 **클 때** 거절(같으면 허용). 그 뒤 actor image count 검증. 입력 잘못/권한 실패는 admission 전 처리.
- releaseUnstarted는 started=false 또는 completed=false인 확정 거절 목록에서0으로 갱신하는 현 함수다. 목록은 license/model unavailable/free allocation exhausted/access denied. 완료 뒤 저장 실패·무변경 출력은 이 조건으로 환불하지 않는다.
- releaseUnstarted는 현 image edit 경로에서 호출한다. 현 text catch는 error 상태만 기록하고 같은 refund helper를 호출하지 않는다. 따라서 text의 확정 거절까지 자동 환불하도록 확장하면 현행 parity가 아닌 동작 변경이며 별도 결정이 필요하다.
- textReservation은 UTF-8 messages JSON bytes+512 framing·max_tokens로 ceil, text settlement는 유효 provider usage가 있을 때 prompt/completion 비율로 ceil·최소1. usage가 없다고0으로 만들지 않는다.

### 7.2 SQL 의미 계약 — 확정, 실행 parity는 추가 검증

SQL은 위 pool/effectiveCost/count/비교/기존ID 순서를 보존한다. invalid JSON은31.42 보정에서만 제외하고 원값 비용을 유지한다. JSON 숫자512와 문자열‘512’를 혼동하지 않는다. NULL/primitive/missing crop이 보정 조건을 만족한 것으로 처리되지 않아야 한다. JSON 검사는 short-circuit에만 의존해 malformed 입력에서 전체 query가 실패하는 구조를 만들지 않는다.

`(day,pool)` 집계·actor count guard·job/legacy ledger 예약 INSERT·native revision increment는 하나의 원자 입장 transaction이어야 한다. 두 클라이언트가 같은 잔여량을 봐도 실제 commit 때 다시 검증한다. 동일 operation unique 충돌 시 전체 rollback 후 기존 작업을 읽고 identity가 같을 때만 반환한다. 기존 write와 새 repository의 비용은 한 번만 센다.

정상 ledger cost는 유한 비음수 numeric이어야 한다. 비정상 타입/NaN 등은 **검증 불가 오류로 fail closed**,0으로 무시/임의 교정하지 않는다. 기존 malformed ledger가 실제 존재한다고 확인한 것은 아니다. 검증 불가를 provider 한도 소진으로 표시하지 않는다.

### 7.3 반드시 작성할 parity 검증 행렬 — 실행 안 함

|축|fixture와 기대|
|---|---|
|pool|text/image·world-vision(kind=text)·world-retry·비슷하지만 prefix 불일치. oracle와 SQL pool 동일.|
|역사 보정|31.42 성공Klein·512/512만 보정. pending/error·다른 모델·다른 크기·string512·invalid JSON·null은 원값. 원행 hash 불변.|
|비용 포함|success/pending/error·거절 success·비용0·400 legacy·소수. 다른 day 제외.|
|개수|actor A/B·image/text·retry 제외·pending/success 포함·error 제외. rejected success 계속 포함.|
|경계|used+cost=cap, 바로 아래/위·소수 누적·행 순서 변경·동일 ID 동시 입장. SUM 공차로 초과 허용 금지.|
|실패/정산|dispatch 전·확정 거절·timeout/abort·storage 실패·no-change·usage 없음/유효 usage/역사 불명. 반환1회/중복 settlement0.|
|UTC|23:59:59.999→00:00:00, 같은 ID 재조회·새 ID·QUEUED cross-day·dispatched cross-day. 로컬 날짜 사용0.|
|구/신 writer|old reserve/settle와 new admission interleave, world 저장 끼어듦, cf_state legacy stale overwrite. 비용/개수 이중 반영0.|
|회귀|기존 ai-limit·companion-actions·Phase1 원자 입장 사례를 실제 신규 repository에 연결. 모델0/원격0.|

결과물은 각 fixture의 JS oracle/SQL effectiveCost·pool별 used·actor count·허용 여부·에러 종류·ledger 전후 hash를 나란히 기록해야 한다. 숫자 차이가 작다는 이유만으로 admission 차이를 통과시키지 않는다. 현재 SQL parity는 **추가 검증 필요**이며 통과 기록이 없다.

### 7.4 U01/U02 — 과거 선택지 (최신 확정은 §17)

- **U01 정밀도:** (A) 현재 REAL/JS 의미를 유지하고 부동소수 경계까지 입장 동등성 검증, (B) micro-Neurons 정수로 각 행을 상향 반올림, (C) 예산 epoch로 보호된 JS 산출값을 commit 검증에 사용. B는 더 보수적으로 일찍 거절할 수 있어 ‘완전 parity’가 아닌 정책 변화다. C는 추가 epoch와 모든 ledger writer의 참여가 필요하다. epsilon만 더해 초과를 허용하는 방식은 금지. **선택 전 B10 입장 구현을 확정하지 않는다.**
- **U02 저장 전략:** 현재 ledger를 authoritative로 한 SQL 집계 guard를 우선 평가한다는 Phase2 방향은 유지하지만 실제 쿼리/precision 검증 전 선택 완료는 아니다. day counter를 선택하면 old ledger와의 초기화·모든 write/settlement·복구/rollback 동기화가 추가로 필요하다. 두 독립 예산원을 동시에 켜지 않는다.

### 7.5 UTC·跨日 규칙

job의 budgetDay는 원자 admission의 UTC 일자로 캡처하고 immutable하게 보관한다. 동일 ID 재조회는 날짜가 바뀌어도 새 예약이 아니다. settlement/환불은 원 allocation/day에 연결하고 오늘 날짜로 조용히 이동하지 않는다. 과거 비용 보정도 해당 과거 row/day의 view이며 신규 추론이 아니다.

QUEUED가 날짜를 넘기면 dispatch 전에 새 일자의 입장 검토가 필요하다. **새 day 예약/기존 반환을 자동 진행하는 정책은 미확정 U07**이다. 미결정 상태의 안전선은 새 provider dispatch를 중지하고 재확인을 요구하는 것이다. 이미 dispatch된 작업의 실제 provider 청구일은 입장일과 다를 수 있어 현재 내부 ledger parity만으로 계정 일일 무료 소비를 완전히 보장하지 못한다. 임의 double reservation·과거 pending 누적 재차감도 승인 없이 도입하지 않는다.

## 8. API 요청·응답 계약 — member v1 확정

아래는 **향후 endpoint/interface 계약이며 현재 구현된 API라는 뜻이 아니다**. 기존 `/api/ai/world-edits`의 경로와 legacy DTO는 유지·확장하는 방향이다.

|요청|의미·필수 검증|응답|
|---|---|---|
|POST /api/ai/world-edits|fresh actor/owner/CSRF·기본 계약 shape → 동일 ID 조회/동일 입력 확인 → 새 작업에만 현재 source/target/revision 검증·입장|새 입장/진행은202 JobView. 이미 SUCCEEDED인 동일 작업은200과 기존 후보. 이것이 승인 성공은 아님.|
|GET /api/ai/jobs/:operationId?worldId=…|authenticated owner/actor scope, kind/world 재확인|200 JobView. 읽기만, 추론·환불·lease 연장 없음. 타 actor 작업 존재를 노출하지 않음.|
|GET /api/ai/world-edits?worldId=… 및 image/original|기존 read 접근/버전 의미 보존|기존 items/image DTO를 유지하고 job/receipt/head 정보를 추가 가능.|
|POST /api/ai/world-edits/:candidateId/approve|approvalId·operationId·expected world/head revisions·source/candidate hash·contractVersion·fresh 권한|PREPARED=202 미반영, APPLIED=200+적용 version·world envelope. 중복 APPLIED는 같은 receipt.|
|GET /api/ai/approvals/:approvalId|fresh actor/owner, receipt scope|PREPARED/APPLIED/recovery 정보, side effect0.|
|기존 reject/대기 중단 UI|candidate reject와 provider cancel을 분리|거절 성공은 active world 그대로. abort가 CANCELLED 성공 응답을 만들지 않음.|

멱등 순서는 고정한다. 이미 있는 작업은 **저장된 당시 canonical snapshot**과 입력을 비교하고 반환한다. 현재 head/캐릭터 version이 바뀌었다는 이유로 기존 작업 조회 앞에서409를 내지 않는다. 조회가 성공해도 현재 세계에 적용 가능하다는 뜻은 아니며 승인은 fresh 조건을 다시 검증한다. 새 작업만 서버의 현재 source/target/문맥으로 정규화해 hash와 입장을 만든다.

별도 server-side cancel URL을 실제로 추가할지는 B11 검토 사항이다. 추가하더라도 QUEUED 확정 취소와 RUNNING cancelRequested를 같은 의미로 처리하지 않는다.

**JobView 필드:** contractVersion, operationId, worldId, actionType, targetId, authoritativePosition, jobState/providerPhase/stateVersion, baseWorldRevision/baseHeadRevision/sourceHash, candidateRef(검증된 경우), reviewState, cost{budgetDay,reservationStatus,estimated,settled?,uncertainty}, recovery{reason,resultReusable,retryInferenceAllowed:false}, timestamps. token/CSRF/private storage credential·내부 stack은 반환하지 않는다. candidate 원문 key는 신뢰 경로 안에서만 쓰고 client에는 기존 private image API 참조를 우선한다.

**ApprovalView 필드:** approvalId/operationId/world/candidate, PREPARED|APPLIED, expected/resulting revisions, source/candidate hash, recoveryRequired/errorCode, appliedAt. PREPARED는 resulting revision null, APPLIED는 값이 있으며 같은 receipt의 결과가 바뀌지 않는다.

오류 불변조건:401 sign_in_required,403 request_verification_failed,404 world/job/candidate scope 없음,400 edit_contract_required/invalid_action/invalid_target/operation_id_mismatch,409 request/world/head/target/protected-area conflict,413 기존 크기 한도,429 내부 text/image/user/provider 구분,503 저장/복구/서비스 불가,504 timeout. 같은 정상 상태의 GET RECOVERY_REQUIRED는200 상태 조회일 수 있다. 플랫폼 HTML1102를 JSON job 성공으로 바꾸지 않는다. 정확한 client 표시 문자열은 I20 소유이나 code 의미는 공통이다.

오류 JSON은 기존 호환을 위해 `{error: stringCode}`를 유지한다. job/approval 관측을 추가하더라도 error를 객체로 바꾸지 않는다. 다음 동작은 read_status/review/retry_same_approval/reauth처럼 명시하고, generic retryable 플래그만으로 generation POST를 자동 재전송하지 않는다.

새 계약은 image 생성/승인 쓰기에 적용한다. 과거 후보 GET을 새 필드 누락 때문에 막지 않는다. 승인 body에 create/edit 전체 입력을 다시 보내 의미를 바꾸지 않으며 immutable candidate와 approval intent를 참조한다.

## 9. 승인·보존 불변조건 — 확정

- member APPLIED의 D1 atomic batch는 fresh auth/owner/status·world/head/source/target guard, active head 변경, member world 최신 snapshot/revision, old approved DTO projection, receipt 적용을 같이 처리한다. 원본 Starter는 active edited image로 덮지 않는다.
- approvalId와 candidate/job은 actor scope에서 유일하게 연결된다. 같은 approvalId의 다른 intent/hash는409. 두 동시 승인 중 같은 base를 적용하는 것은 하나뿐이다. 후보는 둘 다 보관할 수 있다.
- 과거 APPLIED receipt를 최신 head가 바뀐 뒤 다시 조회해도 그 receipt의 역사적 적용 결과를 반환한다. 다시 적용하거나 최신 head를 뒤로 바꾸지 않는다. resulting revision은 당시 값이며 currentWorldEnvelope/currentHead는 최신 관측과 분리한다. UI는 역사적 APPLIED 응답을 현재 활성 후보로 재정렬하지 않는다.
- 같은 receipt의 APPLIED는 revision을 한 번만 증가시킨다. PREPARED 뒤 실패는 원본 유지. 응답 유실 뒤에는 같은 receipt 조회가 우선이고 재생성하지 않는다.
- job.result 저장 성공과 승인 성공을 분리한다. Tigris/DB partial failure는 검증된 receipt로만 복구한다. 이미 바뀐 source 위에 예전 후보를 자동 적용하지 않는다.
- 기존 사용자/세계/원본·승인 이미지/hash/object ID/좌표/대화/이전 revision/pending ledger를 보존한다. 과거 data를 새 hash/상태로 소급 고쳐 동등성을 만드는 backfill 금지.
- rollback은 신규 입장/승인 중지와 호환 read/recovery 유지다. 새 테이블 DROP·APPLIED revision 되감기·기존 파일 덮기·unknown 예약0은 rollback이 아니다.

## 10. Member·admin legacy·구 client 정책

### 확정

member world는 server owner와 worldRevision이 있으므로 9절의 원자 적용을 목표 계약으로 한다. 현재 member world DTO/read·Starter/자산 사본을 유지한다. server actor와 브라우저 namespace를 혼동하지 않는다.

구 client라도 기존 world/이미지/승인 후보 **읽기는 보존**한다. 새 이미지 쓰기에서 missing/invalid actionType이나 계약 규격 누락은400 `edit_contract_required`/`invalid_action`, 모델/예약 전 거절, ‘새로고침/업데이트 필요’로 안내한다. legacy라는 이유로 보호를 해제하지 않는다. 새 UI와 기존 UI는 같은 serializer/validator를 사용한다.

역사 requestId→operationId alias 및 과거 objectId fallback(`objectId`가 없으면 검증된 imageHash)을 read adapter에서만 보존한다. 임의로 새 객체로 치환하지 않는다. 구 후보 승인 bridge는 검증된 실제 후보·source에서 새 approval intent를 만들며 원본/기존 승인 기록을 삭제하지 않는다.

### 미확정 U04 — admin browser-only world

- **선택 A:** server image head/receipt까지만 보장하고 local world/대화 sync는 별도 상태로 표시. 기존 기능을 가장 적게 바꾸지만 member와 같은 atomic-world 성공을 약속할 수 없음.
- **선택 B:** 명시적 동의로 legacy world를 별도 server registry/저장 체계에 등록. 더 강한 보장 가능하지만 데이터 이관·소유/보존/백업·UI 정책 변경이 커짐.

두 정책을 임의로 고르지 않는다. 자동 member migration과 worldRevision=0 가정은 금지. 결정 전 A09는 순수 member 계약 validator와 legacy read adapter만 설계할 수 있고 admin legacy 신규 write의 최종 활성화는 gate를 닫는다.

### 미확정 U03 — cutover/old-writer barrier

모든 old/new 승인·world·budget writer가 계약을 지키는 rollout이 필요하다. (A) compatibility preparation release 후 공통 repository로 이행, (B) 명시적 쓰기 pause/drain과 검증 후 전환 등 선택지와 운영 중단 위험을 비교해야 한다. 오래된 in-flight Worker가 새 head를 모른 채 legacy ledger만 갱신하는 경우를 검증한다. client-first 배포와 cf_state 증가만으로 충분하다고 가정하지 않는다. 실제 환경 gate 전 해결한다.

## 11. 30일 삭제·새 metadata 호환

**확정:** 기존30일 유예·기한 내 복구·cleanup 시작 후 복구 제한·owner prefix만 정리하는 정책은 유지한다. shared Starter/central/admin 원본을 member 삭제 범위에 포함하지 않는다. 새 job/head/receipt가 FK 오류로 기존 삭제를 영구 중단시키거나, 삭제된 계정을 재생성/자료 재게시하면 안 된다.

복구·결과 finalize는 owner/job/fence·cleanup phase를 함께 확인해야 한다. logout은 owner 삭제가 아니다. suspended/deletion_pending 자료 보관과 사용자 승인 권한도 별개로 취급한다. 사용자 권한이 없다는 이유로 이미 받은 결과를 다른 actor에게 귀속시키지 않는다.

**미확정 U05:** 새 metadata/prompt/cost 감사자료의 삭제·가명화 범위, owner cleanup fence 저장 위치, in-flight Tigris PUT의 늦은 완료와 journal/prefix 재확인 방식. 선택지는 (A) cleanup fence+제한된 drain/재조회, (B) 늦은 결과의 격리 receipt+후속 안전 정리 등이다. DB guard만으로 이미 전송된 외부 PUT을 취소할 수 없다. 긴 pending을 이유로 무기한 계정 삭제를 막거나, 증거 없이 파일을 지우는 방식은 채택하지 않는다.

삭제 protocol과 retention 선택은 B10 최종 FK/DDL·B11 late-result 처리의 선행 결정이다. 현재 live cleanup/pending을 실행해 시험하지 않는다.

## 12. Migration 필드 초안 — DDL 미작성

|논리 자료|필수 초안|확정/보류|
|---|---|---|
|ai_world_heads|ownerKind/ownerId/worldId, headRevision, activeCandidateId/sourceHash, stateVersion, updatedAt|member 의미 확정, legacy 초기화/지원 U04|
|ai_jobs|actor/world/operation unique, contract/requestHash, action/target/position, base revisions/source/parent, jobState/stateVersion, providerPhase/attemptFence, UTC budgetDay/allocationRef, resultRef/hash/bytes/availability, started/updated/expires/lastObserved, cancelRequested/error|의미 확정, 실제 열·제약/lease U06|
|ai_approvals|actor/approvalId·job/candidate 관계, immutable intentHash, PREPARED/APPLIED, expected/resulting revisions, hashes, recovery/error, timestamps|member 의미 확정, index/unique 경계 실제 SQL 검증|
|예산 자료|기존 ledger 참조, effective cost policy version, allocation/settlement dedupe|U01/U02: 새 counter/epoch/정수 금액 열 필요 여부 미확정|
|cleanup fencing|owner/cleanup generation·phase 연계|U05: 저장 위치·retention 미확정|
|선택적 result manifest|actor/world/operation/attempt/source/candidate hash·format/bytes|내구 결과 복구용, 새 key만. 실제 Tigris 검증 필요|

기존 reserved_neurons는 INTEGER affinity 선언이지만 현 코드 소수 비용을 사용한다. migration이 기존 값을 정수로 CAST/반올림해 덮으면 안 된다. FK는 member `(owner_id,world_id)`와 admin polymorphic scope를 혼동하지 않도록 별도 검토한다. schema additive가 과거 기록의 의미 변경을 허용하는 것은 아니다.

## 13. 파일 소유권·공통 인터페이스 — 확정

아래 이름은 구현 계약 초안이다. 파일은 생성하지 않았다.

|단계/단일 소유자|파일|제공 인터페이스/경계|
|---|---|---|
|A07|sessionScope.ts, AccountProvider.tsx, cloudWorlds.ts, uploadAssets.ts|capture/assert/invalidate, scopedKeyFor/openAssetsFor, requestWithAccountContext. DB job/보호 규칙 구현 금지.|
|A07→I20 순차 인계|workersDialogue.ts의 auth helper·authorAccess.ts|세션 context와 request guard 먼저 고정; I20이 나중에 consumer 연결. 동시 파일 수정 금지.|
|A09|shared/edit-contract.mjs 및 계약 테스트(예정)|normalizeEditV1(raw), validateEditShape(canonical), makeRequestHashInput(canonical,effectiveContext), serializeEditV1. 순수 입력 계약이며 DB/AI/예산/auth 호출0.|
|B10|ai-jobs.mjs 저장 기초·handler/read-api native entry·d1-store 호환 경계·user-auth native policy adapter·최종 schema 검토|requireActor/fresh commit guard, findOperation, admitOperation, scoped world/head 접근. existing sync auth 함수를 native async DB에서 그대로 호출 가능하다고 가정하지 않음.|
|B11|ai-jobs의 job/result, workers-ai, world-edits, world-edit-inference, companion-context|tryDispatch, recordProviderObservation, persistCandidateReceipt, recoverResult, getJobView. 불명 상태에서 inference 재호출0.|
|B12|ai-jobs approval·user-worlds 승인 적용·관련 read|prepareApproval, applyApproval, getApprovalView. 단일 stateVersion/receipt·world/head 규약 재사용.|
|B10/B11 순차 협의|member-management cleanup 연계|새 metadata 참조/late completion·30일 정책 보존. 실제 삭제 확대 금지.|
|I20 단일 통합 소유자|WorldCompanion.tsx, WorldImageEditor.tsx, aiErrors.ts, 소비자 배선|공통 serializer/guard/job/approval View 사용. UI만의 성공/비용/취소 상태 머신 추가 금지.|

B10/11/12가 같은 repository 파일을 병렬로 바꾸지 않는다. A07/A09의 독립 leaf와 테스트는 별도 구현 승인 후 병렬 가능하다. 공통 오류 code·DTO·ID와 fixture를 각각 복제하지 않는다.

## 14. 재사용 테스트 계획·실행 gate

이번에는 테스트를 실행하지 않았다. 기존 Phase1 `/tmp/beyond-phase1-safety-qUsd5udV/safety.test.mjs`·final-verified.log의39개 사례는 이전 증거다. 실제 새 제품 코드 검사로 전환해야 하며 설계 모형만 재실행해 구현 완료로 보고하면 안 된다.

|gate|재사용/확장|완료 기준|
|---|---|---|
|G-A07|Phase1 hydrate·B credentials 쓰기 재현 → 안전 결과 assertion, cache model; 기존 local member browser fixture|A→B→A·다중 탭·동일 user 새 세션·만료·병렬 완료에서 stale cache/IDB/API0.|
|G-A09|현재 explicit/legacy 차이·보호 mask·공통 corpus|동일 입력 결과 동일, missing/wrong action/target/revision/actor 거절, 예약/모델0.|
|G-BUDGET|7절행렬, ai-limit.test.mjs·원자 budget 모형|JS/SQL 허용·거절·pool/count 동일 또는 승인된 보수정책 차이를 명시. U01/U02 해결 전 gate 통과 불가.|
|G-JOB|지연mock/CAS·8개 pending 상황·duplicate·metadata 실패 모형|다른 세계 정상 저장, 같은 세계/같은ID 경합 감지, candidate/original 보존·불명 재호출/환불0.|
|G-APPROVAL|Phase1 PREPARED/rollback/응답 유실·기존 companion-actions/read-api|APPLIED 정확히1회, before/after hashes·world/head/receipt 정합·최신 대화 보존.|
|G-COMPAT|old snapshot+native 쓰기, old/new budget interleave, 구 후보 승인/legacy profile·30일 cleanup fixture|stale overwrite/이중 차감/자료 누락0. U03/U04/U05 미결이면 activation 불가.|
|G-REMOTE|별도 승인 후 독립 Worker/D1/Tigris+AI mock, 후속 승인된 소수 실제 모델|메모리와 실제 인프라 검증 분리. 현재는 전부 미실행/미검증.|

fixture는 `cloudflare/tests/helpers.mjs`의 TestD1/TestMedia를 재사용하고 fake clock/deferred/network deny를 공통 helper로 한 번만 둔다. *.test.mjs import로 테스트가 중복 등록되지 않도록 한다. 기존 ai-limit/companion-actions/read-api/image-cpu·ai-errors/apiResponse와 관련 Playwright에서 같은 목적의 검사를 확장한다. 새 framework·실제 계정/원본·실제 model 호출은 로컬 gate에 필요하지 않다.

## 15. 미확정 선택·위험·이후 의존성

|ID|미확정 항목·선택지|결정/검증 책임·차단 단계|
|---|---|---|
|U01|정수 fixed-point 확정, 로컬 관측14자리 →10^14 단위|§17. 미인증/표현 불가 값은 차단, 현재 원격 ledger 검증 전 활성화 금지.|
|U02|기존 ledger + 행별 reserved_units, 원자 SQL 집계/INSERT 확정|새 counter/epoch 없음. 원본 금액 유지·미인증 행 fail closed.|
|U03|구 writer preparation release vs 쓰기 pause/drain 등 cutover fence|B10~B12·운영 승인. cf_state 증가만으로 head 혼재 해결됐다고 주장 금지.|
|U04|admin image-only+local 별도 sync vs 명시적 server registry 이관|제품 지원 범위 승인. admin legacy 신규 원자-write 활성화 차단.|
|U05|cleanup fence·late PUT·metadata 보존/가명화|30일 정책/lifecycle 검증 및 승인. 최종 FK/cleanup 활성화 차단.|
|U06|queue/running lease·heartbeat/polling 상한|실측/격리 clock 검증 후 설정 승인. 현재 예시 시간값을 운영값으로 고정하지 않음.|
|U07|跨日 QUEUED 재입장/기존 반환 및 dispatched 비용 청구일 위험|UTC fixture·provider 증거/비용 정책 검토. 자동 이중 예약/새 추론 없이 미결 시 dispatch 보류.|

**진행 가능 범위와 승인:** A07의 account API와 A09의 순수 member 계약은 위 확정 인터페이스를 기준으로 **별도 구현 승인 후** 시작 가능하다. B10은 U01/U02/U03/U05 등 자기 선행 결정을 남긴 채 schema/운영 입장을 확정해서는 안 된다. B11은 B10·A09, B12는 B11의 검증된 후보·receipt, I20은 A07/A09/B12에 의존한다. U04가 미결이면 admin legacy 쓰기는 명시적으로 gate를 닫고 지원 완료라고 보고하지 않는다.

이번 C00 산출물은 확정할 수 있는 계약과 명시적 blocker를 구분한 문서다. 모든 구현/운영 선택이 해소됐다고 선언하지 않는다. 신규 migration 파일·공통 모듈·테스트 파일을 생성하지 않았고 실제 pending/ledger/승인/원본/계정/서비스 설정을 건드리지 않았다. A07/A09 구현으로 자동 진행하지 않는다.

**종료 확인:** 기존298개 파일 SHA-256 변경0·삭제0, 추가 파일은 `BEYOND_PHASE2_C00_CONTRACT.md` 하나뿐이다. 원격 접속·AI 호출·테스트 실행·제품/설정 변경·migration 생성·배포·Git 변경 작업은 없었다.

**문서 제출 후 중단. 다음 단계는 별도 승인을 기다린다.**

## 16. A07/A09 구현 범위와 현재 어댑터

후속 명시 승인에 따른 현재 계약: `shared/edit-contract.mjs`가 `contractVersion:1`, 필수 operationId/worldId/actionType/objectKind/position/targetId/parentId/sourceHash/expectedWorldRevision을 검증한다. 최종 enum은 `CREATE_WORLD_OBJECT`, `EDIT_EXISTING_WORLD_OBJECT`. 과거 저장된 actionType이나 승인/pending 레코드를 일괄 변환하지 않는다. 구형 actionType/필드 누락 쓰기는400으로 차단하고 기존 GET은 유지한다. requestId는 생략 가능하지만 제공하면 operationId와 같아야 한다.

**B10 전 임시 호환 경계:** 숫자 imageHeadRevision은 아직 없다. A09는 기존 승인 `parentId`(초기 null)를 현재 image-head 식별 토큰으로, sourceHash를 해당 실제 bytes의 SHA-256으로 검증한다. 회원은 기존 `user_worlds.version`과 expectedWorldRevision을 일치시킨다. 별도 숫자 head/작업 테이블 도입이나 원자 admission을 구현했다고 주장하지 않는다. expectedImageHeadRevision을 보내면 지원하지 않는 계약으로 거절한다. B10의 숫자 head 의미 활성화 시 contractVersion을 올려 현재 어댑터와 혼동하지 않아야 한다. admin browser-only legacy는 expectedWorldRevision:null과 parent/hash로만 보호하며 회원 세계 version 원자성을 보장하지 않는다. 기존 Starter가 있는 회원의 최초 sourceHash는 저장된 Starter hash와도 일치해야 한다.

두 UI의 payload 연결은 A07/A09에 필요한 최소 통합만 수행했다. 기존 approval API·UI world sidecar 저장 순서는 유지하며 PREPARED/APPLIED receipt와 D1 원자 승인/동시 head CAS는 B10~B12/I20에 남는다. operationId 중복의 내구 dispatch fence 역시 이번 구현 범위 밖이다. 기존 예산 ledger/reserve/queue/미디어 어댑터/스키마는 변경하지 않았다.

A07 구현은 탭별 userId/authEpoch/AbortSignal과 auth reload attempt를 사용한다. namespace는 캡처한 userId에 고정한다. storage 알림은 세션 인증이 아니라 무효화만 수행한다. 이미 완료된 A IDB commit을 되돌리지 않고 B로 이동하지 않는다. 세션 전환 시 private world 화면을 epoch별로 다시 마운트하며 기존 저장 파일·초안은 삭제하지 않는다.

A07의 auth reload에는 별도 attempt 순서를 적용하며, 동시 world 조회에는 기존 cloudVersion 비교로 오래된 응답의 cache/sidecar commit을 차단한다. 같은 세션 refresh는 불필요하게 epoch를 바꾸지 않는다. legacy UI의 같은 탭·동일 입력 네트워크 재시도는 operationId를 재사용하나 새로고침 후의 내구 operation journal은 B11에 남는다.

## 17. B10 후속 정책 승인 및 로컬 구현 — 2026-11-01 UTC

최신 사용자 승인은 U01 정수 fixed-point, U02 기존 ledger 단일 원천, U03 native cf_state 증가/세계별 CAS/구 writer 차단, U05 30일 정책 보존과 owner cleanup fencing을 확정했다. 앞의 과거 미확정 선택지보다 이 절과 최신 DECISIONS가 우선한다. B10만 로컬 구현했으며 B11/B12/I20/T30은 시작하지 않았다.

- 단위:10^14 units/Neuron. 로컬 보관25개 JSON의 관측 최대14자리, 기존 Klein quote109.40349853515625를 정수10940349853515625로 표현. 과거31.42는3142000000000000. JS는 BigInt, SQL은 INTEGER 집계, 큰 값은 decimal string bind 및 TEXT aggregate read. 더 정밀한 값/비정상 값/미인증 reserved_units는 임의 반올림 없이 차단. 실제 원격 ledger 전체는 검증하지 않았다. 원본 REAL 값과 승인 JSON은 그대로 둔다.
- 새 native budget 입장은 기존 workers_ai_requests의 raw reserved_units를 transaction에서 집계하고 job/예약을 함께 INSERT한다. 별도 counter/epoch 없음. effective historical correction·pool·count·UTC·실패/불명 비용 포함 규칙 유지. 동일 operation의 다른 UTC 일자 조회도 재차감하지 않으며 새 입장은 transaction UTC 조건 확인.
- B10 계약v2는 numeric expectedImageHeadRevision을 명시한다. 기존 v1 UI는 그대로이며 native API에 자동 연결하지 않았다. 초기 native head0은 서버 Starter 또는 명시한 최신 승인 parent/hash를 검증한 native-era 기준선이다. 과거 승인 횟수 추정/backfill이 아니다. 이미지 head 적용/증가는 B12에 남으며 B10은 저장·입장에서 head를 CAS 검사한다.
- owner/world/operation scope의 job과 단일 ledger 참조, request hash, world/head revision, 상태·provider phase·state version·cleanup generation·결과 참조를 저장한다. 성공 응답은 QUEUED metadata202이며 생성/승인/적용 성공이 아니다.
- native 성공 쓰기는 cf_state 증가. native condition은 전역 revision에 의존하지 않고 ready/session/owner/world/head/cleanup를 검사한다. protected-table DB trigger는 marker 없는 old writer를 차단한다. 기존 snapshot writer global CAS 유지.
- owner deletion-pending에서는 admission을 막고 기존 작업은 보존한다. 결과 eligibility는 세션 만료와 구분한다. 최종 owner 부재·cleanup phase/generation·삭제 tombstone은 늦은 귀속/부활을 막는 조건이다. 실제 result finalize writer는 B11 대상이다. 삭제 감사는 owner hash와 시각만 남기는 초안이다.
- gate: migration은 active0, 환경 opt-in도 미설정. 원격 ledger 단위 인증·구 in-flight writer 정리·fenced cleanup runner 검증 없이 활성화하지 않는다. 구 cleanup은 native mode에서 media 삭제 전 차단한다. 실제30일 정책 실행/운영 변경은 없었다.

구현·테스트·migration 재실행 절차·미검증 범위는 BEYOND_PHASE2_B10_VERIFICATION.md 참조.

## B10 FAIL remediation amendment (2026-11-01, local only)

This supersedes the earlier draft storage description of a new column on workers_ai_requests. The original nine-column ledger remains the only authoritative cost record. Migration0006 now adds b10_ledger_certifications(ledger_id PK/FK, raw_neurons, reserved_units canonical TEXT) and b10_budget_ledger, not a balance or counter. Proofs are valid only for the matching raw ledger cost; raw-cost updates invalidate them. JS verifies exact10^14 conversion and SQL aggregates the joined proof in the admission transaction. Unknown history remains uncertified and blocks admission. Existing REAL costs and response/approval JSON are not rewritten. Settlement/refund update raw cost and proof atomically; an older local ten-column draft can still be read by the current adapter without dropping its column. No live ledger certification or migration occurred.

Native world saves share ownership/file/hash/format and bounded JSON validation with v1 member saves. v2 progress requires its core fields; v1 partial progress is retained explicitly without inferring missing data. World/source/head changes remain separate: B10 metadata save cannot replace the saved Starter. Asset metadata is rechecked inside native CAS after asynchronous byte verification.

Member management/owner recovery and due cleanup use a narrowly issued fresh-snapshot member capability, retaining global CAS and caller authorization. Recovery rechecks profile/credential version, deadline and cleanup phase; cleanup fences the owner before media deletion, retains retry journal/jobs until final purge and atomically records the hashed owner tombstone. Generic legacy writers remain blocked when native mode is active. This is existing30-day policy compatibility, not B11 dispatch or B12 approval.

Legacy edit outputs are immutable, and candidate-manifest.json retains owner/world/operation/source/result hashes before candidate metadata commit. Failed or uncertain metadata commits do not delete fresh candidates. Manifest retention is not automatic recovery, approval or proof of actual D1/Tigris compatibility. No provider re-dispatch, queue/receipt system, activation or deployment was added. See BEYOND_PHASE2_B10_FAIL_REMEDIATION_REPORT.md.


## B10 V2 local safety amendment — 2026-11-01

Missing/mismatched cost proof is never automatically reconstructed from a successful response. Image settlement uses common raw/proof transaction; reserve refuses open caller transactions and rolls back its own staging before any flush. Legacy revision fields are checked by the Preview adapter; cleanup fence additionally CASes expected owner-world generations. v1 partial history/optional companion description is explicit compatibility; provided nested fields are checked, native v2 core history remains mandatory.

Final account cleanup now defers while a legacy/possibly-dispatched request is pending. Native QUEUED/NOT_DISPATCHED jobs are excluded. A fresh owner/world/deadline/phase/generation check precedes member result PUT. Unknown PUT outcomes keep the pending reservation and require reconciliation rather than enabling deletion or retrying inference. Final purge retains pseudonymized financial ledger/proof/status and known historical cost correction while removing private response data. This supersedes the earlier description that all actor ledger rows were deleted. Real storage/old-worker atomicity is not verified; the new local protection is not a B11 implementation or activation approval. See V2 report for tests, limitations and scope.
