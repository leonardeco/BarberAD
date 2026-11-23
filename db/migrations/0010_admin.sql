-- Códigos de 4 dígitos de un solo uso: recuperar la contraseña y entrar al panel de administrador.
-- Solo se tocan por las funciones de abajo; la app no tiene permiso directo sobre la tabla.
CREATE TABLE one_time_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  purpose text NOT NULL CHECK (purpose IN ('reset', 'admin')),
  code_hash text NOT NULL,
  issued_by text NOT NULL DEFAULT 'self' CHECK (issued_by IN ('self', 'admin')),
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX one_time_codes_user ON one_time_codes (user_id, purpose, created_at DESC);

ALTER TABLE auth_attempts DROP CONSTRAINT auth_attempts_kind_check;
ALTER TABLE auth_attempts ADD CONSTRAINT auth_attempts_kind_check CHECK (kind IN ('login', 'reset', 'book', 'code'));

-- La sesión del administrador solo abre el panel después de confirmar un código.
ALTER TABLE sessions ADD COLUMN admin_verified_until timestamptz;

CREATE FUNCTION app_issue_code(p_user_id uuid, p_purpose text, p_code_hash text, p_minutes integer, p_issued_by text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM one_time_codes WHERE created_at < now() - interval '1 day';
  UPDATE one_time_codes SET used_at = now() WHERE user_id = p_user_id AND purpose = p_purpose AND used_at IS NULL;
  INSERT INTO one_time_codes (user_id, purpose, code_hash, expires_at, issued_by)
  VALUES (p_user_id, p_purpose, p_code_hash, now() + make_interval(mins => p_minutes), p_issued_by);
END;
$$;

-- Cinco intentos por código; al quinto fallo el código se anula.
CREATE FUNCTION app_check_code(p_user_id uuid, p_purpose text, p_code_hash text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c record;
BEGIN
  SELECT * INTO c FROM one_time_codes
  WHERE user_id = p_user_id AND purpose = p_purpose AND used_at IS NULL
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF c IS NULL THEN RETURN 'none'; END IF;
  IF c.expires_at <= now() THEN RETURN 'expired'; END IF;
  IF c.attempts >= 5 THEN RETURN 'locked'; END IF;
  IF c.code_hash = p_code_hash THEN
    UPDATE one_time_codes SET used_at = now() WHERE id = c.id;
    RETURN 'ok';
  END IF;
  UPDATE one_time_codes SET attempts = attempts + 1 WHERE id = c.id;
  IF c.attempts + 1 >= 5 THEN RETURN 'locked'; END IF;
  RETURN 'wrong';
END;
$$;

-- Cambia la contraseña si el código es correcto y cierra todas las sesiones de esa persona.
CREATE FUNCTION app_reset_with_code(p_user_id uuid, p_code_hash text, p_password_hash text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result text;
BEGIN
  result := app_check_code(p_user_id, 'reset', p_code_hash);
  IF result = 'ok' THEN
    UPDATE users SET password_hash = p_password_hash WHERE id = p_user_id;
    DELETE FROM sessions WHERE user_id = p_user_id;
  END IF;
  RETURN result;
END;
$$;

CREATE FUNCTION app_admin_verify(p_session_hash text, p_user_id uuid, p_code_hash text, p_hours integer) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result text;
BEGIN
  result := app_check_code(p_user_id, 'admin', p_code_hash);
  IF result = 'ok' THEN
    UPDATE sessions SET admin_verified_until = now() + make_interval(hours => p_hours)
    WHERE token_hash = p_session_hash AND user_id = p_user_id AND expires_at > now();
  END IF;
  RETURN result;
END;
$$;

CREATE FUNCTION app_session_is_admin(p_session_hash text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((
    SELECT admin_verified_until > now() AND expires_at > now()
    FROM sessions WHERE token_hash = p_session_hash
  ), false)
$$;

CREATE FUNCTION app_email_for_user(p_user_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT email FROM users WHERE id = p_user_id
$$;

-- ---------- Panel de administrador: todo exige una sesión verificada con código ----------

CREATE FUNCTION app_admin_overview(p_session_hash text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  tz constant text := 'America/Bogota';
  today date := (now() AT TIME ZONE 'America/Bogota')::date;
  result jsonb;
BEGIN
  IF NOT app_session_is_admin(p_session_hash) THEN RAISE EXCEPTION 'forbidden'; END IF;
  WITH live AS (
    SELECT c.shop_id, c.business_date, c.charged, c.tip, c.commission_amount, m.role AS member_role
    FROM checkouts c JOIN shop_members m ON m.id = c.member_id
    WHERE NOT EXISTS (SELECT 1 FROM checkout_voids v WHERE v.checkout_id = c.id)
  )
  SELECT jsonb_build_object(
    'shops', jsonb_build_object(
      'total', (SELECT count(*) FROM shops),
      'new7', (SELECT count(*) FROM shops WHERE (created_at AT TIME ZONE tz)::date > today - 7),
      'new30', (SELECT count(*) FROM shops WHERE (created_at AT TIME ZONE tz)::date > today - 30),
      'active7', (SELECT count(DISTINCT shop_id) FROM live WHERE business_date > today - 7),
      'active30', (SELECT count(DISTINCT shop_id) FROM live WHERE business_date > today - 30),
      'pro', (SELECT count(*) FROM shops WHERE plan_until > now()),
      'proExpiring7', (SELECT count(*) FROM shops WHERE plan_until > now() AND plan_until < now() + interval '7 days')
    ),
    'users', jsonb_build_object(
      'total', (SELECT count(*) FROM users),
      'barbers', (SELECT count(*) FROM shop_members WHERE role = 'barber' AND active),
      'google', (SELECT count(*) FROM users WHERE google_sub IS NOT NULL)
    ),
    'sales', jsonb_build_object(
      'today', (SELECT jsonb_build_object('cuts', count(*), 'charged', coalesce(sum(charged), 0), 'tips', coalesce(sum(tip), 0),
                  'teamCommission', coalesce(sum(commission_amount) FILTER (WHERE member_role = 'barber'), 0)) FROM live WHERE business_date = today),
      'last7', (SELECT jsonb_build_object('cuts', count(*), 'charged', coalesce(sum(charged), 0), 'tips', coalesce(sum(tip), 0),
                  'teamCommission', coalesce(sum(commission_amount) FILTER (WHERE member_role = 'barber'), 0)) FROM live WHERE business_date > today - 7),
      'last30', (SELECT jsonb_build_object('cuts', count(*), 'charged', coalesce(sum(charged), 0), 'tips', coalesce(sum(tip), 0),
                  'teamCommission', coalesce(sum(commission_amount) FILTER (WHERE member_role = 'barber'), 0)) FROM live WHERE business_date > today - 30)
    ),
    'appointments', jsonb_build_object(
      'total30', (SELECT count(*) FROM appointments WHERE (starts_at AT TIME ZONE tz)::date > today - 30 AND (starts_at AT TIME ZONE tz)::date <= today),
      'done30', (SELECT count(*) FROM appointments WHERE status = 'done' AND (starts_at AT TIME ZONE tz)::date > today - 30),
      'noShow30', (SELECT count(*) FROM appointments WHERE status = 'no_show' AND (starts_at AT TIME ZONE tz)::date > today - 30),
      'cancelled30', (SELECT count(*) FROM appointments WHERE status = 'cancelled' AND (starts_at AT TIME ZONE tz)::date > today - 30),
      'cancelledByClient30', (SELECT count(*) FROM appointments WHERE cancelled_by_client AND (starts_at AT TIME ZONE tz)::date > today - 30),
      'online30', (SELECT count(*) FROM appointments WHERE source = 'public' AND (created_at AT TIME ZONE tz)::date > today - 30)
    ),
    'billing', jsonb_build_object(
      'approved', (SELECT count(*) FROM payments WHERE status = 'approved'),
      'pending', (SELECT count(*) FROM payments WHERE status = 'pending'),
      'revenueTotal', (SELECT coalesce(sum(amount_cents), 0) / 100 FROM payments WHERE status = 'approved'),
      'revenue30', (SELECT coalesce(sum(amount_cents), 0) / 100 FROM payments WHERE status = 'approved' AND (updated_at AT TIME ZONE tz)::date > today - 30)
    ),
    'funnel', jsonb_build_object(
      'registered', (SELECT count(*) FROM shops),
      'withServices', (SELECT count(DISTINCT shop_id) FROM services WHERE active),
      'withTeam', (SELECT count(DISTINCT shop_id) FROM shop_members WHERE role = 'barber' AND active),
      'withBooking', (SELECT count(DISTINCT shop_id) FROM appointments WHERE source = 'public'),
      'withCheckout', (SELECT count(DISTINCT shop_id) FROM live)
    ),
    'series', (
      SELECT jsonb_agg(jsonb_build_object(
        'day', d::date,
        'signups', (SELECT count(*) FROM shops s WHERE (s.created_at AT TIME ZONE tz)::date = d::date),
        'cuts', (SELECT count(*) FROM live WHERE business_date = d::date),
        'charged', (SELECT coalesce(sum(charged), 0) FROM live WHERE business_date = d::date),
        'bookings', (SELECT count(*) FROM appointments a WHERE a.source = 'public' AND (a.created_at AT TIME ZONE tz)::date = d::date)
      ) ORDER BY d)
      FROM generate_series(today - 29, today, interval '1 day') d
    )
  ) INTO result;
  RETURN result;
END;
$$;

CREATE FUNCTION app_admin_shops(p_session_hash text, p_query text)
RETURNS TABLE (
  shop_id uuid, name text, slug text, phone text, created_at timestamptz, owner_name text, owner_email text,
  pro boolean, plan_until timestamptz, barbers integer, cuts30 integer, charged30 integer, online30 integer, last_activity timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  today date := (now() AT TIME ZONE 'America/Bogota')::date;
  pattern text := '%' || replace(replace(replace(coalesce(p_query, ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
BEGIN
  IF NOT app_session_is_admin(p_session_hash) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT s.id, s.name, s.slug, s.phone, s.created_at, o.display_name, u.email,
         coalesce(s.plan_until > now(), false), s.plan_until,
         (SELECT count(*)::int FROM shop_members m WHERE m.shop_id = s.id AND m.role = 'barber' AND m.active),
         (SELECT count(*)::int FROM checkouts c WHERE c.shop_id = s.id AND c.business_date > today - 30
            AND NOT EXISTS (SELECT 1 FROM checkout_voids v WHERE v.checkout_id = c.id)),
         (SELECT coalesce(sum(c.charged), 0)::int FROM checkouts c WHERE c.shop_id = s.id AND c.business_date > today - 30
            AND NOT EXISTS (SELECT 1 FROM checkout_voids v WHERE v.checkout_id = c.id)),
         (SELECT count(*)::int FROM appointments a WHERE a.shop_id = s.id AND a.source = 'public' AND (a.created_at AT TIME ZONE 'America/Bogota')::date > today - 30),
         (SELECT max(c.completed_at) FROM checkouts c WHERE c.shop_id = s.id)
  FROM shops s
  JOIN shop_members o ON o.shop_id = s.id AND o.role = 'owner'
  JOIN users u ON u.id = o.user_id
  WHERE p_query IS NULL OR p_query = '' OR s.name ILIKE pattern OR u.email ILIKE pattern OR s.slug ILIKE pattern
  ORDER BY (SELECT max(c.completed_at) FROM checkouts c WHERE c.shop_id = s.id) DESC NULLS LAST, s.created_at DESC
  LIMIT 100;
END;
$$;

-- Para darle un código de recuperación al dueño de una barbería.
CREATE FUNCTION app_admin_owner_of(p_session_hash text, p_shop_id uuid) RETURNS TABLE (user_id uuid, email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT app_session_is_admin(p_session_hash) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT u.id, u.email FROM shop_members m JOIN users u ON u.id = m.user_id
  WHERE m.shop_id = p_shop_id AND m.role = 'owner' AND m.active LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION app_issue_code(uuid, text, text, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_check_code(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_reset_with_code(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_admin_verify(text, uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_session_is_admin(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_email_for_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_admin_overview(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_admin_shops(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_admin_owner_of(text, uuid) FROM PUBLIC;
-- app_check_code solo la llaman otras funciones; la app no la necesita directo.
GRANT EXECUTE ON FUNCTION app_issue_code(uuid, text, text, integer, text) TO barberad_app;
GRANT EXECUTE ON FUNCTION app_reset_with_code(uuid, text, text) TO barberad_app;
GRANT EXECUTE ON FUNCTION app_admin_verify(text, uuid, text, integer) TO barberad_app;
GRANT EXECUTE ON FUNCTION app_session_is_admin(text) TO barberad_app;
GRANT EXECUTE ON FUNCTION app_email_for_user(uuid) TO barberad_app;
GRANT EXECUTE ON FUNCTION app_admin_overview(text) TO barberad_app;
GRANT EXECUTE ON FUNCTION app_admin_shops(text, text) TO barberad_app;
GRANT EXECUTE ON FUNCTION app_admin_owner_of(text, uuid) TO barberad_app;
