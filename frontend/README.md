# Frontend

Expo React Native app for the Receipt Splitter starter project.

Use the root documentation first:

- `../README.md` - quick start
- `../BEGINNER_SETUP.md` - detailed beginner setup
- `../TROUBLESHOOTING.md` - common Expo/network fixes
- `../ARCHITECTURE.md` - project structure

## Start

From the repository root:

```bash
npm run frontend:dev
```

Clear Expo cache:

```bash
npm run frontend:start:clean
```

Web preview:

```bash
npm run frontend:web
```

Manual receipt entry works in Expo Go. On-device receipt text recognition uses native Android/iOS modules, so OCR requires a development build (`npm run android` or `npm run ios` from `frontend/`) instead of Expo Go. Web mode does not support OCR.

## Main features

- Photograph a paper receipt and review OCR items before splitting.
- Split items equally or assign units to participants; review totals and past bills.
- Add a friend by scanning a friend QR invite or pasting its URL in the invite scanner.
- Open your profile from the avatar in the app header to edit username, email, avatar, and password. The profile also contains language, appearance, and default currency controls.
- Choose light or dark appearance. The selection is saved on the device.
- Select a default currency and override it for a particular bill. Supported codes: UZS, USD, EUR, RUB, GBP, JPY, KZT, CNY, TRY, AED, KRW, INR. Currency selection changes the label and number formatting; it does not convert amounts.

Friend invite links are time-limited. If a link has expired, create a new QR from the Friend QR screen.

## API URL

Create `frontend/.env` from `frontend/.env.example`.

For Expo Go on a real phone:

```text
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:8080
```

Find your IP from the repository root:

```bash
npm run ip
```
