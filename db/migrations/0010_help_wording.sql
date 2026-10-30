-- Wortlaut der Standard-Hilfeangebote: «für Junge» → «für Kinder und Jugendliche». Von Admins Geändertes bleibt unberührt.
UPDATE help_resources SET audience = replace(audience, 'für Junge', 'für Kinder und Jugendliche') WHERE audience LIKE 'für Junge%';
