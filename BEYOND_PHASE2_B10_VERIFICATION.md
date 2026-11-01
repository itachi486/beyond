# BEYOND Phase 2 B10 — 구현 및 로컬 검증

2026-11-01 UTC. **B10 로컬 기반 구현 완료. native 기능은 비활성. B11/B12/I20/T30 미착수. 실제 Preview/원격 D1/Tigris/provider 검증 아님.**

## 1. 범위·정책·자료

최신 사용자 승인으로 U01 정수 fixed-point, U02 기존 ledger 단일 원천, U03 native/legacy writer barrier, U05 30일 삭제와 owner fencing 방향을 확정했다. B10 preflight, C00, implementation plan, A07/A09 verification, DECISIONS/STATUS/NEXT_SESSION 및 관련 기존 코드를 재검토했다. actionType은 CREATE_WORLD_OBJECT / EDIT_EXISTING_WORLD_OBJECT 그대로다.

main / HEAD `f4585907ecb8158eafd61cc769c4c31e94d102c0` 유지. 이번 시작 기준선·전체 dirty/untracked 목록은 `/tmp/beyond-b10-integer-1z3re69f/{baseline.json,git-status.txt}`. 기존 미커밋 작업을 되돌리지 않았다.

## 2. U01 / U02 — 정수 비용·원자 입장

- 오프라인 image-budget-edit / ai-limit / full-error-resolution의25개 JSON을 읽었다. 관측 reserved_neurons 값은1,2,400,109.40349853515625이고 파일 간 중복 관측이 포함된다. 실제 사용량 보관 totalNeurons에는109.40349853515625 및 여러 일별 집계값이 있다. **관측 최대 소수14자리**. 역사31.42는 기존 코드/보고서와 사용자 요구대로 별도 corpus에 포함했다. 현재 원격 ledger 전체를 확인한 결과는 아니다.
-10^14 units/Neuron.109.40349853515625 →10940349853515625 units,31.42 →3142000000000000. 최대 무료 cap10000 →10^18은 SQL signed64-bit 범위 이내다. JS BigInt를 사용하고 큰 정수는 decimal string으로 bind, SQL 집계는 TEXT로 받아 Number 정밀도 손실을 피한다.
- 반올림하지 않는다. 정확히 나누어지는 추가 trailing zero는 허용하지만14자리로 표현 불가능한 값·NaN·음수·overflow는 budget_precision_unverified로 차단한다. 미인증 값을0으로 취급하지 않는다.
- 기존 workers_ai_requests에 nullable reserved_units만 추가한다. 새 counter/epoch는 없다. 원래 reserved_neurons/response는 보존한다. 기존 행 자동 보정/backfill 없음. SQL admission은 미인증 행이 있으면 차단하고 JS도 raw canonical decimal/units 일치를 검사한다.
- 역사 보정은 오직31.42 + image/success + Klein + numeric512×512에 적용한다. world-vision / world-retry는 image pool, 실패/불명 비용도0으로 확정되지 않았다면 포함. pending/success 이미지 count, retry 제외 규칙 유지. 비용 미확인과 제공자 무료 한도를 혼동하지 않는다.
- native 입장은 같은 D1 batch에서 권한/세계·head/UTC/cleanup/예산 guard → ledger INSERT → job INSERT → cf_state 증가를 처리한다. 중간 실패는 전체 rollback. 같은 owner/world/operation+hash는 재사용하고 다른 hash는409. ledger ID도 owner/world/operation hash로 분리한다.
- 기존 legacy reserve의 **예산 판정**도 BigInt로 바꿨다. 기존 quote/usage 표시용 Number와 예산 판정을 구분한다. 기존 releaseUnstarted·text settlement의 환불 정책은 변경하지 않았다. native settlement/cancel/dispatch는 B11 이후 범위다.

정밀도 숫자만 담은 증거: `/tmp/beyond-b10-integer-1z3re69f/precision.json`. 개인 식별자/프롬프트/인증값을 복사하지 않았다.

## 3. Native CAS / Job Foundation

