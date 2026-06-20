import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import ViewShot from "react-native-view-shot";

import { AmplitudeService } from "@/services/amplitude-service";
import { XpiritDataService, type DashboardSnapshot, type WeeklyDayLoad } from "@/services/xpirit-data-service";

const weekdayLabels = ["M", "T", "W", "T", "F", "S", "S"];

export default function ReportScreen() {
  const reportRef = useRef<ViewShot>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [weeklyLoad, setWeeklyLoad] = useState<WeeklyDayLoad[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadReportData();
  }, []);

  async function loadReportData() {
    setIsLoading(true);
    const [dashboardSnapshot, weeklyLoadRecords] = await Promise.all([
      XpiritDataService.getDashboardSnapshot(),
      XpiritDataService.getWeeklyLoad()
    ]);
    setIsLoading(false);

    if (dashboardSnapshot) {
      setSnapshot(dashboardSnapshot);
    }

    if (weeklyLoadRecords) {
      setWeeklyLoad(weeklyLoadRecords);
    }
  }

  const bestRunKm = snapshot?.latestRun ? snapshot.latestRun.distanceMeters / 1000 : 0;
  const bestRunPace = formatPace(snapshot?.latestRun?.paceSecondsPerKm ?? null);
  const workoutCount = snapshot?.weeklyWorkoutCount ?? 0;
  const maxDailyBarHeight = 64;

  const shareReport = async () => {
    if (!reportRef.current?.capture) {
      return;
    }

    setIsSharing(true);
    AmplitudeService.track("report_share_started", {
      format: "9:16"
    });

    try {
      const uri = await reportRef.current.capture();
      await XpiritDataService.saveReportCard({
        imageUrl: uri,
        metrics: {
          best_run_km: Number(bestRunKm.toFixed(2)),
          best_run_pace: bestRunPace,
          workouts: workoutCount
        },
        periodEnd: new Date().toISOString().slice(0, 10),
        periodStart: getSevenDaysAgo(),
        title: "Weekly performance"
      });
      const canShare = await Sharing.isAvailableAsync();

      if (canShare) {
        await Sharing.shareAsync(uri, {
          dialogTitle: "Share Xpirit Report",
          mimeType: "image/png",
          UTI: "public.png"
        });
        AmplitudeService.track("report_shared", {
          format: "9:16"
        });
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <View className="flex-1 bg-white px-5 pb-8 pt-14">
      <View className="mb-5 flex-row items-center justify-between">
        <Pressable className="h-11 w-11 items-center justify-center rounded-full bg-[#f3f5f9]" onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#000000" />
        </Pressable>
        <Text className="text-sm font-semibold uppercase tracking-widest text-[#808080]">Visual Report</Text>
        <View className="h-11 w-11" />
      </View>

      <View className="flex-1 items-center justify-center">
        <ViewShot ref={reportRef} options={{ fileName: "xpirit-report", format: "png", quality: 1 }}>
          <View className="aspect-[9/16] w-[320px] overflow-hidden rounded-[28px] border border-[#e5e7eb] bg-white p-5">
            <View className="flex-row items-start justify-between">
              <View>
                <Text className="text-xs font-semibold uppercase tracking-widest text-[#808080]">Xpirit Report</Text>
                <Text className="mt-2 text-4xl font-normal leading-[38px] tracking-[-1.4px] text-black">Weekly performance</Text>
              </View>
              <View className="rounded-full bg-black px-3 py-2">
                <Text className="text-xs font-semibold uppercase tracking-widest text-white">9:16</Text>
              </View>
            </View>

            <View className="mt-6 overflow-hidden rounded-[24px] bg-black p-5">
              <View className="absolute right-[-50px] top-[-52px] h-36 w-36 rounded-full bg-[#4a53ff] opacity-55" />
              <Text className="text-xs font-semibold uppercase tracking-widest text-[#999999]">Best run</Text>
              <Text className="mt-3 text-6xl font-normal tracking-[-2px] text-white">{isLoading ? "--" : bestRunKm.toFixed(1)}</Text>
              <Text className="mt-1 text-base text-[#999999]">km covered</Text>
              <Text className="mt-4 text-2xl font-semibold text-[#4a53ff]">{isLoading ? "--:--" : bestRunPace} /km</Text>
            </View>

            <View className="mt-4 flex-row gap-3">
              <View className="flex-1 rounded-[22px] bg-[#f3f5f9] p-4">
                <Text className="text-xs font-semibold uppercase tracking-widest text-[#808080]">Workouts</Text>
                <Text className="mt-2 text-4xl font-normal text-black">{isLoading ? "--" : workoutCount}</Text>
              </View>
              <View className="flex-1 rounded-[22px] bg-[#f3f5f9] p-4">
                <Text className="text-xs font-semibold uppercase tracking-widest text-[#808080]">Active days</Text>
                <Text className="mt-2 text-4xl font-normal text-black">{isLoading ? "--" : weeklyLoad.filter((d) => d.hasActivity).length}</Text>
              </View>
            </View>

            <View className="mt-4 rounded-[24px] bg-[#f3f5f9] p-4">
              <View className="flex-row items-end justify-between">
                {weeklyLoad.map((day, index) => {
                  const barHeight = day.workoutCount === 0 ? 4 : Math.min(maxDailyBarHeight, 24 + day.workoutCount * 20);

                  return (
                    <View key={day.isoDate} className="items-center gap-2">
                      <View className={`w-6 rounded-full ${day.hasActivity ? "bg-[#4a53ff]" : "bg-[#dfe3ee]"}`} style={{ height: barHeight }} />
                      <Text className="text-[10px] font-semibold text-[#808080]">{weekdayLabels[index]}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View className="mt-auto">
              <View className="h-[1px] bg-[#e5e7eb]" />
              <View className="mt-4 flex-row items-center justify-between">
                <Text className="text-xs font-semibold uppercase tracking-widest text-[#808080]">Built with Xpirit</Text>
                <Text className="text-base font-semibold text-[#4a53ff]">xpirit.fit</Text>
              </View>
            </View>
          </View>
        </ViewShot>
      </View>

      <Pressable className="mt-5 rounded-full bg-[#4a53ff] px-6 py-4" onPress={shareReport}>
        <Text className="text-center text-sm font-semibold uppercase tracking-widest text-white">
          {isSharing ? "Preparing..." : "Share Report"}
        </Text>
      </Pressable>
    </View>
  );
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

function getSevenDaysAgo() {
  const date = new Date();
  date.setDate(date.getDate() - 7);

  return date.toISOString().slice(0, 10);
}
