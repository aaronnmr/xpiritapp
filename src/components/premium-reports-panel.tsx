import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AmplitudeService } from "@/services/amplitude-service";
import { XpiritDataService } from "@/services/xpirit-data-service";

type PremiumReport = {
  id: string;
  week_start_date: string;
  week_end_date: string;
  title: string;
  image_url: string | null;
  visibility: "private" | "shared";
  metrics: Record<string, unknown>;
  created_at: string;
};

export function PremiumReportsPanel() {
  const [reports, setReports] = useState<PremiumReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setIsLoading(true);
    setError(null);
    const result = await XpiritDataService.getPremiumReports(5);

    if (result) {
      setReports(result.reports as PremiumReport[]);
    } else {
      setError("Failed to load reports");
    }

    setIsLoading(false);
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const startISO = formatDate(weekStart);
      const endISO = formatDate(weekEnd);

      AmplitudeService.track("premium_report_generation_started", {
        week_start: startISO,
        week_end: endISO,
      });

      const result = await XpiritDataService.generatePremiumReport(startISO, endISO);

      if (!result) {
        setError("Failed to generate report. Please try again.");
        AmplitudeService.track("premium_report_generation_failed");
        return;
      }

      AmplitudeService.track("premium_report_generation_completed", {
        report_id: result.reportId,
      });

      Alert.alert("Success", "Your weekly report has been generated!", [
        {
          text: "View",
          onPress: () => {
            // TODO: Navigate to report detail view
          },
        },
        { text: "Done" },
      ]);

      // Reload reports
      await loadReports();
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      console.error("Error generating report:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShareReport = async (reportId: string) => {
    const result = await XpiritDataService.updateReportVisibility(reportId, "shared");

    if (result) {
      Alert.alert("Success", "Report visibility updated to shared");
      await loadReports();
    } else {
      Alert.alert("Error", "Failed to update report visibility");
    }
  };

  return (
    <ScrollView className="flex-1 bg-white px-5 pt-6" contentContainerStyle={{ paddingBottom: 120 }}>
      <View className="mb-6">
        <View className="flex-row items-center gap-3 mb-2">
          <Ionicons name="stats-chart" size={24} color="#4a53ff" />
          <Text className="text-2xl font-semibold text-black">Premium Reports</Text>
        </View>
        <Text className="text-sm text-[#808080]">Generate beautiful visual reports of your weekly performance</Text>
      </View>

      {/* Generate Button */}
      <Pressable
        className={`mb-6 rounded-[24px] px-6 py-5 ${
          isGenerating ? "bg-[#e5e7eb]" : "bg-[#4a53ff]"
        }`}
        onPress={handleGenerateReport}
        disabled={isGenerating}
      >
        <View className="flex-row items-center justify-center gap-2">
          {isGenerating && <ActivityIndicator size="small" color="#4a53ff" />}
          <Text className={`text-center text-sm font-semibold uppercase tracking-widest ${
            isGenerating ? "text-[#808080]" : "text-white"
          }`}>
            {isGenerating ? "Generating..." : "Generate This Week's Report"}
          </Text>
        </View>
      </Pressable>

      {/* Error Message */}
      {error && (
        <View className="mb-4 rounded-[12px] bg-[#fee2e2] p-4 border border-[#fecaca]">
          <View className="flex-row gap-2">
            <Ionicons name="alert-circle" size={20} color="#dc2626" />
            <Text className="flex-1 text-sm text-[#991b1b] font-medium">{error}</Text>
          </View>
        </View>
      )}

      {/* Reports List */}
      <View className="gap-4">
        {isLoading ? (
          <View className="py-8 items-center">
            <ActivityIndicator size="large" color="#4a53ff" />
          </View>
        ) : reports.length === 0 ? (
          <View className="rounded-[24px] bg-[#f3f5f9] p-8 items-center">
            <Ionicons name="document-text-outline" size={48} color="#808080" />
            <Text className="mt-4 text-sm font-semibold text-[#808080] text-center">No reports yet</Text>
            <Text className="mt-2 text-xs text-[#999999] text-center">
              Generate your first weekly report to get started
            </Text>
          </View>
        ) : (
          reports.map((report) => (
            <View key={report.id} className="rounded-[24px] bg-[#f3f5f9] p-5">
              <View className="flex-row items-start justify-between gap-3 mb-3">
                <View className="min-w-0 flex-1">
                  <Text className="text-lg font-semibold text-black" numberOfLines={1}>
                    {report.week_start_date} to {report.week_end_date}
                  </Text>
                  <Text className="mt-1 text-sm text-[#808080]">
                    {new Date(report.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  {report.visibility === "shared" && (
                    <View className="rounded-full bg-[#4a53ff] px-3 py-1">
                      <Text className="text-xs font-semibold text-white">Shared</Text>
                    </View>
                  )}
                  <Ionicons
                    name={report.image_url ? "checkmark-circle" : "time-outline"}
                    size={20}
                    color={report.image_url ? "#4a53ff" : "#999999"}
                  />
                </View>
              </View>

              {/* Metrics Preview */}
              {report.metrics && (
                <View className="mb-3 gap-2">
                  <View className="flex-row justify-between text-xs text-[#808080]">
                    <Text className="text-xs text-[#808080]">
                      {typeof report.metrics.runCount === "number" && report.metrics.runCount > 0
                        ? `${report.metrics.runCount} runs`
                        : "No runs"}
                    </Text>
                    <Text className="text-xs text-[#808080]">
                      {typeof report.metrics.totalWorkouts === "number"
                        ? `${report.metrics.totalWorkouts} workouts`
                        : "0 workouts"}
                    </Text>
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              <View className="flex-row gap-2">
                {report.visibility === "private" && (
                  <Pressable
                    className="min-w-0 flex-1 rounded-[12px] bg-white border border-[#4a53ff] py-2 px-3"
                    onPress={() => handleShareReport(report.id)}
                  >
                    <Text className="text-center text-xs font-semibold text-[#4a53ff]">Share</Text>
                  </Pressable>
                )}
                {report.image_url && (
                  <Pressable className="min-w-0 flex-1 rounded-[12px] bg-[#4a53ff] py-2 px-3">
                    <Text className="text-center text-xs font-semibold text-white">View</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))
        )}
      </View>

      {/* Feature Info */}
      <View className="mt-8 rounded-[24px] bg-[#f3f5f9] p-6">
        <View className="flex-row gap-3 mb-3">
          <Ionicons name="information-circle" size={24} color="#4a53ff" />
          <Text className="flex-1 text-sm font-semibold text-black">About Premium Reports</Text>
        </View>
        <Text className="text-sm leading-6 text-[#808080]">
          Each week, generate a beautiful visual report showcasing your fitness performance. Share your achievements on social
          media to inspire your community.
        </Text>
      </View>
    </ScrollView>
  );
}
