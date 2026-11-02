# BEYOND CONNECT 구현 및 검증

2026-11-02 UTC. Preview 전용 구현. Production 변경 없음.

## 확정한 범위

사용자 추가 답변에 따라 기존 세계당 Starter 1개 생성 방식을 유지하고, CREATE 안에 계정별 CONNECT 참여 선택(최대 3개)을 추가했다. CONNECT에는 선택기를 만들지 않았다. 현재 공개된 공식 Starter 6개만 연결하며 Enchanted Forest/Outer Space는 원본 미등록으로 비활성화한다. 첨부 PNG를 직접 배경으로 사용하되 고정 세계·가짜 온라인 인원·사진/제목 영역은 CSS로 가리고 실제 선택 이미지와 정보를 겹친다.

## CREATE 데이터 / 글로벌 그룹

- `create_starter_profiles`와 `create_starter_selections`가 CREATE의 영구 참여 선택 원본이다. owner ID, 실제 공식 이미지 ID, 선택 시간, revision을 저장한다. 개인 세계의 `starter`/이미지/ID는 변경하지 않는다.
- 최초 선택 레코드가 없는 기존 계정은 소유 세계의 기존 `starter.imageId`를 정확한 ID로 재사용한다. 공식 ID의 종류가 3개 이하면 CONNECT 진입 시 이를 보존해 초기화한다. 3개 초과면 임의로 자르지 않고 CREATE 검토를 요청한다. 명시적으로 빈 선택을 저장한 계정은 기존 세계에서 다시 가입시키지 않는다.
- `connect_groups`는 8개의 고정 canonical 정의다. 그룹 ID는 `global:<starter-key>`. 계정·국가·언어·접속 시각으로 새 그룹을 만들지 않는다. starter key, group ID, 공식 이미지 ID에 고유 제약을 둔다.
- `connect_memberships`는 owner/group 복합 고유 키다. 선택 유지 시 joined_at 보존, 해제 시 active=0/left_at 기록, 추가 시 가입한다. 기존 그룹과 다른 계정의 가입 상태를 삭제하지 않는다.
- 그룹 진입은 현재 CREATE 선택과 활성 멤버십을 모두 서버에서 확인한다. 과거 멤버십만으로 해제된 그룹에 접근할 수 없다.

| Canonical key / group ID suffix | 실제 공식 이미지 ID |
| --- | --- |
| floating-islands | b07f9334-7ee6-4c3a-9c79-59e0cab97f27 |
| lost-island | 82158cf5-d5de-4e88-b6b9-c5fd3a8c92b8 |
| endless-desert | 5142ed7e-a1ed-4feb-9c25-77a9ab0104b6 |
| deep-ocean | 4845107c-bffa-421c-b857-05d41533c585 |
| green-valley | af8ee6f5-1e89-4a00-970a-9a86494a2846 |
| alien-planet | ff2b1fa4-eefe-46d3-bd88-8fd8842baa4e |
| enchanted-forest / outer-space | NULL — 미등록, 선택/가입 거절 |

이미지 이름을 비교해 가입하지 않는다. 기존 관리 이미지 이름이 바뀌어도 같은 고정 ID를 사용한다. 8개 정의 중 실제 선택 가능한 리소스는 승인받은 6개다.

## 서버 안전성과 API

