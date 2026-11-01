import { test, expect } from "@playwright/test";
import { mockBackend } from "./fixtures";
const pairs = [
  [0, 0, 500, 320, 125, 480],
  [100, 0, 500, 420, 125, 480],
  [0, 100, 500, 320, 225, 480],
];
test("reference calibration shows the point form and preserves the request contract", async ({
  page,
}) => {
  const state = await mockBackend(page);
  await page.goto("/calibration");
  await expect(page.locator(".view-status")).toContainText("A");
  await expect(page.locator(".pair-grid input").first()).toBeVisible();
  await expect(page.locator(".calibration-results")).toContainText("等待标定");
  const canvas = await page.locator(".cloud-canvas canvas").elementHandle(),
    before = await page.locator(".viewport").boundingBox();
  await page.getByRole("button", { name: "配置标定数据", exact: true }).click();
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 6; j++)
      await page
        .getByLabel(`点对${i + 1}坐标${j + 1}`, { exact: true })
        .fill(String(pairs[i][j]));
  await page.getByRole("button", { name: "保存标定", exact: true }).click();
  await expect.poll(() => state.calibWrites).toBe(1);
  expect(state.lastCalibration).toEqual({
    frame: "A",
    pairs: pairs.map((row) => ({
      cam: row.slice(0, 3),
      base: row.slice(3, 6),
    })),
  });
  await expect(page.locator(".calibration-results")).toContainText(
    "需检查精度",
  );
  await expect(
    page.locator(".calibration-metric").filter({ hasText: "最大误差" }),
  ).toContainText("2.00");
  expect(await page.locator(".viewport").boundingBox()).toEqual(before);
  expect(
    await page.evaluate(
      (saved) => document.querySelector(".cloud-canvas canvas") === saved,
      canvas,
    ),
  ).toBe(true);
  await page.getByText("高级调试 · 点对与矩阵", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "清除当前帧标定" }),
  ).not.toBeVisible();
  await page
    .locator(".calibration-results")
    .getByRole("button", { name: "下一步：轨迹预演" })
    .click();
  await expect(page).toHaveURL(/\/program$/);
});
test("demo calibration is one click, with sample precision and the original central 3D view", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("weld-vision-demo", "1"),
  );
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/calibration");
  await expect(page.locator(".view-status")).toContainText("DEMO_PIPE_A");
  await expect(page.locator(".pair-grid input").first()).toBeVisible();
  await page.getByRole("button", { name: "开始演示标定", exact: true }).click();
  await expect(page.locator(".calibration-results")).toContainText(
    "模拟标定已完成",
  );
  await expect(
    page.locator(".calibration-metric").filter({ hasText: "最大误差" }),
  ).toContainText("0.42");
  await expect(
    page.locator(".calibration-metric").filter({ hasText: "对应点" }),
  ).toContainText("3");
  await expect(
    page.getByRole("button", { name: "重新演示标定", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".pair-grid input").first()).toBeVisible();
  await expect(
    page
      .locator(".calibration-results")
      .getByRole("button", { name: "下一步：轨迹预演" }),
  ).toBeInViewport({ ratio: 1 });
  await page.screenshot({
    path: "test-results/calibration-presentation.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "清除当前帧标定" }).click();
  await expect(page.getByRole("dialog")).toContainText("清除");
  await page.getByRole("button", { name: "确认继续" }).click();
  await expect(page.locator(".calibration-results")).toContainText("等待标定");
});
