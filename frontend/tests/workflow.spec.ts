import { test, expect } from "@playwright/test";
test("frame, recognition, calibration, program safety and FTP workflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let generated = 0,
    pushed = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = {};
    let status = 200;
    if (path === "/api/health")
      body = { model_ok: false, model_error: "离线模式", cpp_ok: true };
    else if (path === "/api/frames")
      body = {
        frames: [
          {
            id: "sw2_e30",
            source: "dataset",
            bytes: 3400000,
            has_artifacts: true,
          },
        ],
      };
    else if (path.startsWith("/api/view/")) {
      const h = {
        version: 1,
        units: "mm",
        frame: "camera",
        frame_id: "sw2_e30",
        n: 3,
        n_full: 3,
        n_instances: 1,
        source: "dataset",
        center: [0, 0, 0],
        extent: [-100, -100, -100, 100, 100, 100],
        offsets: { xyz: 2052, rgb: 2088, instance: 2098 },
      };
      const b = Buffer.alloc(2104),
        head = Buffer.from(JSON.stringify(h));
      b.writeUInt32LE(head.length);
      head.copy(b, 4);
      [0, 0, 0, 100, 0, 0, 100, 100, 0].forEach((v, i) =>
        b.writeFloatLE(v, 2052 + i * 4),
      );
      b.fill(130, 2088, 2097);
      [1, 1, 1].forEach((v, i) => b.writeUInt16LE(v, 2098 + i * 2));
      await route.fulfill({ contentType: "application/octet-stream", body: b });
      return;
    } else if (path.startsWith("/api/seams/"))
      body = {
        seams: [
          {
            id: 1,
            shape: "钢管-钢筋",
            type: "相切",
            length_mm: 200,
            trajectory_mm: [
              [0, 0, 0],
              [100, 0, 0],
              [100, 100, 0],
            ],
          },
        ],
      };
    else if (path.startsWith("/api/calib/"))
      body = { calib_tag: "未标定", uncalibrated: true };
    else if (path === "/api/recognize") {
      expect(route.request().postDataJSON().reuse_artifacts).toBe(true);
      status = 202;
      body = { job_id: "job1" };
    } else if (path === "/api/jobs/job1")
      body = {
        id: "job1",
        kind: "recognize",
        state: "done",
        log: ["复用历史产物完成"],
        result: { n_seams: 1, seconds: 1 },
      };
    else if (path === "/api/program") {
      generated++;
      body = {
        ls_name: "WELD01",
        ls_text: "/PROG WELD01\n/END",
        issues: ["检查工具号"],
        waypoints_cam_mm: [
          [0, 0, 0],
          [100, 0, 0],
          [100, 100, 0],
        ],
        waypoints_base_mm: [],
        wpr_list: [
          [180, 0, 0],
          [180, 0, 0],
        ],
        download: "/api/program/WELD01/download",
      };
    } else if (path === "/api/push") {
      pushed++;
      body = { bytes: 42, remote_path: "MD:/WELD01.ls", existed_before: true };
    } else {
      status = 404;
      body = { detail: "不存在" };
    }
    await route.fulfill({ status, json: body });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /看见每一道焊缝/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/design-home.png",
    fullPage: true,
  });
  await page.locator(".feature-card").filter({ hasText: "AI焊缝识别" }).click();
  await expect(
    page.getByRole("heading", { name: "AI焊缝识别", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".view-status")).toContainText("sw2_e30");
  await page.getByRole("checkbox", { name: /复用历史结果/ }).check();
  await page.getByRole("button", { name: "开始识别" }).click();
  await page.getByRole("button", { name: /任务中心/ }).click();
  await expect(page.locator(".task-history")).toContainText("复用历史产物完成");
  await page.getByRole("button", { name: "实例", exact: true }).click();
  await page.screenshot({
    path: "test-results/workstation-light.png",
    fullPage: true,
  });
  await page.getByLabel("切换深浅主题").click();
  await page.screenshot({
    path: "test-results/workstation-dark.png",
    fullPage: true,
  });
  await page.getByLabel("切换深浅主题").click();
  await page
    .locator(".steps")
    .getByRole("link", { name: "数据采集与管理" })
    .click();
  await expect(page).toHaveURL(/\/scan$/);
  await page.screenshot({
    path: "test-results/design-scan.png",
    fullPage: true,
  });
  await page
    .locator(".steps")
    .getByRole("button", { name: "坐标标定", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/design-calibration.png",
    fullPage: true,
  });
  await page
    .locator(".steps")
    .getByRole("button", { name: /程序与预演/ })
    .click();
  await page
    .getByRole("button", { name: "生成 .LS 程序", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("禁止上机");
  expect(generated).toBe(0);
  await page.getByRole("button", { name: "确认继续" }).click();
  await expect(page.locator(".program-code")).toContainText("/PROG WELD01");
  await page.getByLabel("播放", { exact: true }).click();
  await page.getByLabel("暂停", { exact: true }).click();
  await page.screenshot({
    path: "test-results/design-program.png",
    fullPage: true,
  });
  await page.locator(".site-logo").click();
  await page
    .locator(".feature-card")
    .filter({ hasText: "程序生成与轨迹预演" })
    .click();
  await expect(page.locator(".program-code")).toContainText("/PROG WELD01");
  await page
    .locator(".steps")
    .getByRole("button", { name: /FTP 下发/ })
    .click();
  await page
    .getByText("控制器地址", { exact: true })
    .locator("input")
    .fill("192.168.1.20");
  await page.getByRole("button", { name: "确认下发文件" }).click();
  await expect(page.getByRole("dialog")).toContainText("同名程序将被覆盖");
  expect(pushed).toBe(0);
  await page.getByRole("button", { name: "确认继续" }).click();
  await expect(page.getByRole("status")).toContainText("已覆盖");
  expect(pushed).toBe(1);
  await page.screenshot({
    path: "test-results/design-transfer.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
