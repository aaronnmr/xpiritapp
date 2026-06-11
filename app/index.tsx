import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";

import { OnboardingLanguagePicker } from "@/components/onboarding-language-picker";
import { useFrictionlessAuth } from "@/features/auth/use-frictionless-auth";
import { useI18n } from "@/lib/i18n";

export default function AuthScreen() {
  const { appleAvailable, errorMessage, isBusy, signInWithApple, signInWithGoogle, status } = useFrictionlessAuth();
  const { t } = useI18n();

  const statusCopy = {
    authenticating: t("auth.status.authenticating"),
    idle: t("auth.helper"),
    "requesting-health": t("auth.status.requestingHealth"),
    routing: t("auth.status.routing")
  };

  return (
    <View className="flex-1 bg-[#050507] px-6 pb-10 pt-16">
      <OnboardingLanguagePicker />
      <View className="flex-1 justify-center">
        <Text className="text-[56px] font-normal leading-[54px] tracking-[-2px] text-white">Xpirit</Text>
        <Text className="mt-5 max-w-[330px] text-lg leading-7 text-[#a7a7ad]">{t("auth.subtitle")}</Text>

        <View className="mt-10 rounded-[24px] border border-[#24242a] bg-[#0d0d11] p-5">
          <View className="h-2 w-16 rounded-full bg-[#4a53ff]" />
          <Text className="mt-6 text-2xl font-semibold tracking-[-0.8px] text-white">{t("auth.card.title")}</Text>
          <Text className="mt-3 text-base leading-6 text-[#8f8f98]">{t("auth.card.body")}</Text>
        </View>

        <View className="mt-8 gap-3">
          {Platform.OS === "ios" ? (
            <Pressable
              className={`h-[60px] flex-row items-center justify-center gap-3 rounded-[300px] bg-white px-6 ${
                isBusy || !appleAvailable ? "opacity-45" : "opacity-100"
              }`}
              disabled={isBusy || !appleAvailable}
              onPress={signInWithApple}
            >
              <Ionicons name="logo-apple" size={22} color="#050507" />
              <Text className="text-sm font-semibold uppercase tracking-widest text-[#050507]">{t("auth.apple")}</Text>
            </Pressable>
          ) : null}

          <Pressable
            className={`h-[60px] flex-row items-center justify-center gap-3 rounded-[300px] border border-[#2c2c33] bg-[#15151b] px-6 ${
              isBusy ? "opacity-45" : "opacity-100"
            }`}
            disabled={isBusy}
            onPress={signInWithGoogle}
          >
            <Ionicons name="logo-google" size={21} color="#ffffff" />
            <Text className="text-sm font-semibold uppercase tracking-widest text-white">{t("auth.google")}</Text>
          </Pressable>
        </View>

        <View className="mt-6 min-h-[52px] justify-center">
          {isBusy ? (
            <View className="flex-row items-center gap-3">
              <ActivityIndicator color="#4a53ff" />
              <Text className="text-sm font-semibold uppercase tracking-widest text-[#a7a7ad]">{statusCopy[status]}</Text>
            </View>
          ) : (
            <Text className="text-sm leading-5 text-[#6f6f78]">{statusCopy.idle}</Text>
          )}
          {errorMessage ? <Text className="mt-3 text-sm leading-5 text-[#ff6b6b]">{errorMessage}</Text> : null}
        </View>
      </View>
    </View>
  );
}
