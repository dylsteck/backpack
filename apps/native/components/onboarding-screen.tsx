import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export default function OnboardingScreen({
	onComplete,
}: {
	onComplete: () => void;
}) {
	return (
		<View style={styles.container}>
			<Text style={styles.welcomeText}>Welcome</Text>
			<TouchableOpacity style={styles.nextButton} onPress={onComplete}>
				<Text style={styles.nextButtonText}>Next</Text>
			</TouchableOpacity>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 24,
		backgroundColor: "#ffffff",
	},
	welcomeText: {
		fontSize: 48,
		fontWeight: "bold",
		color: "#000000",
		marginBottom: 48,
	},
	nextButton: {
		backgroundColor: "#000000",
		borderRadius: 8,
		paddingHorizontal: 32,
		paddingVertical: 16,
		alignItems: "center",
	},
	nextButtonText: {
		color: "#ffffff",
		fontSize: 18,
		fontWeight: "600",
	},
});
