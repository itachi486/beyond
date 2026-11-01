# BEYOND B10 — Pre-Activation Audit

2026-11-01 UTC. **결론: NOT READY — BLOCKERS REMAIN**

검증 전용. 제품 코드·기존 테스트·migration·배포 설정을 수정하지 않았다. B10 서비스 활성화, B11/B12 구현, 원격 D1/Tigris 접근·변경, 실제 provider 호출, 사용자 변경, 배포 및 Git commit/push/merge/reset/clean/branch 전환 없음. 공개 Cloudflare 문서는 읽었다. native-active 분기는 폐기되는 메모리 fixture에서만 모사했으며 실제 환경이나 저장소 설정을 활성화하지 않았다.

## 1. 기준·실행 범위

요청된 B10 verification/preflight/C00/implementation plan/A07-A09 verification, DECISIONS/STATUS/NEXT_SESSION/AGENTS, 관련 VISION/DESIGN/DISCUSSION_LOG, migration0006과 B10 전체 구현·테스트를 읽고 기존 writer를 대조했다.

- branch main, HEAD `f4585907ecb8158eafd61cc769c4c31e94d102c0`.
- 시작 dirty/untracked: porcelain --untracked-files=all287항목. 전체 목록·파일별 SHA-256은 `/tmp/beyond-b10-preactivation-iafs5qyv/{git-status.txt,baseline.json}`.
- 이번 새 검사20개: **PASS9 / FAIL11**. 이는 별도 assertion20개의 결과이며 독립 root cause11개 또는 전체 제품 테스트 통과율을 뜻하지 않는다. BLOCKED/NOT TESTED는 아래에 별도로 기록했다.
- 임시 하네스: `/tmp/beyond-b10-preactivation-iafs5qyv/audit.mjs`. 실제 제품 모듈을 호출하고 기존 TestD1/TestMedia, sql.js/Node SQLite를 재사용했다. 유효한 CreatedWorld와 validator는 실제 worldStore.ts를 esbuild로 로드했다.
- 실제 provider0회 / 모의 provider1회(D03 경합) / 실제 Tigris0회. 하네스 fetch는 외부 요청을 금지하며 실제 외부 네트워크 호출0회다. 공개 문서 조회는 이 수치 밖이다.
- 이전에 통과한15개 B10 suite나 전체 빌드/브라우저 suite를 반복하지 않았다. 과거 통과 기록을 이번 실행 결과로 표시하지 않는다.

## 2. A–E 판정

|검증|PASS|FAIL|BLOCKED / NOT TESTED|
|---|---|---|---|
|A 정밀도/overflow|정수 converter650개·signed64 경계·SQL TEXT transport·집계 overflow 거절·미인증 비용503|기존 settleText에서 유한한 매우 큰 usage의 곱셈이 Infinity로 overflow되어 로컬 ledger에 기록됨(B05)|현재 원격 ledger 전수·행별 인증, 실제 D1의 nonfinite bind 처리 미검증|
|B SQL/JS parity|192개 비용/state/pool corpus, 1unit 잔여 경계의4요청 경쟁, 가상 UTC 자정 및 중복 비용 방지|정산/환불 후 raw/units 불일치(B04), 캐릭터 unpublish 후 같은 operation POST 재사용404(B03)|native 취소/정산 API는 미구현. 실제 D1 batch/드라이버/자정 검증 없음|
|C writer 전수 조사|legacy/native CAS와 marker 장벽의 코드 경로 확인, 신규 native 원자 입장 경합 검증|native world 저장의 자산/JSON 검증 누락·revision overflow. 기존 writer/UI의 native 전환 미완료|배포된 구 binary·현재 in-flight·운영 도구 실행 경계 미확인|
|D cleanup/late result|비활성 모드 기존 cleanup의 부분 삭제 실패→재시도 및 공유 원본 보존(D04)|활성 분기에서 복구/cleanup 불가(D01/D02), 전환 중 편집 후보 삭제·pending 잔존(D03)|새 native 결과 writer/fenced cleanup runner 미구현, 실제 외부 late PUT/최종 삭제 경합 미검증|
|E migration|현재 코드의 빈 native schema view, FK/index/unique/정수 제약·기본 OFF|raw SQL 재실행 오류(E01), 이전9열 loader와 새 열 비호환(E02)|managed migration history/현재 배포 binary/실제 D1 migration 미검증|

