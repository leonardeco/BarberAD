CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Dirección pública de la barbería: barberad.co/r/<slug>
ALTER TABLE shops ADD COLUMN slug text;
UPDATE shops SET slug = 'barberia-' || substr(replace(id::text, '-', ''), 1, 8) WHERE slug IS NULL;
ALTER TABLE shops ALTER COLUMN slug SET NOT NULL;
ALTER TABLE shops ADD CONSTRAINT shops_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 3 AND 60);
CREATE UNIQUE INDEX shops_slug ON shops (slug);

-- Quién recibe citas. Los barberos sí; el dueño solo si también atiende.
ALTER TABLE shop_members ADD COLUMN takes_appointments boolean NOT NULL DEFAULT true;
UPDATE shop_members SET takes_appointments = false WHERE role = 'owner';

-- Horario semanal: minutos desde la medianoche, en la hora de la barbería. Lunes = 1, domingo = 7.
CREATE TABLE member_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops (id),
  member_id uuid NOT NULL REFERENCES shop_members (id),
  weekday integer NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_min integer NOT NULL CHECK (start_min BETWEEN 0 AND 1439),
  end_min integer NOT NULL CHECK (end_min BETWEEN 1 AND 1440),
  CHECK (end_min > start_min)
);
CREATE INDEX member_hours_member ON member_hours (member_id, weekday);

CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops (id),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  phone text NOT NULL CHECK (phone ~ '^[0-9]{7,15}$'),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, phone)
);

CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops (id),
  member_id uuid NOT NULL REFERENCES shop_members (id),
  service_id uuid NOT NULL REFERENCES services (id),
  client_id uuid NOT NULL REFERENCES clients (id),
  service_name text NOT NULL,
  list_price integer NOT NULL CHECK (list_price >= 0),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'done', 'cancelled', 'no_show')),
  source text NOT NULL CHECK (source IN ('public', 'staff')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  -- Un barbero no puede tener dos citas que se crucen, aunque lleguen al mismo tiempo.
  CONSTRAINT appointments_no_overlap EXCLUDE USING gist (
    member_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status IN ('booked', 'done'))
);
CREATE INDEX appointments_shop_time ON appointments (shop_id, starts_at);
CREATE INDEX appointments_client ON appointments (client_id);

-- Huecos libres de un día, cada 15 minutos, en la hora de la barbería.
CREATE FUNCTION app_free_slots(p_shop_id uuid, p_service_id uuid, p_member_id uuid, p_day date)
RETURNS TABLE (member_id uuid, starts_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public AS $$
  WITH shop AS (
    SELECT id, timezone FROM shops WHERE id = p_shop_id
  ), svc AS (
    SELECT duration_min FROM services WHERE id = p_service_id AND shop_id = p_shop_id AND active
  ), barbers AS (
    SELECT m.id FROM shop_members m
    WHERE m.shop_id = p_shop_id AND m.active AND m.takes_appointments
      AND (p_member_id IS NULL OR m.id = p_member_id)
  ), candidates AS (
    SELECT h.member_id,
           ((p_day + make_interval(mins => t)) AT TIME ZONE shop.timezone) AS starts_at,
           ((p_day + make_interval(mins => t + svc.duration_min)) AT TIME ZONE shop.timezone) AS ends_at
    FROM member_hours h
    JOIN barbers b ON b.id = h.member_id
    CROSS JOIN shop
    CROSS JOIN svc
    CROSS JOIN LATERAL generate_series(h.start_min, h.end_min - svc.duration_min, 15) AS t
    WHERE h.shop_id = p_shop_id AND h.weekday = extract(isodow FROM p_day)::int
  )
  SELECT DISTINCT c.member_id, c.starts_at
  FROM candidates c
  WHERE c.starts_at > now() + interval '10 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.member_id = c.member_id
        AND a.status IN ('booked', 'done')
        AND tstzrange(a.starts_at, a.ends_at) && tstzrange(c.starts_at, c.ends_at)
    )
  ORDER BY c.starts_at, c.member_id
$$;

-- Lo que ve quien reserva desde el enlace público: la barbería, sus servicios y quién atiende.
CREATE FUNCTION app_public_shop(p_slug text) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'phone', s.phone,
    'address', s.address,
    'timezone', s.timezone,
    'today', (now() AT TIME ZONE s.timezone)::date,
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

-- Reserva desde el enlace público. Si no se elige barbero, se asigna el que tenga menos citas ese día.
CREATE FUNCTION app_public_book(
  p_slug text,
  p_service_id uuid,
  p_member_id uuid,
  p_starts_at timestamptz,
  p_name text,
  p_phone text
) RETURNS TABLE (appointment_id uuid, member_name text, starts_at timestamptz, ends_at timestamptz)
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
BEGIN
  SELECT id, timezone INTO sid, tz FROM shops WHERE slug = p_slug;
  IF sid IS NULL THEN RAISE EXCEPTION 'shop_not_found'; END IF;
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
  RETURNING id INTO aid;

  RETURN QUERY
  SELECT aid, m.display_name, p_starts_at, p_starts_at + make_interval(mins => svc.duration_min)
  FROM shop_members m WHERE m.id = mid;
