import { authClient } from "@/lib/auth-client";
import { useForm } from "@tanstack/react-form";
import React from "react";
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	StyleSheet,
	Alert,
} from "react-native";
import z from "zod";

export default function SignUpForm({
	onSwitchToSignIn,
}: {
	onSwitchToSignIn: () => void;
}) {
	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
			name: "",
		},
		onSubmit: async ({ value }) => {
			await authClient.signUp.email(
				{
					email: value.email,
					password: value.password,
					name: value.name,
				},
				{
					onSuccess: () => {
						Alert.alert("Success", "Sign up successful");
					},
					onError: (error) => {
						Alert.alert("Error", error.error.message || error.error.statusText);
					},
				},
			);
		},
		validators: {
			onSubmit: z.object({
				name: z.string().min(2, "Name must be at least 2 characters"),
				email: z.string().email("Invalid email address"),
				password: z.string().min(8, "Password must be at least 8 characters"),
			}),
		},
	});

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Create Account</Text>

			<View style={styles.form}>
				<form.Field name="name">
					{(field) => (
						<View style={styles.fieldContainer}>
							<Text style={styles.label}>Name</Text>
							<TextInput
								style={styles.input}
								value={field.state.value}
								onChangeText={(text) => field.handleChange(text)}
								onBlur={field.handleBlur}
								placeholder="Enter your name"
							/>
							{field.state.meta.errors.map((error) => (
								<Text key={error?.message} style={styles.errorText}>
									{error?.message}
								</Text>
							))}
						</View>
					)}
				</form.Field>

				<form.Field name="email">
					{(field) => (
						<View style={styles.fieldContainer}>
							<Text style={styles.label}>Email</Text>
							<TextInput
								style={styles.input}
								value={field.state.value}
								onChangeText={(text) => field.handleChange(text)}
								onBlur={field.handleBlur}
								keyboardType="email-address"
								autoCapitalize="none"
								placeholder="Enter your email"
							/>
							{field.state.meta.errors.map((error) => (
								<Text key={error?.message} style={styles.errorText}>
									{error?.message}
								</Text>
							))}
						</View>
					)}
				</form.Field>

				<form.Field name="password">
					{(field) => (
						<View style={styles.fieldContainer}>
							<Text style={styles.label}>Password</Text>
							<TextInput
								style={styles.input}
								value={field.state.value}
								onChangeText={(text) => field.handleChange(text)}
								onBlur={field.handleBlur}
								secureTextEntry
								placeholder="Enter your password"
							/>
							{field.state.meta.errors.map((error) => (
								<Text key={error?.message} style={styles.errorText}>
									{error?.message}
								</Text>
							))}
						</View>
					)}
				</form.Field>

				<form.Subscribe>
					{(state) => (
						<TouchableOpacity
							style={[
								styles.submitButton,
								(!state.canSubmit || state.isSubmitting) && styles.disabledButton,
							]}
							onPress={form.handleSubmit}
							disabled={!state.canSubmit || state.isSubmitting}
						>
							<Text style={styles.submitButtonText}>
								{state.isSubmitting ? "Submitting..." : "Sign Up"}
							</Text>
						</TouchableOpacity>
					)}
				</form.Subscribe>
			</View>

			<TouchableOpacity onPress={onSwitchToSignIn} style={styles.switchButton}>
				<Text style={styles.switchButtonText}>
					Already have an account? Sign In
				</Text>
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		paddingHorizontal: 24,
		backgroundColor: "#ffffff",
	},
	title: {
		fontSize: 32,
		fontWeight: "bold",
		textAlign: "center",
		marginBottom: 32,
		color: "#000000",
	},
	form: {
		marginBottom: 24,
	},
	fieldContainer: {
		marginBottom: 16,
	},
	label: {
		fontSize: 16,
		fontWeight: "500",
		marginBottom: 8,
		color: "#000000",
	},
	input: {
		borderWidth: 1,
		borderColor: "#e5e7eb",
		borderRadius: 8,
		padding: 12,
		fontSize: 16,
		backgroundColor: "#ffffff",
		color: "#000000",
	},
	errorText: {
		color: "#ef4444",
		fontSize: 14,
		marginTop: 4,
	},
	submitButton: {
		backgroundColor: "#007AFF",
		borderRadius: 8,
		padding: 16,
		alignItems: "center",
		marginTop: 8,
	},
	disabledButton: {
		backgroundColor: "#9ca3af",
	},
	submitButtonText: {
		color: "#ffffff",
		fontSize: 16,
		fontWeight: "600",
	},
	switchButton: {
		alignItems: "center",
		padding: 16,
	},
	switchButtonText: {
		color: "#007AFF",
		fontSize: 16,
		fontWeight: "500",
	},
});