### A — 확인 가능한 비용 자료

로컬 Preview 보관 JSON109개와 그 안의 JSON 문자열215개를 읽었다. 숫자/숫자 문자열 reserved_neurons를 확인했으며 관측 값은0,1,2,100,300,400,1200,109.40349853515625였다. 파일 간 중복 관측이므로 현재 고유 ledger 행 수가 아니다. 보관된 totalNeurons6개 집계도 따로 확인했다. 둘 모두 **관측 최대 소수14자리**, 비숫자 reserved_neurons 필드는 발견되지 않았다.31.42는 기존 보정 코드/문서 및 별도 corpus에서 검증했다.

현재 원격 ledger 전체의 최대 정밀도나 모든 행의 인증을 확인한 것은 아니다. native는 미인증 행을503으로 거절하므로 관측 밖 비용을0 또는 임의 반올림으로 통과시키지 않는다. `precision-expanded.json`, `provider-precision.json`은 식별자 없이 숫자만 보관한다.

A01에서0·1unit·Number.MAX_SAFE_INTEGER 전후의 **units**·Klein 비용·free cap10000·signed64 최댓값을650개의 정확한 decimal string으로 비교했다. JS BigInt와 SQL CAST(... AS INTEGER)→TEXT가 일치했다. 14자리 초과/음수/비정상/범위 초과는 명시 거절했다. A02에서는 JS 집계와 SQL SUM이 signed64 초과를 거절했고 job/marker가 남지 않았다. SQL의 임의 scalar 산술 전체가 overflow-safe라는 의미는 아니다.

**A의 전체 PASS 조건은 충족하지 못했다:** 정수 admission converter의 성공과 별개로 기존 settlement 곱셈은 여전히 Number/Math.ceil을 사용하며 B05에서 Infinity를 기록했다. 실제 D1이 Infinity bind를 먼저 거절할지는 별도 검증이 필요하지만, 제품 함수에 명시적인 검증/거절이 없다는 사실은 재현했다.

## 3. FAIL 상세와 영향

