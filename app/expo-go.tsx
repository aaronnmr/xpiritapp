import { Image, Text, View } from "react-native";

export default function ExpoGoScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-[#f6f8fc] px-6">
      <View className="w-full max-w-[520px] items-center rounded-[28px] border border-[#e5e7eb] bg-white p-7 shadow-sm">
        <Text className="text-center text-5xl font-normal tracking-[-2px] text-black">Xpirit</Text>
        <Text className="mt-2 text-center text-base leading-6 text-[#5a6072]">Open Expo Go on your phone and scan this QR.</Text>
        <Image
          accessibilityLabel="Expo Go QR code for Xpirit"
          className="mt-6 h-[320px] w-[320px] rounded-[22px]"
          resizeMode="contain"
          source={require("../assets/expo-go-qr.png")}
        />
        <Text className="mt-5 rounded-full bg-black px-4 py-3 text-center text-sm font-semibold text-white">
          exp://192.168.1.24:8081
        </Text>
        <Text className="mt-4 text-center text-sm leading-5 text-[#808080]">
          Keep your phone and this computer on the same Wi-Fi network.
        </Text>
      </View>
    </View>
  );
}
