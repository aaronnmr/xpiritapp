import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { saveWorkoutToNativeHealth, type UnifiedWorkout } from "@/services/health-workout-writer";
import { XpiritDataService } from "@/services/xpirit-data-service";

const GPS_TASK_NAME = "xpirit-live-gps-tracking";
const MIN_DISTANCE_INTERVAL_METERS = 5;
const MIN_TIME_INTERVAL_MS = 1000;

type GpsPoint = {
  latitude: number;
  longitude: number;
  timestamp: number;
};

type LiveSession = {
  distanceMeters: number;
  foregroundSubscription?: { remove: () => void } | null;
  id: string;
  points: GpsPoint[];
  startedAt: number;
  webWatchId?: number | null;
};

let activeSession: LiveSession | null = null;

TaskManager.defineTask(GPS_TASK_NAME, async ({ data, error }) => {
  if (error || !activeSession) {
    return;
  }

  const payload = data as { locations?: Location.LocationObject[] };
  payload.locations?.forEach((location) => appendLocation(location));
});

export const UnifiedDataService = {
  async requestPermissions() {
    if (Platform.OS === "web") {
      return requestWebLocationPermissions();
    }

    const foreground = await Location.requestForegroundPermissionsAsync();

    if (foreground.status !== "granted") {
      return { background: false, foreground: false };
    }

    const background = await Location.requestBackgroundPermissionsAsync();

    return {
      background: background.status === "granted",
      foreground: true
    };
  },

  async startLiveRun() {
    if (Platform.OS === "web") {
      return startWebLiveRun();
    }

    const permissions = await this.requestPermissions();

    if (!permissions.foreground) {
      throw new Error("Location permission is required to track a run.");
    }

    activeSession = {
      distanceMeters: 0,
      foregroundSubscription: null,
      id: `run-${Date.now()}`,
      points: [],
      startedAt: Date.now(),
      webWatchId: null
    };

    activeSession.foregroundSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: MIN_DISTANCE_INTERVAL_METERS,
        timeInterval: MIN_TIME_INTERVAL_MS
      },
      appendLocation
    );

    await Location.startLocationUpdatesAsync(GPS_TASK_NAME, {
      accuracy: Location.Accuracy.BestForNavigation,
      activityType: Location.ActivityType.Fitness,
      deferredUpdatesDistance: MIN_DISTANCE_INTERVAL_METERS,
      deferredUpdatesInterval: MIN_TIME_INTERVAL_MS,
      distanceInterval: MIN_DISTANCE_INTERVAL_METERS,
      foregroundService: {
        killServiceOnDestroy: false,
        notificationBody: "Xpirit is tracking your run.",
        notificationTitle: "Run tracking active"
      },
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      timeInterval: MIN_TIME_INTERVAL_MS
    });

    try {
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation
      });
      appendLocation(currentLocation);
    } catch {
      // The live timer can still start while the first GPS fix is warming up.
    }

    return getLiveRunSnapshot();
  },

  async stopLiveRun() {
    const session = activeSession;

    if (!session) {
      return null;
    }

    activeSession = null;
    session.foregroundSubscription?.remove();

    if (typeof session.webWatchId === "number" && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(session.webWatchId);
    }

    if (Platform.OS !== "web") {
      try {
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(GPS_TASK_NAME);

        if (hasStarted) {
          await Location.stopLocationUpdatesAsync(GPS_TASK_NAME);
        }
      } catch {
        // Stopping the foreground session is enough to unblock the UI.
      }
    }

    const endedAt = Date.now();
    const durationSeconds = Math.max(1, Math.round((endedAt - session.startedAt) / 1000));
    const workout: UnifiedWorkout = {
      distanceMeters: session.distanceMeters,
      durationSeconds,
      endedAt: new Date(endedAt).toISOString(),
      id: session.id,
      paceSecondsPerKm: getPaceSecondsPerKm(session.distanceMeters, durationSeconds),
      route: session.points,
      source: "xpirit_gps",
      startedAt: new Date(session.startedAt).toISOString(),
      type: "run"
    };

    void persistCompletedWorkout(workout);

    return workout;
  },

  getLiveRunSnapshot,
  isTracking() {
    return Boolean(activeSession);
  }
};

function appendLocation(location: Location.LocationObject) {
  if (!activeSession) {
    return;
  }

  appendGpsPoint({
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    timestamp: location.timestamp
  });
}

async function requestWebLocationPermissions() {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { background: false, foreground: false };
  }

  return new Promise<{ background: boolean; foreground: boolean }>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve({ background: false, foreground: true }),
      () => resolve({ background: false, foreground: false }),
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      }
    );
  });
}

async function startWebLiveRun() {
  const permissions = await requestWebLocationPermissions();

  if (!permissions.foreground || typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Location permission is required to track a run.");
  }

  activeSession = {
    distanceMeters: 0,
    foregroundSubscription: null,
    id: `run-${Date.now()}`,
    points: [],
    startedAt: Date.now(),
    webWatchId: null
  };

  activeSession.webWatchId = navigator.geolocation.watchPosition(
    appendWebLocation,
    () => undefined,
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000
    }
  );

  return getLiveRunSnapshot();
}

function appendWebLocation(position: GeolocationPosition) {
  if (!activeSession) {
    return;
  }

  appendGpsPoint({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    timestamp: position.timestamp
  });
}

function appendGpsPoint(point: GpsPoint) {
  if (!activeSession) {
    return;
  }

  const previousPoint = activeSession.points.at(-1);

  if (previousPoint) {
    activeSession.distanceMeters += haversineDistanceMeters(previousPoint, point);
  }

  activeSession.points.push(point);
}

async function persistCompletedWorkout(workout: UnifiedWorkout) {
  await Promise.allSettled([saveWorkoutToNativeHealth(workout), XpiritDataService.saveGpsWorkout(workout)]);
}

function getLiveRunSnapshot() {
  if (!activeSession) {
    return {
      distanceMeters: 0,
      durationSeconds: 0,
      isTracking: false,
      paceSecondsPerKm: null
    };
  }

  const durationSeconds = Math.max(1, Math.round((Date.now() - activeSession.startedAt) / 1000));

  return {
    distanceMeters: activeSession.distanceMeters,
    durationSeconds,
    isTracking: true,
    paceSecondsPerKm: getPaceSecondsPerKm(activeSession.distanceMeters, durationSeconds)
  };
}

function getPaceSecondsPerKm(distanceMeters: number, durationSeconds: number) {
  if (distanceMeters < 10) {
    return null;
  }

  return durationSeconds / (distanceMeters / 1000);
}

function haversineDistanceMeters(start: GpsPoint, end: GpsPoint) {
  const radiusMeters = 6_371_000;
  const latitudeDelta = toRadians(end.latitude - start.latitude);
  const longitudeDelta = toRadians(end.longitude - start.longitude);
  const startLatitude = toRadians(start.latitude);
  const endLatitude = toRadians(end.latitude);
  const a =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) * Math.sin(longitudeDelta / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return radiusMeters * c;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}
