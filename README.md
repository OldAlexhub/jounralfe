# Innerfolio: Journal & Plans

Innerfolio is an Android-only, account-free journal with an encrypted local vault, offline English dictation, reviewable conventional text analysis, and deterministic plan templates. The public API origin is exactly `https://jorunal.server.oldalexhub.com/api/v1`.

## Privacy and product boundaries

- Journal entries, drafts, extracted passages, people, topics, observations, plans, analysis outbox records, and search data live in a SQLCipher database on the phone.
- A random 256-bit vault key is wrapped with a password-derived AES-256-GCM key. PBKDF2-HMAC-SHA256 uses a random salt and versioned 600,000-iteration parameters. The password is not stored or transmitted.
- Optional biometric unlock rewraps the same random vault key with an authentication-bound Android Keystore key. Biometric invalidation never removes password unlock.
- Passwords cannot be reset by the server. Without the password, a still-valid biometric unlock, or a valid encrypted backup, the journal cannot be recovered.
- Dictation uses the bundled `vosk-model-small-en-us-0.15` locally. Audio is held only in bounded microphone buffers, is never written to a file, and is never sent to a server.
- Optional analysis sends reviewed text—not voice—over HTTPS after separate consent. The server runs a CPU non-transformer pipeline and keeps input/result payloads in bounded process memory for a default maximum of 15 minutes.
- Plans are assembled from user-selected evidence, user answers, accepted assumptions, unanswered questions, and publisher-authored guidance. The app does not generate prose or invent missing facts.
- Google Mobile Ads and UMP appear only on substantial publisher-authored template/guidance screens. Private journal, editor, Discover, About Me, plan editor, onboarding, unlock, settings, privacy, and destructive flows contain no ads.

## Local development

Requirements: Node.js 22.11+, Android Studio with API 37 build tools and Android 16/API 36 platform, and the included Gradle wrapper.

```powershell
cd personalJournal
npm ci
powershell -ExecutionPolicy Bypass -File scripts/install-vosk-model.ps1
npm test -- --runInBand
npx tsc --noEmit
npm run android
```

The model installer downloads the Apache-2.0 English model and refuses a SHA-256 mismatch. The checked-in release workspace already includes the verified model. English is the only advertised dictation and analysis language. Unicode Arabic typing and bidirectional rendering are supported, but Arabic dictation/NLP parity is not claimed.

## Release

From the repository root:

```powershell
python release.py --check-env
python release.py --generate-key-only
python release.py
python release.py --no-clean --skip-screenshots
```

`release.py` discovers Android Studio's JBR and the SDK, updates only process-local environment variables, preserves unrelated `local.properties` keys, configures signing without printing passwords, builds a signed APK/AAB, checks 64-bit native ELF alignment for 16 KB pages, packages the server, and copies release materials. The AAB is the Google Play upload artifact.

Signing files are ignored. Securely back up both `android/keystore/innerfolio-release.jks` and `android/signing.properties` separately. If this is an update to an established Play listing, do not generate a replacement key; recover the established identity.

Troubleshooting:

- Run `python release.py --check-env` for `ANDROID_HOME`, SDK, JDK, keytool, adb, Gradle wrapper, platform, build-tools, `local.properties`, or `sdk.dir` problems.
- For navigation overlap, inspect `src/components/layout.tsx`, the single inset owner in `SafeBottomBar`, normal-flow ad footer, scroll padding, and `adjustResize` in `AndroidManifest.xml`.
- If dictation is unavailable, rerun the model installer and grant microphone permission only after tapping Dictate.
- A failed or no-fill ad never blocks guidance content.

## Verification limits

Automated TypeScript/Jest and Android compilation checks are provided. Airplane-mode dictation, biometric enrollment changes, actual reminders, PDF appearance on device, gesture/three-button navigation, cutouts, Bluetooth changes, 16 KB emulator runtime, and AdMob delivery require real device/emulator validation before release. The AdMob console must contain the appropriate privacy message. The publisher must also supply a legitimate privacy contact before publication.
