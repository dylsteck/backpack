INSERT INTO "apps" ("id", "name", "description", "oauth", "icon_url", "connection_type", "config", "transport", "created_at", "updated_at")
VALUES (
	'teller',
	'Teller',
	'Connect your bank accounts and view transaction history',
	true,
	'https://images.crunchbase.com/image/upload/c_pad,h_170,w_170,f_auto,b_white,q_auto:eco,dpr_1/v1477855894/pjmlpvkfj7pwqoveggut.png',
	'api',
	'{"url": "https://api.teller.io"}'::json,
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

