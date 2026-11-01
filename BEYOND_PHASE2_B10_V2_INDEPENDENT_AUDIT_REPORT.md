# BEYOND B10 V2 Independent Audit

2026-11-02 (Asia/Rangoon). **검증과 신규 보고서 작성만 수행했다.** 실제 AI/D1/Tigris/배포 환경에는 접근하지 않았다.

## 1. 시작 상태 및 보존

- branch `main`, HEAD `f4585907ecb8158eafd61cc769c4c31e94d102c0` (`origin/main`과 같은 HEAD). 시작 Git status296개 항목, tracked+untracked 파일322개. 기존 dirty/untracked를 그대로 검사했다.
- 기준: `BEYOND_PHASE2_B10_RE_AUDIT_REPORT.md`, `BEYOND_PHASE2_B10_FAIL_REMEDIATION_REPORT_V2.md`, AGENTS, 관련 계약/소스/SQL/migration/기존 테스트. 보고서의 “FIXED” 문구 자체를 PASS 근거로 쓰지 않았다.
- 증거: `/tmp/beyond-b10-v2-audit-gsbmbt2o`. `baseline.json` SHA-256, `status.txt`, `identity.txt`, 파일별 테스트 로그/`test-results.json`, `frontend.json`, `independent.mjs/independent.json`, `revision-auth.json`, `legacy-http.json`, writer 검색 결과를 보관했다.
- 저장소에는 본 보고서만 새로 작성한다. 기존 코드/테스트/assertion/schema/migration/config/인계 문서는 수정하지 않았다. 최종 hash 비교는 `preservation.json`과 `final-status.txt`에 기록한다.
- 실제 사용자/세계/이미지/대화 변경0. mutable 데이터와 PUT/DELETE는 disposable TestD1/sql.js/TestMedia fixture였다. fixture의 active1은 격리된 분기 검증이며 운영 활성화가 아니다. Git commit/push/merge/branch/reset/clean/checkout, B10 활성화, Preview/Production 배포 모두0.

## 2. 판정 요약

**판정 단위32개: PASS21 / FAIL3 / BLOCKED6 / NOT TESTED2.** V2 대상6개 + 기존 PASS18개 + 원격 gate6개 + 미실행2개를 센다. 테스트 등록 수나 writer 표의 부분 판정을 다시 합산하지 않는다.

- V2 대상: **PASS3(F01/F05/F06의 현재 로컬 경로), FAIL3(F02/F03/F04)**.
- 기존 PASS18개의 기존 검증 범위는 유지됐다. 새로운 반례가 드러낸 더 넓은 불변조건을 기존 좁은 assertion 통과로 덮지 않았다.
- 기존 V2 회귀15개는 모두 통과했다. 그러나 독립 반례4건이 세 범주의 누락을 확인했다. HTTP로 재현한 문제와 내부 helper/adapter의 방어 누락을 구분한다.
- 따라서 실제 서비스 활성화 준비 완료로 판정하지 않는다.

## 3. V2 FAIL6개 독립 검증

