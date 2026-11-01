import { test, expect } from "@playwright/test";
import { mockBackend } from "./fixtures";
for (const size of [
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
  { width: 1920, height: 925 },
])
  test(`home balances its content at ${size.width}x${size.height}`, async ({
    page,
  }) => {
    await mockBackend(page);
    await page.setViewportSize(size);
    await page.goto("/");
    await expect(page.locator(".feature-card")).toHaveCount(5);
    const image = await page.locator(".hero-cloud").boundingBox(),
      features = await page.locator(".feature-section").boundingBox(),
      footer = await page.locator(".home-footer").boundingBox();
    expect(image!.height).toBeGreaterThanOrEqual(260);
    expect(features!.y).toBeGreaterThan(image!.y + image!.height);
    expect(footer!.y + footer!.height).toBeGreaterThan(size.height - 45);
    expect(footer!.y + footer!.height).toBeLessThanOrEqual(size.height);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBeLessThanOrEqual(size.height);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(size.width);
    await expect(
      page.getByRole("button", { name: "体验演示数据 →" }),
    ).toBeInViewport();
    await page.screenshot({
      path: `test-results/home-balanced-${size.width}-${size.height}.png`,
      fullPage: true,
    });
  });
