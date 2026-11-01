# AI 사용 제한 원인 및 수정 보고서

## 1. 실제 원인

**직접 원인은 Cloudflare 무료 Neurons 소진이 아니라 BEYOND 내부의 전역 예약 합계 9,000 도달이다.** 대화100·이미지400을 실제 사용량처럼 합산해 다른 계정과 일반 대화까지 차단했다.

| 조사 항목 | 판정 |
|---|---|
| A. Cloudflare 무료 Neurons 소진 | 직접 원인 아님. 조회 시 계정 전체 실제 분석값1,614.83/10,000. 분석 지연 가능성은 있음. 과거 제공자 소진 오류3036은 기존 기록에서 확인되지 않음. |
| B. 사용자별 일일 제한 | 기존 `AI_USER_DAILY_TEXT=30`, 이미지3회 확인. 비교 계정은 대화7/26건이어서 이번 동시 차단 원인은 아님. |
| C. 내부 전역 제한 | 확인. 예약 합계9,000에서 `reserve()`가 모델 호출 전429를 반환. |
| D. 계정 간 전역 카운터 공유 | 확인. 서로 다른 계정의 동일 신원 오인 문제가 아니라 모든 actor·이미지·대화의 합산 정책 문제. |
| E. 실패·취소·재시도 집계 | 실패 예약1,000, pending800도 합계에 포함. 같은 ID는 기존에도 멱등 처리했으나 자동 재시도는 별도 예약을 만들었음. 생성 완료 후 거절한 이미지는 실제 추론 비용이 발생하므로 무료 사용량을 환급할 수 없음. |
| F. 이미지 제한이 대화 차단 | 확인. 이미지 예약5,200과 대화 예약3,800을 합산한9,000이 모든 대화를 차단. 이미지 분석용 text도 기존에는 대화와 섞임. |
| G. 오류 오해석 | 확인. 사용자/전역 제한이 모두 `daily_limit_reached`; 제공자 quota·rate·limit 문자열도 같은 사용자 안내로 수렴. |
| H. CPU/서비스 오류의 한도 오표시 | 기존 분류기의 광범위한 `limit` 정규식은 CPU 오류도 rate limit으로 잘못 분류할 수 있었음. 해당 이미지503의 실제 종료 단계·CPU 여부는 **미확인**. HTML503을 한도 소진 증거로 취급하지 않음. |

## 2. 증명 로그 및 코드 위치

- 기존 `/home/administrator/beyond-backups/cloudflare-preview/world-companion/final-smoke.json`:429 `daily_limit_reached`; `quota-and-pending.json`:예약9,000, QA 대화26건, 이미지 성공2/pending1.
- 이번 `ai-limit/before.json`:56개 원장 행, 예약9,000(성공7,200/실패1,000/pending800), 배포 설정 text30/image3/global9000.
- 현재 [workers-ai.mjs](cloudflare/workers-ai.mjs:10):정책, 예약 분리, 비용 추정/정산, 오류 구분. 기존 코드의 단일 `SUM(reserved_neurons)` 및 사용자 `COUNT(*)` 차단은 제거됨.
- [world-edit-inference.mjs](cloudflare/world-edit-inference.mjs:1):불확실한 실패의 자동 재호출 제거. [aiErrors.ts](src/features/creation/aiErrors.ts:2):공통 오류 안내·HTML 응답 분류.
- 이번 비공개 증거 디렉터리: `/home/administrator/beyond-backups/cloudflare-preview/ai-limit/`의 `before.json`, `members-and-schema.json`, `provider-usage.json`, `after.json`, `browser-readonly.json`. 개인정보·비밀 값은 보고하지 않음.

## 3. 사용자 A/B 제한 상태 비교

