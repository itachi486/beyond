# BEYOND Phase 2 — B10 선행 결정 검토 / 구현 중단 보고

2026-11-01 UTC. **B10 선행 검토에서 중단. B10/B11/B12 제품 구현·migration 작성·테스트 실행 없음.**

## 1. 중단 근거

사용자 첨부 승인 문서 §1: “확정되지 않은 사항은 임의로 가정하지 않는다. 실제 구현에 영향을 주는 미해결 사항은 선택지와 위험을 간결하게 정리하고 해당 단계에서 중단한다.” §6 역시 선행 조건·중대한 충돌 발견 시 우회하지 않고 중단하도록 지시한다.

현재 C00 §7.4, §10–11, §15는 U01/U02/U03/U05를 여전히 미확정으로 명시한다. 특히 §15 마지막 문단은 이 결정들을 남긴 채 B10 schema/입장을 확정하지 못하도록 한다. DECISIONS 및 최신 STATUS/NEXT_SESSION에서 이를 확정한 후속 기록을 찾지 못했다. 이번 포괄 구현 승인은 선택지 중 특정 정책을 선택한 결정으로 해석하지 않았다.

## 2. 읽은 자료·기준선

Phase1 safety design, Phase2 implementation plan, C00 contract, A07/A09 verification, AGENTS, DECISIONS, 최신 STATUS/NEXT_SESSION 및 관련 VISION/DESIGN/DISCUSSION_LOG를 재검토했다. 현행 workers-ai, d1-store, world-edits, member-management, schema 및 A09 계약 경계를 대조했다. 과거 Phase1 재현이나 전체 프로젝트 분석을 반복하지 않았다.

branch `main`, HEAD `f4585907ecb8158eafd61cc769c4c31e94d102c0`.
기준선306파일 SHA-256, Git 상태 전체는 `/tmp/beyond-b10-preflight-b3tael_6/{baseline.json,git-status.txt,git-identity.txt}`에 보관했다. porcelain `--untracked-files=all`: 기존 modified35 + untracked245파일. 과거 보고서의 디렉터리 단위 untracked 개수와 직접 비교하지 않는다.

## 3. 현행 코드와 미결 결정

|항목|현재 코드·근거|필요한 선택과 위험|
|---|---|---|
|U01 예산 정밀도|C00:178. workers-ai.mjs의 imageCost는 소수 비용을 반환하며 budgetState는 JS Number로 누적한다. schema의 reserved_neurons는 INTEGER affinity이지만 고정 정수 단위 계약/소수 금지 검증은 없다.|A: 현재 수치 의미를 유지하고 SQL/JS 입장 parity 검증. B: micro-Neurons 상향 반올림(더 이른 차단이 가능한 정책 변경). C: JS 계산+예산 epoch 검증(모든 writer 참여 필요). epsilon으로 무료 한도 초과를 허용하는 방법은 제외.|
|U02 단일 예산 원천|C00:179. workers-ai.mjs:17–32는 기존 ledger 조회→JS 검사→INSERT→flush. 독립 native SQL budget guard/counter는 없다. accountedReservation은 역사 Klein31.42 비용 보정도 수행한다.|A: 기존 ledger를 authoritative로 유지하는 SQL 집계 guard. B: 동기화된 counter/epoch. B는 초기화·정산·구 writer 동기화 누락 시 이중 차감 또는 초과 허용 위험. U01과 함께 선택해야 함.|
|U03 writer 전환 장벽|C00:241–243. d1-store.mjs:36–46의 flush는 전역 cf_state revision/권한 guard 및 revision 증가를 사용한다. world-edits.mjs:50–57의 기존 승인 writer는 ledger JSON approved만 갱신하고 새 native head를 알지 못한다.|A: compatibility 준비 릴리스로 모든 writer를 공통 경계에 참여시킨 후 전환. B: 명시적 쓰기 pause/drain 후 전환. A는 구 binary/in-flight 요청의 우회 방지를 증명해야 하고, B는 쓰기 중단 및 불명 pending을 추정 종료하지 않는 처리가 필요. 단순 cf_state 증가만으로 해결 불가.|
|U05 cleanup fencing·보존|C00:247–251. member-management.mjs:25–33의 cleanDueMembers는 owner prefix를 journal에 기록해 삭제한 뒤 계정 관련 행을 제거한다. 새 job/head/receipt 및 late PUT의 fencing/보존 계약은 없다.|A: owner fence+유한 drain/재조회. B: 늦은 결과 격리 receipt+후속 정리. metadata/prompt/cost 보존·가명화 범위도 결정 필요. A/B는 필요에 따라 결합 가능하지만 정책 승인을 추정하지 않는다. DB 조건만으로 이미 전송된 Tigris PUT을 취소할 수 없고, 진행 중 작업 때문에 삭제를 무기한 막아도 안 됨.|

