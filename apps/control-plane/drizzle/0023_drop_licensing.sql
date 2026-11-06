DROP TABLE IF EXISTS "installation";--> statement-breakpoint
DROP TABLE IF EXISTS "licenses";--> statement-breakpoint
DELETE FROM "alert_rules" WHERE "event" = 'license.expiring';
