# VODCoach.AI

VODCoach.AI coaches Apex Legends and VALORANT from a clip, a full match VOD, or a live PC screen share. Japanese UI. No in-game HUD overlay.

Clips are uploaded **directly to Vercel Blob** from the browser so they never pass through the Hobby 4.5MB request body cap. `/api/coach` receives JSON with the Blob HTTPS URL (no video file body). Safari never uses a file input; drop the clip instead.

## Coaching modes

- **Short clip (about 90 seconds or less):** one Gemini video call (`gemini-3.8-flash`) on the Blob URL.
- **Full match (longer VODs):** the client splits the timeline into ~40 second windows so each Hobby function stays under ~60 seconds, then runs up to 3 Gemini calls in parallel on the same Blob URL plus time offsets. Each `/api/coach` call has a ~52s client timeout (under Hobby 60s) and leftover requests abort on error or unmount. The UI shows `区間 N / total`. Match analysis cannot stay spinning past 5 minutes. JPEG stills are only extracted if that Blob URL path fails. Results merge into one match report with more timestamped scenes — not only aim / positioning / abilities / practice.
- **PC live:** browser `getDisplayMedia` (window or screen). About every 5 seconds the page grabs JPEGs and updates the coaching panel. There is no overlay on the game. Windowed or borderless is required so you can see this site. VALORANT Vanguard and similar anti-cheat may block capture (black frames or a hard failure); the UI says so.

Live coaching uses Gemini when `COACH_PROVIDER=gemini` and `GEMINI_API_KEY` are set on the server. Without a key, analysis falls back to the local mock. Do not prefix secrets with `NEXT_PUBLIC_`.

## Run it locally

You need [Node.js](https://nodejs.org/) 20 or newer and npm.

1. Download or clone this repository.
2. Copy `.env.example` to `.env.local`. Leave the values empty unless you have your own secrets. Never commit `.env.local`.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).
6. Notes-only coaching works with no keys (8+ characters in the struggle field).
7. Video coaching needs `BLOB_READ_WRITE_TOKEN` for the client upload. If it is missing, the app shows a Japanese error instead of sending the file to `/api/coach`.
8. Real clip / match / live analysis also needs `GEMINI_API_KEY`. Match windows prefer the Blob URL with time offsets (up to 3 at a time) and do not re-download the whole VOD through the Gemini Files API (that path is still used for short clips). JPEG backups run only when the URL call fails.

## Deploy on Vercel (Hobby / free)

Push this repository to GitHub, then import it in [Vercel](https://vercel.com). Leave the Framework Preset as **Next.js**. Do not set `output: "export"` in `next.config.ts`.

Store secrets in Vercel **Environment Variables** (never `NEXT_PUBLIC_`, never in git):

```text
COACH_PROVIDER=gemini
GEMINI_API_KEY=
BLOB_READ_WRITE_TOKEN=
```

Leave `GEMINI_API_KEY` empty for mock notes-only. For real analysis, set the Blob read/write token, `COACH_PROVIDER=gemini`, and `GEMINI_API_KEY`. After adding variables, Redeploy so the function picks them up.

Maximum clip size is about 80MB. The coaching API body stays small (JSON + a Blob URL, optional JPEGs). Hobby functions are capped around 60 seconds — that is why long matches are chunked on the client.

## Commands

```bash
npm run dev       # Start the development server
npm run lint      # Run ESLint
npx tsc --noEmit  # Check TypeScript
npm run build     # Create a production build
npm run start     # Run the production build
```

## Project structure

```text
src/
├── app/
│   ├── api/blob/upload/route.ts # Client token for @vercel/blob
│   ├── api/coach/route.ts       # JSON coaching endpoint (clip / match / live)
│   └── page.tsx                 # VOD drop + PC live session
├── components/
│   ├── insight-card.tsx
│   └── live-session.tsx         # Screen capture + live panel
└── lib/
    ├── match-plan.ts            # 40s windows, timestamp shift, chunk pool
    ├── async-pool.ts            # bounded parallel match-chunk calls
    ├── live-capture.ts
    ├── upload-clip.ts           # Direct Blob upload
    └── coach/
        ├── mock-provider.ts
        ├── gemini-provider.ts   # gemini-3.8-flash when GEMINI_API_KEY is set
        └── types.ts
```

## API

`POST /api/coach` accepts JSON only (no video file body):

| Field | Type | Notes |
| --- | --- | --- |
| `mode` | string | `clip` (default), `match-chunk`, `match-merge`, `live` |
| `videoUrl` | string | Optional HTTPS URL from Vercel Blob |
| `startOffsetSec` / `endOffsetSec` | number | Match window on the same Blob URL |
| `frames` | array | JPEG data URLs. Used for live and as match-window backup |
| `chunkReports` | array | Text-only input for `match-merge` |
| `game` | string | `apex-legends` or `valorant` |
| `rank` | string | Must belong to the selected game |
| `character` | string | Selected legend or agent |
| `concern` | string | At least 8 characters when there is no clip (clip/notes mode) |

`POST /api/blob/upload` is the `@vercel/blob` `handleUpload` endpoint. `GET /api/blob/upload` reports whether `BLOB_READ_WRITE_TOKEN` is set. It returns a Japanese error when the token is missing.

## Dependencies

- Next.js App Router, React, and TypeScript
- Tailwind CSS and shadcn/ui primitives
- `@vercel/blob` for client uploads
- Lucide React icons

No database or authentication is required for the prototype.
