CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  currency char(3) NOT NULL DEFAULT 'COP',
  timezone text NOT NULL DEFAULT 'America/Bogota',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shop_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops (id),
  user_id uuid NOT NULL REFERENCES users (id),
  role text NOT NULL CHECK (role IN ('owner', 'barber')),
  display_name text NOT NULL,
  commission_percent integer NOT NULL CHECK (commission_percent BETWEEN 0 AND 100),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, user_id)
);

CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops (id),
  name text NOT NULL,
  duration_min integer NOT NULL CHECK (duration_min BETWEEN 1 AND 480),
  list_price integer NOT NULL CHECK (list_price >= 0),
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops (id),
  member_id uuid NOT NULL REFERENCES shop_members (id),
  service_id uuid NOT NULL REFERENCES services (id),
  service_name text NOT NULL,
  business_date date NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  list_price integer NOT NULL CHECK (list_price >= 0),
  extras integer NOT NULL CHECK (extras >= 0),
  discount integer NOT NULL CHECK (discount >= 0),
  discount_reason text NOT NULL DEFAULT '',
  charged integer NOT NULL CHECK (charged >= 0),
  tip integer NOT NULL CHECK (tip >= 0),
  currency char(3) NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'card')),
  commission_percent integer NOT NULL CHECK (commission_percent BETWEEN 0 AND 100),
  commission_amount integer NOT NULL CHECK (commission_amount >= 0),
  client_key uuid NOT NULL,
  UNIQUE (shop_id, client_key),
  CHECK (charged = list_price + extras - discount),
  CHECK (
    (discount = 0 AND discount_reason = '')
    OR (discount > 0 AND length(trim(discount_reason)) > 0)
  ),
  CHECK (commission_amount = (charged * commission_percent) / 100)
);

CREATE TABLE cash_drawers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops (id),
  business_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'closed')),
  closed_at timestamptz,
  closed_by_member_id uuid REFERENCES shop_members (id),
  expected_cash integer,
  counted_cash integer,
  UNIQUE (shop_id, business_date)
);

CREATE INDEX checkouts_shop_day ON checkouts (shop_id, business_date);
CREATE INDEX shop_members_user ON shop_members (user_id);

CREATE FUNCTION app_current_uuid(setting_name text) RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN current_setting(setting_name, true) IS NULL
      OR current_setting(setting_name, true) = '' THEN NULL
    ELSE current_setting(setting_name, true)::uuid
  END
$$;

CREATE FUNCTION forbid_checkout_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'checkout_immutable';
END;
$$;

CREATE TRIGGER checkouts_immutable
BEFORE UPDATE OR DELETE ON checkouts
FOR EACH ROW EXECUTE FUNCTION forbid_checkout_mutation();

CREATE FUNCTION reject_checkout_if_drawer_closed() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  drawer_status text;
BEGIN
  SELECT status INTO drawer_status
  FROM cash_drawers
  WHERE shop_id = NEW.shop_id AND business_date = NEW.business_date
  FOR UPDATE;
  IF drawer_status = 'closed' THEN
    RAISE EXCEPTION 'drawer_closed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER checkouts_need_open_drawer
BEFORE INSERT ON checkouts
FOR EACH ROW EXECUTE FUNCTION reject_checkout_if_drawer_closed();

CREATE FUNCTION forbid_reopen_drawer() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'closed' THEN
    RAISE EXCEPTION 'drawer_closed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER drawers_stay_closed
BEFORE UPDATE ON cash_drawers
FOR EACH ROW EXECUTE FUNCTION forbid_reopen_drawer();

