-- =============================================
-- STEP 10: RLS 설정 (18개 신규 테이블)
-- Supabase SQL Editor에서 실행
-- =============================================

-- ── 1. 전체 테이블 RLS 활성화 ──
ALTER TABLE bookings_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_accommodations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE academy_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssp_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutors ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE online_class_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE shuttle_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_requests ENABLE ROW LEVEL SECURITY;

-- ── 2. 손님용 테이블 정책 (auth.uid() = user_id 본인만) ──

-- guest_profiles: 본인 프로필
CREATE POLICY "guest_profiles_select_own" ON guest_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "guest_profiles_insert_own" ON guest_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "guest_profiles_update_own" ON guest_profiles
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- pickup_requests: 본인 예약의 픽드랍 요청
-- booking_id를 통해 본인 확인 (bookings_new → guest_profiles.user_id)
CREATE POLICY "pickup_requests_select_own" ON pickup_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings_new b
      JOIN guest_profiles g ON g.user_id = auth.uid()
      WHERE b.id = pickup_requests.booking_id
        AND b.booker_name = g.name
    )
  );
CREATE POLICY "pickup_requests_insert_own" ON pickup_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings_new b
      JOIN guest_profiles g ON g.user_id = auth.uid()
      WHERE b.id = pickup_requests.booking_id
        AND b.booker_name = g.name
    )
  );
CREATE POLICY "pickup_requests_update_own" ON pickup_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM bookings_new b
      JOIN guest_profiles g ON g.user_id = auth.uid()
      WHERE b.id = pickup_requests.booking_id
        AND b.booker_name = g.name
    )
  );

-- shuttle_requests: 본인 예약의 셔틀 요청
CREATE POLICY "shuttle_requests_select_own" ON shuttle_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings_new b
      JOIN guest_profiles g ON g.user_id = auth.uid()
      WHERE b.id = shuttle_requests.booking_id
        AND b.booker_name = g.name
    )
  );
CREATE POLICY "shuttle_requests_insert_own" ON shuttle_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings_new b
      JOIN guest_profiles g ON g.user_id = auth.uid()
      WHERE b.id = shuttle_requests.booking_id
        AND b.booker_name = g.name
    )
  );
CREATE POLICY "shuttle_requests_update_own" ON shuttle_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM bookings_new b
      JOIN guest_profiles g ON g.user_id = auth.uid()
      WHERE b.id = shuttle_requests.booking_id
        AND b.booker_name = g.name
    )
  );

-- tutor_requests: 본인 학생의 튜터 요청
CREATE POLICY "tutor_requests_select_own" ON tutor_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students s
      JOIN bookings_new b ON b.id = s.booking_id
      JOIN guest_profiles g ON g.user_id = auth.uid()
      WHERE s.id = tutor_requests.student_id
        AND b.booker_name = g.name
    )
  );
CREATE POLICY "tutor_requests_insert_own" ON tutor_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM students s
      JOIN bookings_new b ON b.id = s.booking_id
      JOIN guest_profiles g ON g.user_id = auth.uid()
      WHERE s.id = tutor_requests.student_id
        AND b.booker_name = g.name
    )
  );

-- ── 3. 나머지 테이블: anon/authenticated 완전 차단 ──
-- service_role key는 RLS를 bypass하므로 정책 불필요
-- 정책이 없으면 = 모든 접근 거부 (RLS ON 상태에서)
-- 아래는 명시적으로 "없음"을 문서화하는 주석

-- bookings_new:            어드민 전용 (service_role bypass)
-- booking_accommodations:  어드민 전용
-- invoices_new:            어드민 전용
-- students:                어드민 전용
-- academy_enrollments:     어드민 전용
-- ssp_records:             어드민 전용
-- tutors:                  어드민 전용
-- tutor_schedules:         어드민 전용
-- tutor_invoices:          어드민 전용
-- online_class_enrollments:어드민 전용
-- drivers:                 어드민 전용
-- vehicles:                어드민 전용
-- driver_schedules:        어드민 전용
-- checkin_details:         어드민 전용

-- ── 4. exec_sql 헬퍼 함수 (향후 스크립트용) ──
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
AS $$ BEGIN EXECUTE sql; END; $$;
