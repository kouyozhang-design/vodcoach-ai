# VODCoach.AI

VODCoach.AI is a responsive video-coaching prototype for Apex Legends and VALORANT. Choose the game, rank, and corresponding legend or agent. A match clip is optional.

Clips are uploaded **directly to Vercel Blob** from the browser so they never pass through the Hobby 4.5MB request body cap. `/api/coach` receives only the Blob URL plus a few JPEG frames extracted in the browser. Safari never uses a file input; drop the clip instead.

Without `OPENAI_API_KEY`, analysis falls back to the local mock. Set `COACH_PROVIDER=openai` and `OPENAI_API_KEY` on the server to use gpt-4o-mini.

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

## Deploy on Vercel (Hobby / free)

Push this repository to GitHub, then import it in [Vercel](https://vercel.com). Leave the Framework Preset as **Next.js**. Do not set `output: "export"` in `next.config.ts`.

Store secrets in Vercel **Environment Variables** (never `NEXT_PUBLIC_`, never in git):

```text
COACH_PROVIDER=
OPENAI_API_KEY=
BLOB_READ_WRITE_TOKEN=
```

Leave them empty for mock notes-only. For real clip analysis, set Blob read/write token and, for gpt-4o-mini, `COACH_PROVIDER=openai` plus `OPENAI_API_KEY`.

Maximum clip size is about 80MB. The coaching API body stays small (JSON + JPEG frames).

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
    ├── extract-frames.ts        # Browser JPEG frames (no ffmpeg)
    ├── upload-clip.ts           # Direct Blob upload
    └── coach/
        ├── mock-provider.ts
        ├── openai-provider.ts   # gpt-4o-mini when COACH_PROVIDER=openai
        └── types.ts
```

## API

`POST /api/coach` accepts JSON only (no video file body):

| Field | Type | Notes |
| --- | --- | --- |
| `videoUrl` | string | Optional HTTPS URL from Vercel Blob |
| `frames` | array | Optional JPEG data URLs extracted in the browser |
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
