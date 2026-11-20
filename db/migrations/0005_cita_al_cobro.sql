-- Pasos de una cita: reservada → confirmada → en silla → atendida (cobrada). O "no vino", o cancelada.
ALTER TABLE appointments ADD COLUMN confirmed_at timestamptz;
ALTER TABLE appointments ADD COLUMN started_at timestamptz;
ALTER TABLE appointments ADD COLUMN closed_at timestamptz;
GRANT UPDATE (confirmed_at, started_at, closed_at) ON appointments TO barberad_app;

-- Un cobro puede venir de una cita, y una cita se cobra una sola vez.
ALTER TABLE checkouts ADD COLUMN appointment_id uuid REFERENCES appointments (id);
CREATE UNIQUE INDEX checkouts_appointment ON checkouts (appointment_id) WHERE appointment_id IS NOT NULL;

-- El dueño puede cobrar la cita de un barbero: el cobro y la comisión quedan a nombre del barbero.
DROP POLICY checkouts_insert ON checkouts;
CREATE POLICY checkouts_insert ON checkouts
FOR INSERT WITH CHECK (
  shop_id = app_current_uuid('app.shop_id')
  AND (
    member_id = app_current_uuid('app.member_id')
    OR (
      current_setting('app.role', true) = 'owner'
      AND appointment_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM appointments a WHERE a.id = appointment_id AND a.member_id = checkouts.member_id)
    )
  )
);
