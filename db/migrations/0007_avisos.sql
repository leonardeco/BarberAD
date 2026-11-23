-- Avisos por WhatsApp que el barbero envía con un toque: se anota cuándo salió cada uno.
ALTER TABLE appointments ADD COLUMN reminded_24_at timestamptz;
ALTER TABLE appointments ADD COLUMN reminded_2h_at timestamptz;
ALTER TABLE appointments ADD COLUMN thanked_at timestamptz;
-- Enlace para que el cliente cancele solo su cita, sin cuenta.
ALTER TABLE appointments ADD COLUMN client_token text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '');
CREATE UNIQUE INDEX appointments_client_token ON appointments (client_token);
ALTER TABLE appointments ADD COLUMN cancelled_by_client boolean NOT NULL DEFAULT false;
GRANT UPDATE (reminded_24_at, reminded_2h_at, thanked_at) ON appointments TO barberad_app;

ALTER TABLE clients ADD COLUMN last_nudged_at timestamptz;
GRANT UPDATE (last_nudged_at) ON clients TO barberad_app;

-- Mensajes de la barbería. Las palabras entre llaves se reemplazan al enviar.
ALTER TABLE shops ADD COLUMN msg_reminder text NOT NULL DEFAULT
  'Hola {nombre}, te recordamos tu cita en {barberia}: {fecha} a las {hora}, {servicio} con {barbero}. Si no puedes venir, cancélala aquí: {cancelar}';
ALTER TABLE shops ADD COLUMN msg_thanks text NOT NULL DEFAULT
  '¡Gracias por venir a {barberia}, {nombre}! Cuando quieras volver, reserva aquí: {enlace}';
ALTER TABLE shops ADD COLUMN msg_comeback text NOT NULL DEFAULT
  'Hola {nombre}, hace rato no te vemos por {barberia}. Reserva tu próximo corte aquí: {enlace}';
ALTER TABLE shops ADD CONSTRAINT shops_messages_length
  CHECK (length(msg_reminder) <= 600 AND length(msg_thanks) <= 600 AND length(msg_comeback) <= 600);
GRANT UPDATE (msg_reminder, msg_thanks, msg_comeback) ON shops TO barberad_app;

-- La reserva pública devuelve también el enlace para cancelar.
DROP FUNCTION app_public_book(text, uuid, uuid, timestamptz, text, text);
CREATE FUNCTION app_public_book(
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
REVOKE ALL ON FUNCTION app_public_book(text, uuid, uuid, timestamptz, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_public_book(text, uuid, uuid, timestamptz, text, text) TO barberad_app;

-- Lo que ve el cliente en su enlace de la cita.
CREATE FUNCTION app_public_appointment(p_token text) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public AS $$
  SELECT jsonb_build_object(
    'shopName', s.name,
    'shopPhone', s.phone,
    'shopAddress', s.address,
    'slug', s.slug,
    'timezone', s.timezone,
    'serviceName', a.service_name,
    'memberName', m.display_name,
    'clientName', c.name,
    'startsAt', a.starts_at,
    'status', a.status,
    'cancelledByClient', a.cancelled_by_client,
    'canCancel', a.status = 'booked' AND a.started_at IS NULL AND a.starts_at > now()
  )
  FROM appointments a
  JOIN shops s ON s.id = a.shop_id
  JOIN shop_members m ON m.id = a.member_id
  JOIN clients c ON c.id = a.client_id
  WHERE a.client_token = p_token
$$;

CREATE FUNCTION app_public_cancel(p_token text) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public AS $$
  WITH done AS (
    UPDATE appointments
    SET status = 'cancelled', cancelled_by_client = true, closed_at = now()
    WHERE client_token = p_token AND status = 'booked' AND started_at IS NULL AND starts_at > now()
    RETURNING id
  )
  SELECT EXISTS (SELECT 1 FROM done)
$$;

REVOKE ALL ON FUNCTION app_public_appointment(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_public_cancel(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_public_appointment(text) TO barberad_app;
GRANT EXECUTE ON FUNCTION app_public_cancel(text) TO barberad_app;
