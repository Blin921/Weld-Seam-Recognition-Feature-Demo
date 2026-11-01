import { test, expect } from "@playwright/test";
import { mockBackend } from "./fixtures";
for (const mode of [
  { path: "/recognize", button: "开始识别" },
  { path: "/scan", button: "采集点云" },
])
  test(`task center stays closed during and after ${mode.path}`, async ({
    page,
  }) => {
    const state = await mockBackend(page);
    await page.goto(mode.path);
    await expect(page.locator(".view-status")).toContainText("A");
    const drawer = page.getByRole("button", { name: /任务中心/ });
    await expect(drawer).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: mode.button, exact: true }).click();
    await expect.poll(() => state.jobReads).toBeGreaterThan(0);
    await expect(drawer).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".task-body")).toHaveCount(0);
    state.done = true;
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(
      page.getByRole("button", { name: mode.button, exact: true }),
    ).toBeEnabled();
    await expect(drawer).toHaveAttribute("aria-expanded", "false");
    await drawer.click();
    await expect(page.locator(".task-history")).toContainText("识别恢复后完成");
    state.done = false;
    await page.getByRole("button", { name: mode.button, exact: true }).click();
    await expect(drawer).toHaveAttribute("aria-expanded", "true");
  });

test("dark palette covers all workflow surfaces and theme icon stays visible", async ({
  page,
}) => {
  await mockBackend(page);
  await page.goto("/recognize");
  const toggle = page.getByLabel("切换深浅主题");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toHaveAttribute("title", "切换为浅色模式");
  for (const destination of [
    "AI焊缝识别",
    "坐标标定",
    "焊缝管理",
    "程序与预演",
    "程序下发",
  ]) {
    await page
      .locator(".steps")
      .getByRole("button", { name: destination, exact: true })
      .click();
    if (destination === "坐标标定")
      await page
        .getByRole("button", { name: "配置标定数据", exact: true })
        .click();
    const bright = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll(
          ".workstation.dark :is(.workspace-topbar,.control-panel,.context-panel,.viewport,.view-toolbar,.view-switch,.fields input,.pair-grid input,.info-box,.secondary,.calibration-metric,.transfer-file,.playback,.task-drawer,select,textarea)",
        ),
      )
        .filter(
          (e) =>
            e.getBoundingClientRect().width > 0 &&
            e.getBoundingClientRect().height > 0,
        )
        .filter((e) => {
          const channels =
            getComputedStyle(e)
              .backgroundColor.match(/[\d.]+/g)
              ?.map(Number) ?? [];
          return (
            channels.length >= 3 &&
            (channels.length < 4 || channels[3] > 0) &&
            channels.slice(0, 3).every((c) => c > 210)
          );
        })
        .map((e) => e.className),
    );
    expect(bright).toEqual([]);
    await expect(toggle.locator("svg")).toBeVisible();
    expect(
      await toggle.locator("svg").evaluate((e) => getComputedStyle(e).color),
    ).toBe("rgb(255, 215, 122)");
  }
  await page
    .locator(".steps")
    .getByRole("button", { name: "AI焊缝识别", exact: true })
    .click();
  await page.getByRole("button", { name: /任务中心/ }).click();
  await page.screenshot({
    path: "test-results/dark-task-center.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /任务中心/ }).click();
  await page.screenshot({
    path: "test-results/dark-workstation-updated.png",
    fullPage: true,
  });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toHaveAttribute("title", "切换为深色模式");
  await expect(toggle.locator("svg")).toBeVisible();
});
