import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

export default function ManualEntryNoticeScreen() {
  return (
    <View className="flex-1 bg-[#050507] px-6 pb-10 pt-16">
      <View className="flex-1 justify-center">
        <Text className="text-sm font-semibold uppercase tracking-widest text-[#7b7b84]">Biometric Sync Disabled</Text>
        <Text className="mt-5 text-[52px] font-normal leading-[50px] tracking-[-2px] text-white">
          Manual logging is active.
        </Text>
        <Text className="mt-6 text-lg leading-7 text-[#a7a7ad]">
          Xpirit cannot access your native health repository. Recovery, biometric sync, and automatic health imports are
          disabled until permissions are granted from device settings.
        </Text>

        <View className="mt-10 rounded-[24px] border border-[#24242a] bg-[#0d0d11] p-5">
          <Text className="text-base font-semibold text-white">Current operating mode</Text>
          <View className="mt-5 gap-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-base text-[#8f8f98]">Biometric sync</Text>
              <Text className="text-base font-semibold text-[#ff6b6b]">Disabled</Text>
            </View>
            <View className="h-[1px] bg-[#24242a]" />
            <View className="flex-row items-center justify-between">
              <Text className="text-base text-[#8f8f98]">Workout logging</Text>
              <Text className="text-base font-semibold text-[#4a53ff]">Manual</Text>
            </View>
          </View>
        </View>
      </View>

      <Pressable className="h-[60px] items-center justify-center rounded-[300px] bg-[#4a53ff] px-6" onPress={() => router.replace("/home")}>
        <Text className="text-sm font-semibold uppercase tracking-widest text-white">Proceed to Dashboard</Text>
      </Pressable>
    </View>
  );
}
