import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import SignInForm from "./sign-in-form";
import SignUpForm from "./sign-up-form";
import OnboardingScreen from "./onboarding-screen";

export default function AuthScreen() {
	const [isSignUp, setIsSignUp] = useState(false);
	const [showOnboarding, setShowOnboarding] = useState(false);

	const handleSignUpSuccess = () => {
		setShowOnboarding(true);
	};

	const handleOnboardingComplete = () => {
		setShowOnboarding(false);
	};

	if (showOnboarding) {
		return (
			<View style={styles.container}>
				<OnboardingScreen onComplete={handleOnboardingComplete} />
			</View>
		);
	}

	return (
		<View style={styles.container}>
			{isSignUp ? (
				<SignUpForm 
					onSwitchToSignIn={() => setIsSignUp(false)}
					onSignUpSuccess={handleSignUpSuccess}
				/>
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
