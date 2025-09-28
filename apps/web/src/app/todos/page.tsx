"use client";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";

import { useMutation, useQuery } from "convex/react";
import { api } from "@cortex/backend/convex/_generated/api";
import type { Id } from "@cortex/backend/convex/_generated/dataModel";
import {
	Authenticated,
	AuthLoading,
	Unauthenticated,
} from "convex/react";

function TodosList() {
	const [newTodoText, setNewTodoText] = useState("");

	const todos = useQuery(api.todos.getAll);
	const createTodoMutation = useMutation(api.todos.create);
	const toggleTodoMutation = useMutation(api.todos.toggle);
	const deleteTodoMutation = useMutation(api.todos.deleteTodo);

	const handleAddTodo = async (e: React.FormEvent) => {
		e.preventDefault();
		const text = newTodoText.trim();
		if (!text) return;
		await createTodoMutation({ text });
		setNewTodoText("");
	};

	const handleToggleTodo = (id: Id<"todos">, currentCompleted: boolean) => {
		toggleTodoMutation({ id, completed: !currentCompleted });
	};

	const handleDeleteTodo = (id: Id<"todos">) => {
		deleteTodoMutation({ id });
	};

	return (
		<div className="mx-auto w-full max-w-md py-10">
			<Card>
				<CardHeader>
					<CardTitle>Todo List</CardTitle>
					<CardDescription>Manage your tasks efficiently</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						onSubmit={handleAddTodo}
						className="mb-6 flex items-center space-x-2"
					>
						<Input
							value={newTodoText}
							onChange={(e) => setNewTodoText(e.target.value)}
							placeholder="Add a new task..."
						/>
						<Button type="submit" disabled={!newTodoText.trim()}>
							Add
						</Button>
					</form>

					{todos === undefined ? (
						<div className="flex justify-center py-4">
							<Loader2 className="h-6 w-6 animate-spin" />
						</div>
					) : todos.length === 0 ? (
						<p className="py-4 text-center">No todos yet. Add one above!</p>
					) : (
						<ul className="space-y-2">
							{todos.map((todo) => (
								<li
									key={todo._id}
									className="flex items-center justify-between rounded-md border p-2"
								>
									<div className="flex items-center space-x-2">
										<Checkbox
											checked={todo.completed}
											onCheckedChange={() =>
												handleToggleTodo(todo._id, todo.completed)
											}
											id={`todo-${todo._id}`}
										/>
										<label
											htmlFor={`todo-${todo._id}`}
											className={`${todo.completed ? "line-through text-muted-foreground" : ""}`}
										>
											{todo.text}
										</label>
									</div>
									<Button
										variant="ghost"
										size="icon"
										onClick={() => handleDeleteTodo(todo._id)}
										aria-label="Delete todo"
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function UnauthenticatedMessage() {
	return (
		<div className="mx-auto w-full max-w-md py-10">
			<Card>
				<CardHeader className="text-center">
					<CardTitle className="flex items-center justify-center gap-2">
						<svg className="h-6 w-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
						</svg>
						Sign In Required
					</CardTitle>
					<CardDescription>
						Please sign in to view and manage your todos.
					</CardDescription>
				</CardHeader>
				<CardContent className="text-center">
					<p className="text-sm text-muted-foreground">
						Go to the Dashboard to sign in with your account.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}

export default function TodosPage() {
	return (
		<>
			<Authenticated>
				<TodosList />
			</Authenticated>
			
			<Unauthenticated>
				<UnauthenticatedMessage />
			</Unauthenticated>
			
			<AuthLoading>
				<div className="mx-auto w-full max-w-md py-10">
					<Card>
						<CardContent className="flex justify-center py-8">
							<Loader2 className="h-8 w-8 animate-spin" />
						</CardContent>
					</Card>
				</div>
			</AuthLoading>
		</>
	);
}
