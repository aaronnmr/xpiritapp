import { createClient } from "@supabase/supabase-js";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface GenerateReportRequest {
  userId: string;
  weekStartDate: string;
  weekEndDate: string;
}

interface WeeklyMetrics {
  runCount: number;
  runDistanceKm: number;
  runDurationHours: number;
  strengthVolume: number;
  strengthSessions: number;
  totalWorkouts: number;
  streak: number;
  achievements: Array<{ title: string; description?: string }>;
}

// Fetch weekly data for a user
async function fetchWeeklyMetrics(
  userId: string,
  weekStartDate: string,
  weekEndDate: string
): Promise<WeeklyMetrics> {
  const startISO = `${weekStartDate}T00:00:00Z`;
  const endISO = `${weekEndDate}T23:59:59Z`;

  // Fetch activities (runs, rides, etc)
  const { data: activities, error: activitiesError } = await supabase
    .from("activities")
    .select("type,duration_seconds,distance_meters")
    .eq("user_id", userId)
    .gte("started_at", startISO)
    .lte("started_at", endISO);

  if (activitiesError) {
    console.error("Error fetching activities:", activitiesError);
  }

  // Fetch gym sessions
  const { data: gymWorkouts, error: gymError } = await supabase
    .from("gym_workouts")
    .select(
      "id, completed_at, gym_sets(weight_kg, reps)"
    )
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("completed_at", startISO)
    .lte("completed_at", endISO);

  if (gymError) {
    console.error("Error fetching gym workouts:", gymError);
  }

  // Fetch user achievements
  const { data: achievements, error: achievementsError } = await supabase
    .from("user_achievements")
    .select("achievement_id, achievements(title, description)")
    .eq("user_id", userId)
    .gte("unlocked_at", startISO)
    .lte("unlocked_at", endISO);

  if (achievementsError) {
    console.error("Error fetching achievements:", achievementsError);
  }

  // Calculate metrics
  const activitiesData = (activities || []) as Array<{
    type: string;
    duration_seconds: number | null;
    distance_meters: number | null;
  }>;

  const runs = activitiesData.filter((a) => a.type === "run");
  const runCount = runs.length;
  const runDistanceKm = runs.reduce((sum, r) => sum + (r.distance_meters || 0), 0) / 1000;
  const runDurationHours =
    runs.reduce((sum, r) => sum + (r.duration_seconds || 0), 0) / 3600;

  const gymData = (gymWorkouts || []) as Array<{
    id: string;
    completed_at: string;
    gym_sets: Array<{ weight_kg: number; reps: number }>;
  }>;

  const strengthVolume = gymData.reduce((sum, workout) => {
    return (
      sum +
      ((workout.gym_sets || []) as Array<{ weight_kg: number; reps: number }>).reduce(
        (setSum, set) => setSum + (set.weight_kg * set.reps || 0),
        0
      )
    );
  }, 0);

  return {
    runCount,
    runDistanceKm: Math.round(runDistanceKm * 10) / 10,
    runDurationHours: Math.round(runDurationHours * 10) / 10,
    strengthVolume: Math.round(strengthVolume),
    strengthSessions: gymData.length,
    totalWorkouts: activitiesData.length + gymData.length,
    streak: 6, // TODO: calculate from training_load_daily
    achievements: (achievements || []).map((a: any) => ({
      title: a.achievements?.title || "Achievement",
      description: a.achievements?.description,
    })),
  };
}

