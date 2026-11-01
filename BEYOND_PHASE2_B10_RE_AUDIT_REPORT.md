# BEYOND B10 Independent Re-Audit

2026-11-01 UTC. **검증 전용.** 기존 remediation 문구를 판정 근거로 재사용하지 않고 현재 제품 함수, SQL, migration, 기존 테스트 및 별도 /tmp 반례를 대조했다. B10은 활성화하지 않았다.

## 1. Git / 보존 / 증거

- branch `main`; HEAD `f4585907ecb8158eafd61cc769c4c31e94d102c0`, `origin/main`과 같은 HEAD. 시작 Git status292개 항목, tracked+untracked 기존 파일318개. clean tree가 아니며 기존 작업을 그대로 기반으로 검사했다.
- 증거 디렉터리: `/tmp/beyond-b10-reaudit-o6dvm0zg`. `baseline.json` SHA-256, `identity.txt`, `status.txt`, 실행 로그, `probes.mjs/probes.json`, `numeric.mjs/numeric.json`, writer 검색 목록을 보관했다. 원래 실패한 직접 SQLite probe도 `probes-initial.json`에 남겼다.
- 읽은 기준: AGENTS, 이전 감사/FAIL remediation/B10 verification/C00, 현재 schema·migration·제품 코드·테스트, DECISIONS/STATUS/NEXT_SESSION 및 관련 프로젝트 문서. 기존 보고서/테스트/설정/migration/인계 문서는 수정하지 않았다. 이번 저장소 산출물은 본 보고서 하나다.
- 기존318개 파일의 최종 hash 대조 및 Git 상태는 `preservation.json`, `final-status.txt`에 기록한다. 코드 수정/삭제/branch 변경/commit/push/merge/reset/clean/checkout 없음. 실제 사용자 데이터, 원격 D1/Tigris, 실제 AI 접근0. 모든 mutable 데이터는 disposable SQLite/TestMedia fixture였다.

## 2. 판정 집계와 해석

**판정 단위32개: PASS18 / FAIL6 / BLOCKED6 / NOT TESTED2.** 아래 원 감사20개 + 추가 반례4개(N03~N06) + 원격 gate6개 + 미실행2개를 센다. N01은 B04, N02는 C02에 포함하므로 중복 집계하지 않는다. writer 표와 실행된 개별 테스트 수는 이 집계에 다시 더하지 않는다.

- 원 감사 assertion20개가 기존 회귀 파일에서는 모두 통과했지만, 독립 반례까지 반영한 해당 항목 판정은 **PASS18 / FAIL2(C02/B04)**다.
- 기존 PASS9개는 모두 유지된다. 이는 모든 writer나 실제 Cloudflare 검증 통과를 뜻하지 않는다.
- 새로 확인한 안전성 반례는 N01~N06 총6개다. N06은 이전 보고서가 남겨둔 late-orphan 위험을 실제 로컬 경로에서 구체화한 것이다.

## 3. Remediation 11개 독립 확인

PASS는 적힌 로컬 범위에만 해당한다. 실제 D1/Tigris 항목은 뒤의 별도 BLOCKED다.

