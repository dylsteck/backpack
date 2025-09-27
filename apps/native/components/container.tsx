import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native";

export const Container = ({ children }: { children: React.ReactNode }) => {
	return (
		<SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
			{children}
		</SafeAreaView>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#ffffff',
	},
});