|ID|재현 결과 / 코드|영향·필요한 후속 검토 — 이번 미수정|
|---|---|---|
|C01|b10-api PUT→B10Repository.saveWorld: 구조상 유효하지만 소유 asset에 존재하지 않는 Starter UUID/hash를 HTTP200으로 저장. head hash는 기존 값 유지.|기존 userWorldAPI의 소유 asset/ready/hash 검사와 native 경로가 다름. 이미지 접근 권한 우회를 재현한 것은 아니며 **끊어진 참조·Starter/head 불일치**를 재현함. 공통 검증/원본 보존 규칙 필요.|
|C02|native PUT이 progress:'not JSON'을 HTTP200으로 저장.|기존 userWorldAPI의 JSON.parse 검사가 누락됨. 대화/발견 sidecar를 읽을 수 없게 만들 수 있음.|
|C03|expectedWorldRevision=Number.MAX_SAFE_INTEGER를 유효하다고 받아 DB version을9007199254740992로 올린 뒤 응답 read에서 안전 정수 오류 발생.|요청은 실패했지만 mutation은 commit됨. 증분 전 SQL/JS 상한 검사 필요. 재무 금액이 아니라 revision 경계 결함이며 일상 발생을 관측한 것은 아님.|
|B03|캐릭터가 publish 상태일 때 job 생성 후 unpublish. 동일 operation/hash POST는 character_not_published404, 원래 GET job은 존재.|b10-foundation의 신규 생성용 publication 검사가 기존 job lookup보다 앞섬. 계약상 재사용과 실제 POST 의미가 다름. job/예약이 중복 생성된 것은 아님.|
|B04|settleText: raw100→1, reserved_units는10000000000000000 유지. releaseUnstarted: raw0, units 여전히 같은 값.|같은 ledger의 표현이 불일치. native precheck가503으로 막으므로 이를 초과 허용으로 보고하지 않음. 준비 단계 이후 인증을 무효화하거나 정수 표현을 원자 동기화할 공통 writer가 필요.|
|B05|usage.prompt_tokens/completion_tokens=1e308은 finite 검사 통과. 곱셈 overflow 후 raw cost Infinity 저장(로컬 SQLite).|잘못된 provider usage를 안전한 정수로 검증하지 않고 원금을 오염시킴. 실제 provider가 이 값을 보냈거나 실제 D1에 저장됐다는 의미가 아님.|
|D01|30일 기한이 남고 phase=pending인데 changeMember restore→flush가 native barrier에 거부됨. 실제 profile은 deletion_pending 유지.|자료는 보존됐지만 복구 기능이 작동하지 않음. barrier 자체의 fail-closed 동작과 정상 기능 호환은 별도다.|
|D02|기한 지난 계정의 cleanDueMembers가 native 모드에서 media 작업 전에 정지, 계정 유지.|안전한 사전 차단은 확인했으나 최종 삭제 runner가 없어30일 정책 완료를 보장하지 못함.|
|D03|기존 v1 편집을 시작·예약 commit·모의 provider 대기→fixture 전환/seed로 cf_state 변경→결과 수신. MEDIA original/candidate 저장 후 metadata409, 새 candidate 삭제, 원래 root pending 유지.|새 후보 내구 보존 실패. 원래 Starter bytes는 남음. world-edits catch의 fresh 삭제와 stale snapshot flush를 실제 제품 경로로 재현. B11 없이 안전한 전환/복구를 주장할 수 없음.|
|E01|0006 SQL을 무조건 두 번 적용하면 duplicate column name: reserved_units.|이미 문서에 있는 제약. PRAGMA-aware 절차 또는 검증된 migration history가 필요. managed runner의 재실행까지 실패했다고 단정하지 않음.|
|E02|기존 schema9열의 sql.js memory view에 migration 후 SELECT rowid,* 행10열을 재생하면 reserved_units 열 없음 오류.|준비 릴리스 없이 schema부터 적용하면 구 loader가 깨짐. native OFF만으로 호환되지 않음. 이는 **9열 loader 재현**이며 현재 배포 binary를 직접 검사한 결과는 아님.|

보호 경계를 제거하거나 assertion을 완화해 해결하지 않았다. 위 결함과 통합 차단 조건은 별도 수정 승인/검증이 필요하다.

## 4. C — Writer inventory

표의 “cf_state”는 실제 mutation commit 기준이다. 로컬 cache/IDB에는 적용되지 않는다. “차단”은 안전한 거절이지 기능 전환 완료가 아니다. 저장소 검색 결과는 `writers-rg.txt`, `ui-writers.txt`; 운영 후보 목록은 `operator-inventory.json`에 있다.

