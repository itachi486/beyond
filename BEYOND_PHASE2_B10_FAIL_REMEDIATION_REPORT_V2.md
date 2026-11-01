# B10 FAIL Remediation V2

2026-11-01 UTC. 대상은 독립 재감사의 FAIL6개뿐이다. B10은 활성화하지 않았고 B11/B12/I20/T30은 구현하지 않았다.

## 1. 시작 상태와 보존

- branch `main`, HEAD `f4585907ecb8158eafd61cc769c4c31e94d102c0`. 시작 tracked/untracked 파일319개, Git status293개 항목(기존 변경 포함). 작업 전 목록/hash/status/HEAD는 `/tmp/beyond-b10-v2-d6tkw_8y/{baseline.json,status.txt,identity.txt}`.
- 기존 dirty/untracked를 되돌리지 않고 필요한 함수만 수정했다. 기존 테스트 파일은 수정하지 않았다. 테스트 assertion 삭제/완화/skip 없음. 최종 비교는 같은 디렉터리의 `preservation.json`, `final-hashes.json`, `final-status.txt`에 기록한다.
- 실제 사용자/원격 D1/실제 Tigris/실제 AI 호출0, 배포/활성화/요금제/Git commit·push·merge/branch·reset·clean·checkout0. 삭제/PUT 시험은 TestMedia와 disposable DB뿐이다.

## 2. FAIL6개 원인·재현·수정

작업 시작 전에 독립 재감사 probe를 그대로 재실행해6개 안전 assertion FAIL을 재현했다(`before.log`). 해당 collector의 exit0은 결과 수집 완료이지 안전성 PASS가 아니다. 제품 수정 후 앞5개 원 assertion은 통과했다. 원래 N06은 cleanup이 dispatch 중에도 삭제 완료된다는 fixture 전제를 사용할 수 없게 되어, 새 회귀가 **삭제 보류→늦은 결과 거절→비용 보존→최종 삭제** 전체를 검증한다. 기존 저장소 assertion을 바꾼 것이 아니다.

|항목|근본 원인 / 수정 전 실제 관측|수정 파일·함수 / 수정 동작|판정|
|---|---|---|---|
|F01 proof 소실|workersImage가 raw 비용만 UPDATE하여 trigger가 proof를 삭제. 성공/raw43.2/proof NULL. 기존 job/cache에 proof가 없어도 재사용 가능.|`workers-ai.mjs:workersImage/writeCost/assertCostProof/reserve`, `b10-foundation.mjs:admit`: 이미지 확정도 공통 raw+proof transaction 사용. 기존 operation은 actor/hash/kind 확인 후 정확한 proof를 검증. native 중복 job도 proof 검증. 누락/불일치면503, 임의 인증/재생성/모델 재호출 없음.|**FIXED LOCALLY**|
|F02 nested JSON|found/completed 원소와 conversations 내부가 미검증. frontend invalid 데이터가 native version1→2로 저장됨.|신규 `b10-json-schema.mjs`, `b10-validation.mjs`, world API 검증: 중첩 key allowlist/type/필수값/UUID목록/메시지 role·길이/배열 cap/정규화 좌표/graph 내부 key/task enum 검사. 전체512KiB/depth32/string12000 상한, prototype/accessor/symbol/위험 key 거절. 기존 실제 validWorld/validGraph 값 검증 유지; v1에 graph가 있으면 graph 계약도 확인.|**FIXED LOCALLY**|
|F03 legacy revision|legacy PUT이 MAX_SAFE_INTEGER를 증가시켜9007199254740992를 HTTP200으로 저장.|`user-worlds.mjs:userWorldAPI`: safe integer 및 증가 가능 범위 명시 거절. `d1-store.mjs:flush`: captured UPDATE의 version/revision/credential_version/cleanup_generation 결과를 공통 검사하여 잘못된 범위면 원격 batch 전 거절. 기존 global cf_state CAS/ready/auth 상한과 native marker 장벽 유지.|**FIXED LOCALLY** (Preview runtime writer 범위)|
|F04 generation|repository fence helper에 cap/CAS가 없어 MAX_SAFE_INTEGER+1 commit.|`b10-foundation.mjs:fenceDueCleanup/canFinalizeResult`: safe nonnegative integer, 증가 상한, owner별 world/generation snapshot count+각 generation CAS. 명시적 expectedGenerations 지원. 오래된 map은 재사용 불가. cleanup bridge의 typeof/음수/상한 guard도 보강.|**FIXED LOCALLY**|
|F05 partial reservation|proof staging 실패 후 pending ledger INSERT가 남아 handler 후속 flush에서 ledger1/proof0 commit.|`workers-ai.mjs:reserve`: ledger+proof staging을 local transaction으로 묶고 오류면 memory와 captured writes 함께 rollback. 열린 caller transaction에서는 쓰기 전에 명시적 거절(그 상태로 durable reserve/flush를 제공할 수 없음). 기존 native job+ledger+proof batch 유지.|**FIXED LOCALLY**|
|F06 late private files|cleanup 후 owner0/world0/tombstone1이어도 구 dispatch 응답이 original/candidate/manifest3개를 PUT.|`d1-store.mjs:hasUnresolvedResults/resultGeneration/assertResultOwner/failOwnedResult/flush`, `member-management.mjs:cleanDueMembers`, `world-edits.mjs`: pending dispatch가 있으면 final cleanup 보류; SQL claim/purge guard도 pending 부재 재검증. member 결과는 원래 actor/world/generation과 현재 account/phase/deadline을 PUT 전 재검증. 거절은 원래 예약에 terminal error만 기록하고 비용/proof 유지. 불명 PUT는 pending+recoveryRequired를 유지해 final purge를 막음.|**FIXED LOCALLY**, 운영/실storage 한계는 §7|

