-- Offene Meldungen zu Inhalten, die es nicht mehr gibt (z. B. nach einer Kontolöschung), schliessen.
-- Die Warteschlange zeigte sie nie an, aber sie belegten vorne Plätze und konnten neue akute Fälle verdrängen.
UPDATE "reports" SET "status" = 'dismissed', "resolved_at" = now()
WHERE "status" = 'open' AND (
  ("target_type" = 'post' AND NOT EXISTS (SELECT 1 FROM "posts" p WHERE p."id" = "reports"."target_id"))
  OR ("target_type" = 'reply' AND NOT EXISTS (SELECT 1 FROM "replies" r WHERE r."id" = "reports"."target_id"))
  OR ("target_type" = 'user' AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = "reports"."target_id"))
);