// Generate HTML template with injected metrics
function generateReportHTML(
  metrics: WeeklyMetrics,
  displayName: string
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Xpirit Weekly Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #050507 0%, #0d0d11 100%);
      color: #ffffff;
      padding: 0;
      margin: 0;
    }

    .container {
      width: 1080px;
      height: 1920px;
      background: linear-gradient(135deg, #050507 0%, #0d0d11 100%);
      padding: 60px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
    }

    .container::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -10%;
      width: 500px;
      height: 500px;
      background: radial-gradient(circle, rgba(74, 83, 255, 0.15) 0%, transparent 70%);
      border-radius: 50%;
      z-index: 0;
    }

    .content {
      position: relative;
      z-index: 1;
    }

    .header {
      margin-bottom: 60px;
    }

    .logo {
      font-size: 56px;
      font-weight: 700;
      letter-spacing: -2px;
      margin-bottom: 20px;
      background: linear-gradient(135deg, #4a53ff 0%, #7c3aed 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .subtitle {
      font-size: 24px;
      color: #a7a7ad;
      font-weight: 500;
    }

    .athlete-name {
      font-size: 48px;
      font-weight: 700;
      letter-spacing: -1px;
      margin-top: 30px;
      color: #ffffff;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 30px;
      margin: 60px 0;
    }

    .metric-card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      padding: 40px;
      backdrop-filter: blur(20px);
      transition: all 0.3s ease;
    }

    .metric-card:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(74, 83, 255, 0.4);
    }

    .metric-label {
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: #808080;
      margin-bottom: 15px;
    }

    .metric-value {
      font-size: 56px;
      font-weight: 700;
      letter-spacing: -1px;
      color: #ffffff;
      margin-bottom: 10px;
    }

    .metric-unit {
      font-size: 18px;
      color: #4a53ff;
      font-weight: 600;
    }

    .achievements-section {
      margin-top: 60px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      padding: 40px;
      backdrop-filter: blur(20px);
    }

    .section-title {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.6px;
      margin-bottom: 30px;
      color: #ffffff;
    }

    .achievement-item {
      background: rgba(74, 83, 255, 0.1);
      border-left: 4px solid #4a53ff;
      padding: 20px;
      margin-bottom: 15px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 15px;
    }

    .achievement-icon {
      width: 16px;
      height: 16px;
      background: #4a53ff;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .achievement-title {
      font-size: 16px;
      font-weight: 600;
      color: #ffffff;
    }

    .streak-badge {
      position: absolute;
      top: 60px;
      right: 60px;
      background: linear-gradient(135deg, #4a53ff 0%, #7c3aed 100%);
      border-radius: 20px;
      padding: 15px 30px;
      font-size: 18px;
      font-weight: 700;
      color: #ffffff;
      text-align: center;
    }

    .footer {
      margin-top: 60px;
      padding-top: 40px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      text-align: center;
      color: #808080;
      font-size: 14px;
    }

    .xpirit-badge {
      display: inline-block;
      background: rgba(74, 83, 255, 0.15);
      border: 1px solid rgba(74, 83, 255, 0.3);
      border-radius: 8px;
      padding: 8px 16px;
      margin-top: 10px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #4a53ff;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="content">
      <div class="streak-badge">🔥 ${metrics.streak} day streak</div>

      <div class="header">
        <div class="logo">Xpirit</div>
        <div class="subtitle">Weekly Performance Report</div>
        <div class="athlete-name">${displayName}</div>
      </div>

      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Running Distance</div>
          <div class="metric-value">${metrics.runDistanceKm}</div>
          <div class="metric-unit">kilometers</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Running Sessions</div>
          <div class="metric-value">${metrics.runCount}</div>
          <div class="metric-unit">workouts</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Strength Volume</div>
          <div class="metric-value">${metrics.strengthVolume.toLocaleString()}</div>
          <div class="metric-unit">kg lifted</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Total Workouts</div>
          <div class="metric-value">${metrics.totalWorkouts}</div>
          <div class="metric-unit">sessions</div>
        </div>
      </div>

      ${
        metrics.achievements.length > 0
          ? `
      <div class="achievements-section">
        <div class="section-title">🏆 Achievements Unlocked</div>
        ${metrics.achievements
          .map(
            (a) => `
          <div class="achievement-item">
            <div class="achievement-icon"></div>
            <div>
              <div class="achievement-title">${a.title}</div>
            </div>
          </div>
        `
          )
          .join("")}
      </div>
      `
          : ""
      }
    </div>

    <div class="footer">
      <p>Generated by Xpirit • Premium Track</p>
      <div class="xpirit-badge">Premium</div>
    </div>
  </div>
</body>
</html>`;
}

// Main handler
serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { userId, weekStartDate, weekEndDate } = (await req.json()) as GenerateReportRequest;

    if (!userId || !weekStartDate || !weekEndDate) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check user subscription
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tier, display_name")
      .eq("id", userId)
      .single();

    if (profileError || !profile || profile.tier !== "premium") {
      return new Response(
        JSON.stringify({ error: "User must be premium subscriber" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch metrics
    const metrics = await fetchWeeklyMetrics(userId, weekStartDate, weekEndDate);

    // Generate HTML
    const htmlContent = generateReportHTML(metrics, profile.display_name || "Athlete");

    // TODO: Convert HTML to PNG using headless browser
    // For now, store metrics in database
    const { data: reportCard, error: insertError } = await supabase
      .from("premium_report_cards")
      .insert({
        user_id: userId,
        week_start_date: weekStartDate,
        week_end_date: weekEndDate,
        title: `Weekly Report - ${weekStartDate} to ${weekEndDate}`,
        metrics,
        visibility: "private",
      })
      .select("id")
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: "Failed to save report" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        reportId: reportCard.id,
        metrics,
        htmlUrl: `data:text/html;base64,${btoa(htmlContent)}`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in generate_report:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
