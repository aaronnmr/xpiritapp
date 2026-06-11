import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { NativeModules, Platform } from "react-native";

export type AppLocale = "en" | "es" | "de";

type TranslationKey =
  | "auth.apple"
  | "auth.card.body"
  | "auth.card.title"
  | "auth.google"
  | "auth.helper"
  | "auth.status.authenticating"
  | "auth.status.requestingHealth"
  | "auth.status.routing"
  | "auth.subtitle"
  | "language.title";

type I18nContextValue = {
  detectedLocale: AppLocale;
  locale: AppLocale;
  setManualLocale: (locale: AppLocale) => void;
  t: (key: TranslationKey) => string;
};

const STORAGE_KEY = "xpirit.locale.override";

const translations: Record<AppLocale, Record<TranslationKey, string>> = {
  de: {
    "auth.apple": "Mit Apple fortfahren",
    "auth.card.body":
      "Einmal anmelden. Xpirit verknupft deine sichere Supabase-Identitat, erstellt dein kostenloses Profil und fragt danach nach biometrischen Berechtigungen.",
    "auth.card.title": "Reibungsloser Zugang",
    "auth.google": "Mit Google fortfahren",
    "auth.helper": "OAuth erstellt dein privates Xpirit-Profil und bereitet die biometrische Synchronisierung vor.",
    "auth.status.authenticating": "Identitat wird gesichert",
    "auth.status.requestingHealth": "Zugriff auf Gesundheitsdaten wird angefragt",
    "auth.status.routing": "Dashboard wird aufgebaut",
    "auth.subtitle": "Verfolge dein Ziel. Erhole dich mit Absicht.",
    "language.title": "Sprache"
  },
  en: {
    "auth.apple": "Continue with Apple",
    "auth.card.body":
      "Sign in once. Xpirit links your secure Supabase identity, creates your free profile, then asks for biometric repository permissions.",
    "auth.card.title": "Frictionless access",
    "auth.google": "Continue with Google",
    "auth.helper": "OAuth creates your private Xpirit profile and prepares biometric sync.",
    "auth.status.authenticating": "Securing identity",
    "auth.status.requestingHealth": "Requesting health repository access",
    "auth.status.routing": "Building your dashboard",
    "auth.subtitle": "Track your goal. Recover with intent.",
    "language.title": "Language"
  },
  es: {
    "auth.apple": "Continuar con Apple",
    "auth.card.body":
      "Inicia sesion una vez. Xpirit conecta tu identidad segura de Supabase, crea tu perfil gratuito y despues solicita permisos biometricos.",
    "auth.card.title": "Acceso sin friccion",
    "auth.google": "Continuar con Google",
    "auth.helper": "OAuth crea tu perfil privado de Xpirit y prepara la sincronizacion biometrica.",
    "auth.status.authenticating": "Protegiendo identidad",
    "auth.status.requestingHealth": "Solicitando acceso a datos de salud",
    "auth.status.routing": "Creando tu dashboard",
    "auth.subtitle": "Sigue tu objetivo. Recupera con intencion.",
    "language.title": "Idioma"
  }
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [detectedLocale] = useState<AppLocale>(detectDeviceLocale);
  const [manualLocale, setManualLocaleState] = useState<AppLocale | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((storedLocale) => {
        if (isAppLocale(storedLocale)) {
          setManualLocaleState(storedLocale);
        }
      })
      .catch(() => undefined);
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const locale = manualLocale ?? detectedLocale;

    return {
      detectedLocale,
      locale,
      setManualLocale: (nextLocale) => {
        setManualLocaleState(nextLocale);
        void AsyncStorage.setItem(STORAGE_KEY, nextLocale);
      },
      t: (key) => translations[locale][key]
    };
  }, [detectedLocale, manualLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider.");
  }

  return context;
}

function detectDeviceLocale(): AppLocale {
  const rawLocale =
    Platform.OS === "ios"
      ? NativeModules.SettingsManager?.settings?.AppleLocale ?? NativeModules.SettingsManager?.settings?.AppleLanguages?.[0]
      : NativeModules.I18nManager?.localeIdentifier;

  const languageCode = String(rawLocale ?? "en").slice(0, 2).toLowerCase();

  if (languageCode === "es" || languageCode === "de") {
    return languageCode;
  }

  return "en";
}

function isAppLocale(value: unknown): value is AppLocale {
  return value === "en" || value === "es" || value === "de";
}
