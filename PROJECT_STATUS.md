# Xpirit Project Status

## Current State

- Expo app upgraded to SDK 54 and running with Expo Router.
- Main app routes:
  - `/`: black onboarding screen with name, email, password, then enters `/home`.
  - `/home`: dashboard hub without route map card.
  - `/gym`: gym logger with activity, weight, reps, saved sets, and timer.
  - `/race`: latest run unlocked, older sessions premium-gated with hidden metric placeholders.
  - `/profile`: profile, history, integrations, plan, and premium report CTA.
- Bottom navigation is a custom centered translucent bubble with filled icons.
- Premium checkout modal exists:
  - Default plan: Xpirit Premium `9.99 / mo`.
  - Dropdown plan: Xpirit Elite `15.99 / mo`.
  - Demo payment fields for email, card number, MM/YY, CVC.
- Home includes a Live GPS tracker card powered by the Unified Data Service.
- Supabase schema includes activities, gym workouts, native health integrations, premium/report tables, webhook events, and GPS route fields.

## Recent Verified Checks

- `npm run typecheck` passed after the latest Race premium metric change.
- Race premium sessions no longer show readable distance/pace values.
- Home no longer displays the route map card.
- Onboarding was verified in the iOS simulator.

## Pending

- Connect real Supabase project env vars:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Enable native HealthKit / Health Connect writers in a development build.
- Persist completed GPS runs into Supabase `activities`.
- Replace demo premium checkout with Stripe or RevenueCat before taking real payments.
- Optionally persist onboarding/auth to Supabase Auth instead of the current fast demo entry.

## Useful Commands

```bash
npm run typecheck
npx expo start --clear --lan --port 8081
```

## Last Known Local URL

- Web: `http://localhost:8081`
- Expo simulator URL: `exp://127.0.0.1:8081`
