import { test, expect } from "@playwright/test";
import { initialPlayers, scenarios } from "../../src/lib/tactics";

test("complete no-key demo, every scenario, reset, modal and clean console", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await expect(page.locator(".player")).toHaveCount(22);
  await expect(
    page.getByRole("button", { name: "ANALYZE SHAPE", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "How do we beat this press?", exact: true })
    .click();
  await page.getByRole("textbox").press("Enter");
  await expect(
    page.getByRole("heading", { name: "Create a 3v2 in the first line" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "APPLY ADJUSTMENT", exact: true })
    .click();
  const dm = page.locator('[data-player-id="dm"]');
  await expect(dm).toHaveAttribute("data-x", "25.00");
  await expect(dm).toHaveAttribute("data-y", "50.00");
  await expect(page.locator(".board-status")).toContainText("2v2 first line");
  await expect(page.locator(".board-status")).toContainText("3v2 overload");
  await expect(
    page.getByRole("button", { name: "ADJUSTMENT APPLIED", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "ASK OPPOSITION AI" }).click();
  await expect(page.locator(".opposition")).toContainText("3v3");
  await page.getByRole("button", { name: "RESET", exact: true }).click();
  await expect(dm).toHaveAttribute("data-x", "43.00");
  await expect(page.getByRole("textbox")).toHaveValue("");
  await expect(page.locator(".pitch-annotation")).toHaveCount(0);
  for (const [name, role, x, y] of [
    ["Break a low block", "lw", "81.00", "27.00"],
    ["Protect a lead", "rcm", "42.00", "62.00"],
  ]) {
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await page.getByRole("textbox").fill("How can we improve this shape?");
    await page
      .getByRole("button", { name: "ANALYZE SHAPE", exact: true })
      .click();
    await page
      .getByRole("button", { name: "APPLY ADJUSTMENT", exact: true })
      .click();
    await expect(page.locator(`[data-player-id="${role}"]`)).toHaveAttribute(
      "data-x",
      x,
    );
    await expect(page.locator(`[data-player-id="${role}"]`)).toHaveAttribute(
      "data-y",
      y,
    );
  }
  await page.getByRole("button", { name: "HOW IT WORKS" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("dialog").getByRole("button")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "HOW IT WORKS" }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("dragging, keyboard movement, responsive coordinates and stale analysis clearing", async ({
  page,
}) => {
  await page.goto("/");
  const dm = page.locator('[data-player-id="dm"]');
  await dm.focus();
  await page.keyboard.press("ArrowRight");
  await expect(dm).toHaveAttribute("data-x", "44.00");
  await page
    .getByRole("button", { name: "How do we beat this press?", exact: true })
    .click();
  await page.getByRole("textbox").press("Enter");
  await expect(
    page.getByRole("button", { name: "APPLY ADJUSTMENT", exact: true }),
  ).toBeVisible();
  // Mouse PointerEvents exercise the same captured-pointer path as touch.
  await dm.scrollIntoViewIfNeeded();
  const before = await dm.boundingBox();
  const board = await page.locator(".pitch").boundingBox();
  if (!before || !board) throw new Error("Missing board");
  await page.mouse.move(
    before.x + before.width / 2,
    before.y + before.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    board.x + board.width * 0.55,
    board.y + board.height * 0.55,
    { steps: 10 },
  );
  await page.mouse.up();
  expect(Number(await dm.getAttribute("data-x"))).toBeCloseTo(55, 0);
  await expect(
    page.getByRole("button", { name: "APPLY ADJUSTMENT", exact: true }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 600, height: 850 });
  await expect(dm).toHaveAttribute("data-x", /55/);
  await dm.focus();
  for (let i = 0; i < 24; i++) await page.keyboard.press("Shift+ArrowLeft");
  await expect(dm).toHaveAttribute("data-x", "4.00");
});

test("reset cancels an in-flight result and network failure still supplies a move", async ({
  page,
}) => {
  await page.goto("/");
  await page.route("**/api/analyze", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.abort().catch(() => {});
  });
  await page.getByRole("textbox").fill("How do we beat this press?");
  await page.getByRole("textbox").press("Enter");
  await expect(
    page.getByRole("button", { name: "READING THE SHAPE..." }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "RESET", exact: true }).click();
  await expect(page.getByRole("textbox")).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "APPLY ADJUSTMENT", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("textbox").fill("How do we beat this press?");
  await page.getByRole("textbox").press("Enter");
  await expect(
    page.getByRole("button", { name: "APPLY ADJUSTMENT", exact: true }),
  ).toBeVisible();
});

test("API fallback and input validation", async ({ request }) => {
  for (const scenario of ["press", "block", "lead"] as const) {
    const response = await request.post("/api/analyze", {
      data: {
        scenario,
        question: scenarios[scenario].question,
        userFormation: scenarios[scenario].userFormation,
        opponentFormation: scenarios[scenario].opponentFormation,
        players: initialPlayers(scenario),
      },
    });
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.source).toBe("fallback");
    expect(data.analysis.whyItWorks).toHaveLength(3);
  }
  expect(
    (await request.post("/api/analyze", { data: { question: "" } })).status(),
  ).toBe(400);
  expect(
    (await request.post("/api/analyze", { data: "x".repeat(25000) })).status(),
  ).toBe(413);
});
