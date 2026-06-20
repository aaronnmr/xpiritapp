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

type RawRunRow = DashboardActivity & {
  route_polyline: string | null;
};

type RawGymSetRow = {
  completed_at: string | null;
  created_at: string;
  gym_exercises: { name: string } | null;
  id: string;
  reps: number | null;
  weight_kg: number | null;
};

type RawUserAchievementRow = {
  achievements: { description: string | null; title: string } | null;
  id: string;
  unlocked_at: string;
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

export type GymSetRecord = {
  activity: string;
  completedAt: string;
  id: string;
  reps: number;
  weightKg: number;
};

export type RunSessionRecord = {
  distanceMeters: number;
  durationSeconds: number;
  id: string;
  name: string;
  paceSecondsPerKm: number | null;
  routePolyline: string | null;
  startedAt: string;
};

export type WeeklyDayLoad = {
  hasActivity: boolean;
  isoDate: string;
  workoutCount: number;
};

export type ProfileSummary = {
  achievementCount: number;
  displayName: string;
  streakDays: number;
  tier: string;
};

export type UnlockedAchievement = {
  detail: string;
  id: string;
  title: string;
  unlockedAt: string;
};

export type ReportCardInput = {
  imageUrl?: string;
  metrics: Record<string, unknown>;
  periodEnd: string;
  periodStart: string;
  title: string;
};

export const XpiritDataService = {
  async ensureProfile(locale = "en") {
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
        locale,
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

  async getRunSessions(limit = 30): Promise<RunSessionRecord[] | null> {
    const user = await getCurrentUser();

    if (!user || !supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from("activities")
      .select("id,name,type,started_at,duration_seconds,distance_meters,route_polyline")
      .eq("user_id", user.id)
      .eq("type", "run")
      .order("started_at", { ascending: false })
      .limit(limit);

    if (error) {
      warnSupabase("getRunSessions", error);
      return null;
    }

    return ((data ?? []) as unknown as RawRunRow[]).map((activity) => {
      const distanceMeters = Number(activity.distance_meters ?? 0);
      const durationSeconds = Number(activity.duration_seconds ?? 0);

      return {
        distanceMeters,
        durationSeconds,
        id: activity.id,
        name: activity.name ?? "Outdoor Run",
        paceSecondsPerKm: getPaceSecondsPerKm(distanceMeters, durationSeconds),
        routePolyline: activity.route_polyline ?? null,
        startedAt: activity.started_at
      };
    });
  },

  async getWeeklyLoad(): Promise<WeeklyDayLoad[] | null> {
    const user = await getCurrentUser();

    if (!user || !supabase) {
      return null;
    }

    const weekStart = getWeekStartIso();
    const weekStartDate = new Date(weekStart);

    const [{ data: runs, error: runsError }, { data: gymWorkouts, error: gymError }] = await Promise.all([
      supabase.from("activities").select("started_at").eq("user_id", user.id).gte("started_at", weekStart),
      supabase.from("gym_workouts").select("started_at").eq("user_id", user.id).gte("started_at", weekStart)
    ]);

    if (runsError) {
      warnSupabase("getWeeklyLoad.activities", runsError);
    }

    if (gymError) {
      warnSupabase("getWeeklyLoad.gymWorkouts", gymError);
    }

    const countsByIsoDate = new Map<string, number>();

    for (const row of [...(runs ?? []), ...(gymWorkouts ?? [])] as Array<{ started_at: string }>) {
      const isoDate = row.started_at.slice(0, 10);
      countsByIsoDate.set(isoDate, (countsByIsoDate.get(isoDate) ?? 0) + 1);
    }

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStartDate);
      date.setDate(weekStartDate.getDate() + index);
      const isoDate = date.toISOString().slice(0, 10);
      const workoutCount = countsByIsoDate.get(isoDate) ?? 0;

      return { hasActivity: workoutCount > 0, isoDate, workoutCount };
    });
  },

  async getProfileSummary(): Promise<ProfileSummary | null> {
    const user = await getCurrentUser();

    if (!user || !supabase) {
      return null;
    }

    const [{ data: profile, error: profileError }, { count: achievementCount, error: achievementError }, streakDays] = await Promise.all([
      supabase.from("profiles").select("display_name,full_name,tier,subscription_tier").eq("id", user.id).single(),
      supabase.from("user_achievements").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      this.getActiveStreakDays()
    ]);

    if (profileError) {
      warnSupabase("getProfileSummary.profile", profileError);
    }

    if (achievementError) {
      warnSupabase("getProfileSummary.achievements", achievementError);
    }

    return {
      achievementCount: achievementCount ?? 0,
      displayName: profile?.full_name ?? profile?.display_name ?? user.email ?? "Xpirit athlete",
      streakDays: streakDays ?? 0,
      tier: profile?.subscription_tier ?? profile?.tier ?? "free"
    };
  },

  async getActiveStreakDays(): Promise<number> {
    const user = await getCurrentUser();

    if (!user || !supabase) {
      return 0;
    }

    const [{ data: runs }, { data: gymWorkouts }] = await Promise.all([
      supabase.from("activities").select("started_at").eq("user_id", user.id).order("started_at", { ascending: false }).limit(90),
      supabase.from("gym_workouts").select("started_at").eq("user_id", user.id).order("started_at", { ascending: false }).limit(90)
    ]);

    const activeDates = new Set(
      [...(runs ?? []), ...(gymWorkouts ?? [])].map((row) => (row as { started_at: string }).started_at.slice(0, 10))
    );

    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    while (activeDates.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
  },

  async getUnlockedAchievements(limit = 10): Promise<UnlockedAchievement[] | null> {
    const user = await getCurrentUser();

    if (!user || !supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from("user_achievements")
      .select("id,unlocked_at,achievements(title,description)")
      .eq("user_id", user.id)
      .order("unlocked_at", { ascending: false })
      .limit(limit);

    if (error) {
      warnSupabase("getUnlockedAchievements", error);
      return null;
    }

    return ((data ?? []) as unknown as RawUserAchievementRow[]).map((row) => ({
      detail: row.achievements?.description ?? "",
      id: row.id,
      title: row.achievements?.title ?? "Achievement",
      unlockedAt: row.unlocked_at
    }));
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

  async updateGymSet(id: string, input: { reps: number; weightKg: number }) {
    const userId = await this.ensureProfile();

    if (!userId || !supabase) {
      return null;
    }

    const { error } = await supabase.from("gym_sets").update({ reps: input.reps, weight_kg: input.weightKg }).eq("id", id).eq("user_id", userId);

    if (error) {
      warnSupabase("updateGymSet", error);
      return null;
    }

    await this.trackEvent("gym_set_updated", "gym", { reps: input.reps, weight_kg: input.weightKg, set_id: id });

    return true;
  },

  async getGymSets(limit = 50): Promise<GymSetRecord[] | null> {
    const user = await getCurrentUser();

    if (!user || !supabase) {
      return null;
    }

    const { data, error } = await supabase
      .from("gym_sets")
      .select("id,reps,weight_kg,completed_at,created_at,gym_exercises(name)")
      .eq("user_id", user.id)
      .order("completed_at", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) {
      warnSupabase("getGymSets", error);
      return null;
    }

    return ((data ?? []) as unknown as RawGymSetRow[]).map((row) => ({
      activity: row.gym_exercises?.name ?? "Custom activity",
      completedAt: row.completed_at ?? row.created_at,
      id: row.id,
      reps: Number(row.reps ?? 0),
      weightKg: Number(row.weight_kg ?? 0)
    }));
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

  async generatePremiumReport(weekStartDate: string, weekEndDate: string) {
    const userId = await this.ensureProfile();

    if (!userId || !supabase) {
      return null;
    }

    try {
      const response = await supabase.functions.invoke("generate-premium-report", {
        body: {
          userId,
          weekStartDate,
          weekEndDate,
        },
      });

      if (response.error) {
        warnSupabase("generatePremiumReport.invoke", response.error);
        return null;
      }

      await this.trackEvent("premium_report_generated", "profile", {
        week_start: weekStartDate,
        week_end: weekEndDate,
      });

      return response.data;
    } catch (error) {
      warnSupabase("generatePremiumReport", error);
      return null;
    }
  },

  async getPremiumReports(limit = 10, offset = 0) {
    const userId = await this.ensureProfile();

    if (!userId || !supabase) {
      return null;
    }

    const { data, error, count } = await supabase
      .from("premium_report_cards")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      warnSupabase("getPremiumReports", error);
      return null;
    }

    return { reports: data || [], total: count || 0 };
  },

  async updateReportVisibility(reportId: string, visibility: "private" | "shared") {
    const userId = await this.ensureProfile();

    if (!userId || !supabase) {
      return null;
    }

    const { error } = await supabase
      .from("premium_report_cards")
      .update({
        visibility,
        shared_at: visibility === "shared" ? new Date().toISOString() : null,
      })
      .eq("id", reportId)
      .eq("user_id", userId);

    if (error) {
      warnSupabase("updateReportVisibility", error);
      return null;
    }

    await this.trackEvent("report_visibility_changed", "profile", {
      report_id: reportId,
      visibility,
    });

    return true;
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
