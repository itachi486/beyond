# BEYOND Preview 통합 오류 진단·수정

2026-10-31 04:38 UTC. 최종 Preview `fa9bf8d2-3e39-41f5-8d27-9b69dff9c843`. **전체 합격 아님**. 실제 검증과 미검증을 구분한다. Preview만 수정했으며 Production Worker/D1, 요금제·결제·DNS는 변경하지 않았다. commit/push/merge, 데이터 초기화·삭제 없음.

## 1. 발견된 오류

- HTML503: 세계/편집 조회와 공개 캐릭터 조회, 이미지 업로드·실제 스타일 편집에서 발생 가능.
- 409: 존재하는 집의 저장 좌표와 클릭 좌표 불일치; 편집 목록 조회 실패를 빈 버전으로 취급하면 부모 버전 충돌도 가능.
- 일반 회원 화면에서 불필요한 관리자 세션401 반복.
- 인사를 풍경 설명으로 연결; 별장·공중다리 분류 누락.
- 실제 별장 후보가 0픽셀 변경인데도 생성·승인된 추가 결함 발견.

## 2. 실제 원인과 증거

보고 세계 `8434447a-b50d-4555-a0fd-d6bee388947e`는 존재하며 최초 조회 version46, 활성 소유 계정이다. 데이터 유실이 아니다. 승인 집 좌표 `(0.6218274037576469,0.5145698558933182)`와 실패 task 좌표 `(0.815234375,0.7141222768331562)`가 달랐다. 기존 `WorldCompanion.point()`가 편집 task를 클릭 위치로 재실행했다. 확인 동의도 저장 대상 좌표를 재조회하지 않았다.

`UniverseProvider`는 public/universe 조회 실패 시 기존 데이터를 버려 세계 전체를 언마운트했다. 읽기 API도 sql.js 초기화와 전체 테이블/모든 세계 revision 복사를 거쳤다. 조회 실패를 편집 버전 없음으로 취급하는 catch도 있었다.

별장 실제 실험에서는 남아 있는 스타일 편집 때문에 새 위치 클릭이 무시되어 기존 집 위치에 새 별장이 요청됐다. 집 보호 마스크가 편집 영역 전체를 제거했지만 무변경 후보 검사가 없었다. 실제 이미지 비교 `inside=0,outside=0`으로 실패 판정했다. 그 승인 이력은 삭제하지 않았다.

## 3. 503 발생 계층

실제 스타일 요청: 2026-10-31 04:16:38 UTC, HTTP503 HTML, Cloudflare1102 `Worker exceeded resource limits`, Ray `a52fd852de01d5f9`. 애플리케이션 JSON409나 Neurons429가 아니다. 이 특정 스타일 실패가 CPU인지 메모리인지는 미확인.

실제 업로드 로그: 04:20:39 UTC `/api/user/assets`, status503, outcome=`exceededCpu`, exception=`Worker exceeded CPU time limit.` 공개 캐릭터 조회도 04:23:50 UTC HTML1102 재현. 이전 시간대 Preview 집계 `exceededResources=51`; 각 요청과의 대응은 미확인. 원래 스크린샷의 특정 세계 조회503은 이번 정상 로그인 재현에서 발생하지 않아 정확한 당시 계층은 확정하지 않는다.

공식 문서상 [1102는 CPU 또는 메모리 한도 초과](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1102/)다. 단순히 HTML→JSON 변환만으로 해결했다고 주장하지 않는다.

## 4. 세계 조회·로딩 수정 결과

- Preview GET 세계/회원·관리자 세션/편집 목록·이미지/공개 universe·캐릭터를 소유권·게시 조건이 있는 native D1 읽기로 처리. 읽기에는 sql.js 초기화 불필요.
- 쓰기 snapshot에서 필요 없는 전체 revision/history 제외. 기존 revision 삭제 없이 새 revision 추가, CAS·인증 유지.
- 읽기만 502/503/504·네트워크 오류에 최대1회 재시도. 쓰기·모델 자동 재시도 없음.
- background universe 실패 시 열린 세계 유지; 초기 실패는 재시도, 비로그인·없는 세계·서비스 장애 구분.
- 소유 계정 정상 암호 로그인200, 직접 URL/세계/승인 집200, 새로고침·브라우저 완전 재시작 후 복원 확인. TLS 우회·진단 전달 경로·요청 가로채기 없음.
- 무료 Worker 이미지 업로드/연산503은 여전히 발생 가능. 영구 해결로 판정하지 않음.

## 5. 409 해결

동의 및 기존 편집 때 승인 객체 ID로 실제 좌표 재조회. 새 클릭은 새 요청용 위치만 저장하며 기존 편집 target/좌표를 바꾸거나 재실행하지 않는다. 존재하지 않는 대상과 좌표 충돌을 각각 `edit_target_not_found`, `edit_target_position_conflict`로 구분한다. 저장 버전 조회 실패 때 생성 중단·재조회 제공, 부모 버전/CAS 보호 유지.

