import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert } from "react-native";
import { Container } from "@/components/container";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@cortex/backend/convex/_generated/api";
import {
	Authenticated,
	AuthLoading,
	Unauthenticated,
} from "convex/react";
import { authClient } from "@/lib/auth-client";
import ThemeToggle from "@/components/theme-toggle";

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
		
		try {
			if (isSignUp) {
				const result = await authClient.signUp.email({
					email,
					password,
					name: name || email.split('@')[0], // Use provided name or email prefix
				});
				
				if (result.error) {
					Alert.alert("Sign Up Failed", result.error.message || "Failed to create account");
				}
			} else {
				const result = await authClient.signIn.email({
					email,
					password,
				});
				
				if (result.error) {
					Alert.alert("Sign In Failed", result.error.message || "Invalid credentials");
				} else if (!result.data) {
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
		<View className="flex-1 justify-center px-4 bg-white dark:bg-gray-900">
			<Text className="text-3xl font-bold text-center mb-8 text-black dark:text-white">
				{isSignUp ? 'Sign Up' : 'Sign In'}
			</Text>
			
			<View className="mb-6">
				{isSignUp && (
					<TextInput
						className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-base mb-4 bg-white dark:bg-gray-800 text-black dark:text-white"
						placeholder="Full Name"
						placeholderTextColor="#9ca3af"
						value={name}
						onChangeText={setName}
						autoCapitalize="words"
					/>
				)}
				<TextInput
					className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-base mb-4 bg-white dark:bg-gray-800 text-black dark:text-white"
					placeholder="Email"
					placeholderTextColor="#9ca3af"
					value={email}
					onChangeText={setEmail}
					keyboardType="email-address"
					autoCapitalize="none"
				/>
				<TextInput
					className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 text-base mb-4 bg-white dark:bg-gray-800 text-black dark:text-white"
					placeholder="Password"
					placeholderTextColor="#9ca3af"
					value={password}
					onChangeText={setPassword}
					secureTextEntry
				/>
			</View>

			<TouchableOpacity 
				className={`py-3 rounded-lg items-center mb-4 ${
					isLoading ? 'bg-gray-400' : 'bg-blue-500'
				}`}
				onPress={handleAuth}
				disabled={isLoading}
			>
				{isLoading ? (
					<ActivityIndicator size="small" color="#ffffff" />
				) : (
					<Text className="text-white text-lg font-semibold">
						{isSignUp ? 'Sign Up' : 'Sign In'}
					</Text>
				)}
			</TouchableOpacity>

			<TouchableOpacity 
				className="items-center py-2"
				onPress={() => setIsSignUp(!isSignUp)}
			>
				<Text className="text-blue-500 text-base">
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
							await authClient.signOut();
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
		<View className="flex-1 px-4 py-5 bg-white dark:bg-gray-900">
			<Text className="text-3xl font-bold text-black dark:text-white mb-5 text-center">Welcome!</Text>
			
			<View className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800 mb-4">
				<Text className="text-lg font-medium text-black dark:text-white mb-2">Account Info</Text>
				<Text className="text-sm text-gray-600 dark:text-gray-300">
					Name: {currentUser?.name || "Loading..."}
				</Text>
				<Text className="text-sm text-gray-600 dark:text-gray-300">
					Email: {currentUser?.email || "Loading..."}
				</Text>
			</View>

			<View className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800 mb-4">
				<Text className="text-lg font-medium text-black dark:text-white mb-2">Appearance</Text>
				<ThemeToggle />
			</View>

			<TouchableOpacity 
				className="bg-red-500 py-3 rounded-lg items-center mt-4"
				onPress={handleLogout}
			>
				<Text className="text-white text-lg font-semibold">Sign Out</Text>
			</TouchableOpacity>
		</View>
	);
}

export default function Home() {
	return (
		<Container>
			<Authenticated>
				<AuthenticatedDashboard />
			</Authenticated>
			
			<Unauthenticated>
				<SignInForm />
			</Unauthenticated>
			
			<AuthLoading>
				<View className="flex-1 justify-center items-center bg-white dark:bg-gray-900">
					<ActivityIndicator size="large" color="#007AFF" />
					<Text className="mt-2 text-lg text-gray-600 dark:text-gray-300">Loading...</Text>
				</View>
			</AuthLoading>
		</Container>
	);
}