| 상태 | 계정 A | 계정 B |
|---|---:|---:|
| 기존 대화 성공 | 7건 | 26건 |
| 기존 이미지 성공/pending | 1/1건 | 2/1건 |
| 수정 전 | 공통 전역9,000 때문에 차단 | 같은 이유로 차단 |
| 수정 후 실제 원장 기반 정책 평가 | 대화 허용 | 대화 허용 |

두 계정 모두 이전30회보다 적다. 이미지 성공·pending 수는 대화 허용 판단에 쓰이지 않는다. 수정 후 실제 모델 응답을 재호출한 결과가 아니라, 실제 원장 읽기 및 동일 제한 코드 평가 결과이다. 별도 폐기 가능한 테스트에서는 두 소유 계정의 companion 대화 HTTP200과 동일 ID 재전송 무추가 호출을 검증했다.

## 4. Cloudflare 무료 Neurons 상태

검증된 GraphQL `aiInferenceAdaptiveGroups.sum.totalNeurons` 조회값은 **1,614.8266**(2026-10-30 UTC 일자, 조회 시점은 증거 JSON 참조). 내부9,000 예약과 다르며 계정 전체 분석값이라 Preview 단독 사용량으로 단정하지 않는다.

공식 무료 할당은10,000 Neurons/일,00:00 UTC 초기화이며 초과 이용은 Paid 플랜이 필요하다. [공식 요금 문서](https://developers.cloudflare.com/workers-ai/platform/pricing/).3036은 무료 할당 소진,3040은 일시 용량 부족으로 구분했다. [공식 오류 문서](https://developers.cloudflare.com/workers-ai/platform/errors/).

내부 안전 예산은 대화8,000/이미지1,000으로 분리했다(설정 합계9,000 이하 검증). 이는 과금 실측이 아니다. 새 대화는 고정100 대신 현재8B 모델 공식 토큰 단가와 요청 크기·최대 출력으로 예약하고, 제공자가 usage를 반환하면 그 토큰 수로 정산한다. 미확인 실패·usage 누락은 보수적으로 예약을 유지한다. 실제 계정 전체10,000 초과 및0달러 보장은 기존 Workers Free 제공자 차단에 의존하며, 요금제·결제·유료 모델을 추가하지 않았다. 다른 Worker의 사용량 및 분석 지연까지 내부 원장만으로 실시간 통제한다고 주장하지 않는다.

## 5. 수정 파일과 변경 사항

- `cloudflare/workers-ai.mjs`:사용자별 대화 횟수 제한 제거, 분리 예산, 이미지 분석/재시도 분류, 새 대화 비용 예약·토큰 정산,3036/3040/CPU/timeout/network/미확인 quota 분리.
- `cloudflare/world-edit-inference.mjs`, `world-edits.mjs`:자동 중복 추론 방지, 이미지 편집 오류·HTTP 상태 구분.
- `cloudflare/generate-api.mjs`, `cloudflare/generated/ai-images.mjs`:기존 이미지 생성 API가 원인을 손실하지 않도록 전달; 이미지 성공 한도와 시도 보호 한도 구분. Node/Production 원본 API 정책은 변경하지 않음.
- `wrangler.cloudflare.preview.jsonc`:`AI_USER_DAILY_TEXT` 제거, 대화8,000/이미지1,000 설정. 기존 이미지 사용자별3회는 추가한 것이 아니라 유지한 이미지 전용 정책임.
- `src/features/creation/aiErrors.ts`, `workersDialogue.ts`, `WorldImageEditor.tsx`, `WorldCompanion.tsx`, `AICharacterModal.tsx`:공통 오류 메시지·응답 파싱, 한도 단정 및 중복 보존 문구 제거. 다른 UI/세계/캐릭터 디자인 변경 없음.
- 테스트:`cloudflare/tests/ai-limit.test.mjs`, 기존 `cloudflare.test.mjs`의 관련 검증, `world-edit-provider.test.mjs`, `src/tests/ai-errors.test.ts`.

## 6. 수정 전후 동작 차이

- 전:이미지·실패·대화 합산9,000 또는 사용자 대화30회 → 동일429/“Today’s AI limit…”. 후:사용자별 대화 횟수 제한 없음; 대화용 예산만 판단. 현재 재분류 집계는 대화3,600/이미지5,400으로, 이미지 초과 상태여도 두 계정 대화 허용.
- 새 코드:`text_budget_exhausted`, `image_budget_exhausted`, `image_daily_limit_reached`, `image_attempt_limit_reached`, `cloudflare_free_allocation_exhausted`, `provider_quota_unconfirmed`, `provider_rate_limited`, `image_edit_temporary_failure`, `service_unavailable`, `workers_cpu_limit`, `network_error`, `request_timeout`.
- 성공/실패/pending 상태는 구분한다. 실패 추론의 과금 여부가 불명확하면 비용 보호 예약은 유지하되 성공 횟수에 넣지 않는다. 추론 전 취소는 추가 예약0, 같은 요청 ID 재전송은 추가 모델 호출/차감0. 이미 추론한 뒤 거절하는 행위는 소비한 연산을 되돌리지 않음.

## 7. 최소 검증 결과

- 관련 백엔드5개 PASS:두 계정의 일반 대화, 기존30회 초과 계정 허용, 이미지·분석 한도와 대화 분리, 같은 성공/실패 ID 재시도 무중복, 실패 이미지 미성공 집계, 무료 안전 설정/오류 구분, 세계·대화 원문 보존. 모의 AI 바인딩인 점을 명시함.
- 클라이언트 오류 검증1개 PASS:HTML503≠한도, 명시 CPU 오류 구분,429 원인 코드 보존.
- 빌드·타입 검사 PASS. 전체 스위트 반복 실행하지 않음.
- 정상 브라우저 TLS로 Preview capabilities GET200:대화 횟수 제한 null,대화8,000/이미지1,000 확인. 모델 POST0건.
- 실제 Preview 원장 A/B 모두 새 정책 허용; 배포 전후 기존 원장 집계 동일. 실제 AI 호출0회, DB 초기화/삭제/마이그레이션/예약 환급 조작0회.
- Preview 배포:`9bf2d1b4-601a-4d50-b0b2-77b235efa75d`100%.

## 8. 미해결 문제

- 실제 A/B 모델 응답은 이번 작업에서 재호출하지 않았다. 소모 금지 조건에 따라 허용 경로는 모의 바인딩 및 실제 원장 평가로 검증했다.
- 기존 pending/실패 예약과 승인 기록은 임의 초기화하지 않았다. 오늘 이미지 예산 초과 상태는 남지만 대화는 막지 않는다. 불확실한 실패의 같은 ID 재호출은 새 추론 없이 기존 상태를 반환한다.
- 이미지503의 정확한 원인과 고아 pending 복구는 미확인/별도 작업이다. Workers Free CPU/네트워크의 근본 안정성은 해결했다고 주장하지 않는다.
- 기존100/400 예약은 실제 과금값으로 사후 조작하지 않았다. 오늘 이전 이미지 초과분은 이미지 풀에 남는 전환 상태이며, 신규 분리 예산·토큰 추정은 미래의 실제 무료 잔액을 보증하는 계량기가 아니다.
- 30명×30메시지=900건은 계획 수치다. 사용자별 강제 제한으로 구현하지 않았고, 긴 맥락/출력에서900건이 무료 안에 들어간다고 보장하지 않는다.

## 9. Production 변경 여부

**없음.** Production Worker/D1/설정·요금제·결제·유료 모델·DNS를 변경하지 않았다. Preview만 배포했고 실제 Preview D1은 읽기만 수행했다. 기존 계정·세계·이미지·대화·승인 기록 보존. Git commit/push/PR merge 없음; 기존 미커밋 작업 유지. 검증 후 자동 실행이나 추가 모델 호출은 예약하지 않았다.
