# Attendance System

A web app for managing courses, students, lecture sessions and attendance, built with HTML, CSS, JavaScript and Firebase (Auth, Firestore, Realtime Database). Fingerprint and RFID enrollment is handled through the Realtime Database.

## Running locally

The app uses ES modules, so it must be served over HTTP (opening the files directly won't work).

    npx serve .

Then open the URL it prints (usually http://localhost:3000), or use the VS Code Live Server extension.

## Project structure

```
attendance-system/
├── index.html              # Login page
├── pages/                  # One HTML file per page
├── assets/
│   └── css/style.css       # The single shared stylesheet
└── src/
    ├── config/firebase.js  # The only place Firebase is configured and initialized
    ├── shared/             # auth.js (login guard, logout), sidebar.js, layout.js
    ├── services/           # Firestore data access (courses-service.js)
    └── pages/              # One script per page
```

## Pages

Live Session, Courses, Students, Create Session, Lecture History, Search, Enroll, Reports & Analysis.

## Conventions

- Each page loads `src/shared/layout.js` (sidebar and logout) plus its own script from `src/pages/`.
- Page scripts call `requireAuth()` from `src/shared/auth.js` to redirect logged-out users to the login page.
- Import Firebase objects (`app`, `auth`, `db`) from `src/config/firebase.js`. Never call `initializeApp` anywhere else.
- Styles live in `assets/css/style.css`. Page-specific rules go in a labelled section at the end of that file.

## Tech

- Vanilla HTML/CSS/JS (no build step)
- Firebase 10.12.2 (loaded from the gstatic CDN)