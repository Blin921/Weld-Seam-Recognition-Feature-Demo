import { test, expect } from "@playwright/test";
import { mockBackend } from "./fixtures";

test("polling outage keeps the same job locked and recovers without resubmitting", async ({
  page,
}) => {
  const state = await mockBackend(page);
  state.failures = 1;
  await page.goto("/recognize");
  await expect(page.locator(".view-status")).toContainText("A");
  await page.getByRole("button", { name: "开始识别", exact: true }).click();
  await expect(page.locator(".connection-warning")).toContainText("保留原任务");
  await expect(
    page.getByRole("button", { name: "任务进行中…", exact: true }),
  ).toBeDisabled();
  await page
    .locator(".steps")
    .getByRole("link", { name: "数据采集与管理" })
    .click();
  await expect(
    page.getByRole("button", { name: "采集点云", exact: true }),
  ).toBeDisabled();
  expect(state.submissions).toBe(1);
  state.done = true;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.getByRole("button", { name: /任务中心/ }).click();
  await expect(page.locator(".task-history")).toContainText("识别恢复后完成");
  await expect(page.locator(".connection-warning")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "采集点云", exact: true }),
  ).toBeEnabled();
  expect(state.submissions).toBe(1);
  expect(state.jobReads).toBeGreaterThan(1);
});

test("hidden pages pause polling and resume the existing task on visibilitychange", async ({
  page,
}) => {
  const state = await mockBackend(page);
  await page.goto("/recognize");
  await page.getByRole("button", { name: "开始识别", exact: true }).click();
  await page.getByRole("button", { name: /任务中心/ }).click();
  await expect(page.locator(".task-history")).toContainText("后端任务仍在运行");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const count = state.jobReads;
  await page.waitForTimeout(1800);
  expect(state.jobReads).toBe(count);
  state.done = true;
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator(".task-history")).toContainText("识别恢复后完成");
  expect(state.submissions).toBe(1);
});

