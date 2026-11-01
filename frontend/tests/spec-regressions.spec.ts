import { test, expect, type Page } from "@playwright/test";
import { mockBackend } from "./fixtures";
async function prepared(page: Page) {
  const state = await mockBackend(page);
  state.calibrations.A = { calib_tag: "ready", uncalibrated: false };
  await page.goto("/program");
  await expect(page.locator(".view-status")).toContainText("A");
  return state;
}
async function generated(page: Page) {
  const state = await prepared(page);
  await page
    .getByRole("button", { name: "生成 .LS 程序", exact: true })
    .click();
  await expect(page.locator(".program-code")).toContainText("TEST01");
  return state;
}
test("R01 real recognition default must match reuse_artifacts=false", async ({
  page,
}) => {
  await mockBackend(page);
  await page.goto("/recognize");
  await expect(page.locator(".view-status")).toContainText("A");
  const sent = page.waitForRequest(
    (r) => new URL(r.url()).pathname === "/api/recognize",
  );
  await page.getByRole("button", { name: "开始识别", exact: true }).click();
  expect((await sent).postDataJSON().reuse_artifacts).toBe(false);
});
test("R02 filtered-out seams should not remain selected", async ({ page }) => {
  await mockBackend(page);
  await page.route("**/api/seams/**", (r) =>
    r.fulfill({
      json: {
        seams: [
          {
            id: 1,
            shape: "短焊缝",
            type: "相切",
            length_mm: 10,
            trajectory_mm: [
              [0, 0, 0],
              [10, 0, 0],
            ],
          },
          {
            id: 2,
            shape: "有效焊缝",
            type: "相切",
            length_mm: 200,
            trajectory_mm: [
              [0, 0, 0],
              [200, 0, 0],
            ],
          },
        ],
      },
    }),
  );
  await page.goto("/recognize");
  await expect(page.locator(".seam-card")).toHaveCount(1);
  await expect(page.locator(".seam-card.selected")).toHaveCount(1);
});
test("R03 download failure should preserve the application and explain the error", async ({
  page,
}) => {
  await generated(page);
  await page.route("**/api/program/*/download", (r) =>
    r.fulfill({ status: 404, json: { detail: "程序不存在，请重新生成" } }),
  );
  await page.getByRole("link", { name: "下载", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "程序不存在，请重新生成",
  );
  await page.getByRole("button", { name: /任务中心/ }).click();
  await expect(page.locator(".event-log")).toContainText(
    "程序不存在，请重新生成",
  );
  expect(new URL(page.url()).pathname).toBe("/program");
});
test("R04 transfer success must belong to the currently selected seam", async ({
  page,
}) => {
  await generated(page);
  await page
    .locator(".steps")
    .getByRole("button", { name: "FTP 下发", exact: true })
    .click();
  await page
    .getByText("控制器地址", { exact: true })
    .locator("input")
    .fill("192.0.2.1");
  await page.getByRole("button", { name: "确认下发文件" }).click();
  await page.getByRole("button", { name: "确认继续" }).click();
  await expect(page.locator(".transfer-main")).toContainText("文件传输完成");
  await page
    .locator(".steps")
    .getByRole("button", { name: "焊缝管理", exact: true })
    .click();
  await page.locator(".control-panel .seam-title").last().click();
  await page
    .locator(".steps")
    .getByRole("button", { name: "FTP 下发", exact: true })
    .click();
  await expect(page.locator(".transfer-main")).toContainText("等待文件传输");
});
test("R13 successful LS download is an attachment", async ({ page }) => {
  await generated(page);
  await page.route("**/api/program/*/download", (r) =>
    r.fulfill({
      status: 200,
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition": 'attachment; filename="TEST01.ls"',
      },
      body: "/PROG TEST01\n/END",
    }),
  );
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载", exact: true }).click();
  const file = await pending;
  expect(file.suggestedFilename()).toBe("TEST01.ls");
  expect(new URL(page.url()).pathname).toBe("/program");
});
test("R16 view failure preserves the backend error detail", async ({
  page,
}) => {
  await mockBackend(page);
  await page.route("**/api/view/**", (r) =>
    r.fulfill({ status: 500, json: { detail: "点云文件损坏，无法读取" } }),
  );
  await page.goto("/recognize");
  await expect(page.getByRole("status")).toBeVisible();
  expect(await page.getByRole("status").textContent()).toContain(
    "点云文件损坏",
  );
});

test("changing the length filter updates selection and blocks generation when no seams remain", async ({
  page,
}) => {
  const state = await mockBackend(page);
  state.calibrations.A = { calib_tag: "ready", uncalibrated: false };
  await page.route("**/api/seams/**", (route) =>
    route.fulfill({
      json: {
        seams: [1, 2].map((id) => ({
          id,
          shape: "钢管-钢筋",
          type: "相切",
          length_mm: id === 1 ? 100 : 200,
          trajectory_mm: [
            [0, 0, 0],
            [id * 100, 0, 0],
          ],
        })),
      },
    }),
  );
  await page.goto("/seams");
  await expect(
    page.locator(".control-panel .seam-card.selected"),
  ).toContainText("#01");
  await page.getByLabel("最短长度 (mm)").fill("150");
  await expect(page.locator(".control-panel .seam-card")).toHaveCount(1);
  await expect(
    page.locator(".control-panel .seam-card.selected"),
  ).toContainText("#02");
  await page
    .locator(".steps")
    .getByRole("button", { name: "程序与预演", exact: true })
    .click();
  const request = page.waitForRequest(
    (r) => new URL(r.url()).pathname === "/api/program",
  );
  await page
    .getByRole("button", { name: "生成 .LS 程序", exact: true })
    .click();
  expect((await request).postDataJSON().seam_id).toBe(2);
  await expect(page.locator(".program-code")).toContainText("TEST01");
  await page
    .locator(".steps")
    .getByRole("button", { name: "焊缝管理", exact: true })
    .click();
  await page.getByLabel("最短长度 (mm)").fill("300");
  await expect(page.locator(".control-panel .seam-card")).toHaveCount(0);
  await page
    .locator(".steps")
    .getByRole("button", { name: "程序与预演", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "生成 .LS 程序", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".program-code")).toHaveCount(0);
  expect(state.programs).toBe(1);
});

test("missing view remains an empty state without a server-failure toast", async ({
  page,
}) => {
  await mockBackend(page);
  await page.route("**/api/view/**", (route) =>
    route.fulfill({ status: 404, json: { detail: "结果尚未生成" } }),
  );
  await page.goto("/recognize");
  await expect(page.locator(".viewport-empty")).toContainText(
    "该帧尚无可用视图，请先完成识别",
  );
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("non-JSON view failure reports its HTTP status", async ({ page }) => {
  await mockBackend(page);
  await page.route("**/api/view/**", (route) =>
    route.fulfill({
      status: 502,
      contentType: "text/html",
      body: "<h1>Bad Gateway</h1>",
    }),
  );
  await page.goto("/recognize");
  await expect(page.getByRole("status")).toContainText("HTTP 502");
});