END;
$$;

REVOKE ALL ON FUNCTION app_free_slots(uuid, uuid, uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_public_shop(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_public_book(text, uuid, uuid, timestamptz, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_free_slots(uuid, uuid, uuid, date) TO barberad_app;
GRANT EXECUTE ON FUNCTION app_public_shop(text) TO barberad_app;
GRANT EXECUTE ON FUNCTION app_public_book(text, uuid, uuid, timestamptz, text, text) TO barberad_app;

-- El registro ahora recibe la dirección pública y si el dueño también atiende.
DROP FUNCTION app_register_owner(text, text, text, text);
CREATE FUNCTION app_register_owner(
  p_email text,
  p_password_hash text,
  p_owner_name text,
  p_shop_name text,
  p_slug text,
  p_owner_takes_appointments boolean
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
  INSERT INTO users (id, email, password_hash)
  VALUES (uid, lower(trim(p_email)), p_password_hash);
  INSERT INTO shops (id, name, slug) VALUES (sid, trim(p_shop_name), final_slug);
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
REVOKE ALL ON FUNCTION app_register_owner(text, text, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_register_owner(text, text, text, text, text, boolean) TO barberad_app;

-- Un barbero nuevo arranca con horario de lunes a sábado, 9:00 a 19:00.
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
  INSERT INTO users (id, email, password_hash)
  VALUES (uid, lower(trim(p_email)), p_password_hash);
  INSERT INTO shop_members (id, shop_id, user_id, role, display_name, commission_percent)
  VALUES (mid, p_shop_id, uid, 'barber', trim(p_display_name), p_commission_percent);
  INSERT INTO member_hours (shop_id, member_id, weekday, start_min, end_min)
  SELECT p_shop_id, mid, d, 9 * 60, 19 * 60 FROM generate_series(1, 6) AS d;
  RETURN mid;
END;
$$;

-- Los barberos que ya existían también arrancan con ese horario.
INSERT INTO member_hours (shop_id, member_id, weekday, start_min, end_min)
SELECT m.shop_id, m.id, d, 9 * 60, 19 * 60
FROM shop_members m CROSS JOIN generate_series(1, 6) AS d
WHERE m.role = 'barber';

ALTER TABLE member_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_hours FORCE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients FORCE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments FORCE ROW LEVEL SECURITY;

CREATE POLICY hours_select ON member_hours
FOR SELECT USING (shop_id = app_current_uuid('app.shop_id'));
CREATE POLICY hours_owner_write ON member_hours
FOR ALL USING (
  shop_id = app_current_uuid('app.shop_id') AND current_setting('app.role', true) = 'owner'
) WITH CHECK (
  shop_id = app_current_uuid('app.shop_id') AND current_setting('app.role', true) = 'owner'
);

CREATE POLICY clients_all ON clients
FOR ALL USING (shop_id = app_current_uuid('app.shop_id'))
WITH CHECK (shop_id = app_current_uuid('app.shop_id'));

-- El dueño ve y maneja toda la agenda; el barbero, solo la suya.
CREATE POLICY appointments_select ON appointments
FOR SELECT USING (
  shop_id = app_current_uuid('app.shop_id')
  AND (current_setting('app.role', true) = 'owner' OR member_id = app_current_uuid('app.member_id'))
);
CREATE POLICY appointments_insert ON appointments
FOR INSERT WITH CHECK (
  shop_id = app_current_uuid('app.shop_id')
  AND (current_setting('app.role', true) = 'owner' OR member_id = app_current_uuid('app.member_id'))
);
CREATE POLICY appointments_update ON appointments
FOR UPDATE USING (
  shop_id = app_current_uuid('app.shop_id')
  AND (current_setting('app.role', true) = 'owner' OR member_id = app_current_uuid('app.member_id'))
) WITH CHECK (
  shop_id = app_current_uuid('app.shop_id')
  AND (current_setting('app.role', true) = 'owner' OR member_id = app_current_uuid('app.member_id'))
);

GRANT UPDATE (slug) ON shops TO barberad_app;
GRANT UPDATE (takes_appointments) ON shop_members TO barberad_app;
GRANT SELECT, INSERT, DELETE ON member_hours TO barberad_app;
GRANT SELECT, INSERT, UPDATE ON clients TO barberad_app;
GRANT SELECT, INSERT ON appointments TO barberad_app;
GRANT UPDATE (status) ON appointments TO barberad_app;
