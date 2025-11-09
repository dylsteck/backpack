import dotenv from "dotenv";
import { readFileSync } from "fs";
import { join } from "path";
import pg from "pg";

dotenv.config({
	path: "../../apps/server/.env",
});

const { Client } = pg;

async function runMigration() {
	const client = new Client({
		connectionString: process.env.DATABASE_URL,
	});

	try {
		await client.connect();
		console.log("Connected to database");

		// Read the migration file
		const migrationPath = join(__dirname, "src/migrations/0011_add_stripe_app.sql");
		const sql = readFileSync(migrationPath, "utf-8");

		// Execute the migration
		console.log("Running migration...");
		await client.query(sql);
		console.log("Migration completed successfully!");

		// Verify the update
		const result = await client.query('SELECT id, name, oauth, connection_type FROM apps WHERE id = $1', ['stripe']);
		console.log("Stripe app after migration:", result.rows[0]);
	} catch (error) {
		console.error("Migration failed:", error);
		process.exit(1);
	} finally {
		await client.end();
	}
}

runMigration();