CREATE FUNCTION app_register_owner(
  p_email text,
  p_password_hash text,
  p_owner_name text,
  p_shop_name text
) RETURNS TABLE (user_id uuid, shop_id uuid, member_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  uid uuid := gen_random_uuid();
  sid uuid := gen_random_uuid();
  mid uuid := gen_random_uuid();
BEGIN
  IF length(trim(p_owner_name)) = 0 OR length(trim(p_shop_name)) = 0 THEN
    RAISE EXCEPTION 'invalid_name';
  END IF;
  INSERT INTO users (id, email, password_hash)
  VALUES (uid, lower(trim(p_email)), p_password_hash);
  INSERT INTO shops (id, name) VALUES (sid, trim(p_shop_name));
  INSERT INTO shop_members (id, shop_id, user_id, role, display_name, commission_percent)
  VALUES (mid, sid, uid, 'owner', trim(p_owner_name), 100);
  user_id := uid;
  shop_id := sid;
  member_id := mid;
  RETURN NEXT;
END;
$$;

CREATE FUNCTION app_find_user_by_email(p_email text)
RETURNS TABLE (user_id uuid, password_hash text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public AS $$
  SELECT id, users.password_hash
  FROM users
  WHERE email = lower(trim(p_email))
$$;

CREATE FUNCTION app_create_session(p_user_id uuid, p_token_hash text) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public AS $$
  INSERT INTO sessions (user_id, token_hash, expires_at)
  VALUES (p_user_id, p_token_hash, now() + interval '30 days')
$$;

CREATE FUNCTION app_read_session(p_token_hash text) RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public AS $$
  SELECT user_id
  FROM sessions
  WHERE token_hash = p_token_hash AND expires_at > now()
$$;

CREATE FUNCTION app_delete_session(p_token_hash text) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public AS $$
  DELETE FROM sessions WHERE token_hash = p_token_hash
$$;

CREATE FUNCTION app_membership_for_user(p_user_id uuid)
RETURNS TABLE (
  member_id uuid,
  shop_id uuid,
  role text,
  display_name text,
  commission_percent integer,
  shop_name text,
  currency text,
  timezone text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public AS $$
  SELECT m.id, m.shop_id, m.role, m.display_name, m.commission_percent,
         s.name, s.currency::text, s.timezone
  FROM shop_members m
  JOIN shops s ON s.id = m.shop_id
  WHERE m.user_id = p_user_id AND m.active
  ORDER BY (m.role = 'owner') DESC, m.created_at
  LIMIT 1
$$;

CREATE FUNCTION app_add_barber(
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
    WHERE user_id = p_owner_user_id
      AND shop_id = p_shop_id
      AND role = 'owner'
      AND active
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO users (id, email, password_hash)
  VALUES (uid, lower(trim(p_email)), p_password_hash);
  INSERT INTO shop_members (id, shop_id, user_id, role, display_name, commission_percent)
  VALUES (mid, p_shop_id, uid, 'barber', trim(p_display_name), p_commission_percent);
  RETURN mid;
END;
$$;

REVOKE ALL ON FUNCTION app_current_uuid(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_register_owner(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_find_user_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_create_session(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_read_session(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_delete_session(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_membership_for_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_add_barber(uuid, uuid, text, text, text, integer) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION app_current_uuid(text) TO barberad_app;
GRANT EXECUTE ON FUNCTION app_register_owner(text, text, text, text) TO barberad_app;
GRANT EXECUTE ON FUNCTION app_find_user_by_email(text) TO barberad_app;
GRANT EXECUTE ON FUNCTION app_create_session(uuid, text) TO barberad_app;
GRANT EXECUTE ON FUNCTION app_read_session(text) TO barberad_app;
GRANT EXECUTE ON FUNCTION app_delete_session(text) TO barberad_app;
GRANT EXECUTE ON FUNCTION app_membership_for_user(uuid) TO barberad_app;
GRANT EXECUTE ON FUNCTION app_add_barber(uuid, uuid, text, text, text, integer) TO barberad_app;

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops FORCE ROW LEVEL SECURITY;
ALTER TABLE shop_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_members FORCE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE services FORCE ROW LEVEL SECURITY;
ALTER TABLE checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkouts FORCE ROW LEVEL SECURITY;
ALTER TABLE cash_drawers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_drawers FORCE ROW LEVEL SECURITY;

CREATE POLICY shops_select ON shops
FOR SELECT USING (id = app_current_uuid('app.shop_id'));

CREATE POLICY members_select ON shop_members
FOR SELECT USING (
  shop_id = app_current_uuid('app.shop_id')
  AND (
    current_setting('app.role', true) = 'owner'
    OR user_id = app_current_uuid('app.user_id')
  )
);

CREATE POLICY members_update ON shop_members
FOR UPDATE USING (
  shop_id = app_current_uuid('app.shop_id')
  AND current_setting('app.role', true) = 'owner'
) WITH CHECK (
  shop_id = app_current_uuid('app.shop_id')
  AND current_setting('app.role', true) = 'owner'
);

CREATE POLICY services_select ON services
FOR SELECT USING (shop_id = app_current_uuid('app.shop_id'));

CREATE POLICY services_write ON services
FOR INSERT WITH CHECK (
  shop_id = app_current_uuid('app.shop_id')
  AND current_setting('app.role', true) = 'owner'
);

CREATE POLICY services_update ON services
FOR UPDATE USING (
  shop_id = app_current_uuid('app.shop_id')
  AND current_setting('app.role', true) = 'owner'
) WITH CHECK (
  shop_id = app_current_uuid('app.shop_id')
  AND current_setting('app.role', true) = 'owner'
);

CREATE POLICY checkouts_select ON checkouts
FOR SELECT USING (
  shop_id = app_current_uuid('app.shop_id')
  AND (
    current_setting('app.role', true) = 'owner'
    OR member_id = app_current_uuid('app.member_id')
  )
);

CREATE POLICY checkouts_insert ON checkouts
FOR INSERT WITH CHECK (
  shop_id = app_current_uuid('app.shop_id')
  AND member_id = app_current_uuid('app.member_id')
);

CREATE POLICY drawers_select ON cash_drawers
FOR SELECT USING (shop_id = app_current_uuid('app.shop_id'));

CREATE POLICY drawers_insert ON cash_drawers
FOR INSERT WITH CHECK (
  shop_id = app_current_uuid('app.shop_id')
  AND status = 'open'
);

CREATE POLICY drawers_update ON cash_drawers
FOR UPDATE USING (
  shop_id = app_current_uuid('app.shop_id')
  AND current_setting('app.role', true) = 'owner'
) WITH CHECK (
  shop_id = app_current_uuid('app.shop_id')
  AND current_setting('app.role', true) = 'owner'
);

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO barberad_app;
GRANT SELECT ON shops TO barberad_app;
GRANT SELECT, UPDATE ON shop_members TO barberad_app;
GRANT SELECT, INSERT, UPDATE ON services TO barberad_app;
GRANT SELECT, INSERT ON checkouts TO barberad_app;
GRANT SELECT, INSERT, UPDATE ON cash_drawers TO barberad_app;
