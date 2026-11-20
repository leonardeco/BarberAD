-- Página pública más completa.
ALTER TABLE shops ADD COLUMN about text NOT NULL DEFAULT '' CHECK (length(about) <= 400);
ALTER TABLE shops ADD COLUMN instagram text NOT NULL DEFAULT '' CHECK (instagram ~ '^[A-Za-z0-9._]{0,30}$');
GRANT UPDATE (about, instagram) ON shops TO barberad_app;

-- Plan Pro pagado hasta esta fecha. Vacío o vencido = plan Gratis.
ALTER TABLE shops ADD COLUMN plan_until timestamptz;

-- Límites del plan Gratis. Cambiarlos aquí y en src/server/plans.ts.
CREATE FUNCTION app_is_pro(p_shop_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT plan_until > now() FROM shops WHERE id = p_shop_id), false)
$$;
REVOKE ALL ON FUNCTION app_is_pro(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_is_pro(uuid) TO barberad_app;

-- Pagos del plan (Wompi). La app crea el intento; solo el aviso firmado de Wompi lo aprueba.
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops (id),
  reference text NOT NULL UNIQUE,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  months integer NOT NULL CHECK (months BETWEEN 1 AND 12),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'voided', 'error')),
  provider_id text,
  created_by_member_id uuid NOT NULL REFERENCES shop_members (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_shop ON payments (shop_id, created_at DESC);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
CREATE POLICY payments_select ON payments
FOR SELECT USING (shop_id = app_current_uuid('app.shop_id') AND current_setting('app.role', true) = 'owner');
CREATE POLICY payments_insert ON payments
FOR INSERT WITH CHECK (
  shop_id = app_current_uuid('app.shop_id') AND current_setting('app.role', true) = 'owner' AND status = 'pending'
);
GRANT SELECT, INSERT ON payments TO barberad_app;

-- Aplica el resultado de un pago. Solo se llama después de verificar la firma del aviso.
-- Un pago aprobado suma sus meses una sola vez, desde hoy o desde que vence el plan vigente.
CREATE FUNCTION app_apply_payment(p_reference text, p_status text, p_provider_id text, p_amount_cents bigint)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pay record;
BEGIN
  SELECT * INTO pay FROM payments WHERE reference = p_reference FOR UPDATE;
  IF pay IS NULL THEN RETURN 'unknown'; END IF;
  IF pay.status = 'approved' THEN RETURN 'already'; END IF;
  IF p_status = 'approved' AND p_amount_cents <> pay.amount_cents THEN
    UPDATE payments SET status = 'error', provider_id = p_provider_id, updated_at = now() WHERE id = pay.id;
    RETURN 'amount_mismatch';
  END IF;
  UPDATE payments SET status = p_status, provider_id = p_provider_id, updated_at = now() WHERE id = pay.id;
  IF p_status = 'approved' THEN
    UPDATE shops
    SET plan_until = greatest(coalesce(plan_until, now()), now()) + make_interval(months => pay.months)
    WHERE id = pay.shop_id;
  END IF;
  RETURN p_status;
END;
$$;
REVOKE ALL ON FUNCTION app_apply_payment(text, text, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_apply_payment(text, text, text, bigint) TO barberad_app;

-- Cuentas con Google: se guarda el identificador de Google y la contraseña queda inutilizable
-- (se puede crear una después con "¿Olvidaste tu contraseña?").
ALTER TABLE users ADD COLUMN google_sub text UNIQUE;

CREATE FUNCTION app_find_user_by_google(p_sub text, p_email text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid;
BEGIN
  SELECT id INTO uid FROM users WHERE google_sub = p_sub;
  IF uid IS NOT NULL THEN RETURN uid; END IF;
  -- Mismo correo ya registrado con contraseña: Google confirmó que es suyo, así que se vinculan.
  UPDATE users SET google_sub = p_sub WHERE email = lower(trim(p_email)) AND google_sub IS NULL RETURNING id INTO uid;
  RETURN uid;
END;
$$;
REVOKE ALL ON FUNCTION app_find_user_by_google(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_find_user_by_google(text, text) TO barberad_app;

-- El registro recibe también el WhatsApp del negocio y, si viene de Google, su identificador.
DROP FUNCTION app_register_owner(text, text, text, text, text, boolean);
CREATE FUNCTION app_register_owner(
  p_email text,
  p_password_hash text,
  p_owner_name text,
  p_shop_name text,
  p_slug text,
  p_owner_takes_appointments boolean,
  p_phone text,
  p_google_sub text
) RETURNS TABLE (user_id uuid, shop_id uuid, member_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  uid uuid := gen_random_uuid();
  sid uuid := gen_random_uuid();
  mid uuid := gen_random_uuid();
  final_slug text := p_slug;
  n integer := 1;
BEGIN
  IF length(trim(p_owner_name)) = 0 OR length(trim(p_shop_name)) = 0 THEN
    RAISE EXCEPTION 'invalid_name';
  END IF;
  WHILE EXISTS (SELECT 1 FROM shops WHERE slug = final_slug) LOOP
    n := n + 1;
    final_slug := left(p_slug, 55) || '-' || n;
  END LOOP;
  INSERT INTO users (id, email, password_hash, google_sub)
  VALUES (uid, lower(trim(p_email)), p_password_hash, nullif(p_google_sub, ''));
  INSERT INTO shops (id, name, slug, phone) VALUES (sid, trim(p_shop_name), final_slug, coalesce(p_phone, ''));
  INSERT INTO shop_members (id, shop_id, user_id, role, display_name, commission_percent, takes_appointments)
  VALUES (mid, sid, uid, 'owner', trim(p_owner_name), 100, p_owner_takes_appointments);
  IF p_owner_takes_appointments THEN
    INSERT INTO member_hours (shop_id, member_id, weekday, start_min, end_min)
    SELECT sid, mid, d, 9 * 60, 19 * 60 FROM generate_series(1, 6) AS d;
  END IF;
  user_id := uid;
  shop_id := sid;
  member_id := mid;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION app_register_owner(text, text, text, text, text, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_register_owner(text, text, text, text, text, boolean, text, text) TO barberad_app;

-- Plan Gratis: hasta 2 barberos activos además del dueño.
CREATE OR REPLACE FUNCTION app_add_barber(
  p_owner_user_id uuid,
  p_shop_id uuid,
  p_email text,
  p_password_hash text,
  p_display_name text,
  p_commission_percent integer
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  uid uuid := gen_random_uuid();
  mid uuid := gen_random_uuid();
BEGIN
  IF p_commission_percent < 0 OR p_commission_percent > 100 THEN
    RAISE EXCEPTION 'invalid_commission';
  END IF;
  IF length(trim(p_display_name)) = 0 THEN
    RAISE EXCEPTION 'invalid_name';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM shop_members
    WHERE user_id = p_owner_user_id AND shop_id = p_shop_id AND role = 'owner' AND active
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  PERFORM 1 FROM shops WHERE id = p_shop_id FOR UPDATE;
  IF NOT app_is_pro(p_shop_id)
     AND (SELECT count(*) FROM shop_members WHERE shop_id = p_shop_id AND role = 'barber' AND active) >= 2 THEN
    RAISE EXCEPTION 'plan_limit_barbers';
  END IF;
  INSERT INTO users (id, email, password_hash)
  VALUES (uid, lower(trim(p_email)), p_password_hash);
  INSERT INTO shop_members (id, shop_id, user_id, role, display_name, commission_percent)
  VALUES (mid, p_shop_id, uid, 'barber', trim(p_display_name), p_commission_percent);
  INSERT INTO member_hours (shop_id, member_id, weekday, start_min, end_min)
  SELECT p_shop_id, mid, d, 9 * 60, 19 * 60 FROM generate_series(1, 6) AS d;
  RETURN mid;
END;
$$;

-- Plan Gratis: hasta 50 reservas en línea por mes. Se agrega el chequeo a la reserva pública.
CREATE OR REPLACE FUNCTION app_public_book(
  p_slug text,
  p_service_id uuid,
  p_member_id uuid,
  p_starts_at timestamptz,
  p_name text,
  p_phone text
) RETURNS TABLE (appointment_id uuid, member_name text, starts_at timestamptz, ends_at timestamptz, client_token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  sid uuid;
  tz text;
  mid uuid;
  cid uuid;
  svc record;
  aid uuid;
  tok text;
BEGIN
  SELECT id, timezone INTO sid, tz FROM shops WHERE slug = p_slug;
  IF sid IS NULL THEN RAISE EXCEPTION 'shop_not_found'; END IF;
  IF NOT app_is_pro(sid) AND (
    SELECT count(*) FROM appointments a
    WHERE a.shop_id = sid AND a.source = 'public'
      AND date_trunc('month', a.created_at AT TIME ZONE tz) = date_trunc('month', now() AT TIME ZONE tz)
  ) >= 50 THEN
    RAISE EXCEPTION 'plan_limit_bookings';
  END IF;
  SELECT name, duration_min, list_price INTO svc
  FROM services WHERE id = p_service_id AND shop_id = sid AND active;
  IF svc IS NULL THEN RAISE EXCEPTION 'service_unavailable'; END IF;
  IF length(trim(p_name)) = 0 OR length(trim(p_name)) > 80 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  IF p_phone !~ '^[0-9]{7,15}$' THEN RAISE EXCEPTION 'invalid_phone'; END IF;

  SELECT f.member_id INTO mid
  FROM app_free_slots(sid, p_service_id, p_member_id, (p_starts_at AT TIME ZONE tz)::date) f
  WHERE f.starts_at = p_starts_at
  ORDER BY (
    SELECT count(*) FROM appointments a
    WHERE a.member_id = f.member_id AND a.status IN ('booked', 'done')
      AND (a.starts_at AT TIME ZONE tz)::date = (p_starts_at AT TIME ZONE tz)::date
  ), f.member_id
  LIMIT 1;
  IF mid IS NULL THEN RAISE EXCEPTION 'slot_taken'; END IF;

  INSERT INTO clients (shop_id, name, phone) VALUES (sid, trim(p_name), p_phone)
  ON CONFLICT (shop_id, phone) DO UPDATE SET name = clients.name
  RETURNING id INTO cid;

  IF (SELECT count(*) FROM appointments a
      WHERE a.client_id = cid AND a.status = 'booked' AND a.starts_at > now()) >= 3 THEN
    RAISE EXCEPTION 'too_many_bookings';
  END IF;

  INSERT INTO appointments (shop_id, member_id, service_id, client_id, service_name, list_price, starts_at, ends_at, source)
  VALUES (sid, mid, p_service_id, cid, svc.name, svc.list_price, p_starts_at,
          p_starts_at + make_interval(mins => svc.duration_min), 'public')
  RETURNING id, appointments.client_token INTO aid, tok;

  RETURN QUERY
  SELECT aid, m.display_name, p_starts_at, p_starts_at + make_interval(mins => svc.duration_min), tok
  FROM shop_members m WHERE m.id = mid;
END;
$$;

-- La página pública incluye la descripción, Instagram y el horario de la barbería (la unión de su equipo).
CREATE OR REPLACE FUNCTION app_public_shop(p_slug text) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'phone', s.phone,
    'address', s.address,
    'about', s.about,
    'instagram', s.instagram,
    'timezone', s.timezone,
    'today', (now() AT TIME ZONE s.timezone)::date,
    'hours', coalesce((
      SELECT jsonb_agg(jsonb_build_object('weekday', h.weekday, 'start', h.start_min, 'end', h.end_min) ORDER BY h.weekday)
      FROM (
        SELECT mh.weekday, min(mh.start_min) AS start_min, max(mh.end_min) AS end_min
        FROM member_hours mh
        JOIN shop_members m ON m.id = mh.member_id AND m.active AND m.takes_appointments
        WHERE mh.shop_id = s.id
        GROUP BY mh.weekday
      ) h
    ), '[]'::jsonb),
    'services', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'durationMin', v.duration_min, 'listPrice', v.list_price) ORDER BY v.name)
      FROM services v WHERE v.shop_id = s.id AND v.active
    ), '[]'::jsonb),
    'barbers', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', m.id, 'name', m.display_name) ORDER BY m.display_name)
      FROM shop_members m
      WHERE m.shop_id = s.id AND m.active AND m.takes_appointments
        AND EXISTS (SELECT 1 FROM member_hours h WHERE h.member_id = m.id)
    ), '[]'::jsonb)
  )
  FROM shops s
  WHERE s.slug = p_slug
$$;
