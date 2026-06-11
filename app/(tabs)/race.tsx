import { ScrollView, Text, View } from "react-native";

const sessions = [
  { distance: "5.8 km", pace: "4:52", title: "Latest Run", date: "Today" },
  { distance: "7.2 km", pace: "5:08", title: "Tempo Run", date: "Tuesday" },
  { distance: "4.1 km", pace: "5:34", title: "Easy Run", date: "Sunday" },
  { distance: "9.6 km", pace: "5:21", title: "Long Run", date: "Friday" }
];

export default function RaceScreen() {
  return (
    <ScrollView className="flex-1 bg-white px-5 pt-14" contentContainerStyle={{ paddingBottom: 120 }}>
      <Text className="text-sm font-semibold uppercase tracking-widest text-[#808080]">Race</Text>
      <Text className="mt-3 text-5xl font-normal leading-[44px] tracking-[-2px] text-black">Every run, ranked by signal.</Text>

      <View className="mt-6 overflow-hidden rounded-[24px] bg-black p-6">
        <View className="absolute right-[-52px] top-[-60px] h-40 w-40 rounded-full bg-[#4a53ff] opacity-40" />
        <Text className="text-sm font-semibold uppercase tracking-widest text-[#999999]">Latest Run</Text>
        <View className="mt-5 flex-row items-end justify-between">
          <View>
            <Text className="text-6xl font-normal tracking-[-2px] text-white">5.8</Text>
            <Text className="mt-1 text-base text-[#999999]">km latest session</Text>
          </View>
          <View className="items-end">
            <Text className="text-4xl font-normal tracking-[-1px] text-white">4:52</Text>
            <Text className="mt-1 text-base text-[#999999]">pace /km</Text>
          </View>
        </View>
      </View>

      <View className="mt-6 flex-row items-center justify-between">
        <Text className="text-xl font-semibold tracking-[-0.6px] text-black">Session History</Text>
        <Text className="text-sm font-semibold uppercase tracking-widest text-[#4a53ff]">All visible</Text>
      </View>

      <View className="mt-3 gap-3">
        {sessions.map((session) => (
          <View key={`${session.title}-${session.date}`} className="rounded-[24px] bg-[#f3f5f9] p-5">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xl font-semibold tracking-[-0.6px] text-black">{session.title}</Text>
                <Text className="mt-1 text-base text-[#999999]">{session.date}</Text>
              </View>
              <View className="items-end">
                <Text className="text-2xl font-semibold tracking-[-0.72px] text-black">{session.distance}</Text>
                <Text className="mt-1 text-base text-[#808080]">{session.pace} /km</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
