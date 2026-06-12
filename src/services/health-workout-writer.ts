import { Platform } from "react-native";

export type UnifiedWorkout = {
  distanceMeters: number;
  durationSeconds: number;
  endedAt: string;
  id: string;
  paceSecondsPerKm: number | null;
  route: Array<{
    latitude: number;
    longitude: number;
    timestamp: number;
  }>;
  source: "xpirit_gps";
  startedAt: string;
  type: "run";
};

export type HealthWriteResult = {
  provider: "apple_healthkit" | "health_connect" | "unsupported";
  status: "saved" | "unavailable";
};

export type HealthPermissionResult = {
  granted: boolean;
  provider: "apple_healthkit" | "health_connect" | "unsupported";
  status: "granted" | "denied" | "unavailable";
};

export async function requestNativeHealthRepositoryPermissions(): Promise<HealthPermissionResult> {
  if (Platform.OS === "ios") {
    return requestAppleHealthKitPermissions();
  }

  if (Platform.OS === "android") {
    return requestHealthConnectPermissions();
  }

  return { granted: false, provider: "unsupported", status: "unavailable" };
}

export async function saveWorkoutToNativeHealth(workout: UnifiedWorkout): Promise<HealthWriteResult> {
  if (Platform.OS === "ios") {
    return saveToAppleHealthKit(workout);
  }

  if (Platform.OS === "android") {
    return saveToHealthConnect(workout);
  }

  return { provider: "unsupported", status: "unavailable" };
}

async function saveToAppleHealthKit(_workout: UnifiedWorkout): Promise<HealthWriteResult> {
  // HealthKit writes require a native module and iOS entitlement, so this adapter
  // is intentionally isolated from the Expo Go-safe GPS implementation.
  return { provider: "apple_healthkit", status: "unavailable" };
}

async function saveToHealthConnect(_workout: UnifiedWorkout): Promise<HealthWriteResult> {
  // Health Connect writes require native Android permissions/modules.
  return { provider: "health_connect", status: "unavailable" };
}

async function requestAppleHealthKitPermissions(): Promise<HealthPermissionResult> {
  // Replace this adapter with a HealthKit module in a development/native build.
  // Expo Go cannot request HealthKit permissions or entitlements.
  return { granted: false, provider: "apple_healthkit", status: "unavailable" };
}

async function requestHealthConnectPermissions(): Promise<HealthPermissionResult> {
  // Replace this adapter with a Health Connect module in a development/native build.
  // Expo Go cannot request Health Connect repository permissions.
  return { granted: false, provider: "health_connect", status: "unavailable" };
}
