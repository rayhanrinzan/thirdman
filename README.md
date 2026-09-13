# THIRDMAN

**AI football tactics sandbox.** Set up a shape, explore an idea, play the sequence, inspect a possible response, and compare the consequences.

## The one-minute demo

1. Open **Beat the press**. Tottenham has the ball with the goalkeeper.
2. Click **Explore** with “How can we create a free player?” The original board stays intact; ghosts preview the movement.
3. Click **Play sequence**. The DM drops between the center backs and the ball circulates GK → LCB → DM → RCB. Pause, scrub, replay, or use the step controls.
4. Click **Apply final shape**, then **Explore Arsenal’s response**. One possible midfielder jump leaves highlighted space and a possible next passing route.
5. Use **Original / Tottenham adjustment / Arsenal response** to compare stages. Apply the response separately, then return to editing. Undo reverses the response and Tottenham adjustment in separate steps.
6. Try **Invert fullback**, **Overlap**, or **Double pivot**, or switch scenarios. **Reset** restores the complete current scenario and cancels requests and playback.

The whole demo works without an API key. Live analysis may choose a different valid sequence based on the actual board and question.

## Working with the board

- Select **Tottenham** or **Arsenal** to edit that team. Drag a piece, or focus it and use arrow keys; Shift moves farther. Select a player to assign possession or inspect nearby pressure.
- Both teams offer **4–3–3, 4–2–3–1, 3–2–5, and 4–4–2**. Stable identities survive formation changes; displayed roles update. Manual movements are labeled **Edited shape**.
- Undo/redo includes player movement, possession, formations, applied sequences and opposition responses. A drag is one history entry; up to 40 entries are kept in memory.
- One optional overlay is visible at a time: nearby passing options, team shape, or pressure around the selected player. Passing lanes use geometric proximity, not success probabilities. The pressure ring shows nearby opponents, not a simulated press.
- Preview and playback are separate from the editable board. **Cancel preview** discards an unapplied preview. After applying, **Return to editing** preserves the applied board; undo restores earlier states.
- Reduced-motion mode offers a step-based sequence. On phones, contextual information stacks beneath the pitch and new sequences bring the board into view.

## Three distinct scenarios

| Scenario | Idea | Tradeoff |
| --- | --- | --- |
| Beat the press | Drop a holding midfielder into the first line and circulate through the spare player. | Less midfield presence until the next pass. |
| Break a low block | Move the winger into a half-space, combine inside, and find the outside lane. | The supporting fullback leaves space behind. |
| Protect a lead | Form a double pivot and recycle through the center backs. | Reduced forward support. |

These are illustrative shapes using positional roles, not reconstructions of real matches. The response is a possibility, not a prediction. No external datasets, real player attributes, invented xG, probabilities, or tactical ratings are used.

## Run locally

Use Node.js 22+ and npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open [localhost:3000](http://localhost:3000). Both environment variables may remain empty:

```text
OPENAI_API_KEY=
OPENAI_MODEL=
```

For live analysis, add an API key to `.env.local` or your host’s secure server environment. Never use a `NEXT_PUBLIC_` key. Restart after changing environment variables. `OPENAI_MODEL` overrides the central default `gpt-5.4-mini`; the selected model must be available to your project and support Responses Structured Outputs.

## Architecture

- **Next.js App Router + TypeScript:** one page and one Node route, `/api/analyze`.
- **`src/lib/lab.ts`:** board types, Zod schemas, action validation, formation layouts, history reducer, geometry, and pure deterministic timeline sampling.
- **`src/lib/curated.ts`:** bounded intent matching and distinct no-key sequences, calculated from current coordinates and possession.
- **`src/components/sandbox.tsx`:** separate editable history, preview snapshot, comparison stage, and applied state. No database or global state library.
- **`src/components/use-timeline.ts`:** playback clock, pause, seek and background-tab pause. The same timestamp always produces the same positions, including a ball paused mid-pass.
- **`src/components/pitch.tsx`:** SVG pitch and overlays, Motion transitions, pointer capture and keyboard editing.
- **`src/lib/openai.ts`:** server-only official OpenAI SDK, Responses API and `zodTextFormat`.

### Coordinates and sequence data

Positions are normalized: **x increases left → right; y increases top → bottom. Tottenham attacks toward increasing x.** Coordinates stay within 4–96. Pixel measurements only convert pointer positions. Player IDs stay stable even when their formation role changes; Arsenal IDs start with `ars-`.

Each sequence has concise analysis text, timed `move`, `pass`, and `highlight` actions, and a separate opponent response. Validation checks roster identity, team ownership, finite coordinates, coherent possession transfers, meaningful changes, bounded text, at most three Tottenham moves and four passes, and at most 18 seconds of main playback. The opponent stage contains one or two Arsenal moves. Every pass is checked against the same lane geometry as the passing overlay, using player positions after all preceding actions. Opponents within four pitch-length units of the straight passing segment (including its endpoints) block the pass. Invalid live sequences fall back to curated routes, which search for open supporting connections within the four-pass budget. If no route exists, the guide omits that connection and explains why. Opposition-response arrows are only shown for an open direct lane; the highlighted space can remain useful even when it cannot yet be reached. Finite model coordinates are clamped to the safe pitch boundary; malformed values are rejected.

In the default press example, center backs are `(25, 33)` and `(25, 67)`. The DM drops from `(43, 50)` to their current midpoint `(25, 50)`. A possible Arsenal midfielder jump leaves its former midfield space visible. Heavily edited shapes receive conservative labels rather than an assumed numerical overload.

### AI and deterministic recovery

The browser sends the actual question, scenario, all 22 players, roles, formations, edited-shape flags, and ball owner. The route validates the roster and a 24 KB body limit. The server sends a strict Structured Outputs schema using `client.responses.parse()` with `store: false`, then validates the result semantically. The model never generates code to run.

Without a key, or after provider failure, refusal, timeout, incomplete output or invalid actions, the app uses a curated exploration. Free-player buildup, fullback inversion, overlap, half-space and double-pivot questions produce distinct responses. Unsupported questions receive an honest explanation and supported shortcuts. Arsenal possession produces shape-only Tottenham actions instead of inventing a possession change. Small **Live board analysis** or **Curated exploration** attribution identifies the source.

The server timeout is 18 seconds with retries disabled; the browser has a separate 22-second deadline and local recovery. Reset, scenario changes, edits and new requests invalidate stale results. Opponent actions are included in the original analysis, so exploring the response needs no extra API call. Credentials, provider errors and question contents are not logged.

References: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) and [GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini).

## Validation

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Run browser tests after building. The suite starts the production server with an empty API key; stop any existing key-enabled server first. Engine and server tests cover all curated combinations, immutable interpolation, history, identities, invalid action rejection, and real SDK requests against mocked provider responses. Browser tests exercise desktop and phone widths, both teams, possession, formations, overlays, complete playback and response flows, comparison, undo/redo, request cancellation, network recovery, keyboard access, reduced motion, modal focus and browser errors.

## Deployment

The existing [rayhanrinzan/thirdman](https://github.com/rayhanrinzan/thirdman) repository is connected to Vercel. Pushes to `main` trigger its production deployment. Use the **Next.js** preset, repository root, default output directory, `npm ci`, and `npm run build`.

For live AI, set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` in Vercel’s secure environment settings, then redeploy. Leave them unset for the deterministic demo. No accounts, database, payments, or additional infrastructure are required. The API has no durable rate limiter; a paid public deployment can use host-level traffic controls and API project limits.