|Writer / 코드|저장 대상|CAS 검사|cf_state 증가|stale write 차단|결과|
|---|---|---|---|---|---|
|일반 AI 대화 workers-ai.reserve/settleText/catch|ledger 예약·정산·응답|기존 전역 snapshot|flush 시 Yes|DB snapshot/trigger|FAIL: native 전환 없음, units/overflow B04/B05|
|일반 대화 WorldAdventure→persistSidecar|progress/conversations|회원 world version + epoch|서버 flush Yes|전역+회원 version|FAIL: 기존 회원 writer, active 모드 차단|
|WorldCompanion.commit/send/choose|world/캐릭터 snapshot/progress|기존 회원 version + captured scope|서버 flush Yes|전역+epoch|FAIL: native API 미연결|
|WorldCompanion.generate/decide|v1 이미지 후보·승인·task|parent token + v1 계약|서버 flush Yes|전역+parent|FAIL: D03/B11·B12 미연결|
|WorldEditor / SpiritEditor.save|회원 world 또는 admin local world|회원 version / local updatedAt|회원 Yes, local N/A|회원 guard / local 비교|FAIL: active 회원 쓰기 차단, local은 별도 보장|
|WorldImageEditor.generate/approve/reject|v1 ledger JSON·후보|parent token·계약v1|서버 flush Yes|DB guard, 외부 media와 비원자|FAIL: numeric head/receipt 연결 없음|
|world-edits approve/reject 서버 writer|approved/rejected JSON|parent + global CAS|Yes|active marker 없으면 거절|FAIL: 회원 world 적용과 아직 별도(B12)|
|legacy d1-store.flush|선택된 기존 테이블|global revision/ready/session|Yes|guard CHECK + batch|PASS 코드 경계, 이전 binary 호환 E02 별도 FAIL|
|native saveWorld / seedHead|world/history/head|world/head/owner/session/ready|Yes|transaction 조건|FAIL: C01/C02/C03; CAS 자체와 validation을 구분|
|native admit|job + 단일 ledger 참조|world/head/source/예산/UTC|Yes|원자 guard·unique|PASS: B06 경합; BLOCKED 현재 ledger 인증/실제 D1|
|native job/head 조회|자신의 metadata|owner/session scope|N/A(read)|owner bound SQL|PASS 정적 확인, 생성/적용 writer가 아님|
|native fenceDueCleanup/recordDeletedOwner|generation / hashed audit|due/phase/owner/tombstone|write 시 Yes|transaction 조건|BLOCKED: 실제 runner/finalizer 연결 없음|
|native canFinalizeResult|결과 귀속 eligibility 조회|owner/generation/phase/tombstone|N/A(read)|검사 이후 부작용까지 원자 아님|BLOCKED: B11 실제 결과 저장 없음|
|cloudWorlds.persistWorld/upload|회원 world/assets|기존 version·ID/hash + captured scope|서버 Yes|서버 CAS, client epoch|FAIL: legacy 경로, active 전환 없음|
|persistSidecar / retryPending / importLegacy|world+sidecars/draft/import|기존 version/requestId·scope|서버 Yes|같은 legacy guard|FAIL: 새 native writer로 전환되지 않음|
|Starter createStarterWorld|local snapshot + asset/world|hash·scope·기존 회원 CAS|회원 Yes|기존 guard|FAIL: active upload/world 차단; 원본 파일 미변경|
|userWorldAPI assets 서버 writer|pending/ready metadata + private PUT|ID/hash + global CAS|Yes|D1은 차단, 외부 PUT은 별도|BLOCKED: in-flight late PUT/cleanup 원자성 없음|
|uploadAssets save/remove/addAssetBatch|계정별 IndexedDB|epoch/transaction abort|N/A|클라이언트 context|N/A D1 장벽. 이번 브라우저 재검사 NOT TESTED|
|worldStore.saveWorld / local sidecar|browser-only JSON|updatedAt / scope|N/A|로컬 비교만|N/A D1. 회원 원자 보장을 주장하지 않음|
|BackupControls/worldBackup restore/import|IDB·receipt + 회원 world|scope/새 ID·기존 CAS|서버 Yes, local N/A|legacy guard|FAIL: 회원 active 쓰기 미전환; originals 이번 미변경|
|관리자 editorial generated/api + server/api bridge|중앙 worlds/characters/content/connections/settings/revisions|개별 version + global CAS|Preview Yes|global guard|PASS 정적 분리; native 회원 head 갱신과 다른 domain, 이번 admin runtime suite NOT TESTED|
|관리자 회원 관리 / account deletion changeMember|profiles/credential/sessions/deletion journal|profile version + global CAS|Yes|trigger 포함|FAIL: active 복구/관리 전환 D01|
|user-auth signup/login/recovery/account|계정/session/profile/token|인증/credential + global CAS|write 시 Yes|보호 table 쓰기 차단|FAIL/BLOCKED: 보호된 계정/profile writer 전환 미완료|
|관리자 managed-images/central files|immutable files + editorial metadata|version/global CAS·If-None-Match|metadata Yes|DB와 파일은 별도|BLOCKED 외부 media runtime; 회원 Starter는 별도 snapshot이어야 함|
|worker.scheduled→cleanDueMembers|owner prefix 삭제·회원 purge/audit|기존 global CAS, 선제 gate|성공 metadata Yes|active에서는 실행 전 차단|FAIL: D02, fenced runner 없음|
|world-edits/handler error compensation|fresh candidate/created media 삭제|파일별 native CAS 없음|파일 자체 N/A|최신 job/fence로 보호하지 않음|FAIL: D03 후보 삭제|
|standalone Node server/store/auth/AI/files|별도 local SQLite/파일|각 Node transaction/version/auth|N/A 별도 DB|Cloudflare 장벽 적용 대상 아님|N/A Preview domain. 공유 adapter 경로와 구분|
|worker/universe 및 read-api|조회|N/A|N/A|쓰기가 아님|PASS 정적 read-only 분리|
|migration/batch/import-preservation/export|별도 staging/백업 IO|staging 검증/원본 hash|공통 native 보장 없음|배포/운영 절차에 의존|BLOCKED 실행 동결·범위 검증 필요, 미실행|
|.local 운영/진단 후보29파일|직접 query 또는 admin API/스토리지|도구별, native 계약으로 일괄 인증되지 않음|자동 보장 없음|DB 권한/트리거·운영 절차에 의존|BLOCKED: 파일 목록만으로 동시 실행·권한 준수를 보장하지 않음, 전부 미실행|

