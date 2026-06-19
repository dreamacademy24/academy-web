-- accom_room과 house_no가 다른 예약 먼저 확인
SELECT id, booker_name, accom_room, house_no
FROM bookings
WHERE accom_room IS NOT NULL
  AND accom_room != ''
  AND (house_no IS NULL OR house_no != accom_room);

-- 위 결과 확인 후, 아래 UPDATE 실행하여 동기화
-- accom_room 값을 house_no에 복사 (accom_room이 캘린더에서 관리되는 최신값)
UPDATE bookings
SET house_no = accom_room
WHERE accom_room IS NOT NULL
  AND accom_room != ''
  AND (house_no IS NULL OR house_no != accom_room);
