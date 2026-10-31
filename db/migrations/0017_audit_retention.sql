-- Das Audit-Log bleibt unveränderlich – mit einer Ausnahme: Einträge älter als 24 Monate dürfen gelöscht werden
-- (Aufbewahrungsfrist, Job «retention» im Worker). Ändern bleibt immer verboten.
CREATE OR REPLACE FUNCTION moderation_actions_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.created_at < now() - interval '24 months' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'moderation_actions ist ein unveränderliches Audit-Log';
END;
$$ LANGUAGE plpgsql;