|항목|실제 코드/검증|판정·미해결 부분|
|---|---|---|
|F01 proof|`workers-ai.mjs:reserve/assertCostProof/writeCost/settleText/workersImage`, `b10-foundation.mjs:admit`를 확인. 이미지도 raw/proof transaction 사용. raw UPDATE trigger가 proof를 지운 뒤 같은 transaction에서 정확한 proof를 갱신. 기존 cache/job은 identity와 proof 검증. V2 N01/F01-extra/F01-native, 기존 B04/R04/R07와 독립 P01 PASS.|**PASS**, migration된 로컬 경로. 성공 proof 누락/불일치는 재생성/추정 없이 거절, 비용 중복 가산 없음. 과거9열 schema에 certification table이 없으면 legacy read 동작이 남으므로 live 전수 인증까지 의미하지 않음(RB01).|
|F02 JSON|`b10-json-schema.mjs:nestedWorld/nestedSidecar`, `b10-validation.mjs:validateNativeJSON`, 실제 `userWorldAPI`/native PUT을 대조. 기본 중첩 key/배열/길이/role/task/깊이 검사는 통과했으나 `sourceUrl` 자료형과 sidecars wrapper 검사는 누락.|**FAIL**. J01 실제 native PUT가 `character.sourceUrl=false`를200으로 저장. J02 wrapper의 symbol/accessor를 거절하지 않고 getter2회 평가. 후자는 일반 HTTP JSON으로 표현할 수 없는 내부 JS 계약 결함임.|
|F03 revision|legacy endpoint의 safe bound, global cf_state CAS, 최종 adapter 검사를 확인. 기존 N03/F03-all/R09/stale snapshot tests는 PASS. 그러나 `d1-store.flush` line94~101은 특정 UPDATE만 검사한다.|**FAIL**. R01: 유효한 member authorization을 켠 adapter에서 unsafe version을 담은 `INSERT INTO user_world_revisions`가 commit. 현재 public world endpoint는 별도 입력 검사를 하므로 이 endpoint에서 MAX 입력이 다시 통과했다는 뜻은 아님. 최종 공통 검증의 INSERT 누락.|
|F04 generation|dense map의 type/cap/unique/count/각 world-generation CAS, `canFinalizeResult`, cleanup bridge bound를 확인. 기존 N04/F04-extra/recovery 경쟁 PASS.|**FAIL**. G01의 sparse `Array(1)`은 some/map/flatMap에서 hole이 건너뛰어져 generation CAS가 사라지고 count guard만 남음. 내부 helper가 MAX_SAFE_INTEGER를9007199254740992로 증가시켰다. 공개 HTTP cleanup endpoint 취약점으로 주장하지 않음.|
|F05 reservation|`reserve`가 열린 caller transaction을 먼저 거절. ledger/proof staging을 own transaction으로 묶고 실패 시 memory/captured writes rollback. native admission은 job/ledger/proof/guard를 같은 batch에 저장.|**PASS** 로컬. V2 N05/F05-parent, 기존 same-op/concurrent/UTC/1-unit 및 partial job failure tests PASS. 후속 flush가 proof 없는 ledger를 남기던 원래 조건은 거절됨. 실제 D1은 RB02.|
|F06 late result|`hasUnresolvedResults`, cleanup claim의 SQL pending guard, `resultGeneration/assertResultOwner/failOwnedResult`, `worldEditsAPI`의 PUT 전 확인·storage-uncertain 경로, final financial pseudonymization을 확인.|**PASS** 현재 로컬 legacy 경로: dispatch pin→삭제 보류→deadline/generation 거절→PUT0→비용/proof 유지→안전한 final purge. Unknown PUT는 pending/recoveryRequired로 유지. Native dispatcher 전이/실제 Tigris/구 Worker까지 PASS인 것은 아님(NT02/RB03/RB04).|

## 4. 독립 반례와 진입 경계

모든 새 probe는 /tmp에서 실행했으며 기존 테스트 파일을 바꾸지 않았다. `independent.json`: PASS3/FAIL4, external fetch0. collector exit0은 증거 수집 성공이지 safety PASS가 아니다. R01 authorization 추가 확인도 같은 FAIL이며 `revision-auth.json`에 보존했다. 정상 history JSON까지 그대로 사용한 재확인도 같은 FAIL이다(`revision-auth-valid.json`).

|ID|재현 및 원인|실제 결과|경계/영향|
|---|---|---|---|
|J01|실제 `makeCharacter` 생성 후 `sourceUrl=false`. `validGraph`는 `sourceUrl===undefined || !sourceUrl || safeURL(...)`라 false를 허용하고 server nestedWorld는 key만 검사. 실제 validWorld/native API 사용.|frontend model validator true, native PUT200, 저장 version2, JSON sourceUrl=false.|실제 JSON HTTP payload로 재현. string이어야 하는 world metadata가 type을 위반한 채 저장됨. F02에 포함.|
|J02|sidecars 자체에 Symbol key 또는 enumerable progress getter를 추가하고 `validateNativeJSON` 호출. visit는 world와 parsed sidecar 값에만 적용됨.|symbolRejected=false, accessorRejected=false, getterCalls2.|내부 JS 함수 계약의 누락. HTTP JSON에는 accessor/symbol을 실을 수 없으므로 외부 코드 실행으로 과장하지 않음. F02에 포함.|
|G01|owner due/phase cleaning/head generation MAX_SAFE_INTEGER fixture에서 `fenceDueCleanup(owner,{expectedGenerations:Array(1)})` 호출.|오류 없음. 저장 generation9007199254740992.|내부 helper의 sparse map 반례. hole 하나인 map은 Set size도 length1과 같아 통과; 개별 CAS도 생성되지 않음. 정상 SQL 조회 map은 dense이지만 “모든 항목 검사” 계약은 미충족.|
|R01|실제 openD1Store로 FK가 유효한 owned world의 revision 행에 unsafe version을 INSERT하고 flush. member authorization도 켜서 재검증.|오류 없음. 저장 revision9007199254740992.|최종 adapter 방어층이 INSERT를 검사하지 않음. public endpoint의 기존 guard를 우회하는 HTTP SQL 주입을 재현한 것은 아님. import/신규 내부 writer의 안전성을 공통 계층만으로 보장할 수 없음.|

