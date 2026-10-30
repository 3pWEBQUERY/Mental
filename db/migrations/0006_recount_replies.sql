-- reply_count einmalig aus den Antworten neu berechnen (vorher konnte der Zähler driften).
UPDATE posts p SET reply_count = (
  SELECT count(*)::int FROM replies r
  WHERE r.post_id = p.id AND r.status = 'visible' AND NOT r.is_author AND r.deleted_at IS NULL
);