실제 보고 계정의 `그렇게 하자`는 기존 집 ID·정확한 좌표를 복원했고 상태 RUNNING을 반환했다. 기존 pending 작업이 있으므로 모델을 재호출하지 않았다. 실제 보고 집의 새 스타일 후보 성공은 아직 미검증이다.

## 6. 관리자401

정상 일반 회원에게 관리자401은 정상 권한 거절이다. 회원 scope/CSRF 재사용, 회원 조회503을 관리자 세션으로 fallback하지 않으며 동시 capability 요청을 합친다. 새 실제 회원 브라우저 흐름의 관리자 요청0건. 인증 우회나401→200 변경 없음.

## 7. 일반 대화

보고 계정에서 실제 Workers AI `안녕` → `안녕하세요.` 200. 짧은 인사에는 세계 설명·이전 장문 맥락을 넣지 않음. 모델 `@cf/meta/llama-3.1-8b-instruct-fp8-fast`. 한국어 장문 전반 품질과 모든 언어의 자연스러움은 미검증. 사용량·세계 관찰·오류 보고는 기존 authoritative tool 경로 유지.

## 8. 새 객체 생성

실제 FLUX.2 Klein `@cf/black-forest-labs/flux-2-klein-4b`, 참조 편집+마스크 합성 유지. Vision 라이선스 동의/모델 교체 없음.

| 실험 | 실제 결과 | 모델 시간 | 요청 전체 | 승인/복원 |
|---|---|---:|---:|---|
| 일반 계정 A 집 | 후보 성공, 안쪽57,430/바깥0 픽셀 변경 |6.045초|8.855초|승인200, refresh·완전 재시작 성공|
| B 집 |후보 성공, 안쪽57,501/바깥0 픽셀 변경|5.098초|7.586초|승인200, refresh·완전 재시작 성공|
| B 공중다리 |후보 성공, 안쪽56,741/바깥0 픽셀 변경|5.009초|9.169초|승인200, refresh·완전 재시작 성공|
| A 별장 | API200이나 **변경0픽셀, 의미상 실패** |6.880초|8.820초|승인·저장·복원 자체는200/성공, 새 별장 생성 성공 아님|

현재는 보호 마스크가 전체를 덮는 위치를 모델·예약 전에409 `edit_area_protected`로 차단하고, 모델 출력이 원본 픽셀과 같으면 `image_edit_no_change`로 후보 저장을 거절한다. 새 객체 ID/종류 구분은 fixture 회귀 통과. 실제 별장 재생성은 미검증이며 최종 잔여 예산15.3685로는 재호출할 수 없다. API 성공을 객체 생성 성공으로 간주하지 않는다.

## 9. 기존 객체 편집

A의 승인 집을 서양식으로 편집한 실제 요청은6.324초 후 플랫폼 HTML503/1102. 원본·승인 집·예약 유지, 성공으로 판정하지 않는다. 무리한 재시도 없이 pending `5460df28-2c04-4b33-96bd-17c7641f6aa5` 유지.

CPU 계산을 줄이기 위해 PNG CRC32 테이블과 타원 bounding box만 계산하는 마스크를 적용했다. 기존 모든 마스크 alpha/가중치·PNG decode 결과 동일성 테스트 통과. 최적화 후 **일반 계정 B의 기존 승인 집 편집은 실제 성공**: request `69d18bf7-5b65-4762-b3ae-77c0a4550c43`, 모델3.817초/전체6.889초, 승인200, refresh·완전 브라우저 재시작 성공. 집 objectId·좌표 동일, 원본은 직전 승인 집 imageHash와 일치, 안쪽57,456/바깥0 픽셀 변경. 단, 시각 비교에서 지붕·건물 외곽과 크기가 달라 보여 동일 footprint/크기는 보장하지 않는다.

## 10. 승인·저장

실제 집 후보는 승인 전 활성 원본을 변경하지 않았고 승인200 이후 별도 이미지 버전이 활성화됐다. 원본/후보 Tigris 읽기 hash 및 D1 metadata 일치 확인. 승인·pending·이전 버전 삭제 없음. 공중다리 생성 후 기존 집 보호 영역의 변경도0픽셀이다. 최종 D1 대조에서 이전72개 요청 행은 모두 byte-hash 동일하고, 보고 세계의 원본 starter 동일, revision1–46 모두 유지하며49까지 추가되었다. 무변경 별장의 기존 승인 이력은 보존하며 이를 유효한 새 객체로 간주하지 않도록 맥락에서 제외한다.

## 11. 복원·최소 회귀

