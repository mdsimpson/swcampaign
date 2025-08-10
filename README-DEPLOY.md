# Southern Walk Campaign – Amplify App

Implements the uploaded specs (`product-brief.md`, `requirements.md`, `roles.md`, `views.md`).

## Local Dev

```bash
npm i
npm run sandbox # provisions personal backend and writes amplify_outputs.json
npm run dev
```

Create a `.env` with:

```
VITE_GOOGLE_MAPS_API_KEY=YOUR_API_KEY
```

## Admin bootstrap

```bash
npm run seed:admin -- michael.d.simpson@gmail.com 'TempPass#2025'
```

## CSV imports

```bash
npm run import:homeowners -- /absolute/path/to/Homeowners.csv
npm run import:votes -- /absolute/path/to/Votes.csv
```

## Deploy on Amplify Hosting (GitHub connected)

1) Push this folder to your GitHub repo branch.
2) Amplify Console → **New app** → **Host web app** → connect to the repo/branch.
3) First build creates the backend and hosts the SPA.
4) Open the app URL and sign in.

## Daily backups (simple manual)

Run `npm run export:backup` to dump each model into JSON files. We can schedule this via EventBridge later.