기존 결함 조건 N01~N05의 통과가 위 새로운 계약 누락을 제거하지 않는다. 이번 작업에서는 어떤 수정도 하지 않았다.

## 5. 기존 PASS18개 재실행

아래 ID는 기존 `b10-remediation.test.mjs`/`b10.test.mjs` 및 해당 handler tests의 실제 assertion 범위다. 전부 **PASS**. current F02/F03/F04의 새 반례와 혼동하지 않는다.

|ID|확인 내용|판정|
|---|---|---|
|C01|자산 소유/ready/file/hash/format 및 비동기 후 asset CAS, 무변경 거절|PASS|
|C03|native world/global revision 상한과 거절 시 원본 보존|PASS|
|B03|동일 owner/world/operation/hash 재사용, publication 변경 후 중복 예약0|PASS|
|B05|BigInt text 정산 overflow/음수/비정상 usage 거절, 원래 비용 유지|PASS|
|D01|30일 내 암호 recovery/admin restore/새 session/stale credential 거절|PASS|
|D02|active cleanup 정상 경로·retry·최종 tombstone; dispatch pin 포함 기존 범위|PASS|
|D03|metadata 충돌 후보/manifest 보존 및 승인 전 원본 유지|PASS|
|E01|migration0006 로컬 rollback/reapply/idempotence|PASS|
|E02|9-column ledger/재구성 old loader 및 현재 adapter 호환|PASS|
|A01|650개 decimal/BigInt/INTEGER TEXT boundary samples|PASS|
|A02|JS/SQL SUM signed64 overflow 거절 및 batch rollback|PASS|
|A03|미인증·14자리 초과 비용503, 임의 refund/한도 소진 오표시 없음|PASS|
|B01|192개 상태·pool·history correction SQL/JS corpus|PASS|
|B02|가상 UTC 자정 입장 guard/기존 operation 재예약0|PASS|
|B06|동시4요청/중복 operation/jobs2/ledger2/잔여1 unit exact parity|PASS|
|D04|inactive cleanup storage 부분 실패/retry/shared 원본 보존|PASS|
|E03|empty native schema/현재 adapter/default-off|PASS|
|E04|FK/index/unique/canonical integer proof constraints|PASS|

A07은 frontend account-context18개 및 관련 backend ownership 테스트가 PASS. A09는 기존 edit-contract/companion 계약 및 actionType 거절 테스트가 PASS. original/approved image hash, mask 밖 변경0, 승인 replay/재로그인·재조회는 기존 user-accounts/world-edits 회귀가 PASS. 실제 browser/실제 AI 생성 결과로 표현하지 않는다.

## 6. v1/v2 JSON 및 비용 경로

### JSON

- 독립 `legacy-http.json` J04 **PASS**: 실제 `world.version=1`/graph 없음, partial progress와 companion description 생략을 legacy PUT가 정상 수용하고 raw history 문자열을 그대로 보존. v1에 malformed graph를 붙인 다음 요청은400, data/version 동일.
- 독립 J03 **PASS**: 정상 v2 core fields, v1 partial, v2 필수값 누락 거절, unknown key/array 항목/메시지 role/task enum/Infinity 좌표/오염 key 거절.
- depth32, 전체512KiB, string12000 및 각 배열 cap은 기존 R02/V2 F02-extra/reader tests와 코드에서 확인했다. generic number finite 검사와 도메인 좌표 범위가 있으며 rotation/layer/scene 좌표의 합법적 음수까지 금지하지 않는다.
- 다만 기본 model validator에 위임한 scalar가 실제로 모두 엄격하지 않고(J01), wrapper 전체가 visit되지 않는다(J02). 따라서 “모든 중첩 입력 검사”는 FAIL이다. 기존 read를 지우거나 migration으로 재작성하지는 않는다.

