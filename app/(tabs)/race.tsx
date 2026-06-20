import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { XpiritDataService, type RunSessionRecord } from "@/services/xpirit-data-service";

type RaceSession = {
  date: string;
  distance: string;
  isoDate: string;
  pace: string;
  title: string;
};

const rangeOptions = ["This week", "Last week", "Last month", "Custom dates"];

export default function RaceScreen() {
  const [isRangeOpen, setIsRangeOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState("This week");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [sessions, setSessions] = useState<RaceSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const customDateError = getCustomDateError(customStart, customEnd);
  const visibleSessions = sessions.filter((session) => isInsideRange(session.isoDate, selectedRange, customStart, customEnd));
  const latestRun = sessions[0] ?? null;

  useEffect(() => {
    void loadSessions();
  }, []);

  async function loadSessions() {
    setIsLoading(true);
    const records = await XpiritDataService.getRunSessions();
    setIsLoading(false);

    if (!records) {
      return;
    }

    setSessions(records.map(toRaceSession));
  }

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
        {latestRun ? (
          <View className="mt-5 flex-row items-end justify-between">
            <View>
              <Text className="text-6xl font-normal tracking-[-2px] text-white">{latestRun.distance.replace(" km", "")}</Text>
              <Text className="mt-1 text-base text-[#999999]">km latest session</Text>
            </View>
            <View className="items-end">
              <Text className="text-4xl font-normal tracking-[-1px] text-white">{latestRun.pace}</Text>
              <Text className="mt-1 text-base text-[#999999]">pace /km</Text>
            </View>
          </View>
        ) : (
          <Text className="mt-5 text-base text-[#999999]">{isLoading ? "Loading…" : "No runs tracked yet. Start a Live Run from Home."}</Text>
        )}
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
        {isLoading ? <Text className="px-1 text-base text-[#808080]">Loading your runs…</Text> : null}
        {!isLoading && visibleSessions.length === 0 ? (
          <Text className="px-1 text-base text-[#808080]">No runs in this range yet.</Text>
        ) : null}
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

function toRaceSession(record: RunSessionRecord): RaceSession {
  const startedAt = new Date(record.startedAt);

  return {
    date: formatDateLabel(startedAt),
    distance: `${(record.distanceMeters / 1000).toFixed(1)} km`,
    isoDate: record.startedAt.slice(0, 10),
    pace: formatPace(record.paceSecondsPerKm),
    title: record.name
  };
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function formatPace(secondsPerKm: number | null) {
  if (!secondsPerKm) {
    return "--:--";
  }

  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
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

  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const startOfThisWeek = new Date(today);
  startOfThisWeek.setDate(today.getDate() - daysSinceMonday);
  startOfThisWeek.setHours(0, 0, 0, 0);

  if (selectedRange === "Last week") {
    const startOfLastWeek = addDays(startOfThisWeek, -7);
    const endOfLastWeek = addDays(startOfThisWeek, -1);
    return isoDate >= formatIsoDate(startOfLastWeek) && isoDate <= formatIsoDate(endOfLastWeek);
  }

  if (selectedRange === "Last month") {
    const firstOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastOfLastMonth = addDays(firstOfThisMonth, -1);
    return isoDate >= formatIsoDate(firstOfLastMonth) && isoDate <= formatIsoDate(lastOfLastMonth);
  }

  const endOfThisWeek = addDays(startOfThisWeek, 6);
  return isoDate >= formatIsoDate(startOfThisWeek) && isoDate <= formatIsoDate(endOfThisWeek);
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
