import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert } from "react-native";
import { Container } from "@/components/container";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@command/backend/convex/_generated/api";
import {
	Authenticated,
	AuthLoading,
	Unauthenticated,
} from "convex/react";
import { authClient } from "@/lib/auth-client";

function SignInForm() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [name, setName] = useState("");
	const [isSignUp, setIsSignUp] = useState(false);
	const [isLoading, setIsLoading] = useState(false);

	const handleAuth = async () => {
		if (!email || !password) {
			Alert.alert("Error", "Please fill in all fields");
			return;
		}

		setIsLoading(true);
		console.log("Starting auth request...", { isSignUp, email });
		
		try {
			if (isSignUp) {
				console.log("Attempting sign up...");
				const result = await authClient.signUp.email({
					email,
					password,
					name: name || email.split('@')[0], // Use provided name or email prefix
				});
				
				console.log("Sign up result:", result);
				
				if (result.error) {
					Alert.alert("Sign Up Failed", result.error.message || "Failed to create account");
				} else {
					// Don't show alert, let the Authenticated component handle the UI change
					console.log("Sign up successful, should switch to authenticated view");
				}
			} else {
				console.log("Attempting sign in...");
				const result = await authClient.signIn.email({
					email,
					password,
				});
				
				console.log("Sign in result:", result);
				
				if (result.error) {
					Alert.alert("Sign In Failed", result.error.message || "Invalid credentials");
				} else if (result.data) {
					// Don't show alert, let the Authenticated component handle the UI change
					console.log("Sign in successful, should switch to authenticated view");
				} else {
					Alert.alert("Error", "No response from server");
				}
			}
		} catch (error) {
			console.error("Auth error:", error);
			Alert.alert("Error", `Authentication failed: ${error.message || error}`);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<View style={styles.authContainer}>
			<Text style={styles.title}>{isSignUp ? 'Sign Up' : 'Sign In'}</Text>
			
			<View style={styles.inputContainer}>
				{isSignUp && (
					<TextInput
						style={styles.input}
						placeholder="Full Name"
						placeholderTextColor="#9ca3af"
						value={name}
						onChangeText={setName}
						autoCapitalize="words"
					/>
				)}
				<TextInput
					style={styles.input}
					placeholder="Email"
					placeholderTextColor="#9ca3af"
					value={email}
					onChangeText={setEmail}
					keyboardType="email-address"
					autoCapitalize="none"
				/>
				<TextInput
					style={styles.input}
					placeholder="Password"
					placeholderTextColor="#9ca3af"
					value={password}
					onChangeText={setPassword}
					secureTextEntry
				/>
			</View>

			<TouchableOpacity 
				style={[styles.authButton, isLoading && styles.authButtonDisabled]} 
				onPress={handleAuth}
				disabled={isLoading}
			>
				{isLoading ? (
					<ActivityIndicator size="small" color="#ffffff" />
				) : (
					<Text style={styles.authButtonText}>
						{isSignUp ? 'Sign Up' : 'Sign In'}
					</Text>
				)}
			</TouchableOpacity>

			<TouchableOpacity 
				style={styles.switchButton}
				onPress={() => setIsSignUp(!isSignUp)}
			>
				<Text style={styles.switchButtonText}>
					{isSignUp 
						? 'Already have an account? Sign In' 
						: "Don't have an account? Sign Up"
					}
				</Text>
			</TouchableOpacity>
		</View>
	);
}

function AuthenticatedDashboard() {
	const currentUser = useQuery(api.auth.getCurrentUser);
	const privateData = useQuery(api.privateData.get);

	console.log("AuthenticatedDashboard - currentUser:", currentUser);
	console.log("AuthenticatedDashboard - privateData:", privateData);

	const handleLogout = () => {
		Alert.alert(
			"Logout",
			"Are you sure you want to log out?",
			[
				{ text: "Cancel", style: "cancel" },
				{ 
					text: "Logout", 
					style: "destructive",
					onPress: async () => {
						try {
							console.log("Logging out...");
							await authClient.signOut();
							console.log("Logged out successfully");
						} catch (error) {
							console.error("Logout error:", error);
							Alert.alert("Error", "Failed to log out");
						}
					}
				}
			]
		);
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Welcome!</Text>
			
			<View style={styles.section}>
				<Text style={styles.sectionTitle}>Account Info</Text>
				<Text style={styles.dataText}>
					Name: {currentUser?.name || "Loading..."}
				</Text>
				<Text style={styles.dataText}>
					Email: {currentUser?.email || "Loading..."}
				</Text>
			</View>

			<View style={styles.section}>
				<Text style={styles.sectionTitle}>Private Data</Text>
				<Text style={styles.dataText}>
					{privateData?.message || "Loading private data..."}
				</Text>
			</View>

			<TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
				<Text style={styles.logoutButtonText}>Sign Out</Text>
			</TouchableOpacity>
		</View>
	);
}

export default function Dashboard() {
	return (
		<Container>
			<Authenticated>
				<AuthenticatedDashboard />
			</Authenticated>
			
			<Unauthenticated>
				<SignInForm />
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
		marginBottom: 20,
		textAlign: 'center',
	},
	section: {
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#e5e7eb',
		padding: 16,
		backgroundColor: '#ffffff',
		marginBottom: 16,
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: '500',
		color: '#000',
		marginBottom: 8,
	},
	dataText: {
		fontSize: 14,
		color: '#6b7280',
	},
	authContainer: {
		flex: 1,
		justifyContent: 'center',
		paddingHorizontal: 16,
		backgroundColor: '#ffffff',
	},
	inputContainer: {
		marginBottom: 24,
	},
	input: {
		borderWidth: 1,
		borderColor: '#d1d5db',
		borderRadius: 8,
		paddingHorizontal: 16,
		paddingVertical: 12,
		fontSize: 16,
		marginBottom: 16,
		backgroundColor: '#ffffff',
	},
	authButton: {
		backgroundColor: '#007AFF',
		paddingVertical: 12,
		borderRadius: 8,
		alignItems: 'center',
		marginBottom: 16,
	},
	authButtonDisabled: {
		backgroundColor: '#9ca3af',
	},
	authButtonText: {
		color: '#ffffff',
		fontSize: 16,
		fontWeight: '600',
	},
	switchButton: {
		alignItems: 'center',
		paddingVertical: 8,
	},
	switchButtonText: {
		color: '#007AFF',
		fontSize: 14,
	},
	logoutButton: {
		backgroundColor: '#ef4444',
		paddingVertical: 12,
		borderRadius: 8,
		alignItems: 'center',
		marginTop: 16,
	},
	logoutButtonText: {
		color: '#ffffff',
		fontSize: 16,
		fontWeight: '600',
	},
	loadingContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: '#ffffff',
	},
	loadingText: {
		marginTop: 10,
		fontSize: 16,
		color: '#6b7280',
	},
});
