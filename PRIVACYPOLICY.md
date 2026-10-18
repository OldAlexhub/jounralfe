# Innerfolio Privacy Policy

Last updated: October 18, 2026

Innerfolio is an account-free Android journal published by Old Alex Hub. This policy explains how the app and its supporting service handle information.

## Information kept on the phone

Journal entries, titles, dates, tags, drafts, extracted passages, confirmed people and relationships, topics, observations, plans, local analysis-job records, and search information are stored in an encrypted SQLCipher vault. Nonsensitive display preferences may be stored separately. Android's recent-app preview is obscured.

The vault uses a random key protected by the password. Innerfolio does not store or send the password. Optional biometric unlock uses Android Keystore protection and does not remove the password path. If the password, any valid biometric method, and an encrypted backup are all unavailable, Old Alex Hub cannot recover the journal.

## Voice and microphone

Microphone access is requested only when Dictate is tapped. English recognition runs on the device with a bundled Vosk model and works without internet after installation. Microphone PCM is processed in bounded memory buffers. Innerfolio does not create recordings, audio attachments, waveform files, or audio database fields, and does not upload audio. Dictation stops when cancelled, stopped, locked, left, interrupted, or backgrounded.

## Journal insights

Journal insights are enabled by default and can be turned off at any time in Settings. While insights are enabled, saved entry text and selected context are sent automatically over HTTPS to `https://jorunal.server.oldalexhub.com`. The server temporarily reads the text to perform non-generative processing using rules, spaCy's CPU non-transformer English pipeline, TF-IDF, NMF when data is sufficient, and extractive sentence ranking.

Text inputs and results are held in bounded process memory, normally for no more than 15 minutes, and are discarded after acknowledgment, cancellation, or expiry. A restart may interrupt a job. PostgreSQL stores only hashed anonymous installation credentials, opaque identifiers, revisions, status, timestamps, durations, expiry metadata, and redacted error codes. It does not store journal text or analysis results. This is encrypted transport and temporary readable server processing—not server-blind end-to-end encryption.

## Advertising and consent

Publisher-authored guidance and template-library screens may show Google banner or native ads. Google Mobile Ads and User Messaging Platform may process device identifiers, IP address, consent choices, diagnostics, ad interactions, and approximate location under Google's policies. UMP consent is refreshed at launch, and ads are requested only when its state permits. Journal text, titles, transcripts, people, values, plans, searches, and analysis features are not supplied as ad keywords, content URLs, custom targeting, or analytics fields.

## Notifications, exports, and deletion

Optional reminders are local, inexact, user-controlled, and use generic wording without journal excerpts. Notification permission is requested only when reminders are enabled.

Readable Markdown, JSON, text, or PDF exports are created only after a warning and are not protected by the vault after export. Encrypted backups use authenticated encryption and a user-provided backup password. Imports are authenticated and validated before replacing vault records; a failed import leaves the current vault intact.

Users can delete entries, clear derived suggestions, revoke optional analysis credentials, or erase the whole vault. Remote deletion requested while offline cannot be claimed complete until the server confirms it.

## Retention, security, and limitations

Server operational metadata is retained only as documented by the deployed service's policy. Administrator pages display operational identifiers and health—not private journal text. No system can guarantee perfect security. Keep Android updated, choose a strong unique passphrase, and protect encrypted backups.

## Contact

For privacy questions or requests, use the developer contact published on Innerfolio's Google Play listing.
