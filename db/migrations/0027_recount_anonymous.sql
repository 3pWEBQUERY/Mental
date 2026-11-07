-- Anonyme Gedanken zählen Blockierungen nicht mehr (lib/reply-count.ts): einmal neu zählen.
UPDATE "posts" p SET "reply_count" = (
  SELECT count(*)::int FROM "replies" r
  WHERE r.post_id = p.id AND r.status = 'visible' AND NOT r.is_author AND r.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u.id = r.user_id AND u.status = 'deleting')
)
WHERE p.visibility = 'anonymous' AND p.deleted_at IS NULL;