- B10Repository: 회원 session·credential version·active profile·owner·cf_state.ready를 commit 조건으로 재확인. unrelated cf_state revision은 native 승인 조건이 아니다.
- user_worlds.version과 숫자 image head revision을 별도 검사한다. world save와 world revision history는 한 batch. image head의 실제 적용/증가는 B12 책임이며 B10은 candidate를 적용하지 않는다.
- seedHead는 server-owned Starter/ready asset hash 또는 명시한 승인 parent/hash를 검증한다. head0은 검증된 native-era 기준선이고 과거 승인 횟수를 추정한 backfill이 아니다. 기존 승인 원본/Starter/JSON을 수정하지 않는다.
- ai_jobs는 id/owner/world/operation/hash/contract version/base revisions/source/target/input/state/provider phase/state version/cleanup generation/ledger/day/result reference/timestamps를 가진다. 기본 QUEUED / NOT_DISPATCHED / result_ref NULL. B11 dispatch marker·lease·복구나 B12 receipt를 구현하지 않았다.
- 새 backend 경로: `/api/user/native-worlds/:id[/head]`, `/api/user/native-jobs`. 서버가 cookie에서 actor를 도출하고 기존 Origin/JSON/CSRF 검증을 재사용한다. 계약v2의 숫자 head를 사용한다. 202는 QUEUED metadata뿐이며 이미지 생성·승인·세계 적용 성공이 아니다. 기존 v1 UI 자동 연결 없음.

## 4. U03 — writer barrier와 활성화 제한

- native 성공 쓰기도 cf_state 증가. 기존 d1-store snapshot writer는 기존 global revision/권한 guard 유지.
- migration의 protected-table trigger는 native 활성 상태에서 transaction marker 없는 쓰기를 거절한다. user_worlds/revisions, ledger, user assets/accounts/profiles/deletions, 새 jobs/heads를 보호한다. fresh legacy writer도 head/ledger만 우회 갱신하지 못한다. D1 batch rollback이 marker를 남기지 않는지 검사했다.
- 조사 경로: handler의 user-worlds/workers-ai/world-edits/member-management 및 generated admin API는 compatibility store로 commit한다. read-api는 직접 D1 조회만 한다. scheduled cleanup도 compatibility store를 사용한다. native repository만 새 native batch를 사용한다. 별도 migration/import 도구는 운영 전환 수단이며 이번에 실행/변경하지 않았다.
- 공용 editorial admin 데이터는 기존 global CAS를 유지한다. native와 다른 세계/공용 편집의 전역 revision 변화가 native CAS를 불필요하게 실패시키지는 않는다.
- **기본 비활성:** migration의 b10_control.active=0, BEYOND_B10_LOCAL_ENABLE 미설정. 실제 환경에서 활성화한 적 없다. 구 binary의 이미 나간 provider/Tigris 작업을 DB trigger로 취소하거나 모든 외부 부작용까지 막았다고 주장하지 않는다. 준비 릴리스·in-flight drain/검증, 미인증 ledger 처리, 다음 단계의 fenced cleanup 통합 없이 활성화하면 안 된다.

## 5. U05 — cleanup 호환

- 기존30일 복구 정책과 삭제 대기 데이터 보존 유지. active profile만 신규 admission 가능하다.
- canFinalizeResult는 owner 존재·cleanup generation/phase·최종 삭제 tombstone을 검사한다. session 만료만으로 내부 결과 귀속을 거부/삭제하지 않는다. 실제 결과 저장 writer는 B11 미구현이다.
- due cleanup용 generation fence는 삭제 기한과 cleaning/retry를 확인한다. 최종 삭제 후 hash(ownerId)+timestamp만 남기는 최소 tombstone을 둔다. 기존 job/head는 owner/world FK cascade로 정리 가능하며 owner 부재/최종 tombstone 상태는 늦은 결과 eligibility를 차단한다.
- 구 cleanup은 native mode에서 **media 삭제 전** 중단한다. 이는 아직 검증되지 않은 구 runner를 활성화 상태에서 실행하지 않기 위한 gate이며 실제 cron/30일 정책/계정은 변경하지 않았다. native fenced runner 및 외부 late PUT 정리는 다음 단계 검토가 필요하다.
- 격리 fixture에서 pending 보존→세션 만료→cleanup fence→최종 삭제 후 늦은 결과 차단과 FK 검사를 수행했다. 실제 사용자 삭제·Tigris 삭제는0회다.

## 6. Schema / migration 초안 및 재실행

`cloudflare/migrations/0006_b10_foundation.sql` 신규 초안:

- 기존 ledger reserved_units TEXT(nullable canonical signed64 integer spelling).
- ai_world_heads, ai_jobs, b10_control/context/guards/deleted_owners 및 indexes/barrier triggers.
- ai_approvals·receipt 테이블 없음(B12 제외). 새 schema는 원격에 적용하지 않았다.

로컬 재실행 절차: PRAGMA table_info(workers_ai_requests)로 column 존재 확인 → 존재할 때는 ALTER 한 문장만 생략 → 나머지 CREATE IF NOT EXISTS / INSERT OR IGNORE를 transaction에 적용. 단순 SQL 파일 전체를 무조건 반복하면 ALTER 중복 오류가 나므로 그렇게 실행하지 않는다. 테스트에서 중간 DDL 오류 rollback 후 재실행·두 번째 적용·row/원본 응답·FK 보존을 확인했다. 실제 D1 migration은 백업/현재 row-count·FK 대조 및 별도 승인 전 금지다. rollback은 환경 opt-in을 닫아 신규 입장을 중단하고 기록을 보존한다. 이미 native 자료가 있으면 DB barrier(active=1)를 유지하며 active0으로 구 writer를 다시 열지 않는다. DROP/과거 revision 되감기 없음.

