import { test, expect } from "@playwright/test";
import { mockBackend } from "./fixtures";

test("real processing waits for backend completion and preserves error details", async ({
  page,
}) => {
  const state = await mockBackend(page);
  await page.goto("/recognize");
  const process = page.getByRole("region", { name: "计算过程展示" });
  await page.getByRole("button", { name: "开始识别", exact: true }).click();
  await expect(process).toHaveAttribute("data-state", "running");
  await expect(process).toContainText("后台任务");
  await expect(process).toContainText("后端任务仍在运行");
  await expect.poll(() => state.jobReads).toBeGreaterThanOrEqual(3);
  await expect(process).toHaveAttribute("data-state", "running");
  await expect(process.locator("li.complete")).toHaveCount(0);
  state.done = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(process).toHaveAttribute("data-state", "done");
  await expect(process).toContainText("识别恢复后完成");
  await expect(process.locator("li.complete")).toHaveCount(0);
  await page.route("**/api/jobs/running-job", (route) =>
    route.fulfill({
      json: {
        id: "running-job",
        kind: "recognize",
        state: "error",
        log: ["读取点云失败"],
        error: "点云文件损坏",
      },
    }),
  );
  await page.getByRole("button", { name: "开始识别", exact: true }).click();
  await expect(process).toHaveAttribute("data-state", "error");
  await expect(process).toContainText("点云文件损坏");
  await expect(page.getByRole("status")).toContainText("点云文件损坏");
});

test("demo animations can be paused without stopping the task or rebuilding the renderer", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("weld-vision-demo", "1"),
  );
  await page.goto("/recognize");
  await expect(page.locator(".view-status")).toContainText("66,080");
  const canvas = await page.locator(".cloud-canvas canvas").elementHandle();
  const process = page.getByRole("region", { name: "计算过程展示" });
  await page.getByRole("button", { name: "开始识别", exact: true }).click();
  await expect(process).toHaveAttribute("data-state", "running");
  await expect(process).toContainText("模拟过程");
  await page.getByRole("button", { name: "暂停动画", exact: true }).click();
  await expect(process).toHaveAttribute("data-paused", "true");
  expect(
    await process
      .locator(".process-packet")
      .evaluate((element) => getComputedStyle(element).animationPlayState),
  ).toBe("paused");
  await expect(process).toHaveAttribute("data-state", "done", {
    timeout: 7000,
  });
  expect(
    await page.evaluate(
      (saved) => document.querySelector(".cloud-canvas canvas") === saved,
      canvas,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "继续动画", exact: true }).click();
  await page.getByRole("button", { name: "演示计算过程", exact: true }).click();
  await expect(process).toContainText("动画示意");
  await page.screenshot({
    path: "test-results/copper-recognition-animation.png",
  });
  await expect(process).toHaveAttribute("data-state", "done", {
    timeout: 7000,
  });
});

test("reduced motion mode stops decorative CSS animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockBackend(page);
  await page.goto("/recognize");
  await page.getByRole("button", { name: "演示计算过程", exact: true }).click();
  expect(
    await page
      .locator(".process-packet")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  await expect(page.locator(".steps")).toBeVisible();
});
