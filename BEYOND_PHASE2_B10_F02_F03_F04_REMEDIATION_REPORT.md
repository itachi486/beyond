# B10 F02/F03/F04 Targeted Remediation

2026-11-02 (Asia/Rangoon). 최신 독립 감사의 세 결함만 수정했다. **B10 활성화 준비 또는 배포 가능 판정이 아니다.**

## 1. 시작 상태·보존

- branch `main`, HEAD `f4585907ecb8158eafd61cc769c4c31e94d102c0`. 로컬 `origin/main` tracking ref와 left/right0/0. fetch/원격 Git 조회는 하지 않았다.
- 시작 tracked/untracked 파일323개, Git status297개 항목. 기존 dirty/untracked를 기준으로 작업했다. `/tmp/beyond-b10-targeted-c65n7051/{baseline.json,status.txt,identity.txt,origin-main.txt}`에 전체 파일명/SHA-256/status/관계를 기록했다.
- 기존 파일 전체 재생성/되돌리기/삭제 없음. 기존 테스트 파일과 assertion은 변경하지 않았다. 제품 수정은 아래4개 파일뿐이다. 신규 회귀 파일과 본 보고서를 추가했다.
- schema/migration/config/frontend/A07/A09/F01 proof/F05 reservation/F06 정책 코드는 변경하지 않았다. 단, 기존 공통 adapter의 최종 revision 검사만 F03 범위에서 보강했다. 실제 계정·세계·이미지·대화 데이터에 접근하지 않았다.
- 실제 AI/원격 D1/실제 Tigris/Worker/실제 브라우저 검증0, Preview/Production 배포/활성화/Git commit·push·merge·branch·reset·clean·checkout0. 모든 mutable 데이터는 disposable TestD1/sql.js/TestMedia fixture였다.

## 2. 독립 재현 전후

스크립트는 기존 감사의 입력·안전 assertion을 그대로 /tmp에 복사하고 출력 경로만 이번 디렉터리로 바꿨다. 기존 감사 증거를 덮어쓰지 않았다. collector exit0은 수집 완료이지 안전 조건 PASS가 아니다. JSON의 status와 details를 확인했다.

|독립 조건|수정 전 실제 재현|수정 후 실제 결과|판정|
|---|---|---|---|
|J01 actual native PUT, character.sourceUrl=false|HTTP200, 잘못된 scalar 저장, version2|HTTP400, 원래 world/version 유지|FIXED LOCALLY / PASS|
|J02 sidecars Symbol/accessor|Symbol/accessor 허용, getter2회|둘 다 거절, getter0회|FIXED LOCALLY / PASS|
|R01 owned history INSERT + 유효 member auth + 정상 history JSON + unsafe version|9007199254740992 commit|예외로 거절, history INSERT 없음|FIXED LOCALLY / PASS|
|G01 Array(1), 기존 generation MAX_SAFE_INTEGER|CAS가 생략되어9007199254740992 저장|invalid_cleanup_generation 거절, 기존 head 유지|FIXED LOCALLY / PASS|

- `before-independent.json`에서 J01/J02/G01/R01 FAIL을 재확인했고 `before-revision-auth-valid.json`에서 유효 authorization 및 정상 history JSON으로 R01 FAIL을 확인했다.
- 동일 `after-independent.json`: J01/J02/G01/R01 모두 PASS, 기존 P01/D01/J03도 PASS. `after-revision-auth-valid.json` R01 PASS. 외부 fetch0.
- `after-legacy-http.json` J04 PASS: 실제 world.version1/partial history/description 생략은 저장되고, malformed v1 graph는 거절되어 기존 data/version이 유지된다.
- 위는 로컬 함수/HTTP handler 검증이다. 실제 Cloudflare D1/Tigris/provider 성공으로 표현하지 않는다.

## 3. F02 — scalar·wrapper

수정: `cloudflare/b10-json-schema.mjs:nestedWorld/nestedSidecar`, `cloudflare/b10-validation.mjs:validateNativeJSON`.