|항목|현재 파일·함수 / 직접 확인|기존 검사 재실행 + 독립 검사|결과 / 한계|
|---|---|---|---|
|C01 asset validation|`b10-validation.mjs:validateNativeAssets`, `b10-foundation.mjs:saveWorld`, `b10-api.mjs`, `user-worlds.mjs`: owned ready asset, owner prefix, 파일/크기/hash/형식, 비동기 이후 SQL asset CAS 확인. metadata 저장에서 Starter 교체 거절.|C01/R01/R03/R10 및 b10 save 경합 PASS. 잘못된 자산에서 ledger/revision 변경0과 원본 hash 보존 확인.|**PASS** 로컬. 실제 Tigris file read/경합은 RB03.|
|C02 JSON validation|`b10-validation.mjs:validateNativeJSON`: parse/key/512KiB/depth32/core field는 검사하지만 found/completed 원소와 conversations 내부 schema를 검사하지 않음.|기존 C02/R02 PASS. **N02**: `{version:1,found:[17],completed:[{}],conversations:{not_uuid:123}}`를 실제 native save가 저장하여 version1→2. 실제 frontend `readProgress`는 invalid=true.|**FAIL**. malformed JSON 수정은 확인했지만 nested schema 무결성은 미완성.|
|C03 revision bound|`b10-foundation.mjs:safeRevision/transaction/saveWorld`: native 입력은 MAX_SAFE_INTEGER 미만, world/history는 guarded batch. `d1-store.flush` global revision 상한도 존재.|C03/R09/native save tests PASS. 별도 N03은 legacy world, N04는 다른 helper의 남은 상한 누락.|**PASS** 원래 native world overflow 범위. 전체 revision 안전성은 N03/N04 때문에 FAIL.|
|B03 idempotent lookup|`b10-foundation.mjs:admit`: 인증/정적 계약 후 owner/world/operation/hash lookup, 기존 job 재사용 후에 새 요청 publication/target/예산 검증.|B03 캐릭터 비공개 전환 후 재사용, B02 UTC 경계, B06 중복/경합, 기존 different hash/owner/world tests PASS.|**PASS** 로컬. dispatcher 구현은 없으므로 재호출 안전성 전체를 검증한 것은 아님.|
|B04 settlement/refund|`workers-ai.mjs:writeCost/settleText/releaseUnstarted`는 raw/proof를 같이 갱신하나 **workersImage 성공 경로(line103)는 raw만 직접 UPDATE**. `budget-schema.mjs`의 UPDATE trigger가 proof를 삭제.|기존 B04/R04/R07 PASS. **N01** 실제 workersImage+adapter+fake provider에서 success/raw43.2/proof NULL, 기대 units4320000000000000. N05는 예약 staging 오류의 추가 원자성 결함.|**FAIL**. 이미지 생성 후 native admission의 precision precheck가503으로 차단될 수 있음.|
|B05 integer/overflow|`workers-ai.mjs:settleText`: safe-integer nonnegative usage, BigInt 곱/합/ceiling, fixed-point signed64 bound 검사 후 cost 변환.|B05/R04, 음수/소수/NaN/extreme usage 및 proof write 실패 rollback PASS. 기존 예약 보존.|**PASS** 해당 정산 함수 범위. raw 직접 쓰기/다른 revision은 별도 결함.|
|D01 recovery|`d1-store.mjs:beginMemberMutation/flush`, `member-management.mjs:changeMember`, `user-auth.mjs:recover-deletion`: fresh scope, global CAS/credential/profile/deadline/phase 확인.|D01/R05/R08/R09, 기존 member-management/user-accounts tests PASS. wrong password401, 유효 암호 recovery200, 새 session, 원본 hash 유지.|**PASS** 로컬 30일 내 복구. 실제 Free CPU/배포 auth flow는 RB04/RB05.|
|D02 cleanup 차단 해소|`cleanDueMembers`와 member-scope flush가 native barrier 안에서 due/phase guard, generation bump, retry journal, 최종 tombstone을 적용.|D02/D04/R05/R06 PASS: active cleanup 실행 가능, storage retry, stale restore 차단, 최종 purge 전 jobs 보존. N04 helper와 N06 late PUT은 미해결.|**PASS** 원래 “active cleanup 전체 차단” 수정 범위. cleanup 전체 안전성 PASS가 아님.|
|D03 candidate preservation|`world-edits.mjs:worldEditsAPI`는 fresh candidate를 오류 catch에서 삭제하지 않으며 immutable manifest를 metadata flush 전에 저장.|D03 metadata409 후 candidate+manifest/hash 유지, R11 approval replay/requery, R12 PUT 실패에서503/재호출0/원본·비용 보존 PASS.|**PASS** 로컬 후보 보존 범위. 보존과 삭제정책의 충돌은 N06; 실제 Tigris는 RB03.|
|E01 migration rerun|`0006_b10_foundation.sql`: 원장 ALTER 제거, IF NOT EXISTS/INSERT OR IGNORE, default active0. precision metadata/view/trigger 추가.|E01/E03/E04, b10 migration rollback/reapply/FK/index/unique tests PASS.|**PASS** 로컬 SQLite 재실행. 실제 D1 적용/history/실패 복구는 RB02.|
|E02 old ledger|동일 migration은 workers_ai_requests9열 유지. `d1-store.emptyDatabase/openD1Store`는 새 proof 별도 로드, 이전 로컬10열 draft도 읽는 분기 존재.|E02 재구성한9열 loader, E03 현재 adapter, R07 raw 변경 proof 무효화 PASS.|**PASS** 로컬 schema/loader 호환. 실제 구 Worker binary는 RB04.|

