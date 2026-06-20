import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Pressable, Text, useWindowDimensions, View } from "react-native";

import { useI18n } from "@/lib/i18n";

const tabIcons = {
  gym: "fitness",
  home: "analytics",
  profile: "person",
  race: "speedometer"
} satisfies Record<string, keyof typeof Ionicons.glyphMap>;

function BubbleTabBar({ navigation, state }: { navigation: any; state: any }) {
  const { width } = useWindowDimensions();
  const { t } = useI18n();
  const barWidth = Math.min(286, width - 112);
  const tabLabels: Record<keyof typeof tabIcons, string> = {
    gym: "Gym",
    home: "Home",
    profile: t("nav.profile"),
    race: t("nav.race")
  };

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
      {state.routes.map((route: { key: string; name: keyof typeof tabIcons }, index: number) => {
        const icon = tabIcons[route.name];

        if (!icon) {
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
            <Ionicons name={icon} color={color} size={23} />
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
              {tabLabels[route.name]}
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
