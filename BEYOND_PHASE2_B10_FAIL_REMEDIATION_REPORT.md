# B10 FAIL remediation — local verification

2026-11-01 UTC. 대상: `BEYOND_PHASE2_B10_PRE_ACTIVATION_AUDIT.md`의 독립 assertion FAIL 11개. B10 활성화/배포 작업이 아니다.

## 1. 기준 및 재현

- branch `main`, HEAD `f4585907ecb8158eafd61cc769c4c31e94d102c0`; 시작 시 기존 파일314개, Git status288개 항목. 기존 dirty/untracked를 기반으로 필요한 부분만 수정했다.
- 작업 전 SHA-256 목록, branch/HEAD, 전체 status: `/tmp/beyond-b10-remediation-vj1aosi2/{baseline.json,identity.txt,status.txt}`.
- 필수 감사/B10 검증·preflight/C00/구현계획/A07·A09 문서, AGENTS/DECISIONS/STATUS/NEXT_SESSION, 관련 schema/migration/제품 코드/테스트를 확인했다. 감사 원문은 변경하지 않았다.
- 수정 전 실제 제품 함수/HTTP handler 재현: `before.log`, `before-results.json`: **PASS9 / FAIL11**. 임시 원 감사 harness를 그대로 실행한 결과를 별도 보관했다. 원래 증거 경로는 `/tmp/beyond-b10-preactivation-iafs5qyv`다.
- 동일 안전 assertion을 저장소 `cloudflare/tests/b10-remediation.test.mjs`로 옮겼다. migration 변경에 따라 fixture의 마지막 정밀도 값을 ledger 열 대신 종속 인증 metadata에 넣도록 바꿨으며, 기존 비용·무변경·소유권·호환성 assertion은 유지했다.

## 2. FAIL 11개별 수정

각 행은 **FIXED LOCALLY — REMOTE VERIFICATION REQUIRED**다. 여기서 verified는 로컬 제품 함수/handler 검사이며 실제 Cloudflare 검증을 뜻하지 않는다.

