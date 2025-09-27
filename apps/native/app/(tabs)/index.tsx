import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Container } from "@/components/container";
import { useQuery } from "convex/react";
import { api } from "@command/backend/convex/_generated/api";

const TITLE_TEXT = `
 ██████╗ ███████╗████████╗████████╗███████╗██████╗ 
 ██╔══██╗██╔════╝╚══██╔══╝╚══██╔══╝██╔════╝██╔══██╗
 ██████╔╝█████╗     ██║      ██║   █████╗  ██████╔╝
 ██╔══██╗██╔══╝     ██║      ██║   ██╔══╝  ██╔══██╗
 ██████╔╝███████╗   ██║      ██║   ███████╗██║  ██║
 ╚═════╝ ╚══════╝   ╚═╝      ╚═╝   ╚══════╝╚═╝  ╚═╝

 ████████╗    ███████╗████████╗ █████╗  ██████╗██╗  ██╗
 ╚══██╔══╝    ██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝
    ██║       ███████╗   ██║   ███████║██║     █████╔╝ 
    ██║       ╚════██║   ██║   ██╔══██║██║     ██╔═██╗ 
    ██║       ███████║   ██║   ██║  ██║╚██████╗██║  ██╗
    ╚═╝       ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝
`;

export default function Home() {
	const healthCheck = useQuery(api.healthCheck.get);

	return (
		<Container>
			<ScrollView style={styles.container}>
				<Text style={styles.asciiArt}>{TITLE_TEXT}</Text>
				
				<View style={styles.section}>
					<Text style={styles.sectionTitle}>API Status</Text>
					<View style={styles.statusRow}>
						<View
							style={[
								styles.indicator,
								{ 
									backgroundColor: healthCheck === "OK" 
										? "#10b981" 
										: healthCheck === undefined 
											? "#f59e0b" 
											: "#ef4444" 
								}
							]}
						/>
						<Text style={styles.statusText}>
							{healthCheck === undefined
								? "Checking..."
								: healthCheck === "OK"
									? "Connected"
									: "Error"}
						</Text>
					</View>
				</View>
			</ScrollView>
		</Container>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		paddingHorizontal: 16,
		paddingVertical: 8,
		backgroundColor: '#ffffff',
	},
	asciiArt: {
		fontFamily: 'Courier New',
		fontSize: 10,
		color: '#000',
		marginBottom: 24,
		lineHeight: 12,
	},
	section: {
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#e5e7eb',
		padding: 16,
		backgroundColor: '#ffffff',
	},
	sectionTitle: {
		fontSize: 16,
		fontWeight: '500',
		color: '#000',
		marginBottom: 8,
	},
	statusRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	indicator: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	statusText: {
		fontSize: 14,
		color: '#6b7280',
	},
});
