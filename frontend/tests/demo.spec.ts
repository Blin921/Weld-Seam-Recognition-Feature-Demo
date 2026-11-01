import { test, expect } from "@playwright/test";
test("offline demo runs the visual workflow without API or controller requests", async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("weld-vision-demo", "1");
    localStorage.setItem(
      "weld-ftp",
      JSON.stringify({ host: "real-controller.example" }),
    );
  });
  test.setTimeout(45000);
  const requests: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) requests.push(r.url());
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "体验演示数据 →" }).click();
  await expect(page.locator(".demo-banner")).toContainText("合成示例数据");
  await expect(page.locator(".view-status")).toContainText("66,080");
  await expect(page.locator(".seam-card")).toHaveCount(3);
  await page.getByRole("button", { name: "开始识别", exact: true }).click();
  await page.getByRole("button", { name: /任务中心/ }).click();
  await expect(page.locator(".task-history")).toContainText("未执行真实推理");
  await page.screenshot({
    path: "test-results/demo-recognition.png",
    fullPage: true,
  });
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
  await page.getByLabel("播放", { exact: true }).click();
  await page.getByLabel("暂停", { exact: true }).click();
  await page.screenshot({
    path: "test-results/demo-preview.png",
    fullPage: true,
  });
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("link", { name: "下载", exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("DEMO_ONLY.demo.txt");
  await page.locator(".site-logo").click();
  await page.getByRole("button", { name: "体验演示数据 →" }).click();
  await page
    .locator(".steps")
    .getByRole("button", { name: "程序下发", exact: true })
    .click();
  await page.getByRole("button", { name: "模拟下发（不连接设备）" }).click();
  await expect(page.getByRole("dialog")).toContainText("不会连接任何设备");
  await page.getByRole("button", { name: "确认继续" }).click();
  await expect(page.locator(".transfer-main")).toContainText(
    "模拟完成，未发送文件",
  );
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("weld-ftp") ?? "{}").host,
    ),
  ).toBe("real-controller.example");
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test("demo can be entered explicitly and exited back to the real API", async ({
  page,
}) => {
  await page.route("**/api/**", (r) =>
    r.fulfill({ status: 503, json: { detail: "测试：没有后端" } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "体验演示数据 →" }).click();
  await expect(page.locator(".demo-banner")).toBeVisible();
  await expect(page.locator(".view-status")).toContainText("DEMO_PIPE_A");
  await page.getByRole("button", { name: "退出演示，连接后端" }).click();
  await expect(page.locator(".demo-banner")).toHaveCount(0);
  expect(
    await page.evaluate(() => sessionStorage.getItem("weld-vision-demo")),
  ).toBeNull();
  await expect(page.locator(".event-log")).toHaveCount(0);
});
