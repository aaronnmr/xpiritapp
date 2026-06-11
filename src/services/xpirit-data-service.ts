import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";
import type { UnifiedWorkout } from "@/services/health-workout-writer";

type DashboardActivity = {
  distance_meters: number | null;
  duration_seconds: number | null;
  id: string;
  name: string | null;
  started_at: string;
  type: string;
};

export type DashboardSnapshot = {
  latestRun: {
    distanceMeters: number;
    durationSeconds: number;
    paceSecondsPerKm: number | null;
  } | null;
  previousRuns: Array<{
    distanceMeters: number;
    durationSeconds: number;
    id: string;
    name: string;
    paceSecondsPerKm: number | null;
    startedAt: string;
  }>;
  weeklyWorkoutCount: number;
};

export type GymSetInput = {
  activity: string;
  reps: number;
  weightKg: number;
};

export type ReportCardInput = {
  imageUrl?: string;
  metrics: Record<string, unknown>;
  periodEnd: string;
  periodStart: string;
  title: string;
};

export const XpiritDataService = {
  async ensureProfile() {
    const user = await getCurrentUser();

    if (!user || !supabase) {
      return null;
    }

    const metadata = user.user_metadata ?? {};
    const displayName = metadata.display_name ?? metadata.full_name ?? user.email ?? "Xpirit athlete";

    const { error } = await supabase.from("profiles").upsert(
      {
        display_name: displayName,
        email: user.email,
        full_name: metadata.full_name ?? displayName,
        id: user.id,
        last_active_at: new Date().toISOString(),
        revenuecat_app_user_id: user.id
      },
      { onConflict: "id" }
    );

    if (error) {
      warnSupabase("ensureProfile", error);
      return null;
    }

    return user.id;
  },

  async registerDevice(installationId: string, metadata: Record<string, unknown> = {}) {
    const userId = await this.ensureProfile();

    if (!userId || !supabase) {
      return;
    }

    const { error } = await supabase.from("user_devices").upsert(
      {
        installation_id: installationId,
        last_seen_at: new Date().toISOString(),
        metadata,
        platform: getPlatform(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
        user_id: userId
      },
      { onConflict: "user_id,installation_id" }
    );

    if (error) {
      warnSupabase("registerDevice", error);
    }
  },

  async getDashboardSnapshot(): Promise<DashboardSnapshot | null> {
    const user = await getCurrentUser();

    if (!user || !supabase) {
      return null;
    }

    const weekStart = getWeekStartIso();
    const [{ data: runs, error: runsError }, { count, error: countError }] = await Promise.all([
      supabase
        .from("activities")
        .select("id,name,type,started_at,duration_seconds,distance_meters")
        .eq("user_id", user.id)
        .eq("type", "run")
        .order("started_at", { ascending: false })
        .limit(8),
      supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("started_at", weekStart)
    ]);

    if (runsError) {
      warnSupabase("getDashboardSnapshot.activities", runsError);
      return null;
    }

    if (countError) {
      warnSupabase("getDashboardSnapshot.count", countError);
    }

    const formattedRuns = ((runs ?? []) as DashboardActivity[]).map((activity) => {
      const distanceMeters = Number(activity.distance_meters ?? 0);
      const durationSeconds = Number(activity.duration_seconds ?? 0);

      return {
        distanceMeters,
        durationSeconds,
        id: activity.id,
        name: activity.name ?? "Outdoor Run",
        paceSecondsPerKm: getPaceSecondsPerKm(distanceMeters, durationSeconds),
        startedAt: activity.started_at
      };
    });

    return {
      latestRun: formattedRuns[0] ?? null,
      previousRuns: formattedRuns.slice(1),
      weeklyWorkoutCount: count ?? 0
    };
  },

  async saveGpsWorkout(workout: UnifiedWorkout) {
    const userId = await this.ensureProfile();

    if (!userId || !supabase) {
      return null;
    }

    const bounds = getRouteBounds(workout.route);
    const routePolyline = encodePolyline(workout.route);
    const firstPoint = workout.route[0];
    const lastPoint = workout.route.at(-1);

    const { data, error } = await supabase
      .from("activities")
      .insert({
        distance_meters: workout.distanceMeters,
        duration_seconds: workout.durationSeconds,
        end_latitude: lastPoint?.latitude,
        end_longitude: lastPoint?.longitude,
        ended_at: workout.endedAt,
        moving_seconds: workout.durationSeconds,
        name: "Outdoor Run",
        raw_payload: {
          pace_seconds_per_km: workout.paceSecondsPerKm,
          route_point_count: workout.route.length
        },
        route_bounds: bounds,
        route_polyline: routePolyline,
        route_summary_polyline: routePolyline,
        source: "xpirit_gps",
        source_activity_id: workout.id,
        start_latitude: firstPoint?.latitude,
        start_longitude: firstPoint?.longitude,
        started_at: workout.startedAt,
        type: workout.type,
        user_id: userId
      })
      .select("id")
      .single();

    if (error) {
      warnSupabase("saveGpsWorkout.activity", error);
      return null;
    }

    if (workout.route.length > 0) {
      const { error: routeError } = await supabase.from("activity_route_points").insert(
        workout.route.map((point, index) => ({
          activity_id: data.id,
          latitude: point.latitude,
          longitude: point.longitude,
          recorded_at: new Date(point.timestamp).toISOString(),
          sequence: index,
          user_id: userId
        }))
      );

      if (routeError) {
        warnSupabase("saveGpsWorkout.routePoints", routeError);
      }
    }

    await this.trackEvent("run_saved", "home", {
      activity_id: data.id,
      distance_meters: workout.distanceMeters,
      duration_seconds: workout.durationSeconds
    });

    return data.id as string;
  },

  async saveGymSet(input: GymSetInput) {
    const userId = await this.ensureProfile();

    if (!userId || !supabase) {
      return null;
    }

    const now = new Date().toISOString();
    const { data: workout, error: workoutError } = await supabase
      .from("gym_workouts")
      .insert({
        completed_at: now,
        started_at: now,
        status: "completed",
        title: "Gym session",
        user_id: userId
      })
      .select("id")
      .single();

    if (workoutError) {
      warnSupabase("saveGymSet.workout", workoutError);
      return null;
    }

    const { data: exercise, error: exerciseError } = await supabase
      .from("gym_exercises")
      .insert({
        name: input.activity,
        position: 0,
        user_id: userId,
        workout_id: workout.id
      })
      .select("id")
      .single();

    if (exerciseError) {
      warnSupabase("saveGymSet.exercise", exerciseError);
      return null;
    }

    const { data: set, error: setError } = await supabase
      .from("gym_sets")
      .insert({
        completed_at: now,
        exercise_id: exercise.id,
        position: 0,
        reps: input.reps,
        user_id: userId,
        weight_kg: input.weightKg,
        workout_id: workout.id
      })
      .select("id")
      .single();

    if (setError) {
      warnSupabase("saveGymSet.set", setError);
      return null;
    }

    await this.trackEvent("gym_set_saved", "gym", {
      exercise: input.activity,
      reps: input.reps,
      weight_kg: input.weightKg
    });

    return set.id as string;
  },

  async saveIntervalTimer(activitySeconds: number, restSeconds: number, repeats: number) {
    const userId = await this.ensureProfile();

    if (!userId || !supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from("interval_timers")
      .insert({
        activity_seconds: activitySeconds,
        repeats,
        rest_seconds: restSeconds,
        status: "running",
        started_at: new Date().toISOString(),
        user_id: userId
      })
      .select("id")
      .single();

    if (error) {
      warnSupabase("saveIntervalTimer", error);
      return null;
    }

    return data.id as string;
  },

  async saveReportCard(input: ReportCardInput) {
    const userId = await this.ensureProfile();

    if (!userId || !supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from("report_cards")
      .insert({
        image_url: input.imageUrl,
        metrics: input.metrics,
        period_end: input.periodEnd,
        period_start: input.periodStart,
        title: input.title,
        user_id: userId
      })
      .select("id")
      .single();

    if (error) {
      warnSupabase("saveReportCard", error);
      return null;
    }

    return data.id as string;
  },

  async trackEvent(eventName: string, screenName?: string, properties: Record<string, unknown> = {}) {
    if (!supabase) {
      return;
    }

    const user = await getCurrentUser();
    const { error } = await supabase.from("app_events").insert({
      event_name: eventName,
      properties,
      screen_name: screenName,
      user_id: user?.id ?? null
    });

    if (error) {
      warnSupabase("trackEvent", error);
    }
  }
};

async function getCurrentUser() {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return data.user;
}

function getPlatform() {
  if (Platform.OS === "ios" || Platform.OS === "android" || Platform.OS === "web") {
    return Platform.OS;
  }

  return "unknown";
}

function getPaceSecondsPerKm(distanceMeters: number, durationSeconds: number) {
  if (distanceMeters < 10 || durationSeconds <= 0) {
    return null;
  }

  return durationSeconds / (distanceMeters / 1000);
}

function getWeekStartIso() {
  const date = new Date();
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);

  return date.toISOString();
}

function getRouteBounds(route: UnifiedWorkout["route"]) {
  if (route.length === 0) {
    return {};
  }

  const latitudes = route.map((point) => point.latitude);
  const longitudes = route.map((point) => point.longitude);

  return {
    max_latitude: Math.max(...latitudes),
    max_longitude: Math.max(...longitudes),
    min_latitude: Math.min(...latitudes),
    min_longitude: Math.min(...longitudes)
  };
}

function encodePolyline(points: Array<{ latitude: number; longitude: number }>) {
  let previousLatitude = 0;
  let previousLongitude = 0;

  return points
    .map((point) => {
      const latitude = Math.round(point.latitude * 1e5);
      const longitude = Math.round(point.longitude * 1e5);
      const encoded = encodePolylineValue(latitude - previousLatitude) + encodePolylineValue(longitude - previousLongitude);
      previousLatitude = latitude;
      previousLongitude = longitude;

      return encoded;
    })
    .join("");
}

function encodePolylineValue(value: number) {
  let coordinate = value < 0 ? ~(value << 1) : value << 1;
  let output = "";

  while (coordinate >= 0x20) {
    output += String.fromCharCode((0x20 | (coordinate & 0x1f)) + 63);
    coordinate >>= 5;
  }

  output += String.fromCharCode(coordinate + 63);

  return output;
}

function warnSupabase(scope: string, error: unknown) {
  if (__DEV__) {
    console.warn(`[XpiritDataService:${scope}]`, error);
  }
}
