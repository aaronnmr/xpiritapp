import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";

import { useI18n } from "@/lib/i18n";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { AmplitudeService } from "@/services/amplitude-service";
import { requestNativeHealthRepositoryPermissions } from "@/services/health-workout-writer";
import { RevenueCatService } from "@/services/revenuecat-service";
import { XpiritDataService } from "@/services/xpirit-data-service";

WebBrowser.maybeCompleteAuthSession();

type AuthProvider = "apple" | "email" | "google";
type AuthStatus = "idle" | "authenticating" | "requesting-health" | "routing";

const googleClientIds = {
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
};
const productionWebRedirectUrl = "https://xpiritapp.vercel.app";
const configuredWebRedirectUrl = process.env.EXPO_PUBLIC_APP_URL;

export function useFrictionlessAuth() {
  const { locale } = useI18n();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>("idle");
  const completedSessionRef = useRef<string | null>(null);

  const hasGoogleClientId = useMemo(() => {
    const platformClientId = Platform.select({
      android: googleClientIds.androidClientId,
      ios: googleClientIds.iosClientId,
      default: googleClientIds.webClientId
    });

    return Boolean(platformClientId || googleClientIds.webClientId);
  }, []);

  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest({
    androidClientId: googleClientIds.androidClientId ?? "missing-google-android-client-id",
    iosClientId: googleClientIds.iosClientId ?? "missing-google-ios-client-id",
    scopes: ["openid", "profile", "email"],
    selectAccount: true,
    webClientId: googleClientIds.webClientId ?? "missing-google-web-client-id"
  });

  useEffect(() => {
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const finishExistingSession = (userId: string, rawProvider?: string) => {
      const provider = normalizeAuthProvider(rawProvider);
      void completeAuthenticatedSession(provider, userId).catch(handleAuthError);
    };

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data.session?.user.id) {
          finishExistingSession(data.session.user.id, data.session.user.app_metadata?.provider);
        }
      })
      .catch(() => undefined);

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user.id) {
        finishExistingSession(session.user.id, session.user.app_metadata?.provider);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (googleResponse?.type !== "success") {
      return;
    }

    const idToken = googleResponse.params.id_token;

    if (!idToken) {
      setErrorMessage("Google did not return an identity token.");
      setStatus("idle");
      return;
    }

    void finishSupabaseIdTokenAuth({
      accessToken: googleResponse.params.access_token,
      idToken,
      nonce: googleRequest?.nonce,
      provider: "google"
    });
  }, [googleRequest?.nonce, googleResponse]);

  const signInWithApple = async () => {
    clearFeedback();
    AmplitudeService.track("auth_apple_pressed");

    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage("Supabase is not configured for authentication.");
      return;
    }

    if (!appleAvailable) {
      setErrorMessage("Apple authentication is not available on this device.");
      return;
    }

    setStatus("authenticating");

    try {
      const rawNonce = createNonce();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const credential = await AppleAuthentication.signInAsync({
        nonce: hashedNonce,
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL
        ]
      });

      if (!credential.identityToken) {
        throw new Error("Apple did not return an identity token.");
      }

      await finishSupabaseIdTokenAuth({
        idToken: credential.identityToken,
        nonce: rawNonce,
        provider: "apple"
      });
    } catch (error) {
      handleAuthError(error);
    }
  };

  const signInWithGoogle = async () => {
    clearFeedback();
    AmplitudeService.track("auth_google_pressed");

    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage("Supabase is not configured for authentication.");
      return;
    }

    if (Platform.OS !== "web" && !hasGoogleClientId) {
      setErrorMessage("Google OAuth client IDs are missing.");
      return;
    }

    setStatus("authenticating");

    if (Platform.OS === "web" && typeof window !== "undefined") {
      const { error } = await supabase.auth.signInWithOAuth({
        options: {
          queryParams: {
            access_type: "offline",
            prompt: "select_account"
          },
          redirectTo: getWebOAuthRedirectUrl()
        },
        provider: "google"
      });

      if (error) {
        handleAuthError(error);
        return;
      }

      return;
    }

    const result = await promptGoogleAsync();

    if (result.type !== "success") {
      setStatus("idle");
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    clearFeedback();
    AmplitudeService.track("auth_email_pressed", { locale });

    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage("Supabase is not configured for authentication.");
      return;
    }

    setStatus("authenticating");

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });

      if (signInData.user) {
        await completeAuthenticatedSession("email", signInData.user.id);
        return;
      }

      if (signInError) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: normalizedEmail,
          options: {
            data: {
              locale
            }
          },
          password
        });

        if (signUpError) {
          throw signUpError;
        }

        if (signUpData.user) {
          await completeAuthenticatedSession("email", signUpData.user.id);
          return;
        }
      }

      throw new Error("Email authentication could not be completed.");
    } catch (error) {
      handleAuthError(error);
    }
  };

  const finishSupabaseIdTokenAuth = async ({
    accessToken,
    idToken,
    nonce,
    provider
  }: {
    accessToken?: string;
    idToken: string;
    nonce?: string;
    provider: AuthProvider;
  }) => {
    if (!supabase) {
      throw new Error("Supabase is not configured for authentication.");
    }

    setStatus("authenticating");

    const { data, error } = await supabase.auth.signInWithIdToken({
      access_token: accessToken,
      nonce,
      provider,
      token: idToken
    });

    if (error) {
      throw error;
    }

    if (data.user?.id) {
      await completeAuthenticatedSession(provider, data.user.id);
    }
  };

  const completeAuthenticatedSession = async (provider: AuthProvider, userId: string) => {
    if (!supabase) {
      throw new Error("Supabase is not configured for authentication.");
    }

    const sessionKey = `${provider}:${userId}`;

    if (completedSessionRef.current === sessionKey) {
      return;
    }

    completedSessionRef.current = sessionKey;
    AmplitudeService.identifyUser(userId, { locale, provider });
    AmplitudeService.track("auth_completed", { locale, provider });

    try {
      await XpiritDataService.ensureProfile(locale);
      await XpiritDataService.registerDevice(`expo-${Platform.OS}`, {
        auth_provider: provider,
        locale
      });
      await XpiritDataService.trackEvent("auth_completed", "auth", { locale, provider });
      await RevenueCatService.configure(userId);
      await supabase.from("profiles").update({ locale, revenuecat_app_user_id: userId }).eq("id", userId);

      setStatus("requesting-health");
      const healthPermissions = await requestNativeHealthRepositoryPermissions();

      setStatus("routing");

      if (healthPermissions.granted) {
        router.replace("/home");
        return;
      }

      router.replace("/manual-entry-notice");
    } catch (error) {
      completedSessionRef.current = null;
      throw error;
    }
  };

  const clearFeedback = () => {
    setErrorMessage(null);
    setStatus("idle");
  };

  const handleAuthError = (error: unknown) => {
    if (isAppleCancel(error)) {
      setStatus("idle");
      return;
    }

    setErrorMessage(error instanceof Error ? error.message : "Authentication failed.");
    setStatus("idle");
  };

  return {
    appleAvailable,
    errorMessage,
    isBusy: status !== "idle",
    signInWithApple,
    signInWithEmail,
    signInWithGoogle,
    status
  };
}

function createNonce() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function isAppleCancel(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ERR_REQUEST_CANCELED";
}

function getWebOAuthRedirectUrl() {
  if (configuredWebRedirectUrl?.startsWith("https://")) {
    return configuredWebRedirectUrl;
  }

  if (typeof window === "undefined") {
    return productionWebRedirectUrl;
  }

  const currentOrigin = window.location.origin;

  if (currentOrigin.startsWith("https://")) {
    return currentOrigin;
  }

  return productionWebRedirectUrl;
}

function normalizeAuthProvider(provider?: string): AuthProvider {
  if (provider === "apple" || provider === "email" || provider === "google") {
    return provider;
  }

  return "google";
}
