-- ============================================
-- 기존 테이블 (건드리지 않음)
-- ============================================

CREATE TABLE IF NOT EXISTS bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_no TEXT UNIQUE,
  status TEXT DEFAULT '접수',
  booker_name TEXT NOT NULL,
  booker_english TEXT DEFAULT '',
  reservation_date DATE DEFAULT CURRENT_DATE,
  balance_date DATE,
  students JSONB DEFAULT '[]',
  accom_type TEXT DEFAULT '',
  accom_room TEXT DEFAULT '',
  accom_weeks INTEGER DEFAULT 2,
  checkin_date DATE,
  checkout_date DATE,
  pickup TEXT DEFAULT 'O',
  drop_off TEXT DEFAULT 'O',
  pickup_place TEXT DEFAULT '',
  flight_in TEXT DEFAULT '',
  flight_out TEXT DEFAULT '',
  house_no TEXT DEFAULT '',
  special_request TEXT DEFAULT '',
  agency TEXT DEFAULT '개인',
  ssp TEXT DEFAULT 'O',
  base_price INTEGER DEFAULT 0,
  billing_items JSONB DEFAULT '[]',
  discounts JSONB DEFAULT '[]',
  locals JSONB DEFAULT '[{"name":"SSP / SSP I card","amount":""},{"name":"드림하우스 보증금","amount":""}]',
  total_discount INTEGER DEFAULT 0,
  final_price INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 새 테이블 (2026-04 로드맵 Phase 0)
-- Phase 3에서 기존 bookings → bookings_new 마이그레이션 예정
-- ============================================

-- 1. bookings_new (예약 마스터 - 새 스키마)
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

-- 2. booking_accommodations (숙소별 상세)
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

-- 3. invoices_new (인보이스 발행 이력)
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