## 4. 이전 PASS9개 재검증

각 ID는 `cloudflare/tests/b10-remediation.test.mjs`의 실제 실행 항목이다.

|ID|검증 범위|판정|
|---|---|---|
|A01|650 decimal/BigInt/SQL integer TEXT boundary 샘플. raw REAL 전체 왕복 보장이 아님.|PASS|
|A02|JS pool 합산 및 SQL SUM signed64 overflow 거절, 실패 admission rollback.|PASS|
|A03|미인증/14자리 초과 저장 비용은503, 임의 환불/무료 한도 소진으로 오표시하지 않음.|PASS|
|B01|192개 비용·상태·pool·31.42 보정·0 환불 SQL/JS corpus.|PASS|
|B02|가상 UTC 자정에서 새 입장 SQL guard 거절, 동일 operation은 재예약하지 않음.|PASS|
|B06|동시4요청/중복 operation/잔여1 unit, jobs2·ledger2와 exact parity.|PASS|
|D04|inactive cleanup 부분 storage 실패/retry, shared original 유지.|PASS|
|E03|native table이 빈 migration 상태에서 현재 adapter read, default-off.|PASS|
|E04|FK/index/unique/canonical units constraint와 default-off.|PASS|

## 5. 독립 반례와 영향

`probes.mjs`는 저장소 밖에 새로 작성한 검증 스크립트다. 기존 테스트 assertion을 수정하지 않았다. 실제 제품 함수/HTTP/adapter를 호출하며 global external fetch는 거절하고 호출 수를 센다. 결과 `probes.json`: **6개 안전 assertion 모두 FAIL, 외부 fetch0, 실제 provider0**. 스크립트 exit0은 결과 수집 성공이며 안전 조건 통과가 아니다.

|반례|실제 근거·발생 조건|관측 결과|영향 / 판정 매핑|
|---|---|---|---|
|N01|`workers-ai.mjs:workersImage` line103 raw-only update + `budget-schema.mjs` UPDATE OF trigger. fixture AI output은 실제 PNG, 제공자는 stub.|success인데 reserved_neurons43.2, reserved_units NULL. raw를 같은 값으로 UPDATE해도 해당 trigger에는 값 변경 여부 조건이 없음.|B04 FAIL. 비용 증명이 사라져 후속 native 입장503 가능. 현재 inactive에도 발생하는 경로.|
|N02|`validateNativeJSON` 내부 원소 검사 누락. 실제 validWorld를 통과한 world와 invalid progress를 saveWorld로 저장.|frontend invalid=true, server 거절 없음, world version1→2 commit.|C02 FAIL. 읽는 UI가 수용하지 못하는 history를 저장할 수 있음.|
|N03|`user-worlds.mjs` line24 Number.isInteger만 검사, line34 version+1.|legacy PUT HTTP200, 저장 version `9007199254740992`.|**FAIL**. native 상한을 legacy writer에 적용하지 않아 safe revision 계약 불일치.|
|N04|`b10-foundation.mjs:fenceDueCleanup` line105 generation+1에 상한 없음.|MAX_SAFE_INTEGER generation을 `9007199254740992`로 commit; 오류 없음.|**FAIL**. 현재 member cleanup bridge에는 cap이 있지만 별도 repository helper는 미보호. 이 helper의 실운영 연결은 아직 없음.|
|N05|`workers-ai.mjs:reserve` line32/33 ledger와 proof staging을 local transaction으로 묶지 않음. 실제 openD1Store의 proof `.run` 실패를 fault injection.|reserve throws 후 handler와 같은 후속 flush를 수행하면 ledger1/proof0가 commit. provider 실행 전인데 예약이 남음.|**FAIL**. D1.batch 전체 실패 rollback과 다른 pre-batch 오류 경로. 인위적 staging failure 조건이며 정상 입력이 항상 실패한다는 주장은 아님. 최초 직접 SQLite 반례도 별도 보존.|
|N06|기존 v1 edit를 fake provider gate에서 중지 → native head seed → 실제 changeMember 삭제 요청 → fixture에서 시간 경과를 모사 → 실제 final cleanup → provider gate 해제.|owner0/world0/tombstone1 유지, HTTP409. 그러나 삭제된 owner prefix에 original.png/candidate.png/candidate-manifest.json **3개가 다시 생성됨**.|**FAIL**. 계정·월드 D1 부활은 차단됐지만 private bytes/manifest orphan의 부활은 차단되지 않음. 이전에 고지한 위험을 로컬 실경로에서 재현. 실제 Tigris 실행은 아님.|