### 예약·정산·환불

|경로|실제 비용 처리|판정/한계|
|---|---|---|
|일반 chat/plan/understand 및 Companion chat|reserve→runAI→settleText→status, raw/proof는 공통 transaction; missing usage는 기존 예약 유지|PASS 현재 로컬 경로|
|Companion 도구 관찰/clarify/inspect|provider 호출 없이 applied=false, 생성/저장 성공을 가장하지 않음|PASS 기존 companion tests|
|관리자 character image workersImage|이미지 성공도 writeCost 사용; trigger로 지운 proof를 같은 transaction에서 갱신|PASS N01 재실행|
|Klein world edit|고정 image pool 예약, mask 합성, 후보/manifest 저장; 승인 전 world 원본 유지|PASS mock; 실제 provider/Tigris BLOCKED|
|기존 성공/pending cache 및 native job 재사용|identity/proof 검증, 누락·불일치 거절, 추정 repair 없음|PASS 독립 P01 및 V2 F01-extra/F01-native|
|확인된 미실행 image/model refusal|releaseUnstarted가 raw/proof0을 같이 갱신|PASS 기존 image-budget/R04|
|실패/timeout/결과 불명|확정할 수 없는 비용 유지. text catch는 보수적 예약 유지. storage PUT 불명은 pending/recoveryRequired|PASS 현재 정책 범위; 실제 청구는 RB01|
|중복/동시/UTC|단일 ledger, 동일 operation 재예약0; native SQL 조건과 JS exact units 일치|PASS B02/B06/기존 B10 tests|
|candidate reject/취소|소비된 이미지 비용을 임의 환불하지 않음. 실행 중 임의 재호출 없음|PASS 현재 v1 경로|
|native cancel/expire/dispatch settlement|schema 상태만 있고 runner 없음|NOT TESTED NT02|
|final member purge|actor hash+비용/proof/status 유지, private response 제거;31.42의 financial-only model/crop correction 보존|PASS V2 F06-cost; 실제 정책 운영/보관은 원격 gate|

Migration은 기존9열 ledger를 유지하고 per-row precision proof/view를 붙이며 새 counter를 만들지 않는다. raw REAL 자체의 모든 decimal 왕복을 보장하지 않는다. JS precision precheck/SQL integer CAST/큰 TEXT read를 구분하며 실제 ledger 전수 인증과 D1 driver는 여전히 BLOCKED다.

## 7. Legacy writer 전수 경로 검토

관련 SQL mutation/flush와 frontend 호출 검색은 `writers.txt`, `frontend-writers.txt`. 아래 표는 도메인별 묶음이며 “정상 경로 PASS”를 전체 활성화 허용으로 해석하지 않는다.

