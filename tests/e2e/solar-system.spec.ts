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
