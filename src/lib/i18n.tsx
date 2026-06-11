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
  localeSource: "device" | "ip" | "manual";
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
  const [detectedLocale, setDetectedLocale] = useState<AppLocale>(detectDeviceLocale);
  const [localeSource, setLocaleSource] = useState<"device" | "ip">("device");
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

  useEffect(() => {
    let isMounted = true;

    detectIpLocale()
      .then((ipLocale) => {
        if (isMounted && ipLocale) {
          setDetectedLocale(ipLocale);
          setLocaleSource("ip");
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const locale = manualLocale ?? detectedLocale;

    return {
      detectedLocale,
      locale,
      localeSource: manualLocale ? "manual" : localeSource,
      setManualLocale: (nextLocale) => {
        setManualLocaleState(nextLocale);
        void AsyncStorage.setItem(STORAGE_KEY, nextLocale);
      },
      t: (key) => translations[locale][key]
    };
  }, [detectedLocale, localeSource, manualLocale]);

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
  if (Platform.OS === "web" && typeof navigator !== "undefined") {
    const browserLocale = navigator.languages?.[0] ?? navigator.language;
    const browserLanguageCode = String(browserLocale ?? "en").slice(0, 2).toLowerCase();

    if (isAppLocale(browserLanguageCode)) {
      return browserLanguageCode;
    }
  }

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

async function detectIpLocale(): Promise<AppLocale | null> {
  if (Platform.OS !== "web" || typeof fetch === "undefined") {
    return null;
  }

  const countryCode = await fetchIpCountryCode();

  if (!countryCode) {
    return null;
  }

  return localeFromCountryCode(countryCode);
}

async function fetchIpCountryCode() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch("https://ipwho.is/", {
      signal: controller.signal
    });
    const data = (await response.json()) as { country_code?: string; success?: boolean };

    if (data.success === false) {
      return null;
    }

    return data.country_code?.toUpperCase() ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function localeFromCountryCode(countryCode: string): AppLocale {
  const normalizedCountry = countryCode.toUpperCase();

  if (["DE", "AT", "CH", "LI", "LU"].includes(normalizedCountry)) {
    return "de";
  }

  if (
    [
      "AR",
      "BO",
      "CL",
      "CO",
      "CR",
      "CU",
      "DO",
      "EC",
      "ES",
      "GT",
      "HN",
      "MX",
      "NI",
      "PA",
      "PE",
      "PR",
      "PY",
      "SV",
      "UY",
      "VE"
    ].includes(normalizedCountry)
  ) {
    return "es";
  }

  return "en";
}

function isAppLocale(value: unknown): value is AppLocale {
  return value === "en" || value === "es" || value === "de";
}
