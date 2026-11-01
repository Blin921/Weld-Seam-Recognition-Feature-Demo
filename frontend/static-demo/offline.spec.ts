import { test, expect } from "@playwright/test";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

let folder: string;
let file: string;
test.beforeAll(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "weld-offline-"));
  // Only the HTML is shared, including in a folder with Chinese text/spaces.
  file = path.join(folder, "焊缝演示 文件.html");
  await copyFile(path.resolve("../demo/WELD-VISION.html"), file);
});
test.afterAll(async () => {
  await rm(folder, { recursive: true, force: true });
});

test("single HTML opens from disk offline and runs the complete visual demonstration", async ({
  page,
  context,
}) => {
  await context.setOffline(true);
  const network: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (/^https?:/.test(request.url())) network.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(pathToFileURL(file).href);
  await expect(
    page.getByRole("heading", { name: /看见每一道焊缝/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "技术架构", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "体验演示数据 →" }).click();
  await expect(page.locator(".view-status")).toContainText("66,080");
  await expect(page.locator(".seam-card")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "退出演示，连接后端" }),
  ).toHaveCount(0);
  await expect(page.locator(".viewport canvas")).toBeVisible();
  await page.getByRole("button", { name: "开始识别", exact: true }).click();
  await expect(page.locator(".task-history")).toHaveCount(0);
  await page.getByRole("button", { name: /任务中心/ }).click();
  await expect(page.locator(".task-history")).toContainText("未执行真实推理");
  await page.getByRole("button", { name: /任务中心/ }).click();
  await page
    .locator(".steps")
    .getByRole("button", { name: "坐标标定", exact: true })
    .click();
  await page.getByRole("button", { name: "开始演示标定", exact: true }).click();
  await expect(page.locator(".health")).toContainText("模拟标定");
  await page
    .locator(".steps")
    .getByRole("button", { name: "程序与预演", exact: true })
    .click();
  await page.getByRole("button", { name: "生成演示程序", exact: true }).click();
  await expect(page.locator(".program-code")).toContainText(
    "NOT AN EXECUTABLE",
  );
  const notice = await page.getByRole("status").boundingBox();
  const navigation = await page.locator(".steps").boundingBox();
  expect(notice!.y + notice!.height).toBeLessThanOrEqual(navigation!.y);
  await page.getByLabel("播放", { exact: true }).click();
  await page.getByLabel("暂停", { exact: true }).click();
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载", exact: true }).click();
  expect((await pending).suggestedFilename()).toBe("DEMO_ONLY.demo.txt");
  await page.getByLabel("切换深浅主题").click();
  await expect(page.locator(".workstation")).toHaveClass(/dark/);
  await page.screenshot({ path: "test-results/offline-preview.png" });
  await page
    .locator(".steps")
    .getByRole("button", { name: "程序下发", exact: true })
    .click();
  await page.getByRole("button", { name: "模拟下发（不连接设备）" }).click();
  await page.getByRole("button", { name: "确认继续" }).click();
  await expect(page.locator(".transfer-main")).toContainText(
    "模拟完成，未发送文件",
  );
  await page.getByRole("link", { name: "返回首页", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /看见每一道焊缝/ }),
  ).toBeVisible();
  await page
    .locator(".feature-card")
    .filter({ hasText: "程序生成与轨迹预演" })
    .click();
  await expect(page.locator(".program-code")).toContainText(
    "NOT AN EXECUTABLE",
  );
  expect(network).toEqual([]);
  expect(errors).toEqual([]);
});

test("all function routes open and refresh directly from the same offline file", async ({
  page,
  context,
}) => {
  await context.setOffline(true);
  for (const route of [
    "scan",
    "recognize",
    "calibration",
    "seams",
    "program",
    "transfer",
  ]) {
    await page.goto(pathToFileURL(file).href + "#/" + route);
    await expect(page.locator(".demo-banner")).toBeVisible();
    await expect(page.locator(".view-status")).toContainText("DEMO_PIPE_A");
    await expect(page.locator(".workstation h1")).toBeVisible();
    await expect(page.locator(".steps")).toHaveCount(1);
    await expect(page.locator(".steps > a, .steps > button")).toHaveCount(6);
    await expect(page.locator('.steps [aria-current="page"]')).toHaveCount(1);
    await expect(page.locator(".function-purpose")).toBeVisible();
    expect(
      await page
        .locator(".workstation h1")
        .evaluate((heading) => parseFloat(getComputedStyle(heading).fontSize)),
    ).toBeGreaterThanOrEqual(28);
    await page.reload();
    await expect(page.locator(".demo-banner")).toBeVisible();
    await expect(page.locator(".view-status")).toContainText("DEMO_PIPE_A");
  }
});