- `sourceUrl`은 optional **string**으로 명시 검사한다. false/number/object/null/array는 허용하지 않는다. URI 값 검사는 기존 실제 validGraph/validWorld 경로와 함께 수행한다. 기존 global string cap12000을 유지해 URL 길이를 새로2048로 줄이지 않았다.
- regex coercion 또는 truthiness가 남은 같은 유형의 metadata에도 타입을 보강했다: fingerprint/Starter 문자열·optional ID/referenceId/task operationId. optional object가 제공된 경우 graph/Starter/rotation을 falsy라서 건너뛰지 않는다. 프런트엔드 모델 코드는 수정하지 않았다.
- sidecars wrapper를 **값을 읽기 전에** 검사한다. plain/null prototype만 허용하고 Reflect.ownKeys+own descriptor로 Symbol/unknown key/accessor/getter/setter/non-enumerable 필드를 거절한다. getter 실행 후 검증하지 않는다. null-prototype의 정상 data wrapper는 허용한다.
- 기존 재귀 world 검사도 graph 접근 전 수행한다. 기존 depth/size/string/배열/중첩 enum 검사는 유지한다. 정상적인 optional 필드 생략, v1 partial progress 및 v1 description 생략 정책은 바꾸지 않았다. 데이터를 자동 보정/삭제하지 않는다.
- 추가 확인 중 `graph:false`, 숫자/array operationId, non-reference content의 boolean referenceId도 같은 F02 누락으로 실제 재현했다(`optional-red.log`: 기존46개 PASS, 이4개 FAIL). 같은 검증 모듈에서 엄격한 존재/타입 검사로 수정했고 새 회귀가 PASS했다.

## 4. F03 — 공통 최종 revision 방어

수정: `cloudflare/d1-store.mjs:flush`만. reservation/late-result/cleanup 정책 함수는 변경하지 않았다.

- 저장된 numeric revision 필드(`version`, `revision`, `credential_version`, `cleanup_generation`)는 **SQLite INTEGER,0~9007199254740991**이어야 한다. 증가하는 global cf_state는 이번 commit 전 **0~9007199254740990**이어야 한다. 문자열 비수치/분수/음수/unsafe 값을 거절한다.
- UPDATE 문자열 패턴에만 의존하던 검사를 제거했다. INSERT/UPDATE/REPLACE/quoted target 등으로 생긴 최종 in-memory 상태의 알려진 revision 필드를 공통 검사한다. valid field0과 MAX_SAFE_INTEGER 자체의 저장은 허용하되 그 이상 증가는 거절한다.
- 실제 `/api/user/worlds`처럼 **history를 selectedTables에서 읽지 않고 쓰는 경로**도 확인했다. 새 회귀에서 중간 구현의 검사 누락을 발견했다(`selected-table-red.log`:40 PASS/2 FAIL). 검사 대상을 seed된 core table 전체로 확장하고, 변경 SQL이 참조하는 revision table의 실제 post-write 값도 **같은 batch의 기존 cf_commit_guards CHECK**로 검사하도록 보강했다.
- post-write guard가 실패하면 해당 batch의 history/다른 metadata/global revision/guard INSERT 전체가 rollback된다. 미로드 UPDATE가 메모리에서0행이라도 실제 DB 값이 잘못되면 commit할 수 없다. 새 table/counter/schema/migration은 만들지 않았다.
- existing global CAS/ready/session/owner/member/native barrier, FK/unique 및 batch 구조는 유지한다. 유효한 member authorization도 잘못된 revision을 허용하지 않는다. readonly 요청의 데이터를 재작성하지 않는다.
- 실제 D1의 query cost/CPU/driver/transaction 호환성은 별도 BLOCKED다. 추가 guard의 실제 Free 성능을 확인했다고 주장하지 않는다.

## 5. F04 — dense generation map

수정: `cloudflare/b10-foundation.mjs:fenceDueCleanup` 내부만.

- map 미지정(`undefined`)일 때만 기존 SQL 조회를 사용한다. 명시적인 null/object/string/Set은 잘못된 map으로 거절한다.
- array 및 length<=20000을 먼저 검사한다. 숫자 index를0부터 끝까지 순회하여 각 index가 **own data element**인지 확인한다. hole·inherited index·accessor는 거절하며 getter를 실행하지 않는다.
- world ID/generation도 own data descriptor에서 한 번 읽는다. generation은 Number safe integer이며0 이상, 증가 전 MAX_SAFE_INTEGER 미만이어야 한다. 잘못된 타입/분수/음수/상한/중복 ID를 거절한다.
- 검증된 값만 별도의 dense 배열로 정규화한다. 이후 map/flatMap은 이 배열에만 적용한다. 실제 owner별 count와 **검증한 모든 world의 개별 generation CAS**는 원래 native transaction/phase/tombstone guard 안에 유지한다.
- 정상2-world map은 양쪽 generation을 증가시키고 SQL에 개별 CAS2개가 생성됨을 확인했다. 나중 world만 stale이어도 전체가 거절되어 첫 world도 바뀌지 않는다. cleanup/recovery 정책 자체는 바꾸지 않았다.