### F02 호환성과 데이터 보존

- v2 native progress는 version/found/completed/conversations 필수. 모든 제공된 배열·message·task·point 구조를 검사한다. discoveries는 실제 UI와 같은 최대12개, dependency는 앞선 point만 허용한다.
- v1 endpoint의 partial progress와 기존 companion description 생략을 **명시적 호환**으로 허용한다. 새 필드를 추론하거나 빈 값으로 재작성하지 않는다. 제공된 필드의 잘못된 값/unknown key는 거절한다.
- 전체 Cloudflare 실행에서 기존 companion-actions의 description 생략이400을 일으킨 것을 발견했다. 기존 assertion을 수정하지 않고 v1 선택 필드 호환을 보강해 해결했다(`cloudflare.log` 실패와 `compat.log` 성공 보존).
- 기존 read/원본/승인 기록을 자동 정리하지 않는다. 불명/잘못된 과거 JSON을 저장 성공으로 숨기지 않고, 수정 요청을400으로 거절하며 기존 데이터는 유지한다.
- 세계 모델의 음수 rotation/layer/3D 좌표 등 기존에 허용된 범위는 기존 validWorld/validGraph가 검증한다. 모든 음수를 무조건 금지하여 정상 모델을 깨뜨리지 않았다.

## 3. 비용·operation 원자성

- 단일 authoritative ledger와10^14 units/BigInt/SQL CAST 규칙 유지. 새 counter/table/migration 없음. raw/proof 정확성은 기존 certification metadata에 연결한다.
- 이미지 성공, text/Companion 정산, 확인된 미실행 환불은 공통 writeCost를 사용한다. missing usage/결과 불명/완료 후 storage 오류의 비용은 추정 환불하지 않는다.
- 같은 id의 actor/hash/kind가 다르면 conflict. 같은 operation은 기존 결과/상태를 반환하며 새 예약을 만들지 않는다. 유실 proof를 관측하면 보수적으로 실패하고 과거 성공 비용을 추정하지 않는다.
- legacy reserve는 local staging rollback + 기존 D1-style atomic flush/CAS; native admit는 job+ledger+proof+guard를 한 batch로 유지한다. concurrent/중복/UTC/잔여1 unit 기존 검사는 그대로 통과했다.
- 실제 D1 transaction/driver 호환성을 입증한 것은 아니다.

