-- Additive prerequisite; no existing data is rewritten. Service-role only.
CREATE TABLE IF NOT EXISTS public.portal_payment_orders (
  payment_id text PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES public.bookings(id),
  amount_krw integer NOT NULL CHECK (amount_krw > 0),
  paid_before numeric NOT NULL,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','paid')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.portal_payment_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portal_payment_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.portal_payment_orders TO service_role;
CREATE OR REPLACE FUNCTION public.finalize_portal_payment(p_payment_id text, p_booking_id uuid, p_amount integer, p_raw jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  o public.portal_payment_orders%ROWTYPE;
  b public.bookings%ROWTYPE;
  total numeric;
  new_paid numeric;
BEGIN
  SELECT * INTO o FROM public.portal_payment_orders WHERE payment_id = p_payment_id FOR UPDATE;
  IF NOT FOUND OR o.booking_id <> p_booking_id OR o.amount_krw <> p_amount THEN RAISE EXCEPTION 'Payment order mismatch'; END IF;
  IF o.status = 'paid' THEN RETURN jsonb_build_object('ok', true, 'already_processed', true); END IF;
  SELECT * INTO b FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  total := COALESCE(b.final_price, b.base_price, 0);
  IF COALESCE(b.paid_amount, 0) <> o.paid_before OR total - COALESCE(b.paid_amount, 0) <> p_amount THEN RAISE EXCEPTION 'Booking balance changed; reconciliation required'; END IF;
  IF EXISTS (SELECT 1 FROM public.payments WHERE payment_id = p_payment_id) THEN RAISE EXCEPTION 'Payment already recorded; reconciliation required'; END IF;
  INSERT INTO public.payments(booking_id, provider, payment_id, amount_krw, status, raw)
  VALUES(p_booking_id::text, 'portone', p_payment_id, p_amount, 'PAID', p_raw);
  new_paid := COALESCE(b.paid_amount, 0) + p_amount;
  UPDATE public.bookings SET paid_amount = new_paid, payment_status = 'paid', status = '결제완료' WHERE id = p_booking_id;
  UPDATE public.portal_payment_orders SET status = 'paid' WHERE payment_id = p_payment_id;
  RETURN jsonb_build_object('ok', true, 'new_paid', new_paid, 'new_status', 'paid');
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_portal_payment(text,uuid,integer,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_portal_payment(text,uuid,integer,jsonb) TO service_role;
