import type { Page } from "@playwright/test";
export async function mockBackend(page: Page) {
  const state = {
    jobReads: 0,
    submissions: 0,
    failures: 0,
    done: false,
    views: 0,
    calibWrites: 0,
    lastCalibration: null as unknown,
    programs: 0,
    pushes: 0,
    calibrations: {
      A: { calib_tag: "none", uncalibrated: true },
      B: { calib_tag: "none", uncalibrated: true },
    } as Record<string, { calib_tag: string; uncalibrated: boolean }>,
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = {},
      status = 200;
    if (path === "/api/health")
      body = { model_ok: false, cpp_ok: true, model_error: "离线模式" };
    else if (path === "/api/frames")
      body = {
        frames: ["A", "B"].map((id) => ({
          id,
          source: id === "A" ? "dataset" : "upload",
          bytes: 3400000,
          has_artifacts: true,
        })),
      };
    else if (path.startsWith("/api/view/")) {
      state.views++;
      const h = {
        version: 1,
        units: "mm",
        frame: "camera",
        frame_id: path.split("/").at(-1),
        n: 3,
        n_full: 200000,
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
        seams: [1, 2].map((id) => ({
          id,
          shape: "钢管-钢筋",
          type: "相切",
          length_mm: 200,
          trajectory_mm: [
            [0, 0, 0],
            [100, 0, 0],
            [100, 100, 0],
          ],
        })),
      };
    else if (path.startsWith("/api/calib/"))
      body = state.calibrations[path.split("/").at(-1)!];
    else if (path === "/api/calib") {
      state.calibWrites++;
      const data = route.request().postDataJSON();
      state.lastCalibration = data;
      state.calibrations[data.frame] = {
        calib_tag: data.clear ? "none" : "calib-" + data.frame,
        uncalibrated: !!data.clear,
      };
      body = {
        calib_tag: state.calibrations[data.frame].calib_tag,
        max_dev_mm: data.clear ? 0 : 2,
        mean_dev_mm: data.clear ? 0 : 0.8,
      };
    } else if (path === "/api/recognize" || path === "/api/scan") {
      state.submissions++;
      status = 202;
      body = { job_id: "running-job" };
    } else if (path === "/api/jobs/running-job") {
      state.jobReads++;
      if (state.failures > 0) {
        state.failures--;
        status = 503;
        body = { detail: "temporary outage" };
      } else
        body = {
          id: "running-job",
          kind: "recognize",
          state: state.done ? "done" : "running",
          log: [state.done ? "识别恢复后完成" : "后端任务仍在运行"],
          result: { n_seams: 2, seconds: 1 },
        };
    } else if (path === "/api/program") {
      state.programs++;
      body = {
        ls_name: "TEST01",
        ls_text: "/PROG TEST01\n/END",
        issues: [],
        waypoints_cam_mm: [
          [0, 0, 0],
          [100, 0, 0],
          [100, 100, 0],
        ],
        waypoints_base_mm: [
          [0, 0, 0],
          [100, 0, 0],
          [100, 100, 0],
        ],
        wpr_list: [
          [180, 0, 0],
          [180, 0, 0],
        ],
        download: "/api/program/TEST01/download",
      };
    } else if (path === "/api/push") {
      state.pushes++;
      body = { bytes: 42, remote_path: "MD:/TEST01.ls", existed_before: true };
    } else {
      status = 404;
      body = { detail: "not found" };
    }
    await route.fulfill({ status, json: body });
  });
  return state;
}