|Writer|실제 경로/보호|결과|
|---|---|---|
|User World create/update|userWorldAPI→adapter; safe input version, asset/JSON 검증, global+world CAS|PASS 정상 요청; common INSERT defense gap R01 별도|
|일반 대화/WorldAdventure 저장|persistSidecar→User World|PASS 기존 범위; native UI 전환은 미구현|
|WorldCompanion commit/send/choose|동일 member world API/context|FAIL 전체 JSON 계약 J01/J02; 기존 정상 대화는 PASS|
|WorldCompanion/WorldImageEditor generate/approve/reject|v1 edit ledger/parent/source guard, legacy flush|PASS mock preservation; native numeric apply/receipt는 NT02|
|WorldEditor/SpiritEditor|회원 world API, admin local updatedAt|PASS 기존 CAS; browser runtime NT01|
|Starter copy|owned image snapshot/hash→asset→member world|PASS 기존 보존; 실제 asset PUT RB03|
|Asset pending/ready upload|owned ID/hash/global CAS; numeric world revision 없음|PASS metadata tests; 별도 in-flight storage race 실제환경 RB03/RB04|
|persistSidecar/retryPending/importLegacy|같은 member world writer/requestId/context|부분 PASS; unknown JSON은 새 validator에 의존, J01 누락 존재|
|BackupControls/worldBackup restore/import|IDB와 member world version|PASS unit 계약, browser NT01/native 전체 이관 미구현|
|browser worldStore/cache/IDB|scope/epoch/updatedAt; D1 numeric revision 아님|PASS unit; 실제 browser NT01|
|admin editorial worlds/discoveries/settings/connections/revisions|generated API→adapter; individual version/global CAS|PASS 정상 UPDATE; INSERT guard 일반화는 FAIL R01|
|central characters edit/archive/delete|공통 adapter/version+auth/global CAS|PASS 기존 server/Cloudflare tests; raw operator는 RB06|
|managed images save/upload/cleanup|row version+1/immutable keys/global CAS|PASS mock version paths; 실제 external storage RB03|
|signup/login/reset/settings/logout|user-auth→legacy adapter/auth/credential checks|PASS 현재 inactive 정상 흐름. native-active 일반 account writer 전환 미완료|
|admin member change/recovery/owner recover-deletion|fresh member scope/global/profile/credential/deadline/phase|PASS 로컬 경쟁·암호·session tests|
|native save/seed/admit|직접 guarded binding.batch, adapter를 거치지 않음|PASS 해당 numeric/owner/job contract; JSON은 FAIL J01|
|repository fenceDueCleanup|직접 native batch/map/count/phase|FAIL G01 sparse map. 정상 dense map 테스트 PASS|
|canFinalizeResult|eligibility read; 실제 결과 PUT writer 아님|PASS read bounds; 미래 finalizer NT02|
|scheduled cleanDueMembers|member bridge: pending absence+phase/global CAS/gen cap+owner prefix|PASS 현재 정상/pending/mock races; real worker/storage RB03/RB04|
|failOwnedResult|직접 narrow batch: original actor/id pending만 error, cf_state guard 증가|PASS 현재 로컬; 비용/proof INSERT/추정 repair 없음|
|world-edits PUT/manifest/error|original owner generation 확인, durable pending이 cleanup pin|PASS 현재 mock; unknown PUT는 deletion 보류|
|handler context.created compensation|다른 admin fresh objects만 참조 확인/정리|PASS fixture; 외부 failure race RB03|
|standalone Node store/API|별도 SQLite domain; cf_state adapter 없음|server81 PASS. B10 native 이관 증거로 쓰지 않음|
|migrate/import/staging/direct SQL/.local 운영 도구|adapter 밖 trusted IO/SQL 가능|BLOCKED RB06. 실행하지 않았으며 범위/권한 동결 미입증|
|universe/read-api|read-only|PASS 기존 read tests; writer 아님|

`src`에 native-worlds/native-jobs 호출은 발견되지 않았고 wrangler 설정에 BEYOND_B10_LOCAL_ENABLE opt-in도 발견되지 않았다. 일반 UI/native cutover 완료로 판정하지 않는다. 원격 actual flag를 조회한 것은 아니며 이번에 flag/schema/설정을 변경하지 않았다.

## 8. Cleanup / late result / NOT_DISPATCHED

- 기존 V2 F06/F06-generation/F06-storage/F06-cost가 모두 PASS: durable pending 중 purge 보류, due/phase/generation 불일치에 PUT0, 원 actor/error/비용 유지, unknown PUT recoveryRequired, shared/Starter 보존, final financial proof 유지.
- 정상 grace 중 session 만료만으로 결과를 다른 계정에 귀속하거나 삭제하지 않는다. 서버가 사용하는 owner는 요청 시작 시 session에서 고정된다. 최종 PUT 전에 실제 owner/world/profile/deadline/generation을 조회한다. D1 row 삭제 후 부활을 위한 INSERT는 없다.
- **운영상 제한:** unconfirmed dispatch/PUT가 남으면30일 이후에도 삭제가 보류될 수 있다. 자동 만료·자동 추정 환불·자동 provider 재호출·강제 orphan 삭제는 없다. 이 제한은 해결됐다고 표시하지 않는다.
- 독립 D01: pending ledger에서 job이 `QUEUED + NOT_DISPATCHED`일 때만 pin=false. `RUNNING + NOT_DISPATCHED`, `QUEUED + DISPATCHED`, `SUCCEEDED + COMPLETED`인데 ledger pending이면 모두 pin=true. 수동 fixture 상태 변경으로 predicate를 검증한 것이지 실제 dispatcher를 실행한 것이 아니다.
- legacy AI는 reserve를 먼저 durable flush한 후 runAI를 호출하여 보수적 pending pin이 있다. **native provider dispatch 구현은 없고**, state_version/provider_phase는 foundation metadata다. 현재 QUEUED job이 실제 AI로 실행되었다는 코드/증거는 없다.
- **향후 필수 gate:** provider 호출 전에 owner/profile/world/generation 및 job state-version을 CAS하고 dispatch marker/state를 같은 D1 transaction으로 내구 저장해야 한다. cleanup이 먼저 claim하면 dispatch CAS는 실패해야 하고, dispatch가 먼저 commit되면 cleanup은 pin되어야 한다. 불명 결과를 QUEUED/NOT_DISPATCHED로 되돌려 pin을 해제해서는 안 된다. 실제 D1 경쟁/Worker 종료 검증이 필요하다.
- 위 미래 전이의 원자성은 NT02이며 별도 승인 없는 B11 구현으로 메우지 않았다. 실제 Tigris timeout/late PUT 및 구 Worker가 이 fence를 준수하는지는 RB03/RB04다.

