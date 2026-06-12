import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

const sessions = [
  { distance: "5.8 km", pace: "4:52", title: "Latest Run", date: "Jun 11, 2026", isoDate: "2026-06-11" },
  { distance: "7.2 km", pace: "5:08", title: "Tempo Run", date: "Jun 9, 2026", isoDate: "2026-06-09" },
  { distance: "4.1 km", pace: "5:34", title: "Easy Run", date: "Jun 7, 2026", isoDate: "2026-06-07" },
  { distance: "9.6 km", pace: "5:21", title: "Long Run", date: "Jun 5, 2026", isoDate: "2026-06-05" }
];

const rangeOptions = ["This week", "Last week", "Last month", "Custom dates"];

export default function RaceScreen() {
  const [isRangeOpen, setIsRangeOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState("This week");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const customDateError = getCustomDateError(customStart, customEnd);
  const visibleSessions = sessions.filter((session) => isInsideRange(session.isoDate, selectedRange, customStart, customEnd));

  const selectRange = (range: string) => {
    setSelectedRange(range);
    setIsRangeOpen(range === "Custom dates");
  };

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

      <View className="mt-6 flex-row items-center justify-between gap-3">
        <Text className="min-w-0 flex-1 text-xl font-semibold tracking-[-0.6px] text-black" numberOfLines={1}>
          Session History
        </Text>
        <Pressable className="shrink-0 rounded-[300px] bg-[#eef0ff] px-4 py-3" onPress={() => setIsRangeOpen((value) => !value)}>
          <Text className="text-xs font-semibold uppercase tracking-widest text-[#4a53ff]" numberOfLines={1}>
            {selectedRange}
          </Text>
        </Pressable>
      </View>

      {isRangeOpen ? (
        <View className="mt-3 rounded-[24px] bg-[#f3f5f9] p-2">
          {rangeOptions.map((option) => {
            const isSelected = option === selectedRange;

            return (
              <Pressable
                key={option}
                className={`rounded-[300px] px-4 py-3 ${isSelected ? "bg-white" : "bg-transparent"}`}
                onPress={() => selectRange(option)}
              >
                <Text className={`text-sm font-semibold ${isSelected ? "text-black" : "text-[#808080]"}`}>{option}</Text>
              </Pressable>
            );
          })}

          {selectedRange === "Custom dates" ? (
            <>
              <View className="mt-2 flex-row gap-2 px-1">
                <TextInput
                  className="min-w-0 flex-1 rounded-[24px] bg-white px-4 py-3 text-sm text-black"
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  onChangeText={(value) => setCustomStart(formatDateInput(value))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#808080"
                  value={customStart}
                />
                <TextInput
                  className="min-w-0 flex-1 rounded-[24px] bg-white px-4 py-3 text-sm text-black"
                  keyboardType="numbers-and-punctuation"
                  maxLength={10}
                  onChangeText={(value) => setCustomEnd(formatDateInput(value))}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#808080"
                  value={customEnd}
                />
              </View>
              {customDateError ? <Text className="px-3 pb-1 pt-2 text-xs font-semibold text-[#d14343]">{customDateError}</Text> : null}
            </>
          ) : null}
        </View>
      ) : null}

      <View className="mt-3 gap-3">
        {visibleSessions.map((session) => (
          <View key={`${session.title}-${session.date}`} className="rounded-[24px] bg-[#f3f5f9] p-5">
            <View className="flex-row items-center justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text className="text-xl font-semibold tracking-[-0.6px] text-black" numberOfLines={1}>
                  {session.title}
                </Text>
                <Text className="mt-1 text-base text-[#999999]">{session.date}</Text>
              </View>
              <View className="shrink-0 items-end">
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

function formatDateInput(value: string) {
  return value.replace(/[^\d-]/g, "").slice(0, 10);
}

function getCustomDateError(start: string, end: string) {
  if (!start && !end) {
    return null;
  }

  if (!isValidIsoDate(start) || !isValidIsoDate(end)) {
    return "Use YYYY-MM-DD for both dates.";
  }

  if (end <= start) {
    return "End date must be after start date.";
  }

  return null;
}

function isInsideRange(isoDate: string, selectedRange: string, customStart: string, customEnd: string) {
  if (selectedRange === "Custom dates") {
    if (getCustomDateError(customStart, customEnd)) {
      return true;
    }

    return isoDate >= customStart && isoDate <= customEnd;
  }

  if (selectedRange === "Last week") {
    return isoDate >= "2026-06-02" && isoDate <= "2026-06-08";
  }

  if (selectedRange === "Last month") {
    return isoDate >= "2026-05-01" && isoDate <= "2026-05-31";
  }

  return isoDate >= "2026-06-09" && isoDate <= "2026-06-15";
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
