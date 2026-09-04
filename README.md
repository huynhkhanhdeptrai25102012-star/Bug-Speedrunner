# Bug Speedrunner — Firebase V2 Hardened

Browser-only coding speedrun game by **HK1413**.

## What is included

- Main menu, Speedrun, Rank, Leaderboard, Beginner Academy.
- Monaco Editor with JavaScript, HTML, C++, C# challenges.
- Millisecond `performance.now()` timer.
- Practice mode + locked ranked mode.
- Randomized challenge variants and fresh board after every finalized run.
- Duplicate-finish protection.
- Firebase Email/Password + Google Authentication.
- Cloud profile + realtime global leaderboard.
- Immutable private run records.
- Hardened Firestore Rules using atomic transaction checks and `getAfter()`.
- Gemini post-run analysis.
- ZIP source export.
- No npm / Node / build step required for the web project.

## Firebase setup

Read `FIREBASE_NEXT_STEPS.md`.

The included `firestore.rules` must be published to the existing `(default)` Firestore database before ranked cloud runs can be saved.

## Important security boundary

This is still a **browser-scored** game. The client contains the challenge and correctness logic, so determined attackers can use DevTools to bypass the client. V2 makes the Firebase data model and write path much harder to abuse, but it does not provide cryptographic proof that the player really solved the code.

For a truly competitive leaderboard, authoritative scoring must happen on a trusted backend. Firebase App Check can reduce abuse against Firebase resources but does not replace server-side score validation.

## Rank thresholds

- Bronze: 0
- Silver: 5
- Gold: 8
- Platinum: 15
- Legendary: 25
- GOD: 40

**Developed by HK1413.**
