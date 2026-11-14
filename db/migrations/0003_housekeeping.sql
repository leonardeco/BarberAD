-- Índices para las consultas que ya hace la app.
CREATE INDEX sessions_user ON sessions (user_id);
CREATE INDEX sessions_expires ON sessions (expires_at);
CREATE INDEX shop_members_shop ON shop_members (shop_id);
CREATE INDEX services_shop ON services (shop_id);
CREATE INDEX password_resets_expires ON password_resets (expires_at);

-- Las sesiones vencidas y los enlaces de recuperación viejos ya no se acumulan:
-- se barren al abrir una sesión nueva y al pedir un enlace.
CREATE OR REPLACE FUNCTION app_create_session(p_user_id uuid, p_token_hash text) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  DELETE FROM sessions WHERE expires_at <= now();
  INSERT INTO sessions (user_id, token_hash, expires_at)
  VALUES (p_user_id, p_token_hash, now() + interval '30 days');
END;
$$;

CREATE OR REPLACE FUNCTION app_create_password_reset(p_email text, p_token_hash text) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  uid uuid;
BEGIN
  DELETE FROM password_resets WHERE expires_at <= now() - interval '1 day';
  SELECT id INTO uid FROM users WHERE email = lower(trim(p_email));
  IF uid IS NULL THEN
    RETURN false;
  END IF;
  DELETE FROM password_resets WHERE user_id = uid AND used_at IS NULL;
  INSERT INTO password_resets (user_id, token_hash, expires_at)
  VALUES (uid, p_token_hash, now() + interval '30 minutes');
  RETURN true;
END;
$$;