위 표는 구현 결과가 아닌 **의사결정 자료**다. U01~U05의 기존 정책을 이번에 임의 확정하거나 DECISIONS를 변경하지 않았다.

현재 A07/A09 actionType `CREATE_WORLD_OBJECT` / `EDIT_EXISTING_WORLD_OBJECT` 유지. shared/edit-contract.mjs는 contractVersion1이며 미구현 expectedImageHeadRevision을 거절한다. C00 §16대로 parentId/hash/member world version 어댑터만 존재한다. B10 numeric head 도입은 계약 버전과 legacy writer 처리까지 함께 검토해야 한다. ai_jobs/ai_world_heads/ai_approvals를 새로 구현한 상태가 아니다.

## 4. 권고하는 결정 절차 — 미승인 제안

1. U01은 기존 수치 의미 유지(A)를 우선 **검증**하고, U02는 기존 ledger authoritative SQL guard(A)를 우선 검토한다. 정확한 parity가 입증되지 않으면 조용히 정수 반올림 정책으로 전환하지 않고 다시 보고한다. 원래 데이터의 비용을 소급 덮지 않는다.
2. U03은 준비 릴리스(A)와 쓰기 pause/drain(B) 중 허용되는 전환 방식을 정해야 한다. 어느 쪽도 실제 Preview 배포·운영 중단을 이번 승인에 포함시키지 않는다. 선택 후에도 이번에는 로컬 old/new writer 동시성 검증까지만 수행한다.
3. U05는 30일 계정 삭제와 양립하는 owner fence 위치, late PUT 격리·재조회, job/prompt/비용 metadata의 삭제 또는 가명화 범위를 함께 확정해야 한다. 기존 사용자의 파일 삭제를 이번 단계에서 실행하지 않는다.

B11 직전에는 C00 U06(lease/heartbeat 수치), U07(UTC 경계 재입장·불명 비용)이 추가로 검토되어야 한다. B12 admin browser-only 지원은 U04와 A09의 제한된 보장 수준을 따라야 한다. 이번 첨부의 관리자/회원 보장 구분 요구를 자동 서버 이관 허가로 해석하지 않는다.

## 5. 결정 후 수행할 로컬 검증 기준

- SQL/JS parity: UTC 날짜·pool 분리·세계 vision/retry의 image pool 귀속·소수 경계·역사31.42 보정·동일 operation 재조회·실패/미dispatch/확정 거절/불명 비용·정산 및 반환 중복을 같은 fixture로 대조한다. 현재 text error의 예약 유지 의미를 임의 변경하지 않는다. IEEE 누적 순서 차이도 확인해야 하며 아직 parity 통과가 아니다.
- B10: 같은 세계 stale revision409, 다른 세계 독립 저장, 동일 operation/hash 재사용·다른 hash409, old/native writer interleave, row count/FK 보존 및 migration 재실행.
- B11: dispatch 전/후 종료, 응답 후 metadata 실패, lease/recovery, 불명 자동 재호출0, A 소유 귀속, 기존 pending 추정 정산0.
- B12: 원자 승인/중복·stale·다른 owner/source/보호 영역 거절, D1/Tigris 부분 실패, 후보 보존, 승인과 실제 world revision 일치.

기존 TestD1/TestMedia 및 handler/companion/edit-contract fixture를 재사용한다. 실제 Cloudflare D1/Tigris/Worker/provider 검증은 별도 승인 단계이며 로컬 fixture로 대체했다고 주장하지 않는다.

## 6. 단계별 결과

|단계|수정 파일·schema/migration|테스트·실패/수정 이력|다음 단계|
|---|---|---|---|
|B10|제품 코드0, schema/migration0. 본 보고서 신규, STATUS/NEXT_SESSION 인계 추가만.|정적 코드/문서 대조만. 구현 테스트 실행0. runtime 실패를 수정한 것이 아니라 선행 정책 미결을 발견함.|U01/U02/U03/U05 결정 전 구현 중단.|
|B11|미진입, 변경0.|미실행·미검증.|B10 구현·로컬 검증 통과 후에만 가능.|
|B12|미진입, 변경0.|미실행·미검증.|B11 검증 통과 후에만 가능.|

기존 테스트 결과를 이번 통과 결과로 재사용하지 않았다. I20/T30 미착수. Production/Preview 배포·원격 D1/Tigris 접근·실제 AI·예산 예약·요금제 변경·사용자 변경·데이터 삭제·commit/push/merge/branch 전환/reset/clean 없음. 기존 dirty/untracked 파일은 유지한다.
