import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";

import { xpiritPlans } from "@/services/revenuecat-service";

type PremiumCheckoutModalProps = {
  feedbackMessage?: string | null;
  isPlanOpen: boolean;
  onClose: () => void;
  onPay: () => void;
  onRestore: () => void;
  onSelectPlan: (planId: string) => void;
  onTogglePlan: () => void;
  selectedPlanId: string;
  visible: boolean;
};

export function PremiumCheckoutModal({
  feedbackMessage,
  isPlanOpen,
  onClose,
  onPay,
  onRestore,
  onSelectPlan,
  onTogglePlan,
  selectedPlanId,
  visible
}: PremiumCheckoutModalProps) {
  const [billingEmail, setBillingEmail] = useState("");
  const [billingName, setBillingName] = useState("");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const selectedPlan = xpiritPlans.find((plan) => plan.id === selectedPlanId) ?? xpiritPlans[0];
  const isElitePlan = selectedPlan.id === "xpirit_elite_monthly_799";
  const planBenefits = isElitePlan
    ? [
        "Everything in Premium",
        "Add wearables like Oura into your Xpirit ecosystem",
        "Advanced recovery, readiness, and performance insights"
      ]
    : ["Share 9:16 performance cards", "Unlock recovery and training insights", "Restore purchases on every device"];

  useEffect(() => {
    if (!visible) {
      setIsCheckoutOpen(false);
    }
  }, [visible]);

  const closeModal = () => {
    setIsCheckoutOpen(false);
    onClose();
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={closeModal}>
      <View className="flex-1 justify-end bg-black/35">
        <View className="rounded-t-[32px] bg-[#050507] px-5 pb-8 pt-5">
          <View className="mb-4 flex-row items-center justify-between">
            <View>
              <Text className="text-sm font-semibold uppercase tracking-widest text-[#7b7b84]">
                {isCheckoutOpen ? "Secure checkout" : "Premium"}
              </Text>
              <Text className="mt-1 text-3xl font-semibold tracking-[-1px] text-white">
                {isCheckoutOpen ? "Complete purchase" : "Unlock Xpirit"}
              </Text>
            </View>
            <Pressable className="h-11 w-11 items-center justify-center rounded-full bg-[#15151b]" onPress={closeModal}>
              <Ionicons name="close" size={22} color="#ffffff" />
            </Pressable>
          </View>

          {isCheckoutOpen ? (
            <>
              <View className="mb-5 rounded-[24px] border border-[#24242a] bg-[#0d0d11] p-5">
                <View className="flex-row items-start justify-between gap-4">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold uppercase tracking-widest text-[#7b7b84]">Selected plan</Text>
                    <Text className="mt-2 text-2xl font-semibold tracking-[-0.8px] text-white">{selectedPlan.label}</Text>
                    <Text className="mt-1 text-sm leading-5 text-[#9a9aa3]">{selectedPlan.summary}</Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-3xl font-semibold tracking-[-1px] text-white">{selectedPlan.price}</Text>
                    <Text className="text-[10px] font-semibold uppercase tracking-widest text-[#7b7b84]">Monthly</Text>
                  </View>
                </View>
              </View>

              <View className="gap-3 rounded-[24px] border border-[#24242a] bg-[#0d0d11] p-4">
                <Text className="text-sm font-semibold uppercase tracking-widest text-[#7b7b84]">Billing details</Text>
                <TextInput
                  autoCapitalize="words"
                  className="h-14 rounded-[24px] border border-[#2c2c33] bg-[#15151b] px-4 text-base text-white"
                  onChangeText={setBillingName}
                  placeholder="Full name"
                  placeholderTextColor="#6f6f78"
                  value={billingName}
                />
                <TextInput
                  autoCapitalize="none"
                  className="h-14 rounded-[24px] border border-[#2c2c33] bg-[#15151b] px-4 text-base text-white"
                  keyboardType="email-address"
                  onChangeText={setBillingEmail}
                  placeholder="Email"
                  placeholderTextColor="#6f6f78"
                  value={billingEmail}
                />
                <View className="rounded-[24px] border border-[#2c2c33] bg-[#15151b] p-4">
                  <View className="flex-row items-center gap-3">
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-[#4a53ff]">
                      <Ionicons name="lock-closed" size={18} color="#ffffff" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-white">Store payment</Text>
                      <Text className="mt-1 text-sm leading-5 text-[#8f8f98]">
                        Card details are confirmed securely by the App Store or Google Play.
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <Pressable className="mt-5 h-[60px] items-center justify-center rounded-[300px] bg-[#4a53ff] px-6" onPress={onPay}>
                <Text className="text-center text-sm font-semibold uppercase tracking-widest text-white">
                  Confirm with store - {selectedPlan.price}
                </Text>
              </Pressable>

              <Pressable className="mt-4 h-11 items-center justify-center rounded-[300px]" onPress={() => setIsCheckoutOpen(false)}>
                <Text className="text-sm font-semibold text-[#c8c8cf]">Back to plans</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View className="mb-5 rounded-[24px] border border-[#24242a] bg-[#0d0d11] p-5">
                <Text className="text-4xl font-normal tracking-[-1.4px] text-white">
                  {isElitePlan ? "Elite ecosystem." : "Reports without limits."}
                </Text>
                <View className="mt-5 gap-3">
                  {planBenefits.map((benefit) => (
                    <View key={benefit} className="flex-row items-center gap-3">
                      <View className="h-7 w-7 items-center justify-center rounded-full bg-[#4a53ff]">
                        <Ionicons name="checkmark" size={16} color="#ffffff" />
                      </View>
                      <Text className="flex-1 text-base text-[#c8c8cf]">{benefit}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <Pressable className="rounded-[24px] border border-[#2c2c33] bg-[#15151b] p-4" onPress={onTogglePlan}>
                <View className="flex-row items-center justify-between gap-4">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-white">{selectedPlan.label}</Text>
                    <Text className="mt-1 text-sm text-[#8f8f98]">{selectedPlan.summary}</Text>
                  </View>
                  <Text className="text-2xl font-semibold text-white">{selectedPlan.price}</Text>
                  <Ionicons name={isPlanOpen ? "chevron-up" : "chevron-down"} size={18} color="#4a53ff" />
                </View>
              </Pressable>

              {isPlanOpen ? (
                <View className="mt-2 gap-2 rounded-[24px] border border-[#24242a] bg-[#0d0d11] p-2">
                  {xpiritPlans.map((plan) => (
                    <Pressable
                      key={plan.id}
                      className={`rounded-[20px] border p-4 ${
                        plan.id === selectedPlanId ? "border-[#4a53ff] bg-[#15151b]" : "border-transparent bg-transparent"
                      }`}
                      onPress={() => onSelectPlan(plan.id)}
                    >
                      <View className="flex-row items-center justify-between gap-4">
                        <View className="flex-1">
                          <Text className="text-base font-semibold text-white">{plan.label}</Text>
                          <Text className="mt-1 text-sm text-[#8f8f98]">{plan.summary}</Text>
                        </View>
                        <View className="items-end">
                          <Text className="text-xl font-semibold text-white">{plan.price}</Text>
                          <Text className="text-[10px] font-semibold uppercase tracking-widest text-[#7b7b84]">Monthly</Text>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <Pressable className="mt-5 h-[60px] items-center justify-center rounded-[300px] bg-[#4a53ff] px-6" onPress={() => setIsCheckoutOpen(true)}>
                <Text className="text-center text-sm font-semibold uppercase tracking-widest text-white">
                  Continue - {selectedPlan.price}
                </Text>
              </Pressable>

              <Pressable className="mt-4 h-11 items-center justify-center rounded-[300px]" onPress={onRestore}>
                <Text className="text-sm font-semibold text-[#c8c8cf]">Restore Purchases</Text>
              </Pressable>
            </>
          )}

          {feedbackMessage ? <Text className="mt-2 text-center text-sm leading-5 text-[#ffce6b]">{feedbackMessage}</Text> : null}

          <Text className="mt-3 text-center text-xs leading-5 text-[#808080]">
            Payment is confirmed by the App Store or Google Play. Cancel anytime from your subscription settings.
          </Text>
        </View>
      </View>
    </Modal>
  );
}