## 9. 테스트 파일별 실제 실행 결과

기존 파일/내용을 바꾸지 않고 각 Node entry file을 별도로 실행했다. exit는 모두0, fail/skipped/cancelled0. **import되는 공통 test가 반복 등록되는 기존 구조**를 숨기지 않는다.

### Cloudflare

|Entry file|실행 PASS/전체|
|---|---|
|`cloudflare/tests/ai-limit.test.mjs`|19/19|
|`cloudflare/tests/b10-remediation.test.mjs`|32/32|
|`cloudflare/tests/b10-v2.test.mjs`|15/15|
|`cloudflare/tests/b10.test.mjs`|15/15|
|`cloudflare/tests/cloudflare.test.mjs`|17/17|
|`cloudflare/tests/companion-actions.test.mjs`|20/20|
|`cloudflare/tests/companion.test.mjs`|19/19|
|`cloudflare/tests/edit-contract.test.mjs`|20/20|
|`cloudflare/tests/image-budget.test.mjs`|18/18|
|`cloudflare/tests/image-cpu.test.mjs`|21/21|
|`cloudflare/tests/managed-images.test.mjs`|19/19|
|`cloudflare/tests/member-management.test.mjs`|21/21|
|`cloudflare/tests/read-api.test.mjs`|21/21|
|`cloudflare/tests/tigris.test.mjs`|4/4|
|`cloudflare/tests/user-accounts.test.mjs`|21/21|
|`cloudflare/tests/world-edit-provider.test.mjs`|19/19|
|`cloudflare/tests/world-edits.test.mjs`|20/20|

위 전체는 **321/321 등록 실행 PASS**다. 로그의 서로 다른 subtest 제목은109개다(제목 중복 제거는 완전한 semantic test 동일성 판정이 아니지만 공통 등록 중복을 드러낸다).321개를 모두 서로 다른 독립 시나리오라고 표현하지 않는다.

- 기존 관련8파일 합계 **166/166**도 위 실행에 포함된다. 서로 다른 subtest 제목은81개. 별도166회를 더했다고 합산하지 않는다.
- `b10-v2.test.mjs` **15/15**, `b10-remediation.test.mjs` **32/32**, 그 안의 original audit IDs **20/20**는 중첩 집합이다. 별도 합산하지 않는다. SUMMARY의 external fetch0도 확인했다.
- 각 Node 로그는 `test-results.json`의 log 필드에 있으며 stdout/stderr 원문을 보존했다.

### Server

|Entry file|실행 PASS/전체|
|---|---|
|`server/tests/admin.test.mjs`|33/33|
|`server/tests/ai-images.test.mjs`|7/7|
|`server/tests/cloud-migration.test.mjs`|11/11|
|`server/tests/edge-admin.test.mjs`|9/9|
|`server/tests/env-loading.test.mjs`|3/3|
|`server/tests/initial-setup.test.mjs`|5/5|
|`server/tests/migration-batch.test.mjs`|13/13|

Server 합계 **81/81 PASS**. 별도 Node DB/로컬 HTTP 테스트이며 실제 Preview 검증이 아니다.