|ID|원래 원인 및 발생 조건|수정 파일·함수와 설계 근거|회귀 결과|
|---|---|---|---|
|C01|native PUT/saveWorld가 구조만 검사하여 존재하지 않는 Starter asset/hash를 HTTP200으로 저장하고 head는 이전 hash 유지.|`b10-validation.mjs:validateNativeAssets`, `b10-foundation.mjs:saveWorld`, `b10-api.mjs:b10API`, `user-worlds.mjs:userWorldAPI`: 소유/ID/ready/owner-prefix/file 존재/크기/실제 hash/형식 검증 공유. 비동기 파일 검증 후 asset metadata를 native SQL CAS에서 다시 검사. B10 metadata 저장은 기존 Starter를 교체하지 못함.|C01, R01(7개 입력), R03, R10 PASS. 잘못된 ID/타 계정/누락 파일/손상 bytes/상태 변경 시 저장·revision·비용 변경0.|
|C02|sidecar key/string만 검사하여 `not JSON`을 그대로 저장.|`b10-validation.mjs:validateNativeJSON`, native save 및 v1 world save: JSON parsing/허용 key/자료형/필수 v2 progress 필드/좌표/512KiB/깊이32 검사. 기존 validateWorld 유지. v1 partial progress는 명시적 호환으로 보존하고 누락값을 추론하지 않음.|C02, R02(8개 입력), R03 PASS. 거절 전후 world/history/head/jobs/ledger/cf_state 동일.|
|C03|MAX_SAFE_INTEGER world version을 증가시킨 뒤 응답 read가 실패하여 commit만 남음.|`b10-foundation.mjs:safeRevision/transaction/saveWorld`, `d1-store.mjs:flush`: 증가 가능한 revision 상한을 입력 및 SQL guard로 검사. global revision, member version/credential, cleanup generation도 증가 전에 상한 검사.|C03, R09 PASS. 상한 초과 전 원자 거절, commit 후 unsafe Number 없음.|
|B03|기존 operation 조회보다 publication 검사가 먼저여서 캐릭터 비공개 전환 후 동일 POST가404.|`b10-foundation.mjs:admit`: 인증·정적 계약 확인 후 owner/world/operation/request hash로 기존 job을 먼저 반환. 새 입장만 현재 publication/target/예산 검사.|B03, B02, B06 및 기존 operation 충돌/UTC/다른 owner·world 테스트 PASS. 중복 예약0.|
|B04|settle/refund가 raw cost만 바꾸고 certified units는 예약 당시 값 유지.|`workers-ai.mjs:writeCost/settleText/releaseUnstarted/reserve`, `budget-schema.mjs`, migration0006, `d1-store.mjs`: 기존 ledger raw cost와 정밀도 proof를 같은 transaction/batch에서 갱신. raw 변경 시 proof 무효화. 별도 balance/counter 없음.|B04, R04, R07 PASS. 정산·0 환불·중복 환불·불명 비용 유지·proof 저장 실패 rollback 확인.|
|B05|유한한1e308 token count의 Number 곱셈이 Infinity를 ledger에 기록.|`workers-ai.mjs:settleText/writeCost`: nonnegative safe-integer token만 허용; BigInt 곱셈/합산/ceil division 후10^14 및 signed64 범위를 검사하고 마지막에만 안전한 정수 Number로 변환. 기존 최소1 Neuron/올림 정책 유지.|B05, R04 PASS. 음수/소수/NaN/최대 safe token/extreme 입력 거절, 원래 예약과 proof 동일.|
|D01|active barrier 때문에 changeMember restore flush가409, 30일 내 복구 불가.|`d1-store.mjs:beginMemberMutation/flush`, `member-management.mjs:changeMember`, `user-auth.mjs:userAuthAPI(recover-deletion)`: fresh snapshot에서 제한된 회원 mutation capability 발급; global CAS/기존 caller 인증/profile·credential version/deadline/cleanup phase 재검증 후 marker를 같은 batch에 한정. 일반 legacy writer의 장벽은 유지.|D01, R05, R08, R09 PASS. 관리자 복구와 실제 로컬 HTTP 암호 검증·새 세션 생성, stale 복구/credential 거절.|
|D02|cleanDueMembers의 unconditional legacy media gate가 active cleanup 전체를 차단.|`member-management.mjs:cleanDueMembers`, `d1-store.mjs:flush`: owner별 due/phase guard와 generation fence를 첫 파일 삭제 전에 commit. retry 재개도 fresh guard. final purge batch에 hashed tombstone 저장. session 만료를 삭제 이유로 삼지 않음.|D02, D04, R05, R06 PASS. partial storage 실패/retry/재실행, pending jobs 최종 purge 전 유지, shared Starter hash 유지, 삭제 후 late-result eligibility false.|
|D03|기존 편집이 cutover 이후 metadata409를 만나면 catch에서 fresh candidate를 삭제.|`world-edits.mjs:worldEditsAPI`: immutable 원본/후보를 오류 보상으로 삭제하지 않음. metadata commit 전에 private owner prefix에 `candidate-manifest.json`을 immutable PUT하여 owner/world/operation/source/result hash·approved=false 보존. 실패는 오류로 반환하며 자동 승인/재호출/복구 dispatcher 없음.|D03 PASS: metadata409에도 후보1개+manifest+원본 유지, manifest와 실제 bytes hash 일치. R11 승인 응답 유실/replay/requery 및 R12 PUT 직전 실패·원본/불명 비용 보존 PASS.|
|E01|raw migration 재실행이 unconditional ADD COLUMN에서 duplicate column 오류.|migration0006과 `budget-schema.mjs`: 기존 ledger ALTER 제거. IF NOT EXISTS table/view/index/trigger 및 INSERT OR IGNORE default-off만 사용. ledger 행에 종속된 precision-proof metadata로 이전 열 초안 대체.|E01, E03, E04, 기존 migration rollback/재실행/FK/index/unique 보존 테스트 PASS.|
|E02|9열 구 loader가 SELECT rowid,*의 새10번째 열을 복사하다 실패; native OFF여도 발생.|동일 migration 변경으로 기존 ledger9열 유지. `b10_budget_ledger`는 raw ledger+일치하는 proof를 조회하는 view이며 독립 비용 원장이 아님. 현재 adapter는 proof metadata를 별도 로드하고 과거 로컬10열 초안도 열 삭제 없이 읽을 수 있음. 과거 비용의 자동 인증/재작성 없음.|E02, E03, R07 PASS. 재구성한 구9열 loader roundtrip 성공. 실제 배포된 구 binary 및 in-flight 혼재는 BLOCKED로 유지.|

