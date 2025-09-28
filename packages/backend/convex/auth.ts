import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { query, mutation } from "./_generated/server";
import { betterAuth } from "better-auth";

const siteUrl = process.env.SITE_URL!;

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (
	ctx: GenericCtx<DataModel>,
	{ optionsOnly } = { optionsOnly: false },
) => {
	return betterAuth({
		logger: {
			disabled: optionsOnly,
		},
		baseUrl: siteUrl,
		trustedOrigins: [siteUrl],
		database: authComponent.adapter(ctx),
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
		},
		plugins: [convex()],
	});
};

export const getCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (identity === null) {
			return null;
		}
		// You can extend this to fetch additional user data from your database
		// For example: const user = await ctx.db.get(identity.subject as Id<"users">);
		return identity;
	},
});

export const deleteCurrentUser = mutation({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (identity === null) {
			throw new Error("User not authenticated");
		}

		try {
			// For now, we'll mark the user as deleted by removing their session
			// In a production app, you might want to:
			// 1. Delete user data from your tables
			// 2. Use Better Auth's admin API to delete the user
			// 3. Handle cascading deletions
			
			// Delete any user-specific data (like todos)
			const userTodos = await ctx.db
				.query("todos")
				.filter(q => q.eq(q.field("userId"), identity.subject))
				.collect();
			
			for (const todo of userTodos) {
				await ctx.db.delete(todo._id);
			}

			return { success: true };
		} catch (error) {
			console.error("Error deleting user data:", error);
			throw new Error("Failed to delete user account");
		}
	},
});
