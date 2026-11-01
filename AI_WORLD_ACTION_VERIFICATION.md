# AI 대화 → 세계 작업 연결 검증

## 1. 발견한 실제 문제와 원인

기존 분류에 농장·`바꾸고 싶어`·서양식 스타일·`그렇게 하자`·`이제/빨리 만들어 달라`가 빠져 있었다. 생성과 기존 객체 편집도 같은 일반 edit로 취급했다. 요청마다 이미지 작업 UUID를 새로 만들었고, 기존 후보를 자동 거절했으며, 모델의 계획 설명과 실제 실행 상태를 구분하지 않았다. 사용량·시스템 오류·객체 확인 질문도 일반 LLM 답변으로 처리해 실제 상태와 모순될 수 있었다.

## 2. 의도 분류 및 실행 연결 수정

- GENERAL_CHAT / CREATE_WORLD_OBJECT / EDIT_EXISTING_OBJECT / INSPECT_WORLD / CONFIRM_ACTION / CANCEL_ACTION / CHECK_USAGE / REPORT_ERROR / EXPLORE_WORLD와 모호한 요청 보호를 구분했다.
- 실제 저장된 승인 기록·객체 ID·좌표·pending 작업을 조회한다. 서양식 요청은 기존 집을 대상으로 하고, 농장은 집과의 상대 위치를 사용한다. 후속 동의는 기존 메시지·대상·작업 ID를 이어받는다. 대상 정보가 없으면 임의로 생성하지 않는다.
- 기존 `/api/ai/text`의 구조화 action → 기존 클라이언트 실행 → `/api/ai/world-edits` Klein → 후보 검토 → 기존 approve/reject → 저장 확인 경로를 사용한다. 새로운 이미지 서비스/작업 엔진/테이블은 추가하지 않았다.
- 일반 대화만 실제 Llama를 사용한다. 실행 준비·객체 조회·오류 보고·사용량 답변은 저장 데이터에서 나온 `provider:world-tools` 관찰/상태 응답이다. 이를 모델 추론 결과로 표시하거나 보고하지 않는다.
- IDLE, NEEDS_CLARIFICATION, READY, QUEUED, RUNNING, AWAITING_APPROVAL, APPROVED, SAVED, FAILED, CANCELLED를 구분한다. QUEUED는 기존 요청 전송 준비 상태이며 별도 서버 큐가 아니다. RUNNING 표시도 요청 처리 상태이지 모델 추론 시작을 증명하는 표시가 아니다. 후보·승인·저장은 실제 서버 응답 후 표시한다.
- 같은 작업 ID를 유지하고, 이미 있는 후보는 재사용한다. 다른 미승인 후보를 임의 삭제/거절하지 않는다. 새 생성 마스크에서 기존 승인 객체 보호 영역을 제외하며, 기존 객체 편집에서는 해당 객체 ID만 대상으로 한다.

## 3. 수정 파일

- `shared/companion-intent.mjs`, `companion-intent.d.mts`:의도 및 후속 동의.
- `cloudflare/companion-context.mjs`, `workers-ai.mjs`:실제 대상/상태/사용량 조회와 도구 응답, 간결한 대화 지침.
- `cloudflare/world-edits.mjs`, `world-edit-model.mjs`:대상 검증, 객체 ID 유지, 집/농장 구분 지침, 기존 객체 마스크 보호, 실패 단계 구분.
- `src/features/creation/WorldCompanion.tsx`, `workersDialogue.ts`, `worldDiscoveryProgress.ts`:작업 메타데이터 저장/복원·같은 ID 실행·실제 상태 표시·후보 재사용.
- `WorldImageEditor.tsx`, `aiErrors.ts`:대기 중단 신호와 이미지 저장/D1 저장 오류 안내.
- 테스트:`src/tests/companion-actions.test.ts`, `cloudflare/tests/companion-actions.test.mjs`, 기존 `companion.test.mjs`의 테스트 helper 공개, `tests/world-companion.spec.ts`의 관련 흐름 확장. 관련 없는 UI/계정/스키마/설정 변경 없음.

## 4. 집 생성·기존 집 편집·농장 생성 테스트

