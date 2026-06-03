# Frontend (Expo / React Native)

The mobile + web client for the DRP neurodivergent travel app. Built with
[Expo](https://expo.dev) (SDK 54) and [expo-router](https://docs.expo.dev/router/introduction)
file-based routing. Deployed to the web on Vercel.

## Get started

```bash
npm install
npx expo start
```

From the dev server you can open the app in a development build, an Android emulator,
an iOS simulator, [Expo Go](https://expo.dev/go), or the web.

## Project layout

```
src/
  app/          expo-router routes (screens live here; this folder name is required by expo-router)
  components/   reusable UI, grouped by feature (home/, routes/, preferences/, ui/)
  services/     backend API client + per-domain fetchers
  types/        shared TypeScript types
  constants/    config (API base URL) + theme/palette
  hooks/        shared hooks
assets/         icons, splash, images (referenced from app.json)
```

The `@/*` import alias maps to `src/*` (see `tsconfig.json`). The backend base URL is
read from `EXPO_PUBLIC_API_URL` (see `.env.example` and `src/constants/config.ts`).

## Checks

```bash
npm run lint          # ESLint (expo lint)
npx tsc --noEmit      # TypeScript
npx expo export --platform web   # production web build (what Vercel runs)
```