## 4. Legacy writer 조사·적용 표

아래 Preview runtime SQL은 공통 adapter가 최종 commit 전에 revision을 검사한다. global CAS는 유지되며 native-active protected writer를 임의로 열지 않았다.

|Writer군|numeric revision 경로|적용/확인|
|---|---|---|
|User World POST/PUT|input version 및 stored version+1|endpoint safe bound + adapter guard|
|일반 대화/WorldAdventure sidecar|persistSidecar→User World|동일 bound/CAS; A07 context 유지|
|WorldCompanion commit/send/choose|world/progress→User World|동일 guard; nested history 추가|
|WorldCompanion/WorldImageEditor generate/approve/reject|v1 계약 expectedWorldRevision / ledger JSON|기존 shared safe-integer 계약 유지; metadata flush global CAS; B12로 바꾸지 않음|
|WorldEditor/SpiritEditor|회원 User World / admin browser local|회원 동일 guard; local updatedAt 비교는 numeric revision 아님|
|Starter copy|managed-image version snapshot + User World|starter version safe integer 검사, 기존 asset/hash 검증 유지|
|Asset upload|pending/ready metadata|numeric world revision 증가 없음; 기존 global CAS. 별도 비AI 업로드의 전체 cutover는 여전히 별도 검증|
|retryPending/importLegacy/backup restore|기존 requestId/version world save|동일 bound/CAS, 새 operation 비용 예약 없음|
|admin editorial worlds/discoveries|version=version+1 / generated server bridge|adapter guard 공통 적용; 기존 central conflict tests 유지|
|central character edit/archive/delete|central_characters version 증가|adapter guard 공통 적용; 원본/삭제 보호 절차 유지|
|managed images metadata/upload/cleanup|row.version+1|adapter guard 공통 적용; immutable 파일 방식 유지|
|admin member suspend/delete/restore|profile+credential version|fresh member scope guard + adapter bound|
|user login/recovery/reset/settings|credential/profile version 및 snapshot|기존 session/CSRF/credential 검사 + bound; recovery 경쟁 유지|
|native save/seed/admit|world/head/job|기존 safe bound/world/head CAS 유지; job 중복 proof 추가|
|repository cleanup fence|cleanup_generation+1|safe bound + expected map/count CAS|
|scheduled cleanup bridge|head generation + cf_state|negative/type/cap + global CAS + pending-result fence|
|terminal late-result error|cf_state+1|명시적 CHECK guard+batch, 원래 actor/id의 pending 행만 UPDATE; INSERT로 부활시키지 않음|
|기타 captured snapshot UPDATE|version/revision/credential/generation assignment|adapter 최종 검사; stale global revision 거절|
|browser local cache/IDB/world graph|epoch/updatedAt|numeric D1 revision 아님; A07 원본 코드 변경0|
|standalone Node store/API|별도 SQLite domain|B10 Preview adapter 범위 밖; 기존 server81개 재실행, 이 domain 전체를 native로 이관하지 않음|
|migration/import/운영 scripts 직접 SQL|adapter 우회 가능 신뢰 경계|미실행·원격 금지. 기존 BLOCKED 운영 gate 유지, 임의 활성화/도구 실행 없음|

“모든 운영 writer가 활성화 준비 완료”라는 주장은 하지 않는다. 일반 UI는 여전히 legacy endpoint를 사용하며 B11/B12/I20은 미구현이다.

## 5. 추가 테스트와 수정 전후

신규 `cloudflare/tests/b10-v2.test.mjs`: **15개**. 독립 probe의 앞5개 assertion을 실제 node:test 회귀로 옮겼고, N06의 안전 전제 및 추가 실패 경로를 새로 검사했다.