수정 제안만 기록한다: 이미지 비용 쓰기를 공통 proof 갱신 경로로 통일; nested history schema를 실제 reader와 일치; legacy revision/helper generation cap; reserve staging rollback; dispatch된 구 writer의 late PUT/cleanup 소유권 fencing 및 이관 계획. 이번에는 수정하지 않았다.

## 6. 숫자 정밀도와 SQL

- 실제 schema: 원래 `reserved_neurons INTEGER` affinity(분수 저장 시 SQLite REAL), proof의 `raw_neurons REAL`, `reserved_units TEXT`. `raw_neurons REAL`은 정확한 decimal 원본이 아니며 join 시 float 값 동등성만 제공한다.
- `budgetUnits`:10^14, BigInt, 정확히 나눠지지 않는 소수 및 음수/비정상/초과 금액 거절. signed64 최대9223372036854775807. `settleText`는 기존 최소1/ceiling 정책을 BigInt로 수행하고 범위 검사한다.
- SQL 예산은 TEXT를 그대로 정렬/합산하지 않고 `CAST(... AS INTEGER)`, 큰 aggregate는 `CAST(... AS TEXT)`로 읽는다. history 보정 CASE, pool, UTC, pending/error 비용 유지 규칙은 기존 corpus에서 일치했다. NULL certification은 native 입장을 차단한다.
- 독립 `numeric.json`: signed64 최대 INTEGER→TEXT 정확, 7개 invalid 입력 거절, SQL SUM overflow 예외, `typeof(max_integer+1)='real'` 확인. SQLite scalar 덧셈은 자동으로 REAL로 승격될 수 있으므로 입력/SQL guard가 필요하다.
- TEXT 비교 반례 `'10'<'2'`는 true, explicit INTEGER 비교는 false. 현재 quota SQL의 cast는 이 차이를 피한다.
- **REAL 손실 실제 재현:** `8999.00000000000001`(정밀도14자리)을 저장하면 raw read는8999, proof는899900000000000001 units, JS raw 재변환은899900000000000000. 현재 native precheck는 mismatch로 거절하므로 조용한 무료 입장 우회는 관측하지 않았다. 그러나 모든 유효 decimal이 REAL에서 손실 없이 왕복한다는 주장은 성립하지 않는다. A01의 INTEGER/TEXT 통과와 별개다. 현재 ledger의 실제 값 전수 인증은 RB01.
- 정확한 정수 변환·quota 계산 통과가 모든 cost writer의 proof 정합성을 뜻하지 않는다(N01/N05). 실제 D1 driver 숫자 전달/SQL/transaction은 RB02, 로컬 SQLite 결과를 D1 결과로 간주하지 않는다.

## 7. Settlement/refund 전체 경로