**모든 writer의 native 전환/준수 검증 완료 조건은 불충족이다.** 특히 일반 대화/계정 복구/cleanup을 막는 장벽이 존재한다는 이유로 활성화 가능이라고 판단하면 안 된다. 운영 도구는 임의 SQL 권한을 가진 신뢰 경계이며 이를 미검증 상태로 두고 전수 준수를 주장하지 않았다.

## 5. D — Cleanup 보장의 경계

- PASS: 기존 inactive cleanup은 모의 delete 실패 후 retry journal로 재시도했으며 공유 원본은 보존했다(D04).
- FAIL: active 분기에서30일 내 restore와 due cleanup은 실제 제품 함수 기준 작동하지 않았다(D01/D02). 손실 없이 거절된 것과 삭제/복구 정책을 완수하는 것은 다르다.
- FAIL: 이미 나간 v1 편집 응답은 CF metadata 충돌 시 fresh candidate를 지운다(D03). 모델을 자동 재호출하지 않았고 원래 Starter와 pending 비용은 남았다.
- BLOCKED: 최종 삭제 직전 admission과 실제 native 결과 finalize의 동일 transaction fencing, 외부 late PUT 격리/재조회, 원래 A 계정의 결과를 실제 finalizer가 보관하는 전체 경로. B10의 eligibility 조회만으로 증명할 수 없다. 실제 native result writer는 아직 없다.
- NOT TESTED: 실제 회원 복구·삭제, 실제 Tigris 재시도/late PUT, remote cron, native 결과 persistence/승인(B11/B12 제외). 실제 계정/미디어는 변경하지 않았다.

## 6. E — Migration 및 D1 정적 검토

E03/E04 PASS는 현재 코드+로컬 DB에서 기본 OFF, 빈 native table, FK/index/unique/canonical units CHECK를 확인한 결과다. source schema를 재생성하거나 old row를 변환하지 않았다. **raw SQL 재실행 FAIL과 관리 도구를 통한 migration history 재실행 BLOCKED는 구분한다.** 이전9열 loader 재현 실패도 준비 릴리스 순서를 검증해야 하는 이유다.

공개 공식 문서와 정적 대조(실환경 호환 PASS 아님):

