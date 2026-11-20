-- Comisión por servicio: si está puesta, manda sobre el porcentaje del barbero (p. ej. 50% corte, 40% barba).
ALTER TABLE services ADD COLUMN commission_percent integer CHECK (commission_percent BETWEEN 0 AND 100);
GRANT UPDATE (commission_percent) ON services TO barberad_app;

-- El dueño puede registrar un cobro sin cita a nombre de cualquier barbero de su barbería.
DROP POLICY checkouts_insert ON checkouts;
CREATE POLICY checkouts_insert ON checkouts
FOR INSERT WITH CHECK (
  shop_id = app_current_uuid('app.shop_id')
  AND (
    member_id = app_current_uuid('app.member_id')
    OR (
      current_setting('app.role', true) = 'owner'
      AND EXISTS (SELECT 1 FROM shop_members m WHERE m.id = checkouts.member_id AND m.shop_id = checkouts.shop_id)
    )
  )
);

-- Liquidaciones: cada pago a un barbero lista los cobros exactos que cubre. Un cobro se liquida una sola vez,
-- y uno que entre mientras se liquida queda para el siguiente pago. Nada se edita después.
CREATE TABLE payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES shops (id),
  member_id uuid NOT NULL REFERENCES shop_members (id),
  covers_from date,
  covers_until date,
  cuts integer NOT NULL CHECK (cuts >= 0),
  commission integer NOT NULL CHECK (commission >= 0),
  tips integer NOT NULL CHECK (tips >= 0),
  paid_by_member_id uuid NOT NULL REFERENCES shop_members (id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payouts_member ON payouts (member_id, created_at DESC);

CREATE TABLE payout_items (
  payout_id uuid NOT NULL REFERENCES payouts (id),
  checkout_id uuid NOT NULL UNIQUE REFERENCES checkouts (id),
  shop_id uuid NOT NULL REFERENCES shops (id),
  PRIMARY KEY (payout_id, checkout_id)
);
CREATE TRIGGER payout_items_immutable
BEFORE UPDATE OR DELETE ON payout_items
FOR EACH ROW EXECUTE FUNCTION forbid_checkout_mutation();
ALTER TABLE payout_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_items FORCE ROW LEVEL SECURITY;
CREATE POLICY payout_items_select ON payout_items
FOR SELECT USING (shop_id = app_current_uuid('app.shop_id'));
CREATE POLICY payout_items_insert ON payout_items
FOR INSERT WITH CHECK (
  shop_id = app_current_uuid('app.shop_id') AND current_setting('app.role', true) = 'owner'
);
GRANT SELECT, INSERT ON payout_items TO barberad_app;
CREATE INDEX checkouts_member_time ON checkouts (member_id, completed_at);

CREATE TRIGGER payouts_immutable
BEFORE UPDATE OR DELETE ON payouts
FOR EACH ROW EXECUTE FUNCTION forbid_checkout_mutation();

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts FORCE ROW LEVEL SECURITY;
CREATE POLICY payouts_select ON payouts
FOR SELECT USING (
  shop_id = app_current_uuid('app.shop_id')
  AND (current_setting('app.role', true) = 'owner' OR member_id = app_current_uuid('app.member_id'))
);
CREATE POLICY payouts_insert ON payouts
FOR INSERT WITH CHECK (
  shop_id = app_current_uuid('app.shop_id') AND current_setting('app.role', true) = 'owner'
);
GRANT SELECT, INSERT ON payouts TO barberad_app;