|경로 / 코드|예약·확정·환불 처리|검증 및 제한|
|---|---|---|
|일반 chat/plan/understand `textAPI`|textReservation→reserve→settleText→success. usage 없으면 기존 예약 유지, usage 있으면 최소1 ceiling. error는 status error이며 예약 유지.|기존 ai-limit/user-account/server tests + R04 PASS. proof staging 오류는 N05.|
|Companion `textAPI/companion-context`|자연어 대화는 동일 text 경로. 도구 관찰/clarify 등은 provider 없이 응답하며 applied=false.|companion/actions/frontend tests PASS. 일반 채팅과 이미지 pool 분리는 유지.|
|관리자 이미지 생성 `workersImage`|Schnell quote 예약, 출력 raster 크기로 raw만 재계산; error면 releaseUnstarted와 error 상태.|**FAIL N01**: 성공 경로 proof 무효화.|
|기존 세계 이미지 편집 `world-edits/worldInference`|Klein 고정 quote image pool; vision(있으면) world-vision image pool. 성공은 후보 metadata, 승인 전 적용 아님. 결과 불명/다운로드·storage 실패는 비용 유지.|편집·mask·원본/approval/reconnect tests PASS. D1 실패 후보는 보존하나 N06 orphan.|
|확인된 미실행/모델 거절 image 경로|releaseUnstarted는 미dispatch 또는 미완료+confirmed refusal만0으로 환불, raw/proof 함께 갱신.|image-budget/R04 PASS. started unknown 또는 completed/storage 실패는 환불하지 않음.|
|일반 text 모델 거절/error|catch는 error 기록만 하고 image와 달리 releaseUnstarted를 호출하지 않음.|보수적 예약 유지라는 기존 동작 확인. provider 확정 비용/환불 telemetry는 없음; 경로 차이를 숨기지 않는다.|
|중복/재시도|동일 id/hash는 기존 ledger/job 반환 또는 pending/error 표시. 다른 hash 거절. worldInference는 자동 provider retry 없음.|B03/B06/R12 및 image-budget PASS. world-retry prefix는 image pool이지만 현재 해당 행을 생성하는 별도 retry writer는 검색에서 발견되지 않음.|
|취소/거절|편집 reject는 candidate flag만 바꾸고 이미 쓴 비용은 반환하지 않음. B10 CANCELLED/EXPIRED는 schema enum만 존재, 새 상태 전이/환불 runner 없음.|기존 reject PASS. 구현되지 않은 native cancel/expiry 경로는 NT02.|
|삭제 중/삭제 후 결과|dispatch된 작업은 원래 actor 귀속, session 만료만으로 삭제하지 않음. final cleanup은 actor ledger/jobs를 purge.|eligibility/30일 보존 테스트 PASS. 실제 old result PUT은 N06; 비용 통계도 final purge 후에는 원래 개인 행을 보존하지 않는 기존 정책임.|

비용 mutation 검색 결과: `cost-writers.txt`. 실제 Cloudflare 청구/Neurons와 내부 보수적 예약을 동일시하지 않는다.

## 8. Legacy / Native writer 목록

이 표의 PASS는 제한된 로컬/정적 계약이다. “차단”은 데이터 보존 거절이며 사용 가능한 native 전환 완료가 아니다. cf_state는 실제 metadata commit 기준이며 브라우저 전용에는 적용되지 않는다.