## 7. 테스트 결과·실패 이력

|검사|결과|
|---|---|
|새 B10 suite|**15개 통과**(기존 suite14 + 추가 legacy head1). 소수/overflow, SQL↔BigInt 비용·pool·actor count·경계·UTC, CAS 경쟁, 독립 세계, duplicate/hash, 부분 실패 rollback, 기존 ledger/원본 metadata 및 FK, migration 실패·재실행, stale/fresh writer, 모호한 과거 parent 시각 거절, cleanup/owner, 실제 HTTP auth/CSRF/default-off·모델 호출0.|
|최종 ready/HTTP gate 재검사|**2/2 통과**. 마지막 ready 조건 추가 후 해당 검사만 실행.|
|관련 Node 회귀|초기 묶음48개 중47통과/1실패. legacy9열 view 문제 수정 후 실패 사례 통과. 최종 변경 후 관련 기존 handler/limit/companion 검사 **6/6 통과**. import되는 기존 테스트는 이름 필터로 필요한 것만 실행.|
|A07/A09·AI 오류 Vitest|**21/21 통과**,3파일.|
|최종 build|tsc + Vite **통과**. 기존 큰 chunk 경고 남음.|

실패를 숨기거나 assertion을 완화하지 않았다. 최초 barrier 테스트는 빈 ledger에 UPDATE를 시도해 행 trigger가 발화하지 않았으므로 기존 행을 fixture에 추가했다. 실제 코드 회귀는 migration 전에도10열 memory schema를 쓰던 문제로, binding의 실제 column 정보에 따라9/10열 view를 선택하도록 수정했다. 테스트 삭제/skip 없음.

로그: `/tmp/beyond-b10-integer-1z3re69f/{native-final.log,gate-final.log,regression.log,retest.log,legacy-final.log,ui-regression.log,build-final.log,head-final.log}`. D1 어댑터는 sql.js/SQLite 메모리 DB 기반이다. 실제 Cloudflare 동시성/CPU·D1 batch·Tigris/provider 성공의 증거로 해석하지 않는다. 이번 브라우저 테스트/실제 provider 테스트는 수행하지 않았다.

## 8. 수정 파일

기존 코드: cloudflare/workers-ai.mjs(정수 admission 판정/정밀도 오류), d1-store.mjs(9/10열 호환·media gate), handler.mjs(native API dispatch), member-management.mjs(cleanup 선제 gate).
신규 코드: cloudflare/budget-fixed.mjs, b10-foundation.mjs, b10-api.mjs, migrations/0006_b10_foundation.sql, tests/b10.test.mjs.
문서: 본 보고서 신규, DECISIONS/C00 정책 갱신, STATUS/NEXT_SESSION 인계 추가. 제품 UI·이미지·기존 승인/pending 원본·배포 설정은 변경하지 않았다.

## 9. 미검증·남은 위험·다음 단계

- 현재 원격 ledger 전수 정밀도 및 reserved_units 인증은 미실행. 관측 밖 값은 수용했다고 가정하지 않고 native admission을 차단한다. 실제 재무/제공자 비용 확정은 별도 근거가 필요하다.
- 실제 D1/Tigris/Worker 동시성·Free CPU·성능/월0달러 청구 검증·migration/배포·현재 in-flight 정리는 미실행. counter 도입 필요성을 입증한 측정도 없으므로 도입하지 않았다.
- image 적용/증가와 원자 승인, lease/dispatch/recovery, 외부 late PUT 정리는 B11/B12 미구현. U06/U07은 해당 단계 전 검토 필요. admin browser-only는 새 member native world 원자성을 제공하지 않는다.
- native 모드 활성화는 이번 결과만으로 준비 완료가 아니다. 활성 상태에서는 업그레이드되지 않은 일반 대화 ledger writer 및 회원 세계 쓰기도 fail closed로 차단되므로 공통 writer 전환 전 운영 사용은 불가하다. 기존 cron/in-flight/provider 결과 처리와 UI 전환이 준비되지 않았으며 gate를 열면 안 된다.

**B10 로컬 검증 후 여기서 중단한다. B11/B12는 자동 시작하지 않는다.** Production/Preview 배포·원격 D1/Tigris 변경·실제 AI 호출·요금제·commit/push/merge/reset/clean/branch 전환 없음. 기존 dirty/untracked 파일과 사용자 데이터 보존.