## 3. 단위 및 SQL/JS parity

- 원장: 기존 `workers_ai_requests`만 authoritative. 새 `b10_ledger_certifications`는 `ledger_id` PK/FK와 raw cost에 연결된 정확성 proof이며 예산 counter/총계/독립 예약을 갖지 않는다. 원래 ledger9열과 cost/response/승인 JSON을 변경하지 않는다.
- `10^14` units/Neuron, JS BigInt, SQL INTEGER. 큰 SQL 값은 decimal TEXT bind/read. 실제 raw와 일치하는 proof만 view에 노출하고, JS가 정확한 변환값과 다시 비교한다. NULL/stale/과도한 정밀도는503이며 무료 예산 소진이라고 표시하지 않는다.
- 이미 확정한 정책 유지:31.42의 알려진 Klein512 보정, world-vision/world-retry image pool, 실패·불명 비용의 보수적 유지, 확인된 미실행/거절만0 환불, UTC 일자 guard, operation 중복 방지. 사용자별 대화 제한 추가0.
- A01 **650개** decimal/I64/TEXT 경계, B01 **192개** 비용·상태·pool corpus, A02 SQL SUM/JS 합산 overflow, B02 가상 UTC 자정, B06 동시4요청/동일 operation/잔여1 unit 및 R04 정산·환불 parity PASS. 기존 B10 parity도 PASS.
- rounding은 기존 text ceiling만 BigInt로 정확히 수행한다. 표현 불가능한 금액은 반올림/절삭 없이 거절한다. 원격 ledger 전수 정밀도/비용 인증은 **BLOCKED: 이번 승인 범위 밖**.

## 4. 실행 결과

최종 명령(전체 프로젝트 suite가 아닌 직접 관련8개 파일):

```sh
node --test cloudflare/tests/b10.test.mjs cloudflare/tests/b10-remediation.test.mjs cloudflare/tests/user-accounts.test.mjs cloudflare/tests/member-management.test.mjs cloudflare/tests/ai-limit.test.mjs cloudflare/tests/image-budget.test.mjs cloudflare/tests/edit-contract.test.mjs cloudflare/tests/world-edits.test.mjs
```

- **166 tests / PASS166 / FAIL0 / skipped0 / cancelled0**, exit0. `final.log`, 로컬 wall time 약4.67초(클라우드 응답시간 아님).
- 원 감사20개는 **PASS20 / FAIL0**. 추가 경계/보존/경쟁12개를 포함한 remediation 파일은 **PASS32 / FAIL0**, 해당 fixture에서 외부 fetch0. `final-regression-results.json`.
- 수정 과정의 실제 실패도 `regression*.log`, `related*.log`에 보존:9→proof schema로의 fixture query 수정, 잘못된 foreign-owner fixture FK, 신규 manifest 때문에 바뀐 파일 개수, 다른 world에 잘못 복사하던 Starter fixture 수정. assertion/skip으로 숨기지 않고 보강했다.
- 기존의 “native cleanup은 항상 거절” expectation은 승인된 D02 수정으로 더 이상 계약이 아니므로, 실패 시 데이터 보존 assertion과 새 실제 active cleanup/retry/purge 검증으로 대체했다. CAS·금액·소유권·hash assertion은 약화하지 않았다.
- 메모리 SQLite/sql.js와 TestD1.batch의 transaction 검증이며 **실제 Cloudflare D1 보장으로 표현하지 않는다**. UI/실제 브라우저는 이번 backend 수정에서 실행하지 않았다.