|검사|수정 전|수정 후|
|---|---|---|
|N01 이미지 성공 proof|raw43.2/proof NULL|정확한 proof 유지 PASS|
|N02 실제 frontend가 거절하는 중첩 progress|server version 증가|저장 전 거절 PASS|
|N03 legacy MAX revision|HTTP200/unsafe 저장|400/기존 version 보존 PASS|
|N04 generation MAX|unsafe increment commit|명시적 거절 PASS|
|N05 proof staging error|후속 flush에 ledger만 저장|rollback, ledger0/proof0 PASS|
|F06 dispatch/삭제 race|owner 삭제 후 private3개 생성|삭제 보류→late result409→files0→최종 삭제/비용 보존 PASS|
|F01 기존 success proof 없음|캐시 재사용 가능|재생성/추정 없이 거절 PASS|
|F02 v1/v2 nested/history/오염|전체 검증 없음|허용 legacy 유지, invalid nested/key/배열/좌표/prototype 거절 PASS|
|F06 generation 변경|PUT 최종 generation 검증 없음|원래 actor 비용 유지, PUT0 PASS|
|F06 불명 storage PUT|pending 보호 부족|recoveryRequired/pending 유지, final cleanup 보류 PASS|
|F03 central legacy revision|공통 bound 없음|최종 commit 거절/원본 version 보존 PASS|
|F04 unsafe/stale expected generations|old generation fence 가능|음수/소수/unsafe/old map 거절 PASS|
|F05 열린 caller transaction|부분 staging 가능|staging 전 거절/금액0 PASS|
|F01 native 중복 job proof 누락|검증 없이 반환|job/ledger 중복0, proof 재생성0 PASS|
|F06 최종 삭제의 최소 금융 기록|원장을 삭제하던 정책|actor hash·비용·proof·status 보존, private 응답 제거,31.42 보정 유지 PASS|

동시 입장/동일 operation/A→B context/recovery-vs-cleanup/metadata 응답 유실/원본 hash/mask 밖 변경0은 기존 관련 테스트로 추가 재검증했다. 실제 browser 재검증을 대신했다고 주장하지 않는다.

### 기존 PASS18개

기존 테스트 파일 hash 변경0. C01/C03/B03/B05/D01/D02/D03/E01/E02 및 A01/A02/A03/B01/B02/B06/D04/E03/E04에 해당하는 **PASS18개 유지**. 원래20개 assertion과 remediation32개는 기존 파일에서 모두 PASS. 새로 보강한 F02/F01 때문에 기존 PASS assertion을 완화하지 않았다.

### 실행 로그

증거 루트 `/tmp/beyond-b10-v2-d6tkw_8y`:

- `related.log`: 기존 관련166개 + 당시 신규11개 = **177/177 PASS**, skipped0.
- `cloudflare.log`: 최초 전체319개 중1개 v1 description 호환 실패. 실제 실패를 보존했다. 수정 후 `compat.log`33/33 PASS.
- `cloudflare-final.log`: 전체 Cloudflare **320/320 PASS**, skipped0, exit0. 기존166개·remediation32·원감사20개 포함(중복 합산하지 않음).
- 마지막 task enum 보강 이후 영향받는 companion+신규 회귀만 `schema-final.log` **53/53 PASS**.
- 마지막 금융 보존 assertion 추가 후 `financial-final.log`: 신규 회귀 **15/15 PASS**, exit0. 신규 test 수 증가를 전체320개 실행 수에 임의 합산하지 않는다.
- 마지막 ownerId metadata 자료형 보강 후 `owner-schema-final.log`: 신규15개+기존 회원 경로21개 **36/36 PASS**, exit0.
- `server.log`: **81/81 PASS**, `frontend.log`: **62/62 PASS**(12 files). 기존 A07 계정 context/frontend 검증 포함.
- `build.log`: **tsc --noEmit + Vite build PASS**. 출력은 /tmp/build, 기존 dist 덮어쓰기 없음. 기존 bundle-size warning 외 실패 없음.
- 기존 6개 반례 재현 결과는 before.log에 보관. 원 감사 디렉터리의 과거 증거 JSON은 원래 audit log 내용으로 복원하여 이번 결과로 바꾸지 않았다.