|Writer|대상 데이터|CAS 적용|cf_state 증가|오래된 쓰기 차단|검증 결과|
|---|---|---|---|---|---|
|workers-ai reserve/settle/error|ledger/proof/응답|global snapshot|Yes|snapshot/DB trigger|FAIL N01/N05; native-active 일반 writer는 marker 없어 거절|
|WorldAdventure 대화→persistSidecar|progress/conversations|world version/epoch|서버 Yes|global+world|FAIL 운영 전환: legacy endpoint 유지|
|WorldCompanion commit/send/choose|world/progress/character|world version/context|서버 Yes|global+epoch|FAIL 운영 전환: native API 미연결|
|WorldCompanion generate/decide|v1 후보/승인/task|parent+contract/global|서버 Yes|global+parent|FAIL 전체 전환: B11/B12 미연결, N06|
|WorldImageEditor generate/approve/reject|v1 ledger JSON/후보|parent/contract/global|Yes|DB guard|FAIL 전체 전환; 로컬 mask/원본 tests PASS|
|world-edits approve/reject 서버|승인/거절 JSON|parent+global|Yes|active marker 없으면 거절|FAIL native world atomic apply 미구현(B12)|
|WorldEditor/SpiritEditor save|회원 world/admin local snapshot|world version/local updatedAt|회원 Yes|회원 guard/local 비교|FAIL 회원 native 전환; N03|
|legacy openD1Store.flush|선택된 기존 테이블|global revision/session|Yes|CHECK guard+batch|PASS 로컬 stale/원자 guard; N05 pre-batch gap 별도|
|native saveWorld/seedHead|world/history/head|owner/session/world/head/asset|Yes|조건 batch|FAIL 전체 schema는 C02; CAS/asset tests PASS|
|native admit|job+ledger+proof|world/head/source/budget/day|Yes|guard+unique|PASS 로컬 admission; live cert/D1 BLOCKED|
|native job/head 조회|소유 metadata|owner/session|N/A read|owner-bound SQL|PASS read-only; 쓰기 경로 아님|
|fenceDueCleanup/recordDeletedOwner|generation/tombstone|due/phase/owner|Yes|native transaction|FAIL N04; tombstone 로컬 PASS|
|canFinalizeResult|결과 귀속 eligibility|owner/generation/phase/tombstone|N/A read|검사 후 external PUT 원자 아님|FAIL 전체 late-result 보장 N06; helper 조회 자체 PASS|
|cloudWorlds persistWorld/upload|회원 world/assets|version/ID/hash/context|서버 Yes|global+epoch|FAIL native 전환; N03|
|persistSidecar/retryPending/importLegacy|world/history/drafts/import|version/requestId/context|서버 Yes|legacy guard|FAIL native 전환; 데이터 임의 정리 없음|
|Starter createStarterWorld|개인 image snapshot/world|hash/context/world version|회원 Yes|기존 guard|FAIL native upload/save 미전환; 로컬 hash tests PASS|
|userWorldAPI asset upload|pending/ready/private PUT|ID/hash/global|Yes|metadata DB 장벽|BLOCKED 실제 PUT/cleanup 원자성; in-flight PUT은 DB commit과 별개|
|uploadAssets IDB save/remove/batch|계정별 IndexedDB|epoch/transaction abort|N/A|client context|PASS unit 계약; 실제 browser는 NT01|
|worldStore/local sidecar|browser-only JSON|updatedAt/context|N/A|local 비교|PASS 별도 로컬 domain; D1 원자성 주장 안 함|
|BackupControls/worldBackup restore/import|IDB/receipt/member world|scope/new ID/version|서버 Yes|legacy guard|FAIL 회원 native 전환; browser runtime NT01|
|admin editorial API/server bridge|중앙 worlds/characters/content/settings/revisions|개별 version+global|Preview Yes|global guard|PASS 로컬 server/Cloudflare suite; member head와 별도 domain|
|admin member changeMember/account delete|profile/credential/session/deletion|profile/global/fresh scope|Yes|SQL auth/deadline/phase|PASS 로컬 D01/cleanup 경쟁; 실제 auth BLOCKED|
|user-auth signup/login/reset/settings|account/profile/session/token|auth/global|Yes|보호 table trigger|FAIL active-mode 전체 전환: recovery 외 writer 미업그레이드|
|owner recover-deletion|profile/deletion/session|fresh member scope/global|Yes|credential/deadline/phase|PASS R08 wrong-password/성공/new session|
|admin managed images/central media|immutable files/editorial metadata|version/global/If-None-Match|metadata Yes|파일과 metadata 별도|BLOCKED 실제 Tigris/cleanup; fixture tests PASS|
|worker.scheduled→cleanDueMembers|owned prefix/purge/audit|due/phase/global/fence|Yes|fresh guard before delete|PASS 정상/retry 로컬, FAIL 전체 late PUT N06|
|world-edits error preservation|candidate/original/manifest|immutable key; D1 CAS 별도|metadata만 Yes|파일 final-owner fence 없음|FAIL N06; D03 보존은 PASS|
|handler context.created compensation|다른 fresh admin files|request key+참조 확인|metadata만 Yes|파일 자체 native CAS 없음|BLOCKED 실제 storage 실패 경합; D03 fresh 배열과 다른 경로|
|standalone Node store/auth/AI/files|별도 local SQLite/files|Node transaction/version/auth|N/A 별도DB|Cloudflare domain 아님|PASS server81; Preview native 준수로 간주하지 않음|
|universe/read-api|조회|N/A|N/A|read-only|PASS 코드 및 read-api tests|
|migration/staging/import/export tools|별도 staging/backup/DB IO|도구별 staging/hash|일괄 보장 없음|운영 절차/권한 의존|BLOCKED RB06; 임의 실행하지 않음|
|.local 운영/진단 scripts|직접 SQL/API/storage 가능|도구별|일괄 보장 없음|권한/운영 동결 필요|BLOCKED RB06; 이름 기준 후보35개, 실행0|