- `GET/PUT /api/user/create-starters`: 현재 계정의 CREATE 선택 조회/저장.
- `POST /api/connect/sync`: 빈 JSON 객체만 허용. 클라이언트가 그룹/선택 목록을 전달하는 요청은 거절하고 서버 CREATE 상태만 읽는다.
- `GET /api/connect/groups/:groupId`: 현재 선택과 멤버십으로 권한 확인 후 그룹 입장 정보 반환.
- 기존 회원 세션/credential version/status, 관리자 allowlist/단일 관리자/기존 세션, Origin/JSON/CSRF를 검증한다. 최종 쓰기 batch에서 세션을 다시 검사한다. 관리자 principal은 기존 studio helper를 재사용하며 일반 회원과 별도 namespace다.
- 선택 저장은 revision CAS, operationId/hash, 기존 `cf_commit_guards`, D1 atomic batch를 사용한다. 중복 요청은 동일 영수증을 반환하고 부분 저장은 rollback한다. 3개 제한과 공식 이미지 공개/검토 상태는 SQL trigger로도 검사한다.
- 새 테이블은 기존 snapshot writer의 대상과 분리된다. 기존 world revision/cf_state/B10 job/예산 시스템을 변경하지 않는다.
- 삭제 유예 중 데이터는 보존되고 inactive 계정은 가입/변경이 거절된다. 실제 최종 계정 삭제 시 해당 owner의 새 metadata만 cascade 정리한다. 글로벌 그룹은 남는다. 실제 사용자 삭제 테스트는 하지 않았다.

## 변경 파일

신규: `cloudflare/connect-api.mjs`, `cloudflare/migrations/0008_connect_groups.sql`, `shared/connect-catalog.mjs`, `src/features/connect/{ConnectHub.tsx,CreateConnectChoices.tsx,connect.css}`, `public/connect-hub-reference.png`, `cloudflare/tests/connect.test.mjs`, `tests/{connect-fixture.mjs,connect.spec.ts}`, `playwright.connect.config.ts`, 이 보고서.

부분 수정: `cloudflare/handler.mjs`(새 경로 분기), `src/features/creation/CreateWorldModal.tsx`(참여 선택 영역), `src/worlds/HiddenWorldsPage.tsx`(CONNECT query 진입), `tests/local-member-server.mjs`(명시적 환경변수에서만 로컬 fixture seed), `wrangler.cloudflare.preview.jsonc`(CONNECT_ENABLED=1), `NEXT_SESSION.md`(인계).

Git 증분 반영을 위해 기존 미추적 `cloudflare/admin-studio.mjs`, `cloudflare/studio-schema.mjs`, `0007_admin_personal_studio.sql`은 내용 변경 없이 필수 공통 의존성으로 포함한다. 이전 미커밋 UI/AI/B10 변경 전체를 이번 commit에 섞지 않는다. 관련 기존 파일도 HEAD 기준 CONNECT hunk만 분리했다. 실제 Preview에는 이전 검증된 미커밋 기능들이 추가로 있으므로 **증분 commit 하나가 현재 Preview 전체 소스/설정과 동일하다는 뜻은 아니다.** 기존 shared AI budget/count-disabled/studio 설정은 실제 작업 트리와 Preview에서 유지되며 이번 증분 config 변경은 CONNECT flag만 포함한다.

## 테스트

| 검사 | 결과 |
| --- | --- |
| 새 CONNECT API | 13 PASS: A/B 동일/상이 그룹, 3개/변경/빈 선택, 이전 세계 재사용, 초과 검토, 누락/위조/미등록, CAS/중복/동시 요청, atomic rollback, 세션 경합, 삭제 pending/최종 cascade, admin 분리, migration 재실행 |
| Cloudflare 전체 | 등록 파일 26/26 PASS (assertion 총수와 구분) |
| 프런트엔드 unit | 파일 14, 테스트 75 PASS |
| CONNECT 브라우저 | 3 PASS: 실제 로컬 회원 인증/API로 A/B·1/3개·변경·모바일·새로고침·권한, 미등록/빈 선택, 동시 선택 충돌 복구 |
| 기존 기능 회귀 | 세계 열기/재접속/미디어 실패 복구/후보 생성·보관·승인/MY WORLDS 5 PASS. 기존 느린 로딩 때문에 별도 20초 expect 설정 사용; 기존 assertion 유지 |
| Build / TypeScript | PASS, 기존 큰 청크 경고 유지 |
| Git 반영 묶음 격리 | 별도 HEAD+선택된 patch 소스에서도 build/tsc, API 13, 브라우저 3 PASS. 작업 트리의 다른 미커밋 파일에 의존하지 않는지 별도 확인 |

