import { test, expect } from "@playwright/test";
import { mockBackend } from "./fixtures";

test("PDF dark palette persists through home, refresh and function navigation", async ({
  page,
}) => {
  const state = await mockBackend(page);
  state.calibrations.A = { calib_tag: "ready", uncalibrated: false };
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/scan");
  await page.getByLabel("切换深浅主题").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    await page
      .locator(".workspace-topbar")
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe("rgb(18, 32, 42)");
  expect(
    await page
      .locator(".workstation")
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe("rgb(7, 19, 27)");
  await page
    .locator(".steps")
    .getByRole("link", { name: "返回首页", exact: true })
    .click();
  await expect(page.locator(".hero-cloud canvas")).toBeVisible();
  await page.locator(".hero-view-tools input").press("End");
  await expect(page.locator(".hero-view-tools input")).toHaveValue("6");
  await page
    .locator(".hero-view-tools")
    .getByRole("button", { name: "重置视角" })
    .click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .locator(".site-header")
    .getByRole("link", { name: "程序与预演", exact: true })
    .click();
  await page
    .getByRole("button", { name: "生成 .LS 程序", exact: true })
    .click();
  await expect(page.locator(".context-panel .program-code")).toContainText(
    "TEST01",
  );
  await expect(page.locator(".control-panel .program-code")).toHaveCount(0);
  await page
    .locator(".steps")
    .getByRole("button", { name: "程序下发", exact: true })
    .click();
  await expect(page.locator(".transfer-viewport canvas")).toBeVisible();
  const preview = await page
    .locator(".transfer-viewport .cloud-canvas")
    .boundingBox();
  const result = await page.locator(".transfer-main").boundingBox();
  expect(result!.y).toBeGreaterThan(preview!.y + preview!.height);
  await page.screenshot({
    path: "test-results/pdf-reference-dark-transfer.png",
  });
  await page.getByLabel("切换深浅主题").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("PDF view controls and settings preserve the existing WebGL renderer", async ({
  page,
}) => {
  await mockBackend(page);
  await page.goto("/recognize");
  const canvas = await page.locator(".cloud-canvas canvas").elementHandle();
  await page.getByRole("button", { name: "点云", exact: true }).click();
  await page.getByRole("button", { name: "网格", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "网格", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "语义", exact: true }).click();
  await page.getByLabel("显示设置", { exact: true }).click();
  await page.getByRole("button", { name: "暗色", exact: true }).click();
  await expect(page.locator(".workstation")).toHaveClass(/dark/);
  expect(
    await page.evaluate(
      (saved) => document.querySelector(".cloud-canvas canvas") === saved,
      canvas,
    ),
  ).toBe(true);
});