source 검색 증거: `writer-functions.txt`, `frontend-writers.txt`, `cost-writers.txt`, `operator-script-names.json`. `src`에서 native-worlds/native-jobs 호출은 발견되지 않았다. 운영 스크립트 목록만으로 전수 준수를 입증하지 않는다. **미전환/미확인 writer가 남아 있으므로 활성화 준비 완료 조건은 충족되지 않는다.**

## 9. Cleanup / Tigris / migration 상세

- 30일 유예: changeMember가 deadline을 설정하고 그전에는 데이터/jobs 보존; recovery는 password/phase/deadline 검사. 로컬 테스트 PASS. 이번 시간 경과/삭제는 fixture만 조작했다.
- 정상 final cleanup bridge는 owner generation과 global CAS를 먼저 commit하고 owned prefix만 삭제한다. partial failure는 journal retry. 다른 계정/managed shared Starter를 보존하는 기존 tests PASS.
- tombstone 및 owner 부재는 새 admission과 metadata 귀속을 막는다. N06에서 user/world가 재생성되지 않은 점도 확인했다. 그러나 legacy 결과 writer는 그 검사를 실제 외부 PUT 직전에 연결하지 않아 orphan3개를 만들었다. 이후 정리/계정 데이터 최소 보존을 보장할 수 없다.
- D03의 후보 보존은 metadata 장애 시 유익하지만 삭제 완료 owner까지 무조건 보존하는 정책은 별도 안전 문제가 된다. 오류를 성공으로 숨기지는 않는다(409).
- 실제 Tigris는 사용하지 않았다. TestMedia/transport mock의 immutable PUT/실패 재시도 결과를 실제 storage PASS로 표현하지 않는다.
- Migration0006의 새 인증 metadata는 ledger_id PK/FK(ON DELETE CASCADE), raw REAL, canonical signed64 TEXT proof다. view는 raw 값이 일치할 때 proof를 노출하고 raw UPDATE trigger가 무효화한다. 원래9열 ledger와 response JSON을 재작성하지 않는다.
- jobs는 owner/world/op unique 및 ledger unique, owner/world FK cascade와 index를 가지며 default active0이다. guard/context table을 사용한 batch rollback은 로컬 확인. 기존 accounts/worlds/approval bytes 보존과 재실행도 확인했다.
- 현재 adapter는 과거 로컬10열 draft를 읽는 branch를 갖지만, 실제 배포된 구 Worker/history를 읽었다는 뜻은 아니다. 로컬 fresh9열 compatibility와 remote rollout을 구분한다.
- rollback에서 기존 데이터/후보/proof/jobs를 삭제하거나 active0으로 old writers를 다시 여는 것을 안전하다고 판정하지 않았다. 이미 native state가 있으면 환경 admission을 닫되 DB barrier 보존이 필요하다. 실제 rollback/recovery procedure는 RB02/RB04.

## 10. 테스트 실행 결과

기존 코드·테스트·assertion을 변경하지 않고 실행했다. 전체 Cloudflare 파일을 두 묶음으로 나눠 같은 파일을 불필요하게 반복 실행하지 않았다. 공통 fixture test import로 반복 등록되는 test는 runner count에 포함되며 unique 시나리오 수와 다르다.

