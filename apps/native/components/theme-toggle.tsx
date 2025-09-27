import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColorScheme } from "nativewind";
import { colorScheme } from "nativewind";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_STORAGE_KEY = "app_theme";

export default function ThemeToggle() {
	const { colorScheme: currentScheme } = useColorScheme();
	const [modalVisible, setModalVisible] = useState(false);
	const [selectedTheme, setSelectedTheme] = useState<"light" | "dark" | "system">("system");

	const themes = [
		{ key: "light", label: "Light", icon: "sunny-outline" },
		{ key: "dark", label: "Dark", icon: "moon-outline" },
		{ key: "system", label: "System", icon: "phone-portrait-outline" },
	] as const;

	useEffect(() => {
		// Load saved theme on component mount
		const loadSavedTheme = async () => {
			try {
				const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
				if (savedTheme && (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system")) {
					setSelectedTheme(savedTheme);
					colorScheme.set(savedTheme);
				}
			} catch (error) {
				console.error("Error loading saved theme:", error);
			}
		};

		loadSavedTheme();
	}, []);

	const currentTheme = themes.find(theme => theme.key === selectedTheme) || themes[2];

	const handleThemeSelect = async (themeKey: "light" | "dark" | "system") => {
		try {
			setSelectedTheme(themeKey);
			colorScheme.set(themeKey);
			await AsyncStorage.setItem(THEME_STORAGE_KEY, themeKey);
			setModalVisible(false);
		} catch (error) {
			console.error("Error saving theme:", error);
		}
	};

	return (
		<View>
			<TouchableOpacity
				className="flex-row items-center py-2 px-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700"
				onPress={() => setModalVisible(true)}
			>
				<Ionicons
					name={currentTheme.icon}
					size={20}
					color="#007AFF"
				/>
				<Text className="text-sm text-black dark:text-white font-medium ml-2">{currentTheme.label}</Text>
			</TouchableOpacity>

			<Modal
				animationType="fade"
				transparent={true}
				visible={modalVisible}
				onRequestClose={() => setModalVisible(false)}
			>
				<TouchableOpacity
					className="flex-1 bg-black/50 justify-center items-center"
					activeOpacity={1}
					onPress={() => setModalVisible(false)}
				>
					<View className="bg-white dark:bg-gray-800 rounded-xl p-5 mx-10 min-w-[200px] shadow-lg">
						<Text className="text-lg font-bold mb-4 text-center text-black dark:text-white">Choose Theme</Text>
						{themes.map((theme) => (
							<TouchableOpacity
								key={theme.key}
								className={`flex-row items-center py-3 px-4 rounded-lg mb-2 ${
									selectedTheme === theme.key ? 'bg-blue-50 dark:bg-blue-900/30' : ''
								}`}
								onPress={() => handleThemeSelect(theme.key)}
							>
								<Ionicons
									name={theme.icon}
									size={24}
									color={selectedTheme === theme.key ? "#007AFF" : "#666"}
								/>
								<Text
									className={`text-base flex-1 ml-3 ${
										selectedTheme === theme.key 
											? 'text-blue-600 dark:text-blue-400 font-medium' 
											: 'text-gray-600 dark:text-gray-300'
									}`}
								>
									{theme.label}
								</Text>
								{selectedTheme === theme.key && (
									<Ionicons
										name="checkmark"
										size={20}
										color="#007AFF"
									/>
								)}
							</TouchableOpacity>
						))}
					</View>
				</TouchableOpacity>
			</Modal>
		</View>
	);
}

