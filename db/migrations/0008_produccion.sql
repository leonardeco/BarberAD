-- Intentos de entrar, de pedir enlaces de recuperación y de reservar, para frenar a quien prueba a la fuerza.
CREATE TABLE auth_attempts (
  id bigserial PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('login', 'reset', 'book')),
  key text NOT NULL,
  ip text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_attempts_key ON auth_attempts (kind, key, created_at);
CREATE INDEX auth_attempts_ip ON auth_attempts (kind, ip, created_at);

-- ¿Está bloqueado? Cuenta los intentos fallidos recientes por correo (o clave) y por IP.
CREATE FUNCTION app_attempts_blocked(p_kind text, p_key text, p_ip text, p_minutes integer, p_max_key integer, p_max_ip integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public AS $$
  SELECT
    (SELECT count(*) FROM auth_attempts
     WHERE kind = p_kind AND key = p_key AND created_at > now() - make_interval(mins => p_minutes)) >= p_max_key
    OR
    (SELECT count(*) FROM auth_attempts
     WHERE kind = p_kind AND ip = p_ip AND created_at > now() - make_interval(mins => p_minutes)) >= p_max_ip
$$;

CREATE FUNCTION app_attempt_record(p_kind text, p_key text, p_ip text) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public AS $$
  DELETE FROM auth_attempts WHERE created_at < now() - interval '1 day';
  INSERT INTO auth_attempts (kind, key, ip) VALUES (p_kind, left(p_key, 254), left(p_ip, 64));
$$;

-- Al entrar bien se borran los fallos de ese correo.
CREATE FUNCTION app_attempts_clear(p_kind text, p_key text) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public AS $$
  DELETE FROM auth_attempts WHERE kind = p_kind AND key = p_key;
$$;

REVOKE ALL ON FUNCTION app_attempts_blocked(text, text, text, integer, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_attempt_record(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_attempts_clear(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_attempts_blocked(text, text, text, integer, integer, integer) TO barberad_app;
GRANT EXECUTE ON FUNCTION app_attempt_record(text, text, text) TO barberad_app;
GRANT EXECUTE ON FUNCTION app_attempts_clear(text, text) TO barberad_app;

-- Anular un cobro: el cobro original no se toca; la anulación queda registrada aparte, con motivo y quién la hizo.
CREATE TABLE checkout_voids (
  checkout_id uuid PRIMARY KEY REFERENCES checkouts (id),
  shop_id uuid NOT NULL REFERENCES shops (id),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 120),
  voided_by_member_id uuid NOT NULL REFERENCES shop_members (id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER checkout_voids_immutable
BEFORE UPDATE OR DELETE ON checkout_voids
FOR EACH ROW EXECUTE FUNCTION forbid_checkout_mutation();
ALTER TABLE checkout_voids ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkout_voids FORCE ROW LEVEL SECURITY;
CREATE POLICY voids_select ON checkout_voids
FOR SELECT USING (shop_id = app_current_uuid('app.shop_id'));
CREATE POLICY voids_insert ON checkout_voids
FOR INSERT WITH CHECK (
  shop_id = app_current_uuid('app.shop_id') AND current_setting('app.role', true) = 'owner'
);
GRANT SELECT, INSERT ON checkout_voids TO barberad_app;

-- Los cobros que cuentan: todos menos los anulados. Respeta la seguridad por filas de quien consulta.
CREATE VIEW live_checkouts WITH (security_invoker = true) AS
SELECT c.* FROM checkouts c
WHERE NOT EXISTS (SELECT 1 FROM checkout_voids v WHERE v.checkout_id = c.id);
GRANT SELECT ON live_checkouts TO barberad_app;

-- Una cita cuyo cobro se anula vuelve a quedar por cobrar, así que puede tener más de un cobro (uno anulado).
-- Que no se cobre dos veces lo sigue cuidando el estado de la cita, bloqueada al cobrar.
DROP INDEX checkouts_appointment;
CREATE INDEX checkouts_appointment ON checkouts (appointment_id) WHERE appointment_id IS NOT NULL;
