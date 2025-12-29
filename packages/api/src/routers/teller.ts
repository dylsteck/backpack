import { publicProcedure, router } from "../index";
import { z } from "zod";
import { db, connections } from "@cortex/db";
import { eq } from "drizzle-orm";
import { TellerService } from "../services/teller";
import { decryptCredentials } from "../lib/credentials";

export const tellerRouter = router({
	/**
	 * Get all accounts for the connected Teller enrollment
	 */
	getAccounts: publicProcedure.query(async () => {
		try {
			// Find the connected Teller connection
			const tellerConnections = await db
				.select()
				.from(connections)
				.where(eq(connections.serverId, "teller"));

			const connection = tellerConnections.find(
				(conn) => conn.status === "connected"
			);

			if (!connection) {
				throw new Error("No connected Teller connection found");
			}

			if (!connection.encryptedCredentials) {
				throw new Error("Teller connection missing credentials");
			}

			// Decrypt the access token
			const accessToken = decryptCredentials(connection.encryptedCredentials);
			const tellerService = new TellerService(accessToken);

			// Fetch accounts from Teller API
			const accounts = await tellerService.getAccounts();

			return { accounts };
		} catch (error: any) {
			console.error("Error fetching Teller accounts:", error);
			throw new Error(error?.message || "Failed to fetch Teller accounts");
		}
	}),

	/**
	 * Get transactions for a specific account
	 */
	getTransactions: publicProcedure
		.input(
			z.object({
				accountId: z.string().optional(), // If not provided, get transactions from all accounts
				count: z.number().optional().default(100),
				fromId: z.string().optional(),
			})
		)
		.query(async ({ input }) => {
			try {
				// Find the connected Teller connection
				const tellerConnections = await db
					.select()
					.from(connections)
					.where(eq(connections.serverId, "teller"));

				const connection = tellerConnections.find(
					(conn) => conn.status === "connected"
				);

				if (!connection) {
					throw new Error("No connected Teller connection found");
				}

				if (!connection.encryptedCredentials) {
					throw new Error("Teller connection missing credentials");
				}

				// Decrypt the access token
				const accessToken = decryptCredentials(connection.encryptedCredentials);
				const tellerService = new TellerService(accessToken);

				// If accountId is provided, fetch transactions for that account
				if (input.accountId) {
					const transactions = await tellerService.getTransactions(
						input.accountId,
						{
							count: input.count,
							from_id: input.fromId,
						}
					);

					return { transactions };
				}

				// Otherwise, fetch transactions from all accounts
				const accounts = await tellerService.getAccounts();
				const allTransactions = [];

				for (const account of accounts) {
					const transactions = await tellerService.getTransactions(
						account.id,
						{
							count: input.count,
							from_id: input.fromId,
						}
					);
					allTransactions.push(...transactions);
				}

				// Sort by date (newest first)
				allTransactions.sort((a, b) => {
					return new Date(b.date).getTime() - new Date(a.date).getTime();
				});

				return { transactions: allTransactions };
			} catch (error: any) {
				console.error("Error fetching Teller transactions:", error);
				throw new Error(error?.message || "Failed to fetch Teller transactions");
			}
		}),

	/**
	 * Get balance for a specific account
	 */
	getBalance: publicProcedure
		.input(
			z.object({
				accountId: z.string(),
			})
		)
		.query(async ({ input }) => {
			try {
				// Find the connected Teller connection
				const tellerConnections = await db
					.select()
					.from(connections)
					.where(eq(connections.serverId, "teller"));

				const connection = tellerConnections.find(
					(conn) => conn.status === "connected"
				);

				if (!connection) {
					throw new Error("No connected Teller connection found");
				}

				if (!connection.encryptedCredentials) {
					throw new Error("Teller connection missing credentials");
				}

				// Decrypt the access token
				const accessToken = decryptCredentials(connection.encryptedCredentials);
				const tellerService = new TellerService(accessToken);

				// Fetch balance from Teller API
				const balance = await tellerService.getBalance(input.accountId);

				return { balance };
			} catch (error: any) {
				console.error("Error fetching Teller balance:", error);
				throw new Error(error?.message || "Failed to fetch Teller balance");
			}
		}),
});

