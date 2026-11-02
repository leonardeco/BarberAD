ALTER TABLE shops ADD COLUMN phone text NOT NULL DEFAULT '';
ALTER TABLE shops ADD COLUMN address text NOT NULL DEFAULT '';
ALTER TABLE shops ADD COLUMN guide_hidden boolean NOT NULL DEFAULT false;

CREATE POLICY shops_update ON shops
FOR UPDATE USING (
  id = app_current_uuid('app.shop_id')
  AND current_setting('app.role', true) = 'owner'
) WITH CHECK (
  id = app_current_uuid('app.shop_id')
  AND current_setting('app.role', true) = 'owner'
);

GRANT UPDATE (name, phone, address, guide_hidden) ON shops TO barberad_app;

CREATE TABLE password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX password_resets_user ON password_resets (user_id);

CREATE FUNCTION app_password_hash_for_user(p_user_id uuid) RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public AS $$
  SELECT password_hash FROM users WHERE id = p_user_id
$$;

CREATE FUNCTION app_change_password(
  p_user_id uuid,
  p_password_hash text,
  p_keep_token_hash text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  UPDATE users SET password_hash = p_password_hash WHERE id = p_user_id;
  DELETE FROM sessions WHERE user_id = p_user_id AND token_hash <> p_keep_token_hash;
END;
$$;

CREATE FUNCTION app_create_password_reset(p_email text, p_token_hash text) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  uid uuid;
BEGIN
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

CREATE FUNCTION app_reset_token_is_valid(p_token_hash text) RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM password_resets
    WHERE token_hash = p_token_hash AND used_at IS NULL AND expires_at > now()
  )
$$;

CREATE FUNCTION app_consume_password_reset(p_token_hash text, p_password_hash text) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  uid uuid;
BEGIN
  UPDATE password_resets
  SET used_at = now()
  WHERE token_hash = p_token_hash AND used_at IS NULL AND expires_at > now()
  RETURNING user_id INTO uid;
  IF uid IS NULL THEN
    RETURN false;
  END IF;
  UPDATE users SET password_hash = p_password_hash WHERE id = uid;
  DELETE FROM sessions WHERE user_id = uid;
  RETURN true;
END;
$$;

CREATE FUNCTION app_reset_member_password(
  p_owner_user_id uuid,
  p_shop_id uuid,
  p_member_id uuid,
  p_password_hash text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  uid uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM shop_members
    WHERE user_id = p_owner_user_id
      AND shop_id = p_shop_id
      AND role = 'owner'
      AND active
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT user_id INTO uid
  FROM shop_members
  WHERE id = p_member_id AND shop_id = p_shop_id AND role = 'barber';
  IF uid IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE users SET password_hash = p_password_hash WHERE id = uid;
  DELETE FROM sessions WHERE user_id = uid;
END;
$$;

CREATE FUNCTION app_member_emails(p_owner_user_id uuid, p_shop_id uuid)
RETURNS TABLE (member_id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM shop_members
    WHERE user_id = p_owner_user_id
      AND shop_id = p_shop_id
      AND role = 'owner'
      AND active
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
  SELECT m.id, u.email
  FROM shop_members m
  JOIN users u ON u.id = m.user_id
  WHERE m.shop_id = p_shop_id;
END;
$$;

REVOKE ALL ON FUNCTION app_password_hash_for_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_change_password(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_create_password_reset(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_reset_token_is_valid(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_consume_password_reset(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_reset_member_password(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_member_emails(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app_password_hash_for_user(uuid) TO barberad_app;
GRANT EXECUTE ON FUNCTION app_change_password(uuid, text, text) TO barberad_app;
GRANT EXECUTE ON FUNCTION app_create_password_reset(text, text) TO barberad_app;
GRANT EXECUTE ON FUNCTION app_reset_token_is_valid(text) TO barberad_app;
GRANT EXECUTE ON FUNCTION app_consume_password_reset(text, text) TO barberad_app;
GRANT EXECUTE ON FUNCTION app_reset_member_password(uuid, uuid, uuid, text) TO barberad_app;
GRANT EXECUTE ON FUNCTION app_member_emails(uuid, uuid) TO barberad_app;
