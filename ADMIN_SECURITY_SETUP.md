# Admin / Owner security setup

The browser only reads Firebase ID token custom claims to decide whether to show Admin UI. Firestore Rules enforce authorization for Event documents.

Roles:
- normal user: no role claim
- admin: `role = admin`
- owner: `role = owner`

Never set roles from browser code, localStorage, display name, or email checks. Provision claims only from a trusted Admin SDK / Cloud Function / server environment.

For production, move Close/Freeze/Announce and other multi-step privileged actions into trusted Cloud Functions, add App Check, and require recent-login reauthentication for sensitive Owner actions.
