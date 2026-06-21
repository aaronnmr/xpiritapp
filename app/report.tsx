import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import { ActionSheetIOS, Alert, Image, Platform, Pressable, Text, View } from "react-native";
import ViewShot from "react-native-view-shot";

import { AmplitudeService } from "@/services/amplitude-service";
import { useI18n } from "@/lib/i18n";
import { XpiritDataService, type WeeklyReportSummary } from "@/services/xpirit-data-service";

export default function ReportScreen() {
  const { locale, t } = useI18n();
  const reportRef = useRef<ViewShot>(null);
  const webFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [summary, setSummary] = useState<WeeklyReportSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [backgroundUri, setBackgroundUri] = useState<string | null>(null);

  useEffect(() => {
    void loadReportData();
  }, []);

  async function loadReportData() {
    setIsLoading(true);
    const weeklySummary = await XpiritDataService.getWeeklyReportSummary();
    setIsLoading(false);

    if (weeklySummary) {
      setSummary(weeklySummary);
    }
  }

  const totalDistanceKm = summary ? summary.totalDistanceMeters / 1000 : 0;
  const longestRunKm = summary ? summary.longestRunMeters / 1000 : 0;
  const avgDistancePerRunKm = summary && summary.sessionCount > 0 ? totalDistanceKm / summary.sessionCount : 0;
  const periodLabel = getCurrentWeekLabel(locale);

  async function pickFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Photos access needed", "Allow photo access in Settings to pick a background image.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [9, 16],
      mediaTypes: ["images"],
      quality: 0.9
    });

    if (!result.canceled && result.assets[0]) {
      setBackgroundUri(result.assets[0].uri);
      AmplitudeService.track("report_background_set", { source: "library" });
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Camera access needed", "Allow camera access in Settings to take a background photo.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.9
    });

    if (!result.canceled && result.assets[0]) {
      setBackgroundUri(result.assets[0].uri);
      AmplitudeService.track("report_background_set", { source: "camera" });
    }
  }

  function handleWebFileSelected(event: { target: { files: FileList | null } }) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setBackgroundUri(objectUrl);
    AmplitudeService.track("report_background_set", { source: "web_file_input" });
  }

  function choosePhotoSource() {
    if (Platform.OS === "web") {
      webFileInputRef.current?.click();
      return;
    }

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          cancelButtonIndex: 2,
          options: ["Take Photo", "Choose from Library", "Cancel"]
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            void takePhoto();
          } else if (buttonIndex === 1) {
            void pickFromLibrary();
          }
        }
      );
      return;
    }

    Alert.alert("Set background photo", undefined, [
      { onPress: () => void takePhoto(), text: "Take Photo" },
      { onPress: () => void pickFromLibrary(), text: "Choose from Library" },
      { style: "cancel", text: "Cancel" }
    ]);
  }

  const shareReport = async () => {
    if (!reportRef.current?.capture) {
      return;
    }

    setIsSharing(true);
    AmplitudeService.track("report_share_started", {
      format: "9:16",
      has_background_photo: backgroundUri !== null
    });

    try {
      const uri = await reportRef.current.capture();
      await XpiritDataService.saveReportCard({
        imageUrl: uri,
        metrics: {
          avg_pace_seconds_per_km: summary?.avgPaceSecondsPerKm ?? null,
          longest_run_km: Number(longestRunKm.toFixed(2)),
          sessions: summary?.sessionCount ?? 0,
          top_gym_set: summary?.topGymSet ?? null,
          total_distance_km: Number(totalDistanceKm.toFixed(2)),
          total_duration_seconds: summary?.totalDurationSeconds ?? 0
        },
        periodEnd: new Date().toISOString().slice(0, 10),
        periodStart: getSevenDaysAgo(),
        title: "Weekly performance"
      });

      if (Platform.OS === "web") {
        const link = document.createElement("a");
        link.href = uri;
        link.download = "xpirit-weekly-report.png";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        AmplitudeService.track("report_shared", { format: "9:16", method: "web_download" });
        return;
      }

      const canShare = await Sharing.isAvailableAsync();

      if (canShare) {
        await Sharing.shareAsync(uri, {
          dialogTitle: "Share Xpirit Report",
          mimeType: "image/png",
          UTI: "public.png"
        });
        AmplitudeService.track("report_shared", {
          format: "9:16",
          method: "native_share_sheet"
        });
      } else {
        Alert.alert("Sharing not available", "Your report was saved. You can find it from your recent reports.");
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <View className="flex-1 bg-white px-5 pb-8 pt-14">
      {Platform.OS === "web" ? (
        <input
          ref={webFileInputRef}
          accept="image/*"
          onChange={handleWebFileSelected as any}
          style={{ display: "none" }}
          type="file"
        />
      ) : null}

      <View className="mb-5 flex-row items-center justify-between">
        <Pressable className="h-11 w-11 items-center justify-center rounded-full bg-[#f3f5f9]" onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#000000" />
        </Pressable>
        <Text className="text-sm font-semibold uppercase tracking-widest text-[#808080]">Visual Report</Text>
        <View className="h-11 w-11" />
      </View>

      <View className="flex-1 items-center justify-center">
        <ViewShot ref={reportRef} options={{ fileName: "xpirit-report", format: "png", quality: 1 }}>
          <View className="aspect-[9/16] w-[320px] overflow-hidden rounded-[28px] border border-[#1a1a1a] bg-black">
            {backgroundUri ? (
              <Image source={{ uri: backgroundUri }} className="absolute h-full w-full" resizeMode="cover" />
            ) : (
              <View className="absolute h-full w-full bg-[#15161a]" />
            )}
            <View className="absolute h-full w-full bg-black/35" />

            <View className="flex-1 p-5">
              <Text className="text-xs font-semibold uppercase tracking-[2px] text-white/70" style={textShadow}>
                {t("report.title")}
              </Text>
              <Text className="mt-2 text-3xl font-extrabold uppercase leading-[34px] tracking-[-0.5px] text-white" style={textShadow}>
                {periodLabel}
              </Text>
              <View className="mt-3 h-[2px] w-10 bg-white/80" />

              <View className="mt-auto items-center">
                <Text className="text-xs font-semibold uppercase tracking-[2px] text-white/70" style={textShadow}>
                  {t("report.totalDistance")}
                </Text>
                <View className="mt-2 flex-row items-end">
                  <Text className="text-7xl font-extrabold tracking-[-2px] text-white" style={textShadow}>
                    {isLoading ? "--" : totalDistanceKm.toFixed(1)}
                  </Text>
                  <Text className="ml-1 mb-2 text-xl font-semibold text-white/85" style={textShadow}>
                    km
                  </Text>
                </View>
              </View>

              <View className="mt-auto">
                <View className="h-[1px] bg-white/25" />
                <View className="mt-4 flex-row justify-between">
                  <ReportStat label={t("report.sessions")} value={isLoading ? "--" : String(summary?.sessionCount ?? 0)} />
                  <ReportStat label={t("report.totalTime")} value={isLoading ? "--" : formatDuration(summary?.totalDurationSeconds ?? 0)} />
                </View>
                <View className="mt-4 flex-row justify-between">
                  <ReportStat label={t("report.avgPace")} value={isLoading ? "--" : formatPace(summary?.avgPaceSecondsPerKm ?? null)} unit="/km" />
                  <ReportStat label={t("report.avgPerRun")} value={isLoading ? "--" : avgDistancePerRunKm.toFixed(1)} unit="km" />
                </View>
                <View className="mt-4 flex-row justify-between">
                  <ReportStat label={t("report.longestRun")} value={isLoading ? "--" : longestRunKm.toFixed(1)} unit="km" />
                  {summary?.topGymSet ? (
                    <ReportStat
                      label={summary.topGymSet.activity}
                      value={String(summary.topGymSet.weightKg)}
                      unit="kg"
                    />
                  ) : (
                    <ReportStat label={t("report.week")} value={isLoading ? "--" : `#${summary?.weekNumber ?? ""}`} />
                  )}
                </View>

                <View className="mt-5 flex-row items-center justify-between">
                  <Text className="text-xs font-semibold uppercase tracking-[2px] text-white/60" style={textShadow}>
                    {t("report.keepMoving")}
                  </Text>
                  <Text className="text-xs font-semibold text-white/60" style={textShadow}>
                    {new Date().getFullYear()}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ViewShot>
      </View>

      <Pressable className="mt-5 rounded-full border border-[#e5e7eb] bg-white px-6 py-4" onPress={choosePhotoSource}>
        <Text className="text-center text-sm font-semibold uppercase tracking-widest text-black">
          {backgroundUri ? "Change Background Photo" : "Set Background Photo"}
        </Text>
      </Pressable>

      <Pressable className="mt-3 rounded-full bg-[#4a53ff] px-6 py-4" onPress={shareReport}>
        <Text className="text-center text-sm font-semibold uppercase tracking-widest text-white">
          {isSharing ? "Preparing..." : Platform.OS === "web" ? "Download Report" : "Share Report"}
        </Text>
      </Pressable>
    </View>
  );
}

function ReportStat({ label, unit, value }: { label: string; unit?: string; value: string }) {
  return (
    <View className="max-w-[47%]">
      <Text className="text-[10px] font-semibold uppercase tracking-[1.5px] text-white/60" numberOfLines={1} style={textShadow}>
        {label}
      </Text>
      <View className="mt-1 flex-row items-end">
        <Text className="text-2xl font-extrabold text-white" style={textShadow}>
          {value}
        </Text>
        {unit ? (
          <Text className="ml-1 mb-[2px] text-xs font-semibold text-white/80" style={textShadow}>
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const textShadow = {
  textShadowColor: "rgba(0,0,0,0.55)",
  textShadowOffset: { height: 1, width: 0 },
  textShadowRadius: 6
};

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function formatPace(secondsPerKm: number | null) {
  if (!secondsPerKm) {
    return "--'--\"";
  }

  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}'${seconds}"`;
}

function getSevenDaysAgo() {
  const date = new Date();
  date.setDate(date.getDate() - 7);

  return date.toISOString().slice(0, 10);
}

function getCurrentWeekLabel(locale: string) {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const start = new Date(today);
  start.setDate(today.getDate() - daysSinceMonday);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const intlLocale = locale === "es" ? "es-ES" : locale === "de" ? "de-DE" : "en-US";
  const monthFormatter = new Intl.DateTimeFormat(intlLocale, { month: "long" });
  const startMonth = monthFormatter.format(start);
  const endMonth = monthFormatter.format(end);

  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()} - ${end.getDate()}`;
  }

  return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;
}