| 사례 | 폐기 가능한 실제 API 어댑터/브라우저 | 실제 Preview |
|---|---|---|
| 안녕 | 일반 대화, 이미지 호출0 | Llama200,1.398초 |
| 여기에 집을 만들고 싶어 | 위치 질문→한 번 선택→기존 생성 API→후보→승인 | 빈 world context에서 CREATE_WORLD_OBJECT/NEEDS_CLARIFICATION 확인. 신규 이미지 추론은 하지 않음 |
| 집을 서양식으로 바꾸고 싶어 | 기존 집 ID/위치 유지, 편집 후보, 승인 전 이전 버전 유지 | 기존 승인 집을 EDIT_EXISTING_OBJECT/READY로 식별 |
| 이제 만들어 달라 | 같은 작업 ID; 후보가 있으면 재표시, 모델 중복 호출0 | 같은 ID로 기존 편집 API 실제 호출. 현재 이미지 예산 때문에429, FAILED 처리 |
| 여기에 농장을 만들고 싶어 | 집 옆 위치·farm 종류 유지, 후보 생성 시 집 보호 픽셀 변경0 | CREATE_WORLD_OBJECT/READY 및 집과의 관계 확인. 추가 이미지 호출은 생략 |
| 그렇게 하자 / 설계할 수 있어 / 빨리 만들어 달라 | 기존 농장 메시지/대상/ID 유지, 반복 질문/중복 추론 없음 | 세 문장 모두 CONFIRM_ACTION/READY, 같은 ID 확인 |
| 내가 만든 집이 어때? | 승인 전 없음, 승인 후 실제 집 기록 조회 | INSPECT_WORLD, 기존 승인 집 확인. 새 시각 분석이라고 주장하지 않음 |
| 오늘 하루 생성량이3번인가? | 설정·실제 카운터별 답변 | CHECK_USAGE, 대화/이미지 생성/편집/pending 구분. Cloudflare 실제 사용량은 미확인으로 표시 |
| service_unavailable… | 오류 경로, 후보/실패/pending 상태 조회 | REPORT_ERROR/FAILED, 성공/저장 완료를 주장하지 않음 |
| 취소 | 미승인 후보 reject, 승인된 집 유지; 실행 중 orphan은 삭제/초기화하지 않음 | CANCEL_ACTION. 새 후보가 생성되지 않아 실제 후보 거절/추론 중단은 미실행 |

관련 단위2개, 통합 시나리오1개(위 흐름·픽셀/보존/실행 중 pending 포함), 브라우저 시나리오1개 PASS. 모의 모델 응답을 사용한 폐기 가능한 검증이며 실제 이미지 모델 성공으로 계산하지 않는다. 브라우저는 집 생성·집 스타일 편집2개 승인 후 농장 요청이 보존된 예산 정책으로429가 되는 FAILED 경로도 확인했다. 전체 테스트 스위트는 반복 실행하지 않았다. 빌드/타입 검사 PASS.

## 5. 실제 모델 호출 및 이미지 생성 결과

- 정상 workers.dev 브라우저 TLS, 요청 가로채기/모의 제공자/진단 중계 없음. 기존 승인된 관리자 소유 세계와 승인 집을 읽었으며 기존 관리자 로그인 후 검증하고 로그아웃했다. 관리자 legacy local-context 경로의 API 검증이며 일반 회원의 전체 UI 실사용 재검증과 혼동하지 않는다.
- 실제 모델은 기존 `@cf/meta/llama-3.1-8b-instruct-fp8-fast`1회. 인사 응답200,한글 응답,1.398초. 총12개 요청 중 인사1건 외11건은 추가 LLM 호출 없이 도구 응답으로 처리했다.
- 이미지 편집 API1회,1.517초,429 `image_budget_exhausted`. 기존 승인 이미지를 Tigris에서 읽고 디코딩한 뒤 내부 예산 예약에서 중단됐다. 기존 기록의 `failureStage:decode_original`은 마지막 수행 단계였으며, 최종 코드에서는 예약 차단을 `usage_reservation`으로 명확히 구분했다.
- **이번 작업에서 새 실제 Klein 후보 생성/서양식 외형/농장 외형 성공은 검증되지 않았다.** 이미지 예산을 올리거나 실패를 성공으로 표시하지 않았다. 기존 Klein 참조 편집+마스크 합성과 모델 기본값을 유지했다.

