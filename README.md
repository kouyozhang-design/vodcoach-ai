# VODCoach.AI

VODCoach.AI is a responsive video-coaching prototype for Apex Legends and VALORANT. Choose the game, rank, and corresponding legend or agent. A match clip is optional.

Clips are uploaded **directly to Vercel Blob** from the browser so they never pass through the Hobby 4.5MB request body cap. `/api/coach` receives JSON with the Blob HTTPS URL (no video bytes, no JPEG frames). Safari never uses a file input; drop the clip instead.

Live coaching uses **Gemini video understanding** (`gemini-3.8-flash`). Set `COACH_PROVIDER=gemini` and `GEMINI_API_KEY` on the server. Without a key, analysis falls back to the local mock. Do not prefix secrets with `NEXT_PUBLIC_`.

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
8. Real clip analysis also needs `GEMINI_API_KEY`. The server sends Gemini the Blob URL when possible, otherwise it uploads the clip through the Gemini Files API.

## Deploy on Vercel (Hobby / free)

Push this repository to GitHub, then import it in [Vercel](https://vercel.com). Leave the Framework Preset as **Next.js**. Do not set `output: "export"` in `next.config.ts`.

Store secrets in Vercel **Environment Variables** (never `NEXT_PUBLIC_`, never in git):

```text
COACH_PROVIDER=gemini
GEMINI_API_KEY=
BLOB_READ_WRITE_TOKEN=
```

Leave `GEMINI_API_KEY` empty for mock notes-only. For real clip analysis, set the Blob read/write token, `COACH_PROVIDER=gemini`, and `GEMINI_API_KEY`. After adding variables, Redeploy so the function picks them up.

Maximum clip size is about 80MB. The coaching API body stays small (JSON + a Blob URL). Hobby functions are capped around 60 seconds.

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
│   ├── api/coach/route.ts       # JSON coaching endpoint
│   └── page.tsx                 # Drop, preview, scan, and report UI
└── lib/
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
| `videoUrl` | string | Optional HTTPS URL from Vercel Blob. Gemini analyzes this video file. |
| `frames` | array | Ignored by the live Gemini path. Kept for older clients. |
| `game` | string | `apex-legends` or `valorant` |
| `rank` | string | Must belong to the selected game |
| `character` | string | Selected legend or agent |
| `concern` | string | At least 8 characters when there is no clip |

`POST /api/blob/upload` is the `@vercel/blob` `handleUpload` endpoint. `GET /api/blob/upload` reports whether `BLOB_READ_WRITE_TOKEN` is set. It returns a Japanese error when the token is missing.

## Dependencies

- Next.js App Router, React, and TypeScript
- Tailwind CSS and shadcn/ui primitives
- `@vercel/blob` for client uploads
- Lucide React icons

No database or authentication is required for the prototype.
