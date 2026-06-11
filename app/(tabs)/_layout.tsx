import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Pressable, Text, useWindowDimensions, View } from "react-native";

const tabs = {
  home: { icon: "analytics", label: "Home" },
  gym: { icon: "fitness", label: "Gym" },
  race: { icon: "speedometer", label: "Race" },
  profile: { icon: "person", label: "Profile" }
} satisfies Record<string, { icon: keyof typeof Ionicons.glyphMap; label: string }>;

function BubbleTabBar({ navigation, state }: { navigation: any; state: any }) {
  const { width } = useWindowDimensions();
  const barWidth = Math.min(286, width - 112);

  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: "rgba(255, 255, 255, 0.78)",
        borderColor: "rgba(229, 231, 235, 0.72)",
        borderRadius: 300,
        borderWidth: 1,
        bottom: 12,
        flexDirection: "row",
        height: 56,
        justifyContent: "center",
        left: (width - barWidth) / 2,
        position: "absolute",
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.12,
        shadowRadius: 28,
        width: barWidth
      }}
    >
      {state.routes.map((route: { key: string; name: keyof typeof tabs }, index: number) => {
        const item = tabs[route.name];

        if (!item) {
          return null;
        }

        const isFocused = state.index === index;
        const color = isFocused ? "#4a53ff" : "#808080";

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            onPress={() => navigation.navigate(route.name)}
            style={{
              alignItems: "center",
              height: 44,
              justifyContent: "center",
              width: 64
            }}
          >
            <Ionicons name={item.icon} color={color} size={23} />
            <Text
              style={{
                color,
                fontSize: 9,
                fontWeight: "700",
                letterSpacing: 0.6,
                marginTop: 1,
                textTransform: "uppercase"
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <BubbleTabBar {...props} />}
      screenOptions={{
        headerShown: false
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen name="gym" options={{ title: "Gym" }} />
      <Tabs.Screen name="race" options={{ title: "Race" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
