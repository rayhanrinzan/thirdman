import { test, expect } from "@playwright/test";
import {
  createBoard,
  applyAction,
  passLane,
  type Board,
  type AnalysisResult,
} from "../../src/lib/lab";
import { scenarios } from "../../src/lib/tactics";
const dm = (page: import("@playwright/test").Page) =>
  page.locator('[data-player-id="dm"]');
async function explore(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Make the spare player" }),
  ).toBeVisible();
}

test("complete press story: reversible playback, apply, response, compare, undo and reset", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/");
  await expect(page.locator(".player")).toHaveCount(22);
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await explore(page);
  await expect(dm(page)).toHaveAttribute("data-x", "43.00");
  await page
    .getByRole("button", { name: "Play sequence", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Replay sequence", exact: true }),
  ).toBeVisible({ timeout: 10000 });
  await expect(dm(page)).toHaveAttribute("data-x", "25.00");
  await expect(page.locator(".ball")).toHaveAttribute("data-possession", "rcb");
  await page
    .getByRole("button", { name: "Cancel preview", exact: true })
    .first()
    .click();
  await expect(dm(page)).toHaveAttribute("data-x", "43.00");
  await expect(page.locator(".ball")).toHaveAttribute("data-possession", "gk");
  await explore(page);
  await page
    .getByRole("button", { name: "Apply final shape", exact: true })
    .click();
  await expect(dm(page)).toHaveAttribute("data-x", "25.00");
  await page
    .getByRole("button", { name: "Explore Arsenal’s response", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Close one door. Open another." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Apply response", exact: true })
    .click();
  await expect(page.locator('[data-player-id="ars-dm"]')).toHaveAttribute(
    "data-x",
    "34.00",
  );
  await expect(page.locator(".space-note")).toContainText("Space behind");
  await page.getByRole("button", { name: "Original", exact: true }).click();
  await expect(dm(page)).toHaveAttribute("data-x", "43.00");
  await page
    .getByRole("button", { name: "Tottenham adjustment", exact: true })
    .click();
  await expect(dm(page)).toHaveAttribute("data-x", "25.00");
  await expect(page.locator('[data-player-id="ars-dm"]')).toHaveAttribute(
    "data-x",
    "62.00",
  );
  await page
    .getByRole("button", { name: "Arsenal response", exact: true })
    .click();
  await expect(page.locator('[data-player-id="ars-dm"]')).toHaveAttribute(
    "data-x",
    "34.00",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(dm(page)).toHaveAttribute("data-x", "25.00");
  await expect(page.locator('[data-player-id="ars-dm"]')).toHaveAttribute(
    "data-x",
    "62.00",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(dm(page)).toHaveAttribute("data-x", "43.00");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("pause freezes a ball mid-pass; stepping, scrubbing, and replay are reversible", async ({
  page,
}) => {
  await page.goto("/");
  await explore(page);
  const slider = page.getByRole("slider", { name: "Sequence progress" });
  await slider.fill("1600");
  await page
    .getByRole("button", { name: "Play sequence", exact: true })
    .click();
  await page.waitForTimeout(180);
  await page
    .getByRole("button", { name: "Pause sequence", exact: true })
    .click();
  const x = await page.locator(".ball").getAttribute("data-x");
  await page.waitForTimeout(300);
  await expect(page.locator(".ball")).toHaveAttribute("data-x", x!);
  // Anchor step assertions to a known time; browser clicks can span another pass under load.
  await slider.fill("1600");
  await page
    .getByRole("button", { name: "Previous step", exact: true })
    .click();
  await expect(slider).toHaveValue("1400");
  await page.getByRole("button", { name: "Next step", exact: true }).click();
  await expect(slider).toHaveValue("2400");
  await page
    .getByRole("button", { name: "Restart sequence", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause sequence", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(dm(page)).toHaveAttribute("data-x", "43.00");
  await page.waitForTimeout(500);
  await expect(dm(page)).toHaveAttribute("data-x", "43.00");
});

test("edit both teams, transfer possession, change formations, and undo redo", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Arsenal", exact: true }).click();
  const p = page.locator('[data-player-id="ars-dm"]');
  await p.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(p).toHaveAttribute("data-x", "61.00");
  await expect(page.getByText("Edited shape", { exact: true })).toBeVisible();
  await p.click();
  await page
    .getByRole("button", { name: "Give possession", exact: true })
    .click();
  await expect(page.locator(".ball")).toHaveAttribute(
    "data-possession",
    "ars-dm",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".ball")).toHaveAttribute("data-possession", "gk");
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.locator(".ball")).toHaveAttribute(
    "data-possession",
    "ars-dm",
  );
  await page
    .getByRole("combobox", { name: "Formation", exact: true })
    .selectOption("3–2–5");
  await expect(p).toHaveText("CB");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(p).toHaveText("LCM");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  const target = dm(page),
    bounds = await target.boundingBox(),
    pitch = await page.locator(".pitch").boundingBox();
  if (!bounds || !pitch) throw new Error("Missing pitch");
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    pitch.x + pitch.width * 0.48,
    pitch.y + pitch.height * 0.55,
    { steps: 8 },
  );
  await page.mouse.up();
  expect(Number(await target.getAttribute("data-x"))).toBeCloseTo(48, 0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(target).toHaveAttribute("data-x", "43.00");
});

test("all scenarios and distinct curated questions have usable sequences", async ({
  page,
}) => {
  await page.goto("/");
  for (const [label, id] of [
    ["Invert fullback", "lb"],
    ["Overlap", "lw"],
    ["Double pivot", "rcm"],
  ]) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await page
      .getByRole("button", { name: "Apply final shape", exact: true })
      .click();
    await expect(page.locator(`[data-player-id="${id}"]`)).toBeVisible();
    await page.getByRole("button", { name: "Reset", exact: true }).click();
  }
  for (const [scenario, heading] of [
    ["block", "Connect through the half-space"],
    ["lead", "Keep two players behind the ball"],
  ]) {
    await page
      .getByRole("combobox", { name: "Scenario", exact: true })
      .selectOption(scenario);
    await page.getByRole("button", { name: "Explore", exact: true }).click();
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await page
      .getByRole("button", { name: "Apply final shape", exact: true })
      .click();
  }
  await page
    .getByRole("textbox", { name: "Tactical question" })
    .fill("Who will win the league?");
  await page.getByRole("textbox").press("Enter");
  await expect(page.locator(".question-dock")).toContainText(
    "This question needs live AI",
  );
  await expect(page.getByRole("complementary")).toHaveCount(0);
});

test("overlays, help focus, empty questions, and reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const choice of ["passing", "shape", "pressure"]) {
    await page
      .getByRole("combobox", { name: "Tactical overlay", exact: true })
      .selectOption(choice);
    await expect(page.locator(".board-context")).toContainText(
      choice === "passing"
        ? "Nearest four"
        : choice === "shape"
          ? "Outfield"
          : "Opponents within",
    );
  }
  await page.getByRole("textbox").fill("");
  await expect(
    page.getByRole("button", { name: "Explore", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Free player", exact: true }).click();
  await page
    .getByRole("button", { name: "Next step", exact: true })
    .first()
    .click();
  await expect(dm(page)).toHaveAttribute("data-x", "25.00");
  await expect(
    page.getByRole("button", { name: "Pause sequence", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "How it works", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Close how it works", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "How it works", exact: true }),
  ).toBeFocused();
});

test("reset cancels stale requests and network failure recovers with a sequence", async ({
  page,
}) => {
  await page.goto("/");
  await page.route("**/api/analyze", async (route) => {
    await new Promise((r) => setTimeout(r, 800));
    await route.abort().catch(() => {});
  });
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Reading the shape…" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.waitForTimeout(1000);
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Make the spare player" }),
  ).toBeVisible();
});

test("API validates rosters, possession and request size; all no-key scenarios work", async ({
  request,
}) => {
  for (const scenario of ["press", "block", "lead"] as const) {
    const r = await request.post("/api/analyze", {
      data: {
        scenario,
        question: scenarios[scenario].question,
        board: createBoard(scenario),
      },
    });
    expect(r.status()).toBe(200);
    const result = await r.json();
    expect(result.source).toBe("fallback");
    expect(result.analysis.actions.length).toBeGreaterThan(1);
  }
  const board = createBoard("press");
  expect(
    (
      await request.post("/api/analyze", {
        data: {
          scenario: "press",
          question: "free player",
          board: { ...board, possession: "missing" },
        },
      })
    ).status(),
  ).toBe(400);
  expect(
    (await request.post("/api/analyze", { data: { question: "" } })).status(),
  ).toBe(400);
  expect(
    (await request.post("/api/analyze", { data: "x".repeat(25000) })).status(),
  ).toBe(413);
});

test("an opponent in an amber passing lane makes the sequence route around it", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Arsenal", exact: true }).click();
  const opponent = page.locator('[data-player-id="ars-st"]');
  const piece = await opponent.boundingBox(),
    pitch = await page.locator(".pitch").boundingBox();
  if (!piece || !pitch) throw new Error("Missing board");
  await page.mouse.move(piece.x + piece.width / 2, piece.y + piece.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    pitch.x + pitch.width * 0.165,
    pitch.y + pitch.height * 0.415,
    { steps: 8 },
  );
  await page.mouse.up();
  await page
    .getByRole("combobox", { name: "Tactical overlay", exact: true })
    .selectOption("passing");
  await expect(page.locator('[data-passing-to="lcb"]')).toHaveAttribute(
    "data-blocked",
    "true",
  );
  const pending = page.waitForResponse((r) => r.url().endsWith("/api/analyze"));
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  const response = await pending;
  let board: Board = response.request().postDataJSON().board;
  const result: AnalysisResult = await response.json();
  expect(result.analysis).toBeTruthy();
  let passes = 0;
  for (const action of result.analysis!.actions) {
    if (action.type === "pass") {
      expect(passLane(board, action.fromId, action.toId).blocked).toBe(false);
      expect(action.fromId === "gk" && action.toId === "lcb").toBe(false);
      passes++;
    }
    board = applyAction(board, action);
  }
  expect(passes).toBeGreaterThan(0);
  await expect(page.locator(".inline-notice")).toContainText("blocked");
  await page
    .getByRole("button", { name: "Apply final shape", exact: true })
    .click();
  await expect(page.locator(".ball")).toHaveAttribute(
    "data-possession",
    board.possession,
  );
  await page
    .getByRole("button", { name: "Explore Arsenal’s response", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Apply response", exact: true })
    .click();
  for (const action of result.analysis!.opponent.movements)
    board = applyAction(board, action);
  const blocked = passLane(
    board,
    board.possession,
    result.analysis!.opponent.outletPlayerId,
  ).blocked;
  await expect(page.locator("[data-response-route]")).toHaveCount(
    blocked ? 0 : 1,
  );
  if (blocked)
    await expect(page.locator(".space-note")).toContainText(
      "Direct outlet unavailable",
    );
});
