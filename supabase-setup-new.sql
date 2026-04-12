-- ============================================
-- 새 테이블 3개 (2026-04 로드맵 Phase 0)
-- Supabase SQL Editor에서 실행
-- ============================================

CREATE TABLE IF NOT EXISTS bookings_new (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_type text CHECK (booking_type IN ('dreamhouse','dreamhouse_jaypark','dreamhouse_cubenine','room_only')),
  booker_name text NOT NULL,
  booker_phone text,
  check_in date,
  check_out date,
  academy_start date,
  academy_end date,
  num_adults int DEFAULT 0,
  num_children int DEFAULT 0,
  flight_in_airline text,
  flight_in_date date,
  flight_in_time text,
  flight_out_airline text,
  flight_out_date date,
  flight_out_time text,
  pickup_place text,
  drop_place text,
  agency text,
  payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid')),
  total_amount bigint DEFAULT 0,
  paid_amount bigint DEFAULT 0,
  balance_due date,
  special_request text,
  status text DEFAULT 'pending',
  confirmed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking_accommodations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid REFERENCES bookings_new(id) ON DELETE CASCADE,
  accommodation_type text CHECK (accommodation_type IN ('dreamhouse','jaypark','cubenine')),
  room_type text,
  check_in date,
  check_out date,
  nights int DEFAULT 0,
  price_per_night bigint DEFAULT 0,
  total_amount bigint DEFAULT 0,
  meal_voucher bigint DEFAULT 0,
  package_type text,
  reservation_number text,
  receipt_number text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices_new (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid REFERENCES bookings_new(id) ON DELETE CASCADE,
  invoice_type text CHECK (invoice_type IN ('guest_kr','resort_en_jaypark','resort_en_cubenine','tutor','online_class')),
  issued_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  sent_to text,
  data jsonb,
  created_at timestamptz DEFAULT now()
);
