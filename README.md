# VODCoach.AI

VODCoach.AI is a responsive video-coaching prototype for Apex Legends and VALORANT. Choose the game, rank, and corresponding legend or agent, then describe what you want to improve. A match clip is optional: the coach still returns four items covering aim, sightlines, ability usage, and a practice routine. If you do upload a clip, the UI previews it and the mock report uses timestamped, footage-based notes.

The current analysis is a local mock. Uploaded videos are parsed by the API but are not saved.

## Run it locally

You need [Node.js](https://nodejs.org/) 20 or newer and npm.

1. Download or clone this repository.
2. Open a terminal in the project folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).
6. Choose Apex Legends or VALORANT. The character and rank options update automatically.
7. Describe the struggle (at least 8 characters). You can submit immediately — video is optional.
8. Optionally drop an MP4, WebM, or MOV clip into the upload area, confirm the preview plays, and submit for a VOD-style report.

## Deploy on Vercel (Hobby / free)

Push this repository to GitHub, then import it in [Vercel](https://vercel.com). Leave the Framework Preset as **Next.js**. Vercel runs `npm install` and `npm run build` from the repo root. Do not set `output: "export"` in `next.config.ts` — `POST /api/coach` needs a Node server.

API keys are optional. The live app uses a local mock until you wire an OpenAI or Gemini adapter. Store secrets in Vercel **Environment Variables** with these names (never `NEXT_PUBLIC_`):

```text
COACH_PROVIDER=mock
OPENAI_API_KEY=
GEMINI_API_KEY=
```

The Hobby plan limits request bodies to about 4.5MB, so large clips will be rejected. Notes-only coaching (no video) works on day one.

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
│   ├── api/coach/route.ts       # JSON or multipart coaching endpoint and validation
│   ├── globals.css              # Tailwind and shadcn theme styles
│   ├── layout.tsx               # Fonts, metadata, and root layout
│   └── page.tsx                 # Upload, preview, scan, and report UI
├── components/ui/               # Reusable shadcn/ui primitives
└── lib/
    ├── games.ts                 # Typed per-game ranks, characters, labels, and defaults
    ├── coach/
    │   ├── mock-provider.ts      # Replaceable mock video-analysis provider
    │   └── types.ts              # Provider request/response contract
    └── utils.ts                  # Shared class-name helper
```

## API

`POST /api/coach` accepts `application/json` or `multipart/form-data`:

| Field | Type | Notes |
| --- | --- | --- |
| `video` | File | Optional. MP4, WebM, or MOV; maximum 100MB. Omit for notes-only coaching. |
| `game` | string | `apex-legends` or `valorant` |
| `rank` | string | Must belong to the selected game |
| `character` | string | Selected legend or agent |
| `concern` | string | At least 8 characters |

The route validates rank and character against the typed configuration in `src/lib/games.ts`, then calls the `VideoCoachProvider` interface. Add another game by extending `gameIds` and `gameConfigs`; the UI and API validation consume the same source of truth.

To connect GPT-4o, Gemini, or another video model:

1. Create a provider implementing `VideoCoachProvider` from `src/lib/coach/types.ts`.
2. Upload/sample the video as required by that provider.
3. Return the same `CoachResponse` shape.
4. Replace the exported provider in `src/lib/coach/mock-provider.ts` or move provider selection into an environment-based factory.

This keeps the UI and API response contract unchanged when the model changes.

## Dependencies

- Next.js App Router, React, and TypeScript
- Tailwind CSS and shadcn/ui primitives
- Lucide React icons

No database, authentication service, or AI key is required for the prototype.

## Validation and privacy

- Client and server both validate optional file type/size plus required game, rank, character, and concern.
- Object URLs used for video previews are revoked when a file is replaced, cleared, or the page unmounts.
- Errors, empty state, loading progress, and completed results each have dedicated UI.
- Production integrations should add authentication, rate limits, persistent job status, provider timeouts, and content-safety checks.