## 5. 보존 및 변경 범위

제품/초안 수정: `cloudflare/{b10-api,b10-foundation,budget-fixed,d1-store,member-management,user-auth,user-worlds,workers-ai,world-edits}.mjs`, `cloudflare/migrations/0006_b10_foundation.sql`.
신규 공통 코드: `cloudflare/b10-validation.mjs`, `cloudflare/budget-schema.mjs`.
테스트: 기존 `cloudflare/tests/{b10,world-edits}.test.mjs`와 신규 `cloudflare/tests/b10-remediation.test.mjs`.
문서: 본 보고서 및 C00 amendment/STATUS/NEXT_SESSION 인계.

- R03/R08/R10: 실제 fixture 원본 bytes SHA-256/Starter hash/head 유지, 잘못된 저장 시 snapshot/revision/ledger 동일. R11: 승인 이미지/원본 hash가 새 HTTP 조회 및 승인 replay에서 일치. 기존 회원 편집 시험: **마스크 밖 변경0**, 원본 bytes 동일, 승인 및 재로그인 후 유지 PASS.
- 기존 pending/승인/Starter 원본을 migration으로 정리하거나 재작성하지 않는다. metadata 충돌 후보/manifest는 보존하며, manifest만으로 world에 적용하지 않는다.
- 실제 계정 삭제0. final purge/retry/원본 제거 시험은 모두 disposable fixture이고 기존30일 정책을 유지한다. 공유 원본은 fixture에서도 유지했다.
- 원본 파일 목록과 작업 후 비교는 `preservation.json`, 작업 후 Git 상태는 `final-status.txt`, 파일별 SHA-256은 `final-hashes.json`에 기록한다. 기존 파일 삭제0, 범위 밖 기존 파일 hash 변경0.
- migration은 **로컬 additive 초안만 수정**, 원격 적용0. 로컬10열 과거 초안에 새 migration을 적용해도 그 열을 파괴적으로 제거하지 않는다. 실환경은 먼저 구9열 schema/배포 이력 확인 필요.
- 안전 rollback: native gate OFF 유지, migration/출력/원장을 되돌려 삭제하지 않는다. 이미 native state가 있다면 active=0으로 legacy writer를 다시 열지 않는다. 기존 cf_state stale-write barrier를 우회하지 않는다.

## 6. 남은 별도 검증 / 제한

- **BLOCKED(기존 별도 gate 유지):** 현재 ledger 전수 인증, 실제 D1 precision/batch/trigger/FK/migration history/Free CPU·성능, 실제 Tigris immutable PUT·부분 실패, 배포 구 Worker binary와 in-flight 혼재 검증. 이번에는 원격 접속/요금제/배포/실제 provider 호출을 하지 않았다.
- **NOT TESTED / 범위 밖:** B11 dispatch/lease/provider 종료·결과 복구, B12 원자 승인 receipt/world apply, I20 UI 연결 및 실제 브라우저·Provider 검증. 이 기능들을 이번에 구현하지 않았다. 기존 ordinary legacy writer 전체를 native로 전환했다는 뜻도 아니다.
- 후보 PUT 자체가 실패하면 새 후보는 실제로 저장되지 않는다(R12에서503·후보0 검증). 원본과 비용/오류는 보존하지만 모델 결과 복구 성공으로 주장하지 않는다. 보존 manifest의 자동 탐색/재적용은 없으며 B11/B12 별도 검토 대상이다.
- 세션 만료만으로 결과를 삭제하지 않는다. 삭제 후 native eligibility와 metadata 부활 차단은 로컬 확인했지만, 외부 PUT와 cleanup의 실제 동시성·late orphan 회수는 실환경/B11 검증 전 보장하지 않는다.
- 실제 AI/원격 D1·Tigris 변경/Preview·Production 배포/활성화/Git commit·push·merge/branch 전환/reset/clean 모두0. 환경 opt-in 미설정과 migration active0 유지. 작업 종료 후 추가 단계에 진입하지 않는다.

**READY FOR B10 RE-AUDIT**