- 보고 세계: 로그인·직접 진입·refresh·완전 브라우저 재시작 통과.
- 관련 서버41/41, 예산 보호19/19 통과. 추가 마스크/무변경/보호 영역·native 캐릭터 경계 회귀 별도 로그 확인.
- 브라우저 companion 회귀 통과: 생성·스타일 승인·취소/거절·429·대화 저장 실패 재시도·조회 HTML503 때 열린 세계 보존·편집 버전 모를 때 모델 호출0·모바일.
- 브라우저 loading 회귀 통과: 비로그인401/없는 세계404/세션 만료 후 복구/원래 세계 보존. 타 계정404는 native D1 fixture에서 확인.
- 추가 native 읽기/캐릭터 게시·인증 경계2/2, 보호영역/마스크2/2, PNG·무변경 후보2/2 통과. 마지막 무변경 테스트는 성공 후보0건·error 상태·추론 예약 유지까지 확인했다. 빌드·타입검사·diff 공백 검사 통과.
- 실제 검증 브라우저3개 모두 정상 로그아웃200 및 이후 session401 확인.
- 전체 프로젝트 테스트 스위트는 반복 실행하지 않았다. fixture를 실제 모델 성공으로 계산하지 않았다.

## 12. 무료 예산

**최종 04:37:48 UTC Cloudflare 실제 합계887.2326 Neurons(계정 집계13회), 내부 text15/image984.6315 Neurons. 이미지 예산1000 중15.3685만 남아 추가 편집 quote109.4035를 확보할 수 없으므로 이후 실제 모델 호출을 중단했다.** 작업 중 모델 성공 응답5건(집2·스타일1·공중다리1·무변경 별장1)과 모델 호출 여부 미확인인 스타일 플랫폼503 1건을 구분한다. 실제 인사1건도 수행했으며 다른 계정에서 발생한 대화2건은 우리 테스트 호출로 계산하지 않는다. 내부에는 완료 불명 pending 예약도 포함하며 실제 사용량과 동일하지 않다. text8000/image1000/service9000, 사용자 image3 공유 제한 유지, 사용자 대화30회 제한 없음. UTC 일자 유지. 이미지 모델 호출 불명 실패는 예약 반환/자동 재호출하지 않았다.

[Workers AI 무료 일일 할당량](https://developers.cloudflare.com/workers-ai/platform/pricing/) 10,000 Neurons 이내를 보호한다. 요금제·결제·유료 외부 서비스 추가 없음. Tigris 월 청구액 자체를 확인한 것은 아니므로 월 실제 청구0달러를 검증했다고 주장하지 않는다.

## 13. 수정 파일·증거

서버: `cloudflare/read-api.mjs`, `handler.mjs`, `worker.mjs`, `companion-context.mjs`, `world-edits.mjs`, `workers-ai.mjs`.
프런트: `src/lib/apiResponse.ts`, `src/features/content/UniverseProvider.tsx`, `src/features/account/AccountProvider.tsx`, `cloudWorlds.ts`, `src/features/creation/authorAccess.ts`, `workersDialogue.ts`, `WorldImageEditor.tsx`, `WorldCompanion.tsx`, `companionScene.ts`, `aiErrors.ts`, `src/worlds/HiddenWorldsPage.tsx`, `shared/companion-intent.mjs`.
테스트: `cloudflare/tests/read-api.test.mjs`, `image-cpu.test.mjs`, `companion.test.mjs`, `companion-actions.test.mjs`, `src/tests/apiResponse.test.ts`, `ai-errors.test.ts`, `tests/world-companion.spec.ts`, `world-loading-recovery.spec.ts`, `playwright.member.config.ts`.

비공개 증거: `/home/administrator/beyond-backups/cloudflare-preview/full-error-resolution/` (`before.json`, `member-before.json`, `worker-outcomes.json`, `worker-tail.jsonl`, `live.json`, `live-b.json`, `pixels.json`, `bridge-house-protection.json`, `final-audit.json`, `logout.json`, `usage-*.json`, 실제 UI·원본·후보 PNG). 암호를 보고서나 스크립트에 저장하지 않았다. `.local/full-error-*.mjs`는 Git 제외 검증 도구이며 Worker 임시 API/스케줄이 아니다.

## 14. 미해결·최종 판정

Free Worker의 CPU/메모리1102 재발 가능성이 남는다. 최초 스크린샷503의 개별 원인, 기존 pending 종료 여부, 보고 소유 계정의 실제 새 스타일 편집 완료는 미확인이다. 별장 무변경 실험은 실패이며 실제 생성 합격으로 계산하지 않는다. 집 편집의 footprint/크기 동일성은 미보장이며 공중다리 양끝 지형 접속부의 자연스러움도 미흡하다. 별장 수정 후 실제 재생성은 내부 잔여 예산 부족과 일일 보호 한도 때문에 진행하지 않았고 fixture만 통과했다. 현재 새 이미지 요청을 강제로 실행하지 않는다. 임시 진단 API/바인딩 없음; 스케줄은 기존 계정 보존 cron03:30 UTC 한 개뿐이다. 무료 보호를 해제하거나 오래된 pending을 임의 초기화하지 않았다. Production 변경 없음.

실제 결과 보기: [최종 브라우저 화면](/home/administrator/beyond-backups/cloudflare-preview/full-error-resolution/b-bridge-reopened.png), [서양식 편집 이미지](/home/administrator/beyond-backups/cloudflare-preview/full-error-resolution/b-style-image.png), [공중다리 이미지](/home/administrator/beyond-backups/cloudflare-preview/full-error-resolution/b-bridge-image.png).
