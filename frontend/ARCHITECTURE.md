# Frontend architecture

## Platform and stack

- React Native 0.81 with Expo SDK 54 and Expo Router 6.
- TypeScript 5.9, Tamagui, React Query 5, Zustand 5, Axios, and i18next.
- Supported interface languages: English, Japanese, and Uzbek.
- Supported runtime: iOS and Android. Core/manual flows run in Expo Go; on-device OCR requires a development build. Web is a preview target.

See `package.json` for the exact dependency versions.

## App structure

- `app/` contains Expo Router layouts and screens.
- `src/features/` contains auth, friends, groups, receipt splitting, and history APIs and stores.
- `src/shared/` contains reusable UI, app configuration, localization, utilities, and stores.
- `src/application/providers/` wires Tamagui, React Query, Zustand-backed app settings, and i18n.

Important files:

- `app/tabs/scan-receipt.tsx` captures a receipt photo and starts OCR.
- `app/tabs/sessions/participants.tsx` selects the people sharing a bill.
- `app/tabs/sessions/items-split.tsx` assigns receipt items and quantities and lets the user set that bill's currency label.
- `app/tabs/sessions/finish.tsx` shows the final amounts and allocations.
- `app/tabs/scan-invite.tsx` scans friend/group QR codes or accepts a pasted invite URL.
- `app/tabs/profile.tsx` edits the username, email, avatar, and password, and contains language, appearance, and currency preferences.
- `src/features/receipt/model/receipt-session.store.ts` owns the current receipt, split, and finalization state.
- `src/shared/lib/stores/app-store.tsx` persists the theme, language, and preferred currency in device storage.
- `src/shared/config/currencies.ts` lists supported currency codes and formats amounts using each currency's minor-unit rules.

## Receipt and split flow

The user can photograph a paper receipt for on-device text recognition, then review and correct suggested item names, prices, and quantities. Recognition uses native Android/iOS APIs and does not upload the image or require an API key. Manual item entry is available as a fallback. Both paths create a normal session before the user selects participants, reviews and assigns items, and finalizes the allocation.

Currency selection changes the currency code and number formatting. It does not convert the underlying amounts or use exchange rates.

## Friend invites

The backend issues short-lived signed tokens from `POST /friends/invite`. Friend and group URLs are parsed by `src/shared/lib/utils/invite.ts`. The invite scanner supports both camera QR scanning and manual URL entry. After a friend invite is redeemed, the frontend refreshes the friend store and the friends screen reloads when focused.

## Theme and profile

The persisted `theme` setting is passed to the root Tamagui provider. The profile screen offers light/dark controls and uses theme-aware backgrounds. Profile editing uses the existing username, email, password, and avatar API endpoints.

## Backend connection

Set `EXPO_PUBLIC_API_URL` in `frontend/.env`. Use `http://YOUR_COMPUTER_IP:8080` on a phone running Expo Go; `localhost` on the phone refers to the phone itself.

## Validation

Run the frontend type check from the repository root with:

```bash
npm --prefix frontend run typecheck
```

Automated unit and UI test suites are not currently configured in this frontend package.
