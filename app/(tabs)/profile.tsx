import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { PremiumCheckoutModal } from "../../src/components/premium-checkout-modal";
import { AmplitudeService } from "../../src/services/amplitude-service";
import { RevenueCatService, type RevenueCatProductId } from "../../src/services/revenuecat-service";

const achievements = [
  { detail: "6 day active streak", title: "Consistency" },
  { detail: "First live GPS run saved", title: "Road Ready" },
  { detail: "3 strength sessions this week", title: "Strength Block" }
];

export default function ProfileScreen() {
  const params = useLocalSearchParams<{ paywall?: string }>();
  const [isPremiumOpen, setIsPremiumOpen] = useState(false);
  const [isPlanOpen, setIsPlanOpen] = useState(false);
  const [premiumFeedback, setPremiumFeedback] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("xpirit_premium_monthly_299");

  useEffect(() => {
    if (params.paywall === "1") {
      setSelectedPlanId("xpirit_premium_monthly_299");
      setIsPremiumOpen(true);
    }
  }, [params.paywall]);

  const openPremiumPaywall = () => {
    setSelectedPlanId("xpirit_premium_monthly_299");
    setPremiumFeedback(null);
    setIsPremiumOpen(true);
    AmplitudeService.track("premium_paywall_opened", {
      source: "profile_report"
    });
  };

  const handlePayForReport = async () => {
    setPremiumFeedback(null);
    AmplitudeService.track("premium_purchase_started", {
      product_id: selectedPlanId
    });
    const purchase = await RevenueCatService.purchaseProduct(selectedPlanId as RevenueCatProductId);

    if (!purchase.isActive) {
      AmplitudeService.track("premium_purchase_not_completed", {
        product_id: selectedPlanId,
        status: purchase.status
      });
      const messageByStatus = {
        cancelled: "Purchase cancelled.",
        configured: "RevenueCat is configured. Choose a product to continue.",
        missing_api_key: "RevenueCat iOS or Android public SDK key is missing.",
        purchased: "Purchase completed, but entitlement is not active yet.",
        unavailable: "This product is not available in the current RevenueCat offering."
      };
      setPremiumFeedback(messageByStatus[purchase.status]);
      return;
    }

    setIsPremiumOpen(false);
    setIsPlanOpen(false);
    AmplitudeService.track("premium_purchase_completed", {
      entitlement_id: purchase.entitlementId,
      product_id: selectedPlanId
    });
    router.push("/report");
  };

  const handleRestorePurchases = async () => {
    setPremiumFeedback(null);
    AmplitudeService.track("premium_restore_started");
    const entitlements = await RevenueCatService.restorePurchases();

    if (entitlements.premiumReports || entitlements.eliteAnalytics) {
      setIsPremiumOpen(false);
      setIsPlanOpen(false);
      AmplitudeService.track("premium_restore_completed", entitlements);
      router.push("/report");
      return;
    }

    AmplitudeService.track("premium_restore_empty");
    setPremiumFeedback("No active Xpirit subscription was found.");
  };

  return (
    <>
      <ScrollView className="flex-1 bg-white px-5 pt-14" contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="flex-row items-center gap-4">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-black">
            <Text className="text-2xl font-semibold text-white">A</Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-5xl font-normal leading-[44px] tracking-[-2px] text-black" numberOfLines={1} adjustsFontSizeToFit>
              Profile
            </Text>
            <Text className="mt-1 text-base text-[#808080]">Xpirit athlete</Text>
          </View>
        </View>

        <View className="mt-6 flex-row gap-3">
          <View className="flex-1 rounded-[24px] bg-[#f3f5f9] p-5">
            <Text className="text-sm font-semibold uppercase tracking-widest text-[#808080]">Streak</Text>
            <Text className="mt-2 text-4xl font-normal tracking-[-1px] text-black">6</Text>
            <Text className="text-base font-semibold text-[#4a53ff]">days</Text>
          </View>
          <View className="flex-1 rounded-[24px] bg-[#f3f5f9] p-5">
            <Text className="text-sm font-semibold uppercase tracking-widest text-[#808080]">Achievements</Text>
            <Text className="mt-2 text-4xl font-normal tracking-[-1px] text-black">12</Text>
            <Text className="text-base font-semibold text-[#4a53ff]">active</Text>
          </View>
        </View>

        <View className="mt-5 rounded-[24px] bg-[#f3f5f9] p-5">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-xl font-semibold tracking-[-0.6px] text-black">Achievements</Text>
            <Text className="shrink text-right text-base text-[#808080]">Active now</Text>
          </View>
          <View className="mt-4 gap-3">
            {achievements.map((item) => (
              <View key={item.title} className="flex-row items-center justify-between gap-3 rounded-[24px] bg-white p-4">
                <View className="min-w-0 flex-1">
                  <Text className="text-base font-semibold text-black" numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text className="mt-1 text-base text-[#808080]">{item.detail}</Text>
                </View>
                <View className="h-3 w-3 rounded-full bg-[#4a53ff]" />
              </View>
            ))}
          </View>
        </View>

        <View className="mt-5 rounded-[24px] bg-[#f3f5f9] p-5">
          <Text className="text-xl font-semibold tracking-[-0.6px] text-black">Information</Text>
          <View className="mt-4 gap-3">
            <View className="flex-row justify-between gap-4">
              <Text className="text-base text-[#808080]">Integrations</Text>
              <Text className="min-w-0 flex-1 text-right text-base font-semibold text-black">Native health pending</Text>
            </View>
            <View className="flex-row justify-between gap-4">
              <Text className="text-base text-[#808080]">Plan</Text>
              <Text className="text-base font-semibold text-black">Free</Text>
            </View>
          </View>
        </View>

        <View className="mt-5 rounded-[24px] bg-black p-5">
          <Text className="text-xl font-semibold tracking-[-0.6px] text-white">Visual Reports</Text>
          <Text className="mt-2 text-base leading-6 text-[#999999]">Activate the 9:16 report to share progress, mileage, volume, and recovery.</Text>
          <Pressable className="mt-4 rounded-full bg-white px-6 py-4" onPress={openPremiumPaywall}>
            <Text className="text-center text-sm font-semibold uppercase tracking-widest text-black">View Report</Text>
          </Pressable>
        </View>
      </ScrollView>
      <PremiumCheckoutModal
        feedbackMessage={premiumFeedback}
        isPlanOpen={isPlanOpen}
        onClose={() => {
          setIsPremiumOpen(false);
          setIsPlanOpen(false);
          setPremiumFeedback(null);
        }}
        onPay={handlePayForReport}
        onRestore={handleRestorePurchases}
        onSelectPlan={(planId) => {
          setSelectedPlanId(planId);
          setIsPlanOpen(false);
          setPremiumFeedback(null);
          AmplitudeService.track("premium_plan_selected", {
            product_id: planId
          });
        }}
        onTogglePlan={() => setIsPlanOpen((value) => !value)}
        selectedPlanId={selectedPlanId}
        visible={isPremiumOpen}
      />
    </>
  );
}
