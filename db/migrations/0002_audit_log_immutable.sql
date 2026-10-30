-- Das Audit-Log ist unveränderlich: keine Änderungen, keine Löschungen.
CREATE OR REPLACE FUNCTION moderation_actions_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'moderation_actions ist ein unveränderliches Audit-Log';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER moderation_actions_no_update
  BEFORE UPDATE OR DELETE ON moderation_actions
  FOR EACH ROW EXECUTE FUNCTION moderation_actions_immutable();
