-- Planes regalados por el administrador. Cada regalo queda anotado (quién, cuántos meses y por qué).
CREATE TABLE plan_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops (id),
  months integer NOT NULL CHECK (months BETWEEN 1 AND 24),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 200),
  granted_by_user_id uuid NOT NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX plan_grants_shop ON plan_grants (shop_id, created_at DESC);

-- Solo una sesión de administrador verificada con código puede regalar plan. La tabla no tiene permisos directos.
CREATE FUNCTION app_admin_grant_pro(p_session_hash text, p_shop_id uuid, p_months integer, p_note text, p_user_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  until_date timestamptz;
BEGIN
  IF NOT app_session_is_admin(p_session_hash) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_months < 1 OR p_months > 24 THEN RAISE EXCEPTION 'invalid_months'; END IF;
  UPDATE shops
  SET plan_until = greatest(coalesce(plan_until, now()), now()) + make_interval(months => p_months)
  WHERE id = p_shop_id
  RETURNING plan_until INTO until_date;
  IF until_date IS NULL THEN RAISE EXCEPTION 'shop_not_found'; END IF;
  INSERT INTO plan_grants (shop_id, months, note, granted_by_user_id)
  VALUES (p_shop_id, p_months, left(coalesce(p_note, ''), 200), p_user_id);
  RETURN until_date;
END;
$$;
REVOKE ALL ON FUNCTION app_admin_grant_pro(text, uuid, integer, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_admin_grant_pro(text, uuid, integer, text, uuid) TO barberad_app;

-- El panel muestra cuántos regalos tiene cada barbería y los meses regalados en total.
CREATE FUNCTION app_admin_grants(p_session_hash text)
RETURNS TABLE (shop_id uuid, grants integer, months integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT app_session_is_admin(p_session_hash) THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT g.shop_id, count(*)::int, sum(g.months)::int FROM plan_grants g GROUP BY g.shop_id;
END;
$$;
REVOKE ALL ON FUNCTION app_admin_grants(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_admin_grants(text) TO barberad_app;