## 6. 승인·저장·재접속 검증

폐기 가능한 D1/Tigris 어댑터에서 집·스타일 후보 승인과 서버 재조회/브라우저 새로고침, 대화/원본 해시 보존을 통과했다. 농장 후보의 기존 집 보호 영역 변경 픽셀0도 확인했다. 후보 거절 후 승인된 스타일 버전이 유지됐다.

실제 Preview에서는 기존 승인 이미지 해시가 호출 전후 및 새로고침 뒤 동일했다. 원래 있던 pending/성공/실패/승인 원장 행은 해시 비교로 모두 변경 없음. 추가 원장은 실제 인사 성공1건(예약 정산2)뿐이며 새 이미지 원장/승인/파일 쓰기는 없었다. 신규 회원 대화·새 승인 결과의 독립 브라우저 재로그인은 이번 실제 검증에 포함하지 않았다. 기존 데이터는 삭제하지 않았다.

## 7. 사용량 제한과 오류 처리

이전 수정의 대화8,000/이미지1,000 분리 안전 예산, 이미지 계정별3회, 사용자별 대화 횟수 제한 없음, 기존 Free 보호를 그대로 유지했다. CHECK_USAGE/REPORT_ERROR/INSPECT_WORLD 및 실행 준비 답변은 새 AI 예약을 소비하지 않는다. 내부 예약량을 실제 Neurons 잔액이라고 답하지 않는다.

같은 작업 ID 재전송은 새 후보 추론으로 이어지지 않는다. 실패 후 새 UUID로 자동 재시도하지 않는다. D1 저장은 `world_save_failed`, 이미지 저장은 `image_storage_unavailable`, 일시 편집/CPU/네트워크/시간 초과는 별도로 처리한다. 승인 전 원본은 바뀌지 않으며 저장 확인 실패에 완료 표시를 하지 않는다.

## 8. 미해결 문제

- 실제 새 집/서양식 집/농장 후보의 시각적 품질과 승인·재로그인 전체 흐름은 현재 이미지 예산 때문에 미검증이다. 모의 후보 성공으로 대체 판정하지 않는다.
- 실행 중 Workers AI 추론을 중단하는 기능은 기존 바인딩이 제공하지 않는다. “Stop waiting”은 로컬 HTTP 대기만 중단하며 추론 중단/취소 완료라고 표시하지 않는다. 서버 pending은 그대로 조회하고 자동 재호출하지 않는다. 완료된 미승인 후보는 사용자가 거절할 수 있다.
- 위치·집/농장 관계는 저장 좌표에 기반한 휴리스틱이다. 새 시각 분석/지형 의미 인식은 추가하지 않았다. 스타일 편집의 정확한 외곽/크기 보존은 프롬프트 제약이며 실제 모델 결과를 검토해야 한다. 다른 승인 객체 보호와 마스크 밖 보존은 픽셀 합성으로 강제한다.
- 구형 대화에 작업 ID/대상이 저장되지 않았다면 이를 확정된 pending으로 꾸며 복원하지 않고 확인을 요청한다. 복잡한 자유 문장의 분류·한국어 자연스러움을 모두 보장하지 않는다. 이미지503/기존 고아 pending의 근본 복구는 별도 미해결이다.

## 9. Production 변경 여부

Production Worker/D1·요금제·결제·유료 서비스·모델 변경 없음. Preview만 배포, 스키마/테이블 추가 없음. Git commit/push/PR merge 없음. 기존 미커밋 작업·원본·승인·대화 보존. 원래의03:30UTC 보존 cron만 유지하고 임시 경로나 스케줄을 추가하지 않았다.

실제 증거:`/home/administrator/beyond-backups/cloudflare-preview/world-actions/{before,browser,after}.json`. 브라우저 예외0,관리자 종료 시 로그아웃 요청을 수행했다(별도 종료 후 세션 조회는 하지 않음). 최종 Preview 버전은 `75ce73bf-7b8e-47e2-a2ba-1946fa1caffc`(상태/오류 세부 보완 포함). 실제 모델 호출은 앞선 c16aa9e5 배포에서 수행했고 마지막 보완 후 같은 호출을 반복하지 않았다. 추가 AI 호출이나 자동 재개는 예약하지 않았다.