### Frontend

|파일|PASS/전체|
|---|---|
|`src/tests/account-context.test.ts`|18/18|
|`src/tests/admin-i18n.test.ts`|1/1|
|`src/tests/ai-errors.test.ts`|2/2|
|`src/tests/apiResponse.test.ts`|3/3|
|`src/tests/backup.test.ts`|4/4|
|`src/tests/companion-actions.test.ts`|1/1|
|`src/tests/companion-intent.test.ts`|1/1|
|`src/tests/spiritModel.test.ts`|4/4|
|`src/tests/universe.test.ts`|9/9|
|`src/tests/uploads.test.ts`|3/3|
|`src/tests/worldDiscoveryProgress.test.ts`|12/12|
|`src/tests/worldStore.test.ts`|4/4|

**62/62 PASS**,12 files. 파일별 결과를 확보하기 위해 JSON reporter로 한 번 재실행했으며 처음62개와 합쳐124개로 부풀리지 않았다. `frontend.json`을 최종 표 근거로 사용한다.

### Build/typecheck 및 독립 검사

- `tsc --noEmit && vite build --outDir /tmp/beyond-b10-v2-audit-gsbmbt2o/build --emptyOutDir`: exit0. 기존 dist를 덮어쓰지 않았다. bundle500kB warning만 존재.
- 독립 scratch probes: J01/J02/G01/R01 FAIL, P01/D01/J03 PASS; 추가 실제 legacy HTTP J04 PASS. R01 valid-member authorization 재확인도 같은 FAIL. 이들은 기존 테스트와 별개이며 성공 테스트 수에 합산하지 않는다.
- collector는 원문 실패와 details를 JSON에 남긴다. 그 exit0을 테스트 PASS로 오표시하지 않았다. 실제 AI/provider·external fetch는0, 모든 PUT/DELETE는 mock이다.

## 10. 원격 BLOCKED / 미실행 판정 단위

|ID|항목|판정|
|---|---|---|
|RB01|현재 운영 ledger 전체 비용 정밀도·certification/실제 Neurons|BLOCKED: 원격 조회 금지. 로컬 fixture로 전수 인증하지 않음.|
|RB02|실제 D1 batch/transaction/trigger/FK/INTEGER driver/migration rollback|BLOCKED: SQLite/sql.js/TestD1 결과만 존재.|
|RB03|실제 Tigris timeout/늦은 PUT/immutable 조건/부분 실패|BLOCKED: mock만 사용, 실제 PUT/DELETE 금지.|
|RB04|배포된 구 Worker binary와 기존 in-flight 및 실제 dispatch|BLOCKED: 배포/실제 모델/원격 환경 접근 금지. 구 binary가 새 fence를 준수한다고 주장하지 않음.|
|RB05|Workers Free CPU/crypto/large snapshot 성능·실제 사용량/비용|BLOCKED: 로컬 처리 시간은 실제 Worker·청구 근거가 아님.|
|RB06|direct SQL/import/운영 automation writer 권한·동결·전수 준수|BLOCKED: source 경계만 확인, 현재 운영 실행 상태/권한 미확인.|
|NT01|실제 browser/IndexedDB·desktop/mobile·재접속 전체 흐름|NOT TESTED: frontend unit/backend fixture만 실행.|
|NT02|미래 native dispatcher atomic transition/lease/recovery/receipt/apply/UI 전체|NOT TESTED: B11/B12/I20/T30 미구현·이번 금지 범위.|

## 11. 차단 조건 및 결론

- F02의 실제 JSON scalar type 누락과 wrapper 검증 누락, F03의 common INSERT revision 검증 공백, F04의 sparse map 우회를 해결·재검증해야 한다. 현재 정상 endpoint 경로가 안전한 부분과 internal helper 방어 결함의 노출 범위를 위 표처럼 구분한다.
- 기존 정상 테스트 통과를 새 반례의 해소로 간주하지 않는다. 코드/기존 assertion을 수정하거나 실패를 성공으로 바꾸지 않았다.
- Native dispatch 전이, 미전환 legacy/auth/upload/UI writer, 원격 gate가 남아 있으므로 기능 활성화 준비 완료 판정을 할 수 없다. 이번에는 보고서 제출 후 중단한다.

**NOT READY — BLOCKERS REMAIN**
