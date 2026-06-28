<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Nivaran — AI-Powered Civic Issue Reporting & Resolution Platform

Nivaran lets citizens report local civic issues — potholes, garbage, broken streetlights, water leaks — with a photo, description, and location. An AI agent classifies each report, scores its severity, escalates high-risk issues with reasoned justification, and generates a resolution plan. Every status change is logged publicly, so citizens can see exactly what happened to their report and who acted on it.

Built for the **Vibe2Skill Hackathon** — Problem Statement 2: *Community Hero — Hyperlocal Problem Solver*.

> 📄 Full project description (problem statement, solution overview, features, tech stack): see the submitted Google Doc.
> 🔗 Live app: [Insert deployed URL]

---

## What It Does

1. **Report** — Citizen captures a photo, adds a description, and shares location (geolocation or manual entry).
2. **Duplicate Check** — Before saving, the system checks for similar open reports nearby (same category, within 200m). If found, the citizen chooses: confirm it's the same issue (attaches their photo as evidence to the existing report) or submit as genuinely new.
3. **AI Analysis** — Gemini analyzes the photo + description to assign a category, severity, and a natural-language verification summary. High-severity reports are auto-escalated with a generated justification.
4. **Resolution Plan** — The system generates a suggested action, responsible department, estimated resources, and time to resolve.
5. **Public Visibility & Dispatch** — The report appears in the public feed and an operator dispatch view. Other citizens can verify it's still active or confirm it's resolved. Every transition is logged to a public Citizen Transparency Log.
6. **Civic Points** — Citizens earn points (report submitted, AI-verified, resolved, community-confirmed) reflected live on a leaderboard.
7. **Predictive Hotspots** — As real reports accumulate, the system surfaces genuine recurring-issue zones — but only when there's enough real report density to support the pattern; otherwise it says so honestly instead of guessing.

## Key Design Principle

Nowhere in this app does the AI fabricate confidence it doesn't have:
- If Gemini analysis fails after trying multiple fallback models, the report says **"AI analysis pending"** rather than inventing a result.
- The hotspot feature only surfaces a zone when at least 2 real matching reports exist nearby, and cites the literal count in its reasoning.
- No synthetic/seeded data is used in production — all displayed numbers come from real Firestore data.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite) |
| Backend | Node.js / Express |
| Database | Cloud Firestore |
| Auth | Firebase Authentication (Google Sign-In) |
| AI | Gemini API (with automatic multi-model fallback) |
| Build Environment | Google AI Studio (Build Mode) |
| Hosting | Google Cloud Run |

## Project Structure

```
src/
  components/      # Dashboard, Leaderboard, ReportForm, ReportList, Header, DispatchView
  App.tsx           # Main app shell, report state, points logic, verification flow
  firebase.ts        # Firebase client init
server.ts            # Express backend — Gemini calls, AI analysis, duplicate detection, hotspots
firestore.rules       # Firestore security rules
```

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```
   npm install
   ```
2. Set the `GEMINI_API_KEY` in `.env.local` to your Gemini API key (see `.env.example` for the required variables).
3. Run the app:
   ```
   npm run dev
   ```

> **Security note:** Never commit a real `.env` or `.env.local` file. This repo's `.gitignore` already excludes them — `.env.example` is the only tracked env-related file, and contains placeholder values only.

## Firestore Security

`firestore.rules` requires Firebase Authentication for all write operations (creating reports, submitting verifications, updating points). Reads are public, consistent with the platform's transparency goal — anyone can view civic reports without signing in, but only authenticated citizens can act on them.