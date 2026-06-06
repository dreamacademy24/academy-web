-- [제안] 튜터 lessons 금액·회차 보정 (통일 정의: 단가=기본×타임, 회차=실제 일수, 총액=단가×일수)
-- 생성: 점검 스크립트 자동 산출. 실행 전 검토 필수 — 수동 단가 조정한 건이 있으면 제외할 것.
-- 기본단가 가정: 1:1=300, 1:2=350 (타임당). hourly_rate에는 하루치 단가(기본×타임) 저장.

BEGIN;
UPDATE tutor_lessons SET total_amount=5400, total_sessions=18, hourly_rate=300 WHERE id='2692067f-9de4-4e9b-b70b-3a4f38c99c5f'; -- moon seon been / 문선빈 (1:1 1T, 18일)
UPDATE tutor_lessons SET total_amount=1500, total_sessions=5, hourly_rate=300 WHERE id='f286247e-f614-4892-a0df-3f57f6464476'; -- 신나영 / SHIN NAYOUNG (1:1 1T, 5일)
UPDATE tutor_lessons SET total_amount=4200, total_sessions=12, hourly_rate=350 WHERE id='7dea6632-69a5-48ee-98ca-292e3a7e1a99'; -- 김하온, 김하서 / KIM HAON, KIM HASEO (1:2 1T, 12일)
UPDATE tutor_lessons SET total_amount=2100, total_sessions=6, hourly_rate=350 WHERE id='14ece9fc-8b66-4d0b-b09b-8ae8ec70edc1'; -- KIM ROA, KIM ROUN / 김로아, 김로운 (1:2 1T, 6일)
UPDATE tutor_lessons SET total_amount=5400, total_sessions=18, hourly_rate=300 WHERE id='63aa1294-1c6f-415a-a810-636c61aa2567'; -- 신현선 / SHIN HYUN SUN (1:1 1T, 18일)
UPDATE tutor_lessons SET total_amount=5400, total_sessions=18, hourly_rate=300 WHERE id='829233fe-016b-402f-ab65-1bcbec9ca380'; -- 문선빈 / moon seon been (1:1 1T, 18일)
UPDATE tutor_lessons SET total_amount=3600, total_sessions=12, hourly_rate=300 WHERE id='06ee7962-72e1-4ad3-9142-a2760d840e34'; -- 김하우 / KIM HAWOO (1:1 1T, 12일)
UPDATE tutor_lessons SET total_amount=4200, total_sessions=7, hourly_rate=600 WHERE id='f961f6eb-b140-43f4-839d-a1e6f12b48cd'; -- 최영은 (1:1 2T, 7일)
UPDATE tutor_lessons SET total_amount=3150, total_sessions=9, hourly_rate=350 WHERE id='ffb4d331-4d2c-4f5f-a4b3-931b01bb64a9'; -- 최서우, 최은우 / Choi Seou, Choi eunwoo (1:2 1T, 9일)
UPDATE tutor_lessons SET total_amount=3500, total_sessions=10, hourly_rate=350 WHERE id='19fdf4a0-1fba-4680-9f64-59c330a93d6b'; -- 박세아, 박세인 / PARK SEA, PARK SEIN (1:2 1T, 10일)
UPDATE tutor_lessons SET total_amount=3000, total_sessions=5, hourly_rate=600 WHERE id='f8bf9961-2048-49c9-9c28-e17aef99db70'; -- 신나영 (1:1 2T, 5일)
UPDATE tutor_lessons SET total_amount=2100, total_sessions=7, hourly_rate=300 WHERE id='b727bc7b-bca1-40e2-85db-bcbfdb7ddbf0'; -- 정민기 / JEONG MINGI (1:1 1T, 7일)
UPDATE tutor_lessons SET total_amount=3600, total_sessions=6, hourly_rate=600 WHERE id='9bcfe238-0f8d-496c-ad49-22bf4f6903c2'; -- 정루하 (1:1 2T, 6일)
UPDATE tutor_lessons SET total_amount=2100, total_sessions=7, hourly_rate=300 WHERE id='5d5a3427-a9c8-416c-b897-56ab4de508ff'; -- 최하진 (1:1 1T, 7일)
UPDATE tutor_lessons SET total_amount=2800, total_sessions=8, hourly_rate=350 WHERE id='5ecdbc7e-8a5b-47c9-8a19-31b0dc17d86d'; -- 곽서아, 곽지아 (1:2 1T, 8일)
UPDATE tutor_lessons SET total_amount=2700, total_sessions=9, hourly_rate=300 WHERE id='62423dfd-cfd8-491c-93ab-fb7a1c6b7d4d'; -- 최서우 (1:1 1T, 9일)
UPDATE tutor_lessons SET total_amount=2700, total_sessions=9, hourly_rate=300 WHERE id='4610d3c8-400c-48d5-bbe1-640bb0a2a445'; -- 최은우 (1:1 1T, 9일)
COMMIT;
