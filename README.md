# Xpirit

Xpirit is a premium, minimalist fitness ecosystem hub for centralizing performance and recovery data.

## Stack

- Expo Router v3
- React Native
- NativeWind
- Supabase Auth and Postgres
- TanStack Query
- Strava, Oura, Apple Health, or Google Fit integrations

## Structure

```text
app/                    Expo Router screens
src/components/         Shared UI primitives
src/config/             Integration configuration
src/features/           Feature modules for Hub, Gym, Reports, Premium
src/lib/                Supabase and query clients
supabase/migrations/    Database schema
```

## Start

```bash
npm install
npm run start
```

Copy `.env.example` to `.env` and add your Supabase and Strava values before running the app.
