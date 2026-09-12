# THIRDMAN

**AI football tactics sandbox. See the game differently.**

Move players, change the shape, and ask AI how the game changes. Thirdman turns a tactical question into one concrete, visible adjustment on a Tottenham–Arsenal board.

## The 30-second demo

1. Open the app. Tottenham builds out against Arsenal's two-forward press.
2. Drag a white player, or focus one and use arrow keys (Shift for larger steps).
3. Select **How do we beat this press?** and press Enter or **ANALYZE SHAPE**.
4. Read the diagnosis and click **APPLY ADJUSTMENT →**.
5. Watch the DM drop between the center backs: **2v2 first line → 3v2 overload**.
6. Select **ASK OPPOSITION AI** to see Arsenal's possible response.
7. **RESET** restores the original board and clears every analysis state.

The full demonstration works without an API key.

## Scenarios

- **Beat the press:** drop the DM between the center backs to create a spare player in buildup.
- **Break a low block:** bring the left winger into a half-space to create a local overload.
- **Protect a lead:** drop the right central midfielder alongside the DM to create a double pivot.

These are illustrative tactical scenarios using positional roles, not reconstructions of real matches. No club crests, player images, scraped statistics, or external football datasets are used.

## Run locally

Use Node.js 22+ and npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open [localhost:3000](http://localhost:3000). Both environment variables may remain empty.

```text
OPENAI_API_KEY=
OPENAI_MODEL=
```

For live analysis, add your OpenAI API key to `.env.local` or your host's secure server environment. Never use a `NEXT_PUBLIC_` key. Restart the dev server after changing the environment. Model selection is centralized in `src/lib/openai.ts`; `OPENAI_MODEL` overrides the default `gpt-5.4-mini`, which supports Responses and Structured Outputs. Use a model available to your API project that supports these features.

## Architecture

- **Next.js App Router + TypeScript:** one page and one Node server route, `/api/analyze`.
- **React state:** normalized board coordinates, scenario, question, analysis and applied state; no database or global state library.
- **Tailwind CSS + authored CSS:** responsive dark workspace, locally drawn SVG pitch and team pieces.
- **Motion + Pointer Events:** animated scenario/adjustment transitions, captured-pointer dragging, keyboard alternatives and reduced-motion support.
- **Lucide:** restrained interface icons.
- **OpenAI official SDK + Zod:** typed, validated analysis, with deterministic recovery.

### Coordinates

The landscape pitch uses percentages: **x increases left → right; y increases top → bottom. Tottenham always attacks toward increasing x.** All movement stays within 4–96 on both axes. Pixel measurements are used only to convert a pointer position into normalized coordinates. Every player has a stable ID. The DM is `dm`; Arsenal IDs have an `ars-` prefix.

In the press preset, the center backs are `(25, 33)` and `(25, 67)`. The DM moves from `(43, 50)` to their midpoint `(25, 50)`. The fallback recomputes that midpoint from the current center backs. The double-pivot target follows the current DM.

### AI integration

The browser sends the question, scenario, both formations and all 22 players (IDs, roles, teams and positions). The route validates the request, including roster identity, uniqueness, coordinates and body size, before calling the API.

`src/lib/openai.ts` uses the installed SDK's `client.responses.parse()` and `zodTextFormat()` to send a strict JSON schema through `text.format`. Responses are not stored (`store: false`). The prompt confines analysis to the board, favors one player movement, and excludes invented statistics, attributes or match events.

The returned object is validated again with Zod. Unknown IDs, opponent movements, non-finite coordinates, incomplete fields and excessive text are rejected. Valid numeric coordinates are clamped. Only validated results reach the UI. API credentials and SDK errors are never logged or returned.

Official references: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) and [GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini).

### Reliability and limitations

If no key is present, or the SDK fails, times out, exhausts quota, refuses, or returns invalid output, `src/lib/fallback.ts` produces a curated scenario recommendation with the identical `Analysis` type. These are deterministic structural suggestions, not free-form answers to arbitrary tactical questions. A small **Scenario guide** attribution distinguishes these from live board analysis. Fallback labels describe the intended preset relationship; extensively edited boards should be reset to reproduce the canonical demonstration.

The server timeout is 18 seconds with SDK retries disabled. The browser has a separate 22-second deadline and a local fallback if the route cannot be reached. Reset, scenario changes and player moves abort pending requests and invalidate stale results. Applying a move is idempotent. The opponent response is included in the same analysis; it requires no second API call.

The public endpoint is intentionally simple. No authentication, durable rate limiter or database is included. For a public demo with a paid API key, set project usage limits in OpenAI and consider Vercel's platform rate controls for expected traffic. Without a key, hosting the full demo makes no paid API calls.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The Playwright suite starts the production build with `OPENAI_API_KEY` empty. It checks the full flow at desktop and phone widths, pointer and keyboard movement, all scenarios, reset, opposition response, modal focus and Escape, stale requests, client network recovery, API validation and browser errors. Run it after `npm run build`. Stop any existing server using a key first so the suite can test the no-key path.

```sh
npm run start
```

## Vercel deployment

Import the existing [rayhanrinzan/thirdman](https://github.com/rayhanrinzan/thirdman) repository in Vercel. Use the Next.js preset, repository root, `npm ci`, and `npm run build`. No custom Vercel configuration is required.

For live AI, set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` through Vercel's secure environment settings for the intended environments, then redeploy. Leave them unset for the complete deterministic demo. Never commit `.env.local` or `.vercel` credentials.

For an authenticated CLI deployment:

```sh
npx vercel --prod
```

Built as an exploration of generative AI + football tactics.