## 6. 변경 파일

제품 수정7개:
- `cloudflare/workers-ai.mjs` — proof 검증/이미지 정산/원자 staging.
- `cloudflare/b10-foundation.mjs` — duplicate proof/generation bound+CAS/v1 graph 검사.
- `cloudflare/b10-validation.mjs` — 재귀 안전 검사 및 schema 연결.
- `cloudflare/user-worlds.mjs` — legacy version/v1 graph 검사.
- `cloudflare/d1-store.mjs` — 공통 revision 검사/result-owner·generation/terminal error/pending cleanup guard.
- `cloudflare/member-management.mjs` — pending 보류/최종 금융 행 비식별 보존.
- `cloudflare/world-edits.mjs` — dispatch generation capture/PUT 전 검사/불명 storage 보류.

신규: `cloudflare/b10-json-schema.mjs`, `cloudflare/tests/b10-v2.test.mjs`, 본 보고서. STATUS/NEXT_SESSION/C00에는 결과와 계약 변경 인계만 append한다. schema/migration/config/기존 테스트/프런트엔드 코드 변경0.

## 7. 삭제·늦은 결과·원격 제한

- 단순한 PUT 직전 체크만으로 distributed race를 해결했다고 주장하지 않는다. **pending durable ledger가 final deletion을 막는 보수적 fence**를 추가했다. 새 admission은 deletion_pending에서 기존 server auth로 차단된다. generation/owner 검증은 session 만료와 구분하고 원래 actor를 사용한다.
- deadline이 지났거나 cleanup phase/generation이 달라진 늦은 member 결과는 PUT하지 않는다. 기존 reservation을 error로 표시하고 금액/proof는 유지한다. final purge는 actor를 SHA-256 pseudonym으로 바꾸고 응답 개인정보를 제거한다. 비용·상태·operation 행을 임의 삭제하거나 청구 금액을 추정하지 않는다. 알려진31.42 금융 보정만 남긴다.
- **제한:** provider/PUT 결과가 불명확하면 계정 삭제가30일 이후에도 보류될 수 있다. 자동 재호출/자동 추정 정산/자동 orphan 삭제/강제 finalize는 없다. 안전한 reconciliation은 별도 승인·설계가 필요하다. 운영상 무기한 pending을 해결했다고 주장하지 않는다.
- 현재 native QUEUED+NOT_DISPATCHED job은 실제 provider 실행 전이므로 cleanup pin에서 제외한다. B11 dispatcher를 구현하거나 활성화한 것이 아니며, 향후 dispatch marker 계약 검증이 필수다.
- 실제 D1의 driver/trigger/batch/성능, 실제 Tigris의 timeout·늦은 PUT, 배포된 구 Worker 및 기존 in-flight 요청은 **여전히 BLOCKED**. 현 코드의 local mock 안전성만 확인했다. 구 binary가 새 보호를 사용한다고 주장하지 않는다.
- 현재 ledger 전수 인증, Workers Free CPU/월 비용, 운영/import/direct-SQL writer 동결, 실제 browser/native 전체 lifecycle은 기존 BLOCKED/NOT TESTED로 유지한다. 별도 Node domain 전체 이관도 하지 않았다.
- 실제 사용자 파일/계정/원본/승인 데이터 변경0. 공유 원본·마스크 밖 픽셀·승인 후 재접속 관련 기존 테스트를 보존했다. Preview/Production 배포, 원격 migration/스토리지, 실제 AI, Git 작업0.

## 8. 결론

FAIL6개는 위 범위에서 **FIXED LOCALLY**. 기존 PASS18개 유지. 원격 gate와 운영 제한은 제거하지 않았다. 추가 단계나 B10 활성화를 시작하지 않고 독립 재감사를 기다린다.

**READY FOR INDEPENDENT RE-AUDIT**
