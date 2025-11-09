INSERT INTO "apps" ("id", "name", "description", "oauth", "icon_url", "connection_type", "config", "transport", "created_at", "updated_at")
VALUES (
	'stripe',
	'Stripe',
	'Connect bank accounts and view transaction history',
	true,
	'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/stripe.svg',
	'api',
	'{}'::json,
	'[]'::json,
	NOW(),
	NOW()
)
ON CONFLICT ("id") DO UPDATE SET
	"name" = EXCLUDED."name",
	"description" = EXCLUDED."description",
	"oauth" = EXCLUDED."oauth",
	"icon_url" = EXCLUDED."icon_url",
	"connection_type" = EXCLUDED."connection_type",
	"config" = EXCLUDED."config",
	"transport" = EXCLUDED."transport",
	"updated_at" = NOW();

