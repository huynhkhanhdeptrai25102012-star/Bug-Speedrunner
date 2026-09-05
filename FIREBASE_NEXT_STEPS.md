# Firebase V5 setup

1. Enable Email/Password and Google Authentication.
2. Publish the included `firestore.rules` to the default Firestore database.
3. Add the deployed domain to Firebase Authentication Authorized domains.
4. Provision `role=admin` or `role=owner` as a Firebase custom claim from a trusted server environment. Never grant it from the browser.
5. Test ranked run, Event result, Event leaderboard, profile photoURL, and Admin Event Manager with separate accounts.

The ranked core is still browser-scored; trusted server validation is required if the leaderboard must be competitive against DevTools manipulation.