실제 Preview: 신규 QA 계정 A/B로 동일 Floating Islands canonical ID, 다른 Deep Ocean ID, 세 그룹 가입, 하나 해제/다른 그룹 추가, 다른 계정 유지, 새로고침/브라우저 재접속, 모바일, 네 번째 선택 400, 미선택/해제 그룹 403, 실제 그룹 진입을 확인했다. E는 별도 빈 QA 계정으로 임의 그룹/선택기 부재와 CREATE 안내를 확인했다. 첫 E 관측은 렌더 완료 전에 검사한 harness race였고 실패 원본 로그는 보존했다. 렌더 완료를 기다린 별도 검사는 PASS다.

총 3개의 신규 QA 계정을 만들었으며 삭제하지 않았다. 테스트 세션은 로그아웃 후 401로 확인했다. 실제 사용자/관리자의 기존 선택은 임의로 변경하지 않았다. 세계/AI 쓰기 요청 0회, 모델 호출 0회. 기존 `worlds`, `discoveries`, `connections`, `managed_images`, `user_worlds`, `admin_personal_worlds`, `user_world_assets`, `workers_ai_requests`의 전후 row 수/해시가 모두 일치했다(AI 원장 229행 불변).

## 배포 / 백업 / 롤백

- 실제 A~E 검증은 Preview `910f585c-af41-417d-98fc-7c3e6aa1f551`에서 수행. 이후 사용자 충돌 안내/CONNECT 전용 헤더 CSS/잘못된 JSON 객체 거절 가드를 추가 검증하고 최종 `5e018b10-59c9-4317-b086-c9f7cc504ec1`로 배포했다. 유효한 선택·동기화 API 경로는 동일하며 최종 소스 API/격리 build도 통과했다.
- Preview D1에 **0008만** 명시적으로 적용했다. migration 전체 자동 적용/B10 0006 활성화는 하지 않았다. 기존 migration과 사용자 데이터는 보존했다.
- 사전 D1 백업: `/home/administrator/beyond-backups/connect-2026-11-02/before.sql`, 2,571,972 bytes, SHA256 `5bf50fe2e5b1aeab03ed75b70e774c27709701e19d91a305d1686043a5dc1484`. private 파일/임시 다운로드 URL은 공개·Git 반영하지 않는다.
- 롤백: CONNECT flag를 끄거나 이전 Preview Worker `638088d2-0d2f-4909-9a82-75bc6fc72064`로 복귀하고 신규 metadata는 보존한다. 공유 DB 전체 백업을 자동 복원하거나 새 테이블을 파괴적으로 삭제하지 않는다.
- Production Worker/DB/Tigris/secret, 요금제/결제, AI 모델/예산/사용자별 이미지 수, B10, cron은 변경하지 않았다.

## 미완료 / Git 상태

1. Enchanted Forest/Outer Space 실제 원본/공식 이미지 ID는 미등록이다. 사용자 승인대로 비활성 상태이며 임의 생성/대체하지 않았다.
2. 이번 우선 범위는 그룹 입장 화면과 영구 멤버십이다. **실시간 채팅, 메시지 저장/전송, 온라인 인원수는 미구현**이다. `chatAvailable:false`로 명확히 알린다. 메시지 격리의 실사용 검증도 NOT TESTED이며 구현한 것처럼 보고하지 않는다.
3. 원본에 고정된 세계/인원수가 있으므로 CSS mask로 해당 영역을 가렸다. 배경 PNG 자체는 원본 그대로다. 느린 이미지 다운로드는 로딩/오류 안내가 필요할 수 있으며 Free Workers 전체 안정성이나 실제 D1 장애 경합 전부를 인증한 것은 아니다.
4. GitHub 인증/원격 조회는 성공. origin/main은 `63a60b5`; 시작 로컬 HEAD `773e8e9`는 미푸시 Production 복구 commit을 포함했다. 기존 main push 자동 Production 배포 설정 때문에 **main push는 하지 않는다**. Git push 대상/자동 배포 안전성을 확인한 후 별도 브랜치 반영을 진행해야 한다. 최종 commit/push 결과는 이 문서 끝의 후속 기록을 기준으로 한다.