|항목|정적 근거|실제 환경 검증 상태|
|---|---|---|
|batch rollback|D1 batch는 한 sequence의 실패 시 전체 rollback을 설명한다. [D1 Database API](https://developers.cloudflare.com/d1/worker-api/d1-database/)|BLOCKED: 실제 guard 실패·trigger 오류·동시 요청을 D1에서 실행하지 않음|
|정수/driver|D1 내부 signed64와 binding의 BigInt 미지원·Number safe integer 한계가 명시돼 있다. 큰 units는 string bind/TEXT read로 설계됐다. [Workers Binding API](https://developers.cloudflare.com/d1/worker-api/)|BLOCKED: 실제 binding round trip·error shape·nonfinite 처리 미검증|
|SQL/PRAGMA/JSON/시간|D1은 SQLite 기반이며 schema/foreign_key/index/trigger 관련 PRAGMA를 문서화한다. 본 코드는 CAST/SUM/CASE/json/strftime/julianday 사용. [SQL statements](https://developers.cloudflare.com/d1/sql-api/sql-statements/)|BLOCKED: 실제 runtime SQL/JSON 버전·날짜 경계·native transaction 격리 미검증. B02는 가상 clock fixture임|
|FK/cascade|D1 FK/삭제 cascade 동작을 문서화한다. [Foreign keys](https://developers.cloudflare.com/d1/sql-api/foreign-keys/)|BLOCKED: 새 schema와 실제 cleanup batch의 상호작용 미실행|
|migration history|Wrangler는 d1_migrations로 적용 이력을 관리한다. [Migrations](https://developers.cloudflare.com/d1/reference/migrations/)|BLOCKED: 실제 backup/row-count/FK 및 준비 릴리스·중단/재실행 절차 미검증|

SQLite/sql.js의 성공을 Cloudflare D1 실행 성공이라고 표현하지 않는다. 이번 외부 접속은 공개 문서 읽기뿐이며 원격 DB에는 접속하지 않았다.

## 7. 실행 결과 상세

검사는 성공/실패를 수집하는 감사 하네스다. runner 종료 code0은 안전 조건 통과가 아니며 아래 FAIL을 그대로 보존한다. 최종 집계 확인은 FAIL이 있으면 nonzero를 반환한다.

|ID|판정|검사 및 결과|
|---|---|---|
|A01|PASS|650 exact decimal samples and SQL integer text transport, no Number multiplication — {"samples": 650, "exceedsNumberSafeInteger": true}|
|A02|PASS|I64 aggregate overflow is explicit and rolls back admission rather than wrapping — {"jsRejected": true, "sqlOverflow": true, "jobs": 0}|
|A03|PASS|Uncertified and >14-place stored costs are explicit failures, never free quota exhaustion — {"status": 503, "amountRetained": 1e-15}|
|B01|PASS|Extended SQL/JS corpus: decimal costs, failed/unknown/retry pools, historical correction and zero refunds — {"corpus": 192, "allStatesChargedUnlessZero": true}|
|B02|PASS|Virtual midnight between JS check and SQL guard rejects new allocation; duplicate operation crosses day without recharge — {"virtualClock": true, "jobs": 1, "duplicateNewReservation": false}|
|B03|FAIL|A duplicate operation remains reusable after character is unpublished — POST duplicate rejected with character_not_published; GET still finds original job + actual - expected  + 'character_not_published' - undefined |
|B04|FAIL|Existing settlement/refund writers keep same-ledger raw cost and certified units coherent — after settlement raw=1, units=10000000000000000; after refund raw=0, units=10000000000000000; native precheck would block mismatch + actual - expected  + '10000000000000000' - '0' |
|B05|FAIL|Finite but extreme usage cannot overflow settlement into a nonfinite stored budget — stored raw cost=Infinity; multiplication overflow was not rejected|
|B06|PASS|Four concurrent requests: duplicate identity and a one-unit budget edge match exact integer admission — {"requests": 4, "jobs": 2, "remainingUnits": "1", "sameOperationReused": true}|
|C01|FAIL|Native HTTP world save enforces the existing member Starter ownership/integrity policy — HTTP 200; dangling Starter=true, head hash unchanged|
|C02|FAIL|Native HTTP world save validates sidecar JSON as the legacy member API does — HTTP 200; invalid progress persisted  200 !== 400 |
|C03|FAIL|A current typed world revision cannot be advanced beyond Number.MAX_SAFE_INTEGER — stored revision=9007199254740992, response error=Value is too large to be represented as a JavaScript number: 9007199254740992 + actual - expected  + '9007199254740992' - '9007199254740991'                   ^ |
|D01|FAIL|30-day recovery remains available through the existing writer in native mode — recovery blocked: Concurrent change or expired authorization; retry after refreshing.; data retained but recovery unavailable + actual - expected  + 'deletion_pending' - 'active' |
|D02|FAIL|Legacy cleanup cannot fulfill final deletion in native mode — owner retained; Native writer required; legacy media writes are paused.  1 !== 0 |
|D03|FAIL|A pre-cutover in-flight image result is preserved durably instead of deleted on a stale metadata flush — HTTP 409; candidates=0; root=pending; original retained=true  0 !== 1 |
|D04|PASS|Cleanup retry recovers a partial media deletion in inactive mode without deleting shared originals — {"retrySucceeded": true, "sharedPreserved": true}|
|E01|FAIL|Unconditional migration SQL rerun is idempotent — raw rerun error=duplicate column name: reserved_units; requires external PRAGMA-aware runner + actual - expected  + 'duplicate column name: reserved_units' - undefined |
|E02|FAIL|Pre-B10 9-column compatibility view can load migrated existing ledger rows while native is OFF — pre-B10 loader fails: table workers_ai_requests has no column named reserved_units + actual - expected  + 'table workers_ai_requests has no column named reserved_units' - undefined |
|E03|PASS|Current compatibility view opens migrated schema with empty native tables; not a browser or previous Worker test — {"currentView": true, "nativeDefaultOff": true}|
|E04|PASS|Migration indexes/FKs, canonical integer constraint, fresh-row preservation and default-off control — {"uniqueIndexes": ["owner_id,world_id,operation_id", "ledger_id", "id"], "foreignKeys": 4, "invalidUnitsRejected": 4, "nativeDefaultOff": true}|

B02 최초 하네스는 SQLite strftime을0인자로 등록해2인자 실제 호출을 바꾸지 못했다. 임시 fixture의 함수 arity만 수정하고 B02 하나를 다시 실행해 PASS를 확인했다. 제품 코드/기존 테스트/assertion은 수정하지 않았다. 초기 `audit.log/results.json`도 보존한다. E03의 초기 설명이 populated case까지 포함하는 듯했으나 실제 evidence는 빈 native table만이므로 그 범위로 보고했다.

실행물: `audit.mjs`, `audit.log`, `results-final.json`, `b02-retest.log`, `b04.log`, `b05.log`, `b06.log`, `e04.log`, `ledger-precision.json`, `precision-expanded.json`, `provider-precision.json`, `operator-inventory.json` — 모두 `/tmp/beyond-b10-preactivation-iafs5qyv/`.

## 8. 활성화 전 필요한 별도 작업 — 이번에 수행하지 않음

1. native world 저장의 소유 자산/Starter·head 일관성·sidecar JSON 검사, revision 증분 상한 및 동일 operation 조회 의미를 보완하고 격리 재검증.
2. 모든 reserve/settle/refund writer의 raw/units 동기화 또는 인증 무효화 계약과 usage 정수/overflow 거절을 확정·검증. 현재 원격 ledger 인증 없이 gate를 열지 않음.
3. 일반 대화·계정 관리/30일 복구를 포함한 공통 writer 전환, fenced cleanup와 결과 저장 경로·기존 in-flight drain/복구 증거 마련. B11/B12는 이번 감사에서 구현하지 않음.
4. 실제 배포 binary 확인 후 새 schema 읽기 준비 릴리스→승인된 migration 절차·backup/FK/row-count→별도 실제 D1 검증 순서 검토. raw ALTER를 무조건 재실행하거나 DB barrier를 풀어 old writer를 재개하지 않음.

원격 검증·실제 provider·배포·활성화·정책 변경은 이번 실행에서 NOT TESTED이며 승인하지 않았다. 제품 수정이 필요한 문제도 그대로 남겼다. 보고서와 STATUS/NEXT_SESSION 인계만 작성한 뒤 중단한다.

**NOT READY — BLOCKERS REMAIN**
