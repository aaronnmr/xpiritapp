import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { AmplitudeService } from "@/services/amplitude-service";
import { requestNativeHealthRepositoryPermissions } from "@/services/health-workout-writer";
import { RevenueCatService } from "@/services/revenuecat-service";
import { XpiritDataService } from "@/services/xpirit-data-service";

WebBrowser.maybeCompleteAuthSession();

type AuthProvider = "apple" | "google";
type AuthStatus = "idle" | "authenticating" | "requesting-health" | "routing";

const googleClientIds = {
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
};

export function useFrictionlessAuth() {
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>("idle");

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

    if (!hasGoogleClientId) {
      setErrorMessage("Google OAuth client IDs are missing.");
      return;
    }

    setStatus("authenticating");
    const result = await promptGoogleAsync();

    if (result.type !== "success") {
      setStatus("idle");
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
      AmplitudeService.identifyUser(data.user.id, { provider });
      AmplitudeService.track("auth_completed", { provider });
      await XpiritDataService.ensureProfile();
      await XpiritDataService.registerDevice(`expo-${Platform.OS}`, {
        auth_provider: provider
      });
      await XpiritDataService.trackEvent("auth_completed", "auth", { provider });
      await RevenueCatService.configure(data.user.id);
      await supabase.from("profiles").update({ revenuecat_app_user_id: data.user.id }).eq("id", data.user.id);
    }

    setStatus("requesting-health");
    const healthPermissions = await requestNativeHealthRepositoryPermissions();

    setStatus("routing");

    if (healthPermissions.granted) {
      router.replace("/home");
      return;
    }

    router.replace("/manual-entry-notice");
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
