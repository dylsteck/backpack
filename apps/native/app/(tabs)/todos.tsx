import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert } from "react-native";
import { Container } from "@/components/container";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@command/backend/convex/_generated/api";
import type { Id } from "@command/backend/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
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

	const handleAddTodo = async () => {
		const text = newTodoText.trim();
		if (!text) return;
		try {
			await createTodoMutation({ text });
			setNewTodoText("");
		} catch (error) {
			console.error("Add todo error:", error);
			const errorMessage = error?.message || "Failed to add todo";
			Alert.alert("Error", errorMessage);
		}
	};

	const handleToggleTodo = async (id: Id<"todos">, currentCompleted: boolean) => {
		try {
			await toggleTodoMutation({ id, completed: !currentCompleted });
		} catch (error) {
			console.error("Toggle todo error:", error);
			const errorMessage = error?.message || "Failed to update todo";
			Alert.alert("Error", errorMessage);
		}
	};

	const handleDeleteTodo = (id: Id<"todos">) => {
		Alert.alert(
			"Delete Todo",
			"Are you sure you want to delete this todo?",
			[
				{ text: "Cancel", style: "cancel" },
				{ text: "Delete", style: "destructive", onPress: () => deleteTodoMutation({ id }) }
			]
		);
	};

	const renderTodo = ({ item }: { item: any }) => (
		<View style={styles.todoItem}>
			<TouchableOpacity
				style={styles.todoContent}
				onPress={() => handleToggleTodo(item._id, item.completed)}
			>
				<Ionicons
					name={item.completed ? "checkbox" : "checkbox-outline"}
					size={24}
					color={item.completed ? "#10b981" : "#6b7280"}
					style={styles.checkbox}
				/>
				<Text style={[
					styles.todoText,
					item.completed && styles.completedTodo
				]}>
					{item.text}
				</Text>
			</TouchableOpacity>
			<TouchableOpacity
				style={styles.deleteButton}
				onPress={() => handleDeleteTodo(item._id)}
			>
				<Ionicons name="trash-outline" size={20} color="#ef4444" />
			</TouchableOpacity>
		</View>
	);

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Todo List</Text>
			<Text style={styles.subtitle}>Manage your tasks efficiently</Text>

			<View style={styles.inputContainer}>
				<TextInput
					style={styles.textInput}
					value={newTodoText}
					onChangeText={setNewTodoText}
					placeholder="Add a new task..."
					placeholderTextColor="#9ca3af"
					returnKeyType="done"
					onSubmitEditing={handleAddTodo}
				/>
				<TouchableOpacity
					style={[
						styles.addButton,
						!newTodoText.trim() && styles.addButtonDisabled
					]}
					onPress={handleAddTodo}
					disabled={!newTodoText.trim()}
				>
					<Text style={[
						styles.addButtonText,
						!newTodoText.trim() && styles.addButtonTextDisabled
					]}>
						Add
					</Text>
				</TouchableOpacity>
			</View>

			{todos === undefined ? (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color="#007AFF" />
				</View>
			) : todos.length === 0 ? (
				<Text style={styles.emptyText}>No todos yet. Add one above!</Text>
			) : (
				<FlatList
					data={todos}
					renderItem={renderTodo}
					keyExtractor={(item) => item._id}
					style={styles.todoList}
					showsVerticalScrollIndicator={false}
				/>
			)}
		</View>
	);
}

function UnauthenticatedMessage() {
	return (
		<View style={styles.authMessageContainer}>
			<Ionicons name="lock-closed-outline" size={64} color="#9ca3af" />
			<Text style={styles.authTitle}>Sign In Required</Text>
			<Text style={styles.authMessage}>
				Please sign in to view and manage your todos.
			</Text>
			<Text style={styles.authSubMessage}>
				Go to the Dashboard tab to sign in.
			</Text>
		</View>
	);
}

export default function Todos() {
	return (
		<Container>
			<Authenticated>
				<TodosList />
			</Authenticated>
			
			<Unauthenticated>
				<UnauthenticatedMessage />
			</Unauthenticated>
			
			<AuthLoading>
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color="#007AFF" />
					<Text style={styles.loadingText}>Loading...</Text>
				</View>
			</AuthLoading>
		</Container>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		paddingHorizontal: 16,
		paddingVertical: 20,
		backgroundColor: '#ffffff',
	},
	title: {
		fontSize: 28,
		fontWeight: 'bold',
		color: '#000',
		marginBottom: 4,
	},
	subtitle: {
		fontSize: 16,
		color: '#6b7280',
		marginBottom: 24,
	},
	inputContainer: {
		flexDirection: 'row',
		marginBottom: 24,
		gap: 8,
	},
	textInput: {
		flex: 1,
		borderWidth: 1,
		borderColor: '#d1d5db',
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 10,
		fontSize: 16,
		backgroundColor: '#ffffff',
	},
	addButton: {
		backgroundColor: '#007AFF',
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderRadius: 8,
		justifyContent: 'center',
	},
	addButtonDisabled: {
		backgroundColor: '#d1d5db',
	},
	addButtonText: {
		color: '#ffffff',
		fontSize: 16,
		fontWeight: '600',
	},
	addButtonTextDisabled: {
		color: '#9ca3af',
	},
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	emptyText: {
		textAlign: 'center',
		color: '#6b7280',
		fontSize: 16,
		paddingVertical: 32,
	},
	todoList: {
		flex: 1,
	},
	todoItem: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: '#ffffff',
		borderWidth: 1,
		borderColor: '#e5e7eb',
		borderRadius: 8,
		padding: 12,
		marginBottom: 8,
	},
	todoContent: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
	},
	checkbox: {
		marginRight: 12,
	},
	todoText: {
		flex: 1,
		fontSize: 16,
		color: '#000',
	},
	completedTodo: {
		textDecorationLine: 'line-through',
		color: '#6b7280',
	},
	deleteButton: {
		padding: 8,
	},
	authMessageContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 32,
		backgroundColor: '#ffffff',
	},
	authTitle: {
		fontSize: 24,
		fontWeight: 'bold',
		color: '#000',
		marginTop: 16,
		marginBottom: 8,
		textAlign: 'center',
	},
	authMessage: {
		fontSize: 16,
		color: '#6b7280',
		textAlign: 'center',
		marginBottom: 8,
	},
	authSubMessage: {
		fontSize: 14,
		color: '#9ca3af',
		textAlign: 'center',
	},
	loadingText: {
		marginTop: 10,
		fontSize: 16,
		color: '#6b7280',
	},
});