## 6. 테스트 및 diff

### 새 회귀: `cloudflare/tests/b10-targeted.test.mjs`

**50/50 PASS**: F02 20개, F03 15개, F04 15개. 기존 test assertion을 수정/삭제/skip하지 않았다.

- 초기 신규34개를 제품 수정 전에 실행: PASS18/FAIL16(`red-tests.log`). helper scalar/HTTP/wrapper/unsafe INSERT/one-hole·inherited map의 실패를 실제 확인했다.
- 중간 수정 후 추가 미로드 history 사례2개가 FAIL했다. 실제 batch guard 보강 뒤 PASS했다. 실패 로그를 남겼다.
- 같은 F02의 optional scalar 추가4개도 먼저 FAIL을 확인하고 수정했다. 검사 결과를 성공으로 바꾸지 않았다.
- 정상 URL·optional 생략, v1/v2, Symbol/getter/setter/호출0/prototype/중첩 key/type, 정상 INSERT/UPDATE/경계, unsafe/음수/분수/비수치/global cf_state/quoted·미로드 history, batch rollback, 모든 sparse 유형/own index/중복/type/cap/다중 CAS를 포함한다.

### 기존 검사와 최종 결과

|범위|실제 결과/증거|
|---|---|
|기존 관련166개|최종 전체 Cloudflare 실행에 포함, 모두 PASS|
|기존 b10-v2|15/15 PASS|
|기존 b10-remediation|32/32 PASS; original audit20개는 그 안의 중첩 집합|
|기존 b10|15/15 PASS|
|신규 targeted|50/50 PASS|
|직접 관련4파일|최종112/112 PASS(`optional-green.log`)|
|Cloudflare 전체18 entry files|371/371 등록 실행 PASS, skipped0(`complete-suite/test-results.json`)|
|server 전체|81/81 PASS|
|frontend 관련 unit|62/62 PASS,12 files(`frontend.json`)|
|최종 typecheck/build|tsc --noEmit와 Vite build exit0, output은 /tmp/final-build|
|동일 독립 scratch 재현|J01/J02/R01/G01 모두 안전한 거절, P01/D01/J03/J04도 PASS, 외부 fetch0|

Cloudflare371개는 import로 공통 test가 반복 등록되는 기존 구조를 포함한다. 서로 다른 subtest 제목은159개이며, 제목 dedup을 완전한 semantic 시나리오 수로 주장하지 않는다.166/32/20/15/50/112를 모두 합산해 별도 성공 테스트 수로 부풀리지 않았다. 마지막 entry별 Node 결과는 다음과 같다.

|Node entry|PASS/전체|
|---|---|
|`cloudflare/tests/ai-limit.test.mjs`|19/19|
|`cloudflare/tests/b10-remediation.test.mjs`|32/32|
|`cloudflare/tests/b10-targeted.test.mjs`|50/50|
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
|`server/tests/admin.test.mjs`|33/33|
|`server/tests/ai-images.test.mjs`|7/7|
|`server/tests/cloud-migration.test.mjs`|11/11|
|`server/tests/edge-admin.test.mjs`|9/9|
|`server/tests/env-loading.test.mjs`|3/3|
|`server/tests/initial-setup.test.mjs`|5/5|
|`server/tests/migration-batch.test.mjs`|13/13|

Frontend JSON reporter의 실제 합계는62/62다. 기존 browser/e2e는 실행하지 않았다. 빌드는 기존 bundle-size warning만 있고 실패0이다.

### Diff 검사