test("frame metadata, readable fields, compact context tabs, and preserved residual warnings", async ({
  page,
}) => {
  const state = await mockBackend(page);
  await page.goto("/recognize");
  await expect(page.locator(".frame-list small").first()).toBeVisible();
  await expect(page.locator(".frame-list .artifact").first()).toBeVisible();
  await expect(page.locator(".frame-list small").first()).toContainText(
    "dataset",
  );
  const label = page.locator(".toggle-row").first();
  expect(
    await label.evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
  ).toBeGreaterThanOrEqual(14);
  await page
    .locator(".steps")
    .getByRole("button", { name: "坐标标定", exact: true })
    .click();
  await page.getByRole("button", { name: "配置标定数据", exact: true }).click();
  await page.getByRole("button", { name: "保存标定", exact: true }).click();
  await expect(page.locator(".health .warn")).toContainText([
    "模型未就绪",
    "已标定",
  ]);
  await page
    .getByRole("button", { name: "清除当前帧标定", exact: true })
    .click();
  expect(state.calibWrites).toBe(1);
  await page.getByRole("button", { name: "取消", exact: true }).click();
  expect(state.calibWrites).toBe(1);
  await page
    .locator(".steps")
    .getByRole("button", { name: "AI焊缝识别", exact: true })
    .click();
  await page
    .locator(".frame-list button")
    .filter({ has: page.locator("strong").filter({ hasText: /^B$/ }) })
    .click();
  await expect(page.locator(".view-status")).toContainText("B");
  await page
    .locator(".frame-list button")
    .filter({ has: page.locator("strong").filter({ hasText: /^A$/ }) })
    .click();
  await expect(page.locator(".view-status")).toContainText("A");
  await expect(page.locator(".health .warn")).toContainText([
    "模型未就绪",
    "已标定",
  ]);
  await page
    .locator(".steps")
    .getByRole("button", { name: "坐标标定", exact: true })
    .click();
  await page.setViewportSize({ width: 1100, height: 768 });
  await page.getByRole("tab", { name: "详情与结果" }).click();
  await expect(
    page.getByRole("tabpanel", { name: "详情与结果" }),
  ).toContainText("2.00");
  await page.screenshot({
    path: "test-results/compact-calibration.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "操作设置" }).click();
  await expect(
    page.getByRole("button", { name: "重新标定", exact: true }),
  ).toBeVisible();
  state.calibrations.A = {
    calib_tag: "changed-externally",
    uncalibrated: false,
  };
  await page
    .locator(".steps")
    .getByRole("button", { name: "AI焊缝识别", exact: true })
    .click();
  await page
    .locator(".frame-list button")
    .filter({ has: page.locator("strong").filter({ hasText: /^B$/ }) })
    .click();
  await expect(page.locator(".view-status")).toContainText("B");
  await page
    .locator(".frame-list button")
    .filter({ has: page.locator("strong").filter({ hasText: /^A$/ }) })
    .click();
  await expect(page.locator(".view-status")).toContainText("A");
  await expect(
    page.locator(".health span").filter({ hasText: "已标定" }),
  ).toHaveClass("ok");
});

test("3D controls and paused theme changes preserve the renderer and compact TCP/FTP details", async ({
  page,
}) => {
  const state = await mockBackend(page);
  await page.goto("/recognize");
  await expect(page.locator(".view-status")).toContainText("A");
  const canvas = await page.locator(".cloud-canvas canvas").elementHandle();
  expect(canvas).not.toBeNull();
  const viewRequests = state.views;
  await page.getByRole("button", { name: "实例", exact: true }).click();
  await page.locator(".view-controls input").focus();
  await page.locator(".view-controls input").press("ArrowRight");
  await page.locator(".seam-title").last().click();
  expect(
    await page.evaluate(
      (saved) => document.querySelector(".cloud-canvas canvas") === saved,
      canvas,
    ),
  ).toBe(true);
  expect(state.views).toBe(viewRequests);
  await page
    .locator(".steps")
    .getByRole("button", { name: "程序与预演", exact: true })
    .click();
  await page
    .getByRole("button", { name: "生成 .LS 程序", exact: true })
    .click();
  await page.getByRole("button", { name: "确认继续" }).click();
  await expect(page.locator(".program-code")).toContainText("TEST01");
  await page.getByLabel("播放", { exact: true }).click();
  await page.getByLabel("暂停", { exact: true }).click();
  const progress = await page.getByLabel("预演进度").inputValue();
  await page.getByLabel("切换深浅主题").click();
  await page.getByLabel("切换深浅主题").click();
  expect(await page.getByLabel("预演进度").inputValue()).toBe(progress);
  expect(
    await page.evaluate(
      (saved) => document.querySelector(".cloud-canvas canvas") === saved,
      canvas,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1100, height: 768 });
  await page.getByRole("tab", { name: "详情与结果" }).click();
  await expect(
    page.getByRole("tabpanel", { name: "详情与结果" }),
  ).toContainText("坐标系：相机系");
  await page.screenshot({
    path: "test-results/compact-tcp.png",
    fullPage: true,
  });
  await page
    .locator(".steps")
    .getByRole("button", { name: "程序下发", exact: true })
    .click();
  await page
    .getByText("控制器地址", { exact: true })
    .locator("input")
    .fill("192.168.1.20");
  await page.getByRole("button", { name: "确认下发文件" }).click();
  await page.getByRole("button", { name: "确认继续" }).click();
  await page.getByRole("tab", { name: "详情与结果" }).click();
  await expect(
    page.getByRole("tabpanel", { name: "详情与结果" }),
  ).toContainText("MD:/TEST01.ls");
  expect(state.pushes).toBe(1);
});

test("1366px layout retains a 600px viewport without horizontal overflow", async ({
  page,
}) => {
  await mockBackend(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/recognize");
  await expect(page.locator(".view-status")).toContainText("A");
  expect(
    await page
      .locator(".viewport")
      .evaluate((e) => e.getBoundingClientRect().width),
  ).toBeGreaterThanOrEqual(600);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(1366);
  await expect(page.locator(".context-panel")).toBeVisible();
  const undersized = await page.evaluate(() =>
    Array.from(document.querySelectorAll("main *"))
      .filter(
        (el) =>
          el.getBoundingClientRect().width > 0 &&
          el.getBoundingClientRect().height > 0 &&
          Array.from(el.childNodes).some(
            (node) =>
              node.nodeType === Node.TEXT_NODE &&
              /[\u4e00-\u9fff]/.test(node.textContent ?? ""),
          ) &&
          parseFloat(getComputedStyle(el).fontSize) < 14,
      )
      .map((el) => ({
        text: el.textContent?.slice(0, 60),
        size: getComputedStyle(el).fontSize,
      })),
  );
  expect(undersized).toEqual([]);
  await page.screenshot({
    path: "test-results/layout-1366.png",
    fullPage: true,
  });
});

test("workspace fits the viewport on all routes, including demo and open logs", async ({
  page,
}) => {
  await mockBackend(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  for (const path of [
    "/scan",
    "/recognize",
    "/calibration",
    "/seams",
    "/program",
    "/transfer",
  ]) {
    await page.goto(path);
    await expect(page.locator(".panels")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBeLessThanOrEqual(768);
    expect(
      await page
        .locator(".viewport")
        .evaluate((e) => e.getBoundingClientRect().height),
    ).toBeGreaterThan(220);
  }
  await page.getByRole("button", { name: /任务中心/ }).click();
  await expect(page.locator(".task-body")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(768);
  await page.goto("/");
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(768);
  await page.getByRole("button", { name: "体验演示数据 →" }).click();
  await expect(page.locator(".demo-banner")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(768);
  await expect(
    page.getByRole("button", { name: "开始识别", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: "test-results/viewport-fit-1366.png",
    fullPage: true,
  });
});

test("compact demo header leaves most of a 1366x768 screen for the workspace", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("weld-vision-demo", "1"),
  );
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/recognize");
  await expect(page.locator(".view-status")).toContainText("DEMO_PIPE_A");
  const bounds = await page.locator(".viewport").boundingBox();
  expect(bounds!.y).toBeLessThanOrEqual(100);
  expect(bounds!.height).toBeGreaterThanOrEqual(570);
  await expect(
    page.getByRole("button", { name: "退出演示，连接后端" }),
  ).toBeVisible();
  await expect(page.locator(".health")).toContainText("演示未标定");
  await page.getByText("演示说明", { exact: true }).click();
  await expect(page.locator(".workspace-help>div")).toBeVisible();
  await page.getByText("演示说明", { exact: true }).click();
  await page.getByRole("button", { name: "展开演示区", exact: true }).click();
  await expect(page.locator(".control-panel")).not.toBeVisible();
  expect(
    (await page.locator(".viewport").boundingBox())!.width,
  ).toBeGreaterThan(1300);
  await page.keyboard.press("Escape");
  await expect(page.locator(".control-panel")).toBeVisible();
  await page.screenshot({
    path: "test-results/compact-workspace-1366.png",
    fullPage: true,
  });
});
