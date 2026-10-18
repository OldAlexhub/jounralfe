# Google Play Data Safety working notes

These are implementation notes, not legal advice or a guarantee of Play approval. Reconcile them with the final AdMob configuration, deployed privacy policy, and Play Console definitions.

## App/publisher processing

- No consumer account, email, phone number, social login, subscription, contacts upload, advertising-ID-as-account, or hardware fingerprint.
- Journal text and derived information remain in encrypted local storage unless the user opts into text analysis and submits an entry.
- Optional analysis transfers journal text over HTTPS for app functionality. The server processes it readably in bounded memory and does not persist text/results. Operational PostgreSQL records include opaque installation/job identifiers, revisions, timestamps, duration, expiry, status, and error codes.
- Voice/audio is neither collected nor shared by the app/server. Microphone permission is used only for on-device dictation.
- Crash analytics and general product analytics are not integrated.

## Google advertising exception

Google Mobile Ads/UMP may collect or share device or other identifiers, IP address/approximate location, app interactions, ad interactions, diagnostics, and consent state for advertising, fraud prevention, security, compliance, and measurement. Confirm current Google SDK disclosures in Play Console. Data may be linked to a device by Google. User-requested deletion in Innerfolio cannot delete records controlled independently by Google; link Google's controls in the published policy as appropriate.

## Security/deletion

Data in transit to the analysis server uses HTTPS. Local journal data uses SQLCipher; readable exports are explicitly warned and are outside vault protection. Users can delete entries, clear derived suggestions, revoke/delete installation operational data, or erase the local vault. Complete the remote deletion retry test before answering deletion questions.

## Permissions

- `INTERNET`: optional text analysis and eligible ads/consent.
- `RECORD_AUDIO`: requested only after Dictate is tapped; local recognition only.
- `POST_NOTIFICATIONS`: requested only when the user enables a generic daily reminder on Android 13+.
- No broad storage, contacts, location, camera, exact alarm, background microphone, or phone permissions.
