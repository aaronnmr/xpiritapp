import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { AmplitudeService } from "@/services/amplitude-service";
import { UnifiedDataService } from "@/services/unified-data-service";
import { XpiritDataService, type DashboardSnapshot } from "@/services/xpirit-data-service";

const weeklySessions = [
  { day: "M", height: "h-16", active: true },
  { day: "T", height: "h-20", active: true },
  { day: "W", height: "h-10", active: false },
  { day: "T", height: "h-24", active: true },
  { day: "F", height: "h-12", active: false },
  { day: "S", height: "h-8", active: false },
  { day: "S", height: "h-14", active: false }
];

const oldSessions = [
  { distance: "7.2 km", pace: "5:08", title: "Tempo Run" },
  { distance: "4.1 km", pace: "5:34", title: "Easy Run" },
  { distance: "9.6 km", pace: "5:21", title: "Long Run" }
];

export default function DashboardScreen() {
  const [dashboardSnapshot, setDashboardSnapshot] = useState<DashboardSnapshot | null>(null);
  const [runSnapshot, setRunSnapshot] = useState(UnifiedDataService.getLiveRunSnapshot());
  const [latestRun, setLatestRun] = useState({
    distanceMeters: 5800,
    durationSeconds: 1694,
    paceSecondsPerKm: 292 as number | null
  });

  useEffect(() => {
    void refreshDashboardSnapshot();

    const interval = setInterval(() => {
      setRunSnapshot(UnifiedDataService.getLiveRunSnapshot());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const refreshDashboardSnapshot = async () => {
    const snapshot = await XpiritDataService.getDashboardSnapshot();

    if (!snapshot) {
      return;
    }

    setDashboardSnapshot(snapshot);

    if (snapshot.latestRun) {
      setLatestRun(snapshot.latestRun);
    }
  };

  const toggleRunTracking = async () => {
    if (runSnapshot.isTracking) {
      AmplitudeService.track("live_run_end_pressed", {
        distance_meters: runSnapshot.distanceMeters,
        duration_seconds: runSnapshot.durationSeconds
      });
      const workout = await UnifiedDataService.stopLiveRun();

      if (workout) {
        AmplitudeService.track("live_run_saved", {
          distance_meters: workout.distanceMeters,
          duration_seconds: workout.durationSeconds,
          pace_seconds_per_km: workout.paceSecondsPerKm
        });
        setLatestRun({
          distanceMeters: workout.distanceMeters,
          durationSeconds: workout.durationSeconds,
          paceSecondsPerKm: workout.paceSecondsPerKm
        });
        void refreshDashboardSnapshot();
      }

      setRunSnapshot(UnifiedDataService.getLiveRunSnapshot());
      return;
    }

    AmplitudeService.track("live_run_start_pressed");
    const snapshot = await UnifiedDataService.startLiveRun();
    setRunSnapshot(snapshot);
  };

  return (
    <ScrollView className="flex-1 bg-white px-5 pt-14" contentContainerStyle={{ paddingBottom: 120 }}>
      <View className="mb-7 flex-row items-start justify-between">
        <View className="flex-1 pr-4">
          <Text className="text-sm font-semibold uppercase tracking-widest text-[#808080]">Xpirit Lab</Text>
          <Text className="mt-3 text-5xl font-normal leading-[44px] tracking-[-2px] text-black">Your performance pulse.</Text>
        </View>
        <View className="rounded-full bg-black px-4 py-2">
          <Text className="text-sm font-semibold uppercase tracking-widest text-white">Today</Text>
        </View>
      </View>

      <View className="overflow-hidden rounded-[24px] bg-black p-6">
        <View className="absolute right-[-60px] top-[-70px] h-44 w-44 rounded-full bg-[#4a53ff] opacity-35" />
        <Text className="text-sm font-semibold uppercase tracking-widest text-[#999999]">Latest Run</Text>
        <View className="mt-5 flex-row items-end justify-between">
          <View>
            <Text className="text-6xl font-normal tracking-[-2px] text-white">{(latestRun.distanceMeters / 1000).toFixed(1)}</Text>
            <Text className="mt-1 text-base text-[#999999]">km covered</Text>
          </View>
          <View className="items-end">
            <Text className="text-4xl font-normal tracking-[-1px] text-white">{formatDuration(latestRun.durationSeconds)}</Text>
            <Text className="mt-1 text-base text-[#999999]">duration</Text>
          </View>
        </View>
        <Text className="mt-4 text-base font-semibold text-[#4a53ff]">{formatPace(latestRun.paceSecondsPerKm)} average pace</Text>
        <View className="mt-6 h-2 overflow-hidden rounded-full bg-[#191919]">
          <View className="h-full w-[72%] rounded-full bg-[#4a53ff]" />
        </View>
      </View>

      <View className="mt-4 flex-row gap-3">
        <Pressable className="flex-1 rounded-[24px] bg-[#f3f5f9] p-5" onPress={() => router.push("/gym")}>
          <Text className="text-sm font-semibold uppercase tracking-widest text-[#808080]">Weekly Workouts</Text>
          <Text className="mt-3 text-4xl font-normal tracking-[-1px] text-black">{dashboardSnapshot?.weeklyWorkoutCount ?? 3}</Text>
          <Text className="mt-1 text-base font-semibold text-[#4a53ff]">+1 vs last week</Text>
        </Pressable>
        <View className="flex-1 rounded-[24px] bg-[#f3f5f9] p-5">
          <Text className="text-sm font-semibold uppercase tracking-widest text-[#808080]">Recovery</Text>
          <Text className="mt-3 text-4xl font-normal tracking-[-1px] text-black">18h</Text>
          <Text className="mt-1 text-base font-semibold text-[#4a53ff]">recommended</Text>
        </View>
      </View>

      <View className="mt-4 rounded-[24px] bg-[#f3f5f9] p-5">
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-semibold tracking-[-0.6px] text-black">Weekly Load</Text>
          <Text className="text-base text-[#808080]">3 / 5 goal</Text>
        </View>
        <View className="mt-5 h-28 flex-row items-end justify-between">
          {weeklySessions.map((item, index) => (
            <View key={`${item.day}-${index}`} className="items-center gap-2">
              <View className={`w-7 rounded-full ${item.height} ${item.active ? "bg-[#4a53ff]" : "bg-[#e5e7eb]"}`} />
              <Text className={`text-xs font-semibold ${item.active ? "text-black" : "text-[#999999]"}`}>{item.day}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="mt-4 rounded-[24px] bg-[#f3f5f9] p-5">
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-semibold tracking-[-0.6px] text-black">Previous Sessions</Text>
          <Text className="text-sm font-semibold uppercase tracking-widest text-[#4a53ff]">View All</Text>
        </View>
        <View className="mt-4 gap-3">
          {(dashboardSnapshot?.previousRuns.length
            ? dashboardSnapshot.previousRuns.map((session) => ({
                distance: formatDistance(session.distanceMeters),
                pace: formatPace(session.paceSecondsPerKm).replace(" /km", ""),
                title: session.name
              }))
            : oldSessions
          ).map((session) => (
            <View key={`${session.title}-${session.distance}`} className="flex-row items-center justify-between rounded-[24px] bg-white p-4">
              <View>
                <Text className="text-base font-semibold text-black">{session.title}</Text>
                <Text className="mt-1 text-base text-[#808080]">{session.distance}</Text>
              </View>
              <View className="rounded-full border border-[#e5e7eb] px-4 py-2">
                <Text className="text-sm font-semibold text-black">{session.pace} /km</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className="mt-5 rounded-[24px] bg-black p-5">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-semibold uppercase tracking-widest text-[#999999]">Live GPS</Text>
            <Text className="mt-2 text-2xl font-semibold text-white">{runSnapshot.isTracking ? "Run in progress" : "Ready to track"}</Text>
          </View>
          <View className={`rounded-full px-4 py-2 ${runSnapshot.isTracking ? "bg-[#4a53ff]" : "bg-white"}`}>
            <Text className={`text-xs font-semibold uppercase tracking-widest ${runSnapshot.isTracking ? "text-white" : "text-black"}`}>
              {runSnapshot.isTracking ? "Live" : "Idle"}
            </Text>
          </View>
        </View>

        <View className="mt-5 flex-row gap-3">
          <View className="flex-1 rounded-[20px] bg-[#111111] p-4">
            <Text className="text-xs font-semibold uppercase tracking-widest text-[#999999]">Distance</Text>
            <Text className="mt-2 text-2xl font-semibold text-white">{formatDistance(runSnapshot.distanceMeters)}</Text>
          </View>
          <View className="flex-1 rounded-[20px] bg-[#111111] p-4">
            <Text className="text-xs font-semibold uppercase tracking-widest text-[#999999]">Pace</Text>
            <Text className="mt-2 text-2xl font-semibold text-white">{formatPace(runSnapshot.paceSecondsPerKm)}</Text>
          </View>
        </View>

        <View className="mt-3 rounded-[20px] bg-[#111111] p-4">
          <Text className="text-xs font-semibold uppercase tracking-widest text-[#999999]">Duration</Text>
          <Text className="mt-2 text-3xl font-semibold text-white">{formatDuration(runSnapshot.durationSeconds)}</Text>
        </View>

        <Pressable className="mt-5 rounded-full bg-[#4a53ff] px-6 py-4" onPress={toggleRunTracking}>
          <Text className="text-center text-sm font-semibold uppercase tracking-widest text-white">
            {runSnapshot.isTracking ? "End Run" : "Start Live Run"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function formatDistance(meters: number) {
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatPace(secondsPerKm: number | null) {
  if (!secondsPerKm) {
    return "-- /km";
  }

  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds} /km`;
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
