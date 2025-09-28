import { ConvexReactClient, Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { Stack } from "expo-router";
import {
	DarkTheme,
	DefaultTheme,
	type Theme,
	ThemeProvider,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "../global.css";
import { NAV_THEME } from "@/lib/constants";
import React, { useRef, useState, createContext, useContext } from "react";
import { useColorScheme } from "@/lib/use-color-scheme";
import { Platform, View, Text, StyleSheet } from "react-native";
import { setAndroidNavigationBar } from "@/lib/android-navigation-bar";
import { authClient } from "@/lib/auth-client";
import AuthScreen from "@/components/auth-screen";
import OnboardingScreen from "@/components/onboarding-screen";

const LIGHT_THEME: Theme = {
	...DefaultTheme,
	colors: NAV_THEME.light,
};
const DARK_THEME: Theme = {
	...DarkTheme,
	colors: NAV_THEME.dark,
};

export const unstable_settings = {
	initialRouteName: "(drawer)",
};

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
	unsavedChangesWarning: false,
});

const OnboardingContext = createContext<{
	showOnboarding: boolean;
	setShowOnboarding: (show: boolean) => void;
}>({
	showOnboarding: false,
	setShowOnboarding: () => {},
});

export const useOnboarding = () => useContext(OnboardingContext);

function AuthenticatedApp() {
	const { showOnboarding, setShowOnboarding } = useOnboarding();

	const handleOnboardingComplete = () => {
		setShowOnboarding(false);
	};

	if (showOnboarding) {
		return <OnboardingScreen onComplete={handleOnboardingComplete} />;
	}

	return (
		<Stack>
			<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
			<Stack.Screen
				name="modal"
				options={{ title: "Modal", presentation: "modal" }}
			/>
		</Stack>
	);
}

export default function RootLayout() {
	const hasMounted = useRef(false);
	const { colorScheme, isDarkColorScheme } = useColorScheme();
	const [isColorSchemeLoaded, setIsColorSchemeLoaded] = React.useState(false);
	const [showOnboarding, setShowOnboarding] = useState(false);

	useIsomorphicLayoutEffect(() => {
		if (hasMounted.current) {
			return;
		}

		if (Platform.OS === "web") {
			document.documentElement.classList.add("bg-background");
		}
		setAndroidNavigationBar(colorScheme);
		setIsColorSchemeLoaded(true);
		hasMounted.current = true;
	}, []);

	if (!isColorSchemeLoaded) {
		return null;
	}
	return (
		<OnboardingContext.Provider value={{ showOnboarding, setShowOnboarding }}>
			<ConvexBetterAuthProvider client={convex} authClient={authClient}>
				<ThemeProvider value={isDarkColorScheme ? DARK_THEME : LIGHT_THEME}>
					<StatusBar style={isDarkColorScheme ? "light" : "dark"} />
					<GestureHandlerRootView style={{ flex: 1 }}>
						<Authenticated>
							<AuthenticatedApp />
						</Authenticated>
						<Unauthenticated>
							<AuthScreen />
						</Unauthenticated>
						<AuthLoading>
							<View style={styles.loadingContainer}>
								<Text style={styles.loadingText}>Loading...</Text>
							</View>
						</AuthLoading>
					</GestureHandlerRootView>
				</ThemeProvider>
			</ConvexBetterAuthProvider>
		</OnboardingContext.Provider>
	);
}

const useIsomorphicLayoutEffect =
	Platform.OS === "web" && typeof window === "undefined"
		? React.useEffect
		: React.useLayoutEffect;

const styles = StyleSheet.create({
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		backgroundColor: "#ffffff",
	},
	loadingText: {
		fontSize: 18,
		color: "#000000",
	},
});