- 변경 대상이 주로 기존 untracked 파일이므로 `git diff`만으로 이전 내용을 비교했다고 주장하지 않았다. 읽었던 원본을 /tmp 비교본으로 구성하여 **작업 전 baseline SHA-256과4개 모두 정확히 일치**하는지 확인한 뒤 `task.diff`를 생성·검토했다. 실제 제품 파일을 원복하지 않았다.
- `git diff --no-index --check`는 의도된 차이 때문에 exit1이고 whitespace 진단 출력은0이었다(`diff-check.json`). 최종 diff 추가행의 trailing whitespace 검사도0이며, source 변경이 해당 세 결함의 함수 범위뿐임을 검토했다.
- 작업 전후 전체 hash/최종 status 비교는 보고서 작성 후 `preservation.json`, `final-hashes.json`, `final-status.txt`에 기록한다. 기존 test/frontend/schema/migration/config/proof/reservation/late-result 정책 파일은 그대로다.

## 7. 기존 PASS21개 및 변경 금지 범위

- 기존18개: C01/C03/B03/B05/D01/D02/D03/E01/E02, A01/A02/A03/B01/B02/B06/D04/E03/E04의 assertion 모두 그대로 재실행해 PASS.
- 추가3개: F01 proof, F05 reservation 원자성, F06 현재 로컬 late-result 보호도 기존 V215개 및 관련 서버/SQL 회귀에서 PASS. 비용 계산/환불 규칙/cleanup 보류·금융기록 정책을 변경하지 않았다.
- `workers-ai.mjs`, `member-management.mjs`, `world-edits.mjs`, `shared/edit-contract.mjs`, src의 A07/A09 및 frontend 전부 baseline hash 유지. foundation은 fenceDueCleanup만, adapter는 final revision 검사만 수정했다.
- SQL/JS parity, BigInt/signed64 경계, 단일 ledger, UTC/중복/동시 입장, stale snapshot, account context, mask 밖 픽셀0 및 원본/승인 hash 보존, deletion recovery/cleanup 경쟁의 기존 검사를 유지했다.
- schema/migration/config/기존 테스트 변경0. 실제 사용자 data/asset을 정리하거나 원본을 덮어쓰지 않았다.

## 8. 남은 BLOCKED6 / NOT TESTED2

이전 gate를 해결했다고 주장하지 않는다.

|항목|상태|
|---|---|
|운영 ledger 전체 인증/실제 Neurons|BLOCKED|
|실제 D1 batch/trigger/driver/migration/rollback|BLOCKED|
|실제 Tigris timeout/늦은 PUT/부분 실패|BLOCKED|
|배포된 구 Worker와 기존 in-flight|BLOCKED|
|Workers Free CPU/실제 사용량·비용|BLOCKED|
|direct SQL/import 운영 writer 전수 권한·동결|BLOCKED|
|실제 browser/IDB/desktop/mobile·재접속 전체|NOT TESTED|
|B11/B12/I20/T30/native dispatch transition 전체|NOT TESTED|

Native dispatcher의 atomic transition은 구현하지 않았다. NOT_DISPATCHED pin 예외, 불명 결과의 삭제 보류/수동 reconciliation 필요성 등 F06 제한도 그대로다. 공통 post-write 검사와 배열 resource cap이 실제 D1의 성능/parameter 한도를 충족한다고 판정하지 않았다. 운영 환경의 직접 writer까지 통제했다고 주장하지 않는다.

## 9. 완료·중단

최종 비교: 시작323개→325개, 기존 변경4개/그 외319개 hash 동일, 신규2개(test/report), 삭제0·범위 밖 변경0. Git status297→299개 항목. branch/HEAD 및 origin tracking0/0 유지. 기존 테스트/schema/migration/config/frontend hash 변경0. 증거는 `/tmp/beyond-b10-targeted-c65n7051/{preservation.json,final-hashes.json,final-status.txt}`.

변경 제품 파일4개: `cloudflare/b10-json-schema.mjs`, `cloudflare/b10-validation.mjs`, `cloudflare/d1-store.mjs`, `cloudflare/b10-foundation.mjs`. 신규 test와 본 보고서만 추가했다. 기존 사용자 변경사항은 나머지 파일의 hash로 보존 여부를 확인한다. branch/HEAD/origin tracking 관계를 유지했으며 commit/push/merge/배포/원격 변경은 없다.

J01/J02/R01/G01의 동일 독립 재현은 수정 후 거절되고, 정상 입력과 기존 PASS21개는 유지됐다. 여기서 중단하고 독립 재감사를 기다린다.

**READY FOR NEXT INDEPENDENT AUDIT**
