# Xpirit Supabase

## Migration

Run the initial schema with the Supabase CLI:

```bash
supabase db push
```

The schema uses `auth.users` as the source of truth and creates a matching row in `public.profiles` for each new user.

## MVP Data Model

- `profiles`: app user profile, timezone, and freemium tier.
- `user_devices`: current user installations, platform, timezone, and push-token-ready device records.
- `user_integrations`: integration records for native health providers, Oura, or Google Fit.
- `activities`: normalized external and manual activity feed for the Hub.
- `activity_route_points`: high-resolution GPS route points linked to each tracked run.
- `daily_health_metrics`: recovery, sleep, HRV, resting HR, steps, and related daily health signals.
- `training_load_daily`: daily rollups for dashboard charts, weekly load, recovery, and volume.
- `gym_workouts`, `gym_exercises`, `gym_sets`: manual gym logger structure.
- `interval_timers`: persisted timer state for background-capable intervals.
- `achievements`, `user_achievements`: milestone catalog and user unlock history.
- `subscription_events`: purchase lifecycle events.
- `subscription_products`: RevenueCat-ready product catalog for Premium and Elite.
- `revenuecat_customers`: maps Supabase users to RevenueCat app user ids.
- `subscription_entitlements`: entitlement truth table for premium feature gates.
- `revenuecat_webhook_events`: idempotent RevenueCat webhook intake.
- `feature_access_audit`: feature gate audit trail.
- `report_cards`: generated 9:16 shareable report metadata.
- `report_assets`: report image/storage metadata.
- `app_events`: lightweight analytics and product event history.
- `webhook_events`: idempotent external webhook intake.

Edge Functions should use the service role key for webhook writes because `webhook_events` and integration token refreshes are intentionally not writable by client RLS policies.

## Unified Data Service

Xpirit tracks runs directly with app GPS and stores normalized workout data in `activities`.

Flow:

1. The app starts live GPS tracking with high-accuracy location updates.
2. A background location task keeps collecting points when the screen locks.
3. The app calculates duration, distance, and pace from GPS points.
4. When the run ends, Xpirit creates a normalized `xpirit_gps` workout.
5. Native adapters save the workout to Apple HealthKit on iOS or Health Connect on Android when those native modules are enabled.

Useful activity fields:

```text
source = 'xpirit_gps'
type = 'run'
duration_seconds
moving_seconds
distance_meters
route_polyline
native_health_saved_at
```

HealthKit and Health Connect writes require native app capabilities and cannot be completed inside plain Expo Go.

## Auth Providers

Google is implemented in the app and should be enabled in Supabase Auth Providers with the Google Web OAuth client ID and client secret.

Set the Supabase Auth URL configuration to:

```text
Site URL: https://xpiritapp.vercel.app
Redirect URLs:
- https://xpiritapp.vercel.app
- https://xpiritapp.vercel.app/**
```

Apple Sign In is implemented in code but intentionally not activated until an Apple Developer account is used to configure Sign in with Apple, Services ID, Team ID, Key ID, and the `.p8` private key inside Supabase.

## RevenueCat Foundation

The database is ready for RevenueCat, but the app does not process real payments yet.

Seeded products:

```text
xpirit_premium_monthly_299 -> premium_reports -> 2,99 EUR monthly
xpirit_elite_monthly_799 -> elite_analytics -> 7,99 EUR monthly
```

Use the same product identifiers in Apple App Store Connect and Google Play Console when possible:

```text
xpirit_premium_monthly_299
xpirit_elite_monthly_799
```

The webhook maps RevenueCat `APP_STORE` events to `ios`, `PLAY_STORE` events to `android`, and stores both in the same `subscription_entitlements` table. This means Android payments are backend-ready even if the Android SDK key is added later.

Use `public.user_can_view_reports()` to gate report access from Supabase-backed checks once RevenueCat webhooks are connected.

RevenueCat webhook processing should run from an Edge Function using the Supabase service role key, verify the RevenueCat authorization header, insert into `revenuecat_webhook_events`, upsert `subscription_entitlements`, then call `public.sync_profile_subscription_from_entitlements(user_id)`.

Edge Function:

```text
supabase/functions/revenuecat-webhook
```

Required Supabase secrets:

```bash
REVENUECAT_WEBHOOK_AUTHORIZATION=<same value configured in the RevenueCat webhook Authorization header>
REVENUECAT_SECRET_API_KEY=<RevenueCat secret API key, server-only>
SUPABASE_SERVICE_ROLE_KEY=<server-only Supabase service role key>
```

Client app env vars:

```bash
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=<RevenueCat public iOS SDK key>
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=<RevenueCat public Android SDK key>
EXPO_PUBLIC_REVENUECAT_WEB_API_KEY=<RevenueCat public Web SDK key, only if Web Billing is enabled>
```

Never put the RevenueCat secret API key or Supabase service role key in any `EXPO_PUBLIC_*` variable.

## Apply to the Real Supabase Project

The app already points at the Supabase project through:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
```

The publishable anon key lets the app authenticate and read/write rows allowed by RLS. It cannot create database tables. To create the real database, apply the migrations from this folder in Supabase.

Recommended CLI flow:

```bash
npx supabase login
npx supabase init
npx supabase link --project-ref zumagxrwfluuknanmlpz
npx supabase db push
```

Dashboard-only flow:

1. Open Supabase Dashboard.
2. Go to SQL Editor.
3. Run every file in `supabase/migrations` in filename order.
4. Confirm the `profiles`, `activities`, `gym_*`, `report_*`, `subscription_*`, `revenuecat_*`, and `app_events` tables exist.

After the migrations are applied, the app will automatically persist:

- New OAuth users into `profiles`.
- Device sessions into `user_devices`.
- Finished GPS runs into `activities` and `activity_route_points`.
- Manual gym entries into `gym_workouts`, `gym_exercises`, and `gym_sets`.
- Started timers into `interval_timers`.
- Generated report cards into `report_cards`.
- Product events into `app_events`.
