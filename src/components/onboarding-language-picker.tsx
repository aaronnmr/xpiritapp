import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { type AppLocale, useI18n } from "@/lib/i18n";
import { AmplitudeService } from "@/services/amplitude-service";

const languageOptions: Array<{ code: AppLocale; label: string; shortLabel: string }> = [
  { code: "en", label: "English", shortLabel: "EN" },
  { code: "es", label: "Español", shortLabel: "ES" },
  { code: "de", label: "Deutsch", shortLabel: "DE" }
];

export function OnboardingLanguagePicker() {
  const { locale, setManualLocale, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const selectedLanguage = languageOptions.find((option) => option.code === locale) ?? languageOptions[0];

  const selectLanguage = (nextLocale: AppLocale) => {
    setManualLocale(nextLocale);
    setIsOpen(false);
    AmplitudeService.track("onboarding_language_selected", {
      locale: nextLocale
    });
  };

  return (
    <>
      <Pressable
        accessibilityLabel={t("language.title")}
        className="absolute right-6 top-14 z-10 h-11 flex-row items-center gap-2 rounded-[300px] border border-[#2c2c33] bg-[#15151b] px-4"
        onPress={() => {
          setIsOpen(true);
          AmplitudeService.track("onboarding_language_picker_opened", {
            locale
          });
        }}
      >
        <Ionicons name="language" size={18} color="#ffffff" />
        <Text className="text-xs font-semibold uppercase tracking-widest text-white">{selectedLanguage.shortLabel}</Text>
      </Pressable>

      <Modal animationType="fade" transparent visible={isOpen} onRequestClose={() => setIsOpen(false)}>
        <Pressable className="flex-1 bg-black/45 px-6 pt-14" onPress={() => setIsOpen(false)}>
          <Pressable className="ml-auto w-[230px] rounded-[24px] border border-[#24242a] bg-[#0d0d11] p-2" onPress={() => undefined}>
            <Text className="px-3 py-3 text-xs font-semibold uppercase tracking-widest text-[#7b7b84]">{t("language.title")}</Text>
            <View className="gap-1">
              {languageOptions.map((option) => {
                const isSelected = option.code === locale;

                return (
                  <Pressable
                    key={option.code}
                    className={`h-[52px] flex-row items-center justify-between rounded-[300px] px-4 py-3 ${
                      isSelected ? "bg-white" : "bg-transparent"
                    }`}
                    onPress={() => selectLanguage(option.code)}
                  >
                    <Text className={`text-base font-semibold ${isSelected ? "text-[#050507]" : "text-white"}`}>{option.label}</Text>
                    {isSelected ? <Ionicons name="checkmark" size={18} color="#050507" /> : null}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
