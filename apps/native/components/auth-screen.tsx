import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import SignInForm from "./sign-in-form";
import SignUpForm from "./sign-up-form";

export default function AuthScreen() {
	const [isSignUp, setIsSignUp] = useState(false);

	return (
		<View style={styles.container}>
			{isSignUp ? (
				<SignUpForm onSwitchToSignIn={() => setIsSignUp(false)} />
			) : (
				<SignInForm onSwitchToSignUp={() => setIsSignUp(true)} />
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#ffffff",
	},
});
