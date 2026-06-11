import * as amplitude from "@amplitude/unified";
import { Platform } from "react-native";

const AMPLITUDE_API_KEY = process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY ?? "8aaa7bc0644323a640f886c680f318b7";

let initializePromise: Promise<void> | null = null;
let isInitialized = false;

export const AmplitudeService = {
  initOnce() {
    if (!canUseAmplitude()) {
      return null;
    }

    if (!initializePromise) {
      initializePromise = amplitude
        .initAll(AMPLITUDE_API_KEY, {
          analytics: {
            autocapture: true
          },
          serverZone: "EU",
          sessionReplay: {
            sampleRate: 1
          }
        })
        .then(() => {
          isInitialized = true;
          amplitude.track("app_opened", {
            platform: Platform.OS
          });
        })
        .catch((error) => {
          initializePromise = null;

          if (__DEV__) {
            console.warn("[AmplitudeService:initOnce]", error);
          }
        });
    }

    return initializePromise;
  },

  identifyUser(userId: string, properties: Record<string, unknown> = {}) {
    if (!canUseAmplitude()) {
      return;
    }

    void this.initOnce()?.then(() => {
      if (isInitialized) {
        amplitude.setUserId(userId);
        amplitude.track("user_identified", properties);
      }
    });
  },

  track(eventName: string, properties: Record<string, unknown> = {}) {
    if (!canUseAmplitude()) {
      return;
    }

    void this.initOnce()?.then(() => {
      if (isInitialized) {
        amplitude.track(eventName, {
          platform: Platform.OS,
          ...properties
        });
      }
    });
  },

  trackScreen(screenName: string, properties: Record<string, unknown> = {}) {
    this.track("screen_viewed", {
      screen_name: screenName,
      ...properties
    });
  }
};

function canUseAmplitude() {
  return Platform.OS === "web" && typeof window !== "undefined" && Boolean(AMPLITUDE_API_KEY);
}
