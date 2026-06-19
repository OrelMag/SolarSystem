import { expect, test } from "@playwright/test";

test("loads the simulation and exercises core controls", async ({ page }) => {
  await page.goto("/");

  const canvas = page.locator("#scene canvas");
  await expect(canvas).toBeVisible();
  await expect(page.locator("#status")).toHaveText("Running");
  await expect(page.locator("#scenario")).toBeVisible();
  await expect(page.locator("#speed-select")).toBeVisible();
  await expect(page.locator("#selected-body")).toContainText("Sun");

  await expect
    .poll(async () => canvas.evaluate((node) => (node as HTMLCanvasElement).toDataURL().length))
    .toBeGreaterThan(1_000);

  await page.locator("#toggle").click();
  await expect(page.locator("#status")).toHaveText("Paused");
  await page.locator("#toggle").click();
  await expect(page.locator("#status")).toHaveText("Running");

  await page.locator("#speed-select").selectOption("86400");
  await expect(page.locator("#speed-value")).toHaveText("1 days/s");

  await page.locator("#body-search").fill("Earth");
  await page.locator("#body-results").getByRole("option", { name: /^Earth\b/i }).click();
  await expect(page.locator("#selected-body")).toContainText("Earth");

  await page.locator("#reset").click();
  await expect(page.locator("#selected-body")).toContainText("Sun");
});

test("keeps mobile controls reachable with collapsed secondary sections", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");

  await expect(page.locator("#scene canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Simulation" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.getByRole("button", { name: "Telemetry" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );

  await page.getByRole("button", { name: "Telemetry" }).click();
  await expect(page.getByRole("button", { name: "Telemetry" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.locator("#physics-time")).toBeVisible();
  await expect(page.locator("#visible-objects")).toBeVisible();
});

test("launches a spacecraft toward a planet", async ({ page }) => {
  await page.goto("/");

  await page.locator("#launch-target").selectOption("mars");
  await page.locator("#launch-spacecraft").click();

  await expect(page.locator("#launch-status")).toHaveText("EN ROUTE");
  await expect(page.locator("#selected-body")).toContainText("Spacecraft");
  await page.locator("#body-search").fill("Spacecraft");
  await expect(page.locator("#body-results").getByRole("option", { name: /Spacecraft/i })).toBeVisible();
});
