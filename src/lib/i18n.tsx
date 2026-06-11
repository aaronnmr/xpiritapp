import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { NativeModules, Platform } from "react-native";

export type AppLocale = "en" | "es" | "de";

type TranslationKey =
  | "auth.apple"
  | "auth.email"
  | "auth.emailCta"
  | "auth.emailHelper"
  | "auth.emailRequired"
  | "auth.google"
  | "auth.helper"
  | "auth.orGoogle"
  | "auth.password"
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
    "auth.email": "E-Mail",
    "auth.emailCta": "Mit E-Mail fortfahren",
    "auth.emailHelper": "Melde dich an oder erstelle ein Konto mit E-Mail und Passwort.",
    "auth.emailRequired": "Gib deine E-Mail und dein Passwort ein.",
    "auth.google": "Mit Google fortfahren",
    "auth.helper": "OAuth erstellt dein privates Xpirit-Profil und bereitet die biometrische Synchronisierung vor.",
    "auth.orGoogle": "Oder weiter mit",
    "auth.password": "Passwort",
    "auth.status.authenticating": "Identitat wird gesichert",
    "auth.status.requestingHealth": "Zugriff auf Gesundheitsdaten wird angefragt",
    "auth.status.routing": "Dashboard wird aufgebaut",
    "auth.subtitle": "Verfolge dein Ziel. Erhole dich mit Absicht.",
    "language.title": "Sprache"
  },
  en: {
    "auth.apple": "Continue with Apple",
    "auth.email": "Email",
    "auth.emailCta": "Continue with Email",
    "auth.emailHelper": "Sign in or create an account with your email and password.",
    "auth.emailRequired": "Enter your email and password.",
    "auth.google": "Continue with Google",
    "auth.helper": "OAuth creates your private Xpirit profile and prepares biometric sync.",
    "auth.orGoogle": "Or continue with",
    "auth.password": "Password",
    "auth.status.authenticating": "Securing identity",
    "auth.status.requestingHealth": "Requesting health repository access",
    "auth.status.routing": "Building your dashboard",
    "auth.subtitle": "Track your goal. Recover with intent.",
    "language.title": "Language"
  },
  es: {
    "auth.apple": "Continuar con Apple",
    "auth.email": "Email",
    "auth.emailCta": "Continuar con Email",
    "auth.emailHelper": "Inicia sesion o crea una cuenta con tu email y contrasena.",
    "auth.emailRequired": "Introduce tu email y contrasena.",
    "auth.google": "Continuar con Google",
    "auth.helper": "OAuth crea tu perfil privado de Xpirit y prepara la sincronizacion biometrica.",
    "auth.orGoogle": "O continua con",
    "auth.password": "Contrasena",
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
