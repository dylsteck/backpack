import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { authComponent } from "./auth";

export const getAll = query({
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("You must be logged in to view todos");
		}
		
		// Return todos for this specific user using the index
		// Use identity.subject as the user ID
		return await ctx.db.query("todos")
			.withIndex("by_user", (q) => q.eq("userId", identity.subject))
			.collect();
	},
});

export const create = mutation({
	args: {
		text: v.string(),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("You must be logged in to create todos");
		}
		
		const newTodoId = await ctx.db.insert("todos", {
			text: args.text,
			completed: false,
			userId: identity.subject,
		});
		return await ctx.db.get(newTodoId);
	},
});

export const toggle = mutation({
	args: {
		id: v.id("todos"),
		completed: v.boolean(),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("You must be logged in to update todos");
		}
		
		// Check if the todo belongs to the current user
		const todo = await ctx.db.get(args.id);
		if (!todo || todo.userId !== identity.subject) {
			throw new Error("Todo not found or you don't have permission to update it");
		}
		
		await ctx.db.patch(args.id, { completed: args.completed });
		return { success: true };
	},
});

export const deleteTodo = mutation({
	args: {
		id: v.id("todos"),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("You must be logged in to delete todos");
		}
		
		// Check if the todo belongs to the current user
		const todo = await ctx.db.get(args.id);
		if (!todo || todo.userId !== identity.subject) {
			throw new Error("Todo not found or you don't have permission to delete it");
		}
		
		await ctx.db.delete(args.id);
		return { success: true };
	},
});