|명령/범위|실제 결과|로그|
|---|---|---|
|이전 보고서의 관련8파일 node --test 명령 그대로|166/166 PASS, skipped0, exit0|reported.log|
|위 파일 내 remediation assertions|32/32 PASS; 원 감사20개 포함(20을 또 합산하지 않음)|reported.log SUMMARY PASS32/FAIL0/fetch0|
|나머지 Cloudflare8파일 node --test|140/140 PASS, skipped0, exit0|other-cloudflare.log|
|node --test server/tests/*.test.mjs|81/81 PASS, skipped0, exit0|server.log|
|vitest run|12 files,62/62 PASS, exit0|frontend.log|
|tsc --noEmit, vite build --outDir /tmp/.../build --emptyOutDir|모두 exit0; bundle500kB warning만 존재|build.log|
|별도 독립 안전 probe6개|PASS0/FAIL6, 실제 외부 fetch0; 실패를 결과 JSON에 보존|probes.json / probes-final.log|
|별도 숫자/SQL 검증|위 §6의 실제 타입/경계/REAL 손실 확인. scalar overflow의 REAL 승격 및 SUM overflow를 분리|numeric.json / numeric.log|

기존 test 실행 count 합계449(166+140+81+62)는 중복 fixture 등록을 포함한 실행 수다. 독립 audit 판단을 대체하지 않는다. build output은 /tmp에 두어 기존 dist를 덮어쓰지 않았다. browser/e2e는 실행하지 않았다. 원래 임시 감사 script의10열 fixture를 고치지 않았고, 현재 저장소에 옮겨진 동일20개 안전 assertion의 통과를 확인했다.

## 11. 별도 원격 gate / 미실행 (집계 대상)

|ID|범위|판정 및 이유|
|---|---|---|
|RB01|현재 ledger 전수 정밀도/인증, 실제 Neurons/청구|BLOCKED: 원격 D1/제공자 telemetry 접근 금지. 로컬 샘플은 전수 인증 아님.|
|RB02|실제 D1 INTEGER driver/batch/trigger/FK/migration history/rollback|BLOCKED: 로컬 SQLite/sql.js만 실행. 원격 schema 변경/접근 금지.|
|RB03|실제 Tigris immutable PUT/late orphan/부분 실패/삭제 race|BLOCKED: TestMedia와 mock transport만 사용. 실제 파일 변경 금지.|
|RB04|배포 Worker/구 binary 및 실제 in-flight/provider 결과 혼재|BLOCKED: 배포/원격/실제 AI 호출 금지. 실제 서비스 흐름을 성공이라고 판정하지 않음.|
|RB05|Workers Free CPU/성능/계정 crypto/스냅샷 크기/월 비용|BLOCKED: 실제 Worker 실행/usage 관측 없음. 로컬 처리 시간은 근거가 아님.|
|RB06|운영/background/import 도구 전수 동결·권한·writer barrier 준수|BLOCKED: 로컬 코드/후보명은 확인했지만 현재 운영 실행/권한/외부 자동화는 검증할 수 없음.|
|NT01|실제 desktop/mobile browser, 계정 전환·IDB·재접속 UI|NOT TESTED: 이번에는 frontend unit/typecheck/build만 실행.|
|NT02|B11/B12/I20 native dispatch·cancel/expiry·receipt/apply 전체 lifecycle|NOT TESTED: 현재 구현되지 않은 별도 단계이며 사용자 금지 범위.|

## 12. 최종 차단 조건

기존 테스트 통과 주장은 재현됐지만 C02/B04의 전체 수정 완료 주장은 반례로 반박됐다. N03/N04/N05와 구 dispatch의 late orphan N06도 남는다. 원격 gate 및 일반 chat/world/auth/upload writer의 native 전환이 확인되지 않았다. 해당 문제를 숨기거나 테스트를 변경하지 않았고 제품 수정도 하지 않았다.

이번에는 본 보고서를 제출하고 중단한다. 별도 구현·원격 검증·활성화 승인을 추론하지 않는다.

**NOT READY — BLOCKERS REMAIN**
