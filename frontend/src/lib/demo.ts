import type { Frame, Seam, Vec } from "./core";
const key = "weld-vision-demo";
export function isDemoMode() {
  try {
    return typeof window !== "undefined" && sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
export function setDemoMode(enabled: boolean) {
  if (enabled) {
    const entering = !isDemoMode();
    sessionStorage.setItem(key, "1");
    if (entering) {
      calibration.clear();
      jobs.clear();
      generated.clear();
      frames.splice(2);
    }
  } else sessionStorage.removeItem(key);
  window.dispatchEvent(new Event("weld-demo-mode"));
}
const frames: Frame[] = [
  {
    id: "DEMO_PIPE_A",
    source: "demo",
    bytes: 0,
    mtime: 0,
    has_artifacts: true,
  },
  {
    id: "DEMO_PIPE_B",
    source: "demo",
    bytes: 0,
    mtime: 0,
    has_artifacts: true,
  },
];
const calibration = new Map<
  string,
  {
    calib_tag: string;
    uncalibrated: boolean;
    max_dev_mm?: number;
    mean_dev_mm?: number;
  }
>();
const jobs = new Map<string, { id: string; kind: string; start: number }>();
const generated = new Map<string, { seam_id: number; frame: string }>();
const blobs = new Map<string, ArrayBuffer>();
export function demoSeams(frame: string): Seam[] {
  const offset = frame.endsWith("B") ? 20 : 0;
  return [-70, 70]
    .map((y, i) => ({
      id: i + 1,
      shape: "钢管–扁钢",
      type: "相切",
      length_mm: 500,
      trajectory_mm: Array.from(
        { length: 21 },
        (_, j) => [-250 + j * 25, y, 532 + offset] as Vec,
      ),
    }))
    .concat([
      {
        id: 3,
        shape: "钢筋–钢管",
        type: "交叉",
        length_mm: 200,
        trajectory_mm: Array.from(
          { length: 11 },
          (_, i) => [0, -100 + i * 20, 480 + offset] as Vec,
        ),
      },
    ]);
}
export function demoCloud(frame: string): ArrayBuffer {
  const cached = blobs.get(frame);
  if (cached) return cached;
  const values: number[] = [],
    colors: number[] = [],
    ids: number[] = [];
  const offset = frame.endsWith("B") ? 20 : 0;
  const add = (x: number, y: number, z: number, rgb: number[], id: number) => {
    values.push(x, y, z + offset);
    colors.push(...rgb);
    ids.push(id);
  };
  for (let pipe = 0; pipe < 2; pipe++)
    for (let i = 0; i < 220; i++)
      for (let j = 0; j < 100; j++) {
        const a = (j / 100) * Math.PI * 2;
        add(
          -280 + (i * 560) / 219,
          (pipe ? 70 : -70) + 32 * Math.sin(a),
          500 + 32 * Math.cos(a),
          [70, 130, 230],
          pipe + 1,
        );
      }
  for (let x = 0; x < 120; x++)
    for (let y = 0; y < 64; y++)
      add(
        -320 + (x * 640) / 119,
        -160 + (y * 320) / 63,
        468,
        [180, 50, 180],
        3,
      );
  for (let bar = 0; bar < 3; bar++)
    for (let i = 0; i < 160; i++)
      for (let j = 0; j < 30; j++) {
        const a = (j / 30) * Math.PI * 2;
        add(
          (bar - 1) * 170 + 10 * Math.sin(a),
          -140 + (i * 280) / 159,
          470 + 10 * Math.cos(a),
          [50, 200, 80],
          bar + 4,
        );
      }
  const n = ids.length,
    xyz = 2052,
    rgb = xyz + n * 12,
    instance = (rgb + n * 3 + 1) & ~1;
  const buffer = new ArrayBuffer(instance + n * 2);
  const header = {
    version: 1,
    units: "mm",
    frame: "camera",
    frame_id: frame,
    n,
    n_full: n,
    source: "demo",
    center: [0, 0, 500 + offset],
    extent: [-320, -160, 460 + offset, 320, 160, 532 + offset],
    n_instances: 6,
    semantic_counts: { pipe: 44000, flat: 7680, rebar: 14400 },
    offsets: { xyz, rgb, instance },
    dtype: { xyz: "<f4", rgb: "u1", instance: "<u2" },
  };
  const text = new TextEncoder().encode(JSON.stringify(header));
  new DataView(buffer).setUint32(0, text.length, true);
  new Uint8Array(buffer, 4, text.length).set(text);
  new Float32Array(buffer, xyz, n * 3).set(values);
  new Uint8Array(buffer, rgb, n * 3).set(colors);
  new Uint16Array(buffer, instance, n).set(ids);
  blobs.set(frame, buffer);
  return buffer;
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
export async function demoRequest(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (init.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
  if (path === "/health")
    return json({
      model_ok: false,
      model_error: "演示使用合成数据，不加载推理模型",
      cpp_ok: false,
      demo: true,
    });
  if (path === "/frames")
    return json({
      frames: frames.map((f) => ({ ...f, bytes: demoCloud(f.id).byteLength })),
    });
  const fid = decodeURIComponent(path.split("/").at(-1) ?? "");
  if (path.startsWith("/view/"))
    return frames.some((f) => f.id === fid)
      ? new Response(demoCloud(fid).slice(0), {
          headers: { "Content-Type": "application/octet-stream" },
        })
      : json({ detail: "演示帧不存在" }, 404);
  if (path.startsWith("/seams/"))
    return json({
      frame: fid,
      ...(calibration.get(fid) ?? {
        calib_tag: "DEMO_NONE",
        uncalibrated: true,
      }),
      seams: demoSeams(fid),
      primitives: [],
    });
  if (path.startsWith("/calib/"))
    return json(
      calibration.get(fid) ?? {
        calib_tag: "DEMO_NONE",
        has_calib: false,
        uncalibrated: true,
      },
    );
  if (
    (path === "/calib" || path === "/program" || path === "/recognize") &&
    !frames.some((f) => f.id === body.frame)
  )
    return json({ detail: "演示帧不存在" }, 404);
  if (path === "/calib") {
    generated.delete(body.frame);
    const result = body.clear
      ? { calib_tag: "DEMO_NONE", has_calib: false, uncalibrated: true }
      : {
          calib_tag: "DEMO_CALIB",
          has_calib: true,
          uncalibrated: false,
          max_dev_mm: 0.42,
          mean_dev_mm: 0.18,
        };
    calibration.set(body.frame, result);
    return json(result);
  }
  if (path === "/recognize" || path === "/scan") {
    if ([...jobs.values()].some((j) => Date.now() - j.start < 2300))
      return json({ detail: "模拟任务进行中，请稍候" }, 409);
    const id = "demo-job-" + (jobs.size + 1);
    const kind = path.slice(1);
    jobs.set(id, { id, kind, start: Date.now() });
    if (kind === "scan")
      frames.push({
        id: "DEMO_SCAN_" + jobs.size,
        source: "demo",
        bytes: 0,
        mtime: 0,
        has_artifacts: true,
      });
    return json({ job_id: id }, 202);
  }
  if (path.startsWith("/jobs/")) {
    const job = jobs.get(fid);
    if (!job) return json({ detail: "演示任务不存在" }, 404);
    const elapsed = Date.now() - job.start,
      done = elapsed >= 2300;
    return json({
      id: job.id,
      kind: job.kind,
      state: done ? "done" : "running",
      seconds: Number((elapsed / 1000).toFixed(1)),
      log: [
        "[演示] 使用程序生成的合成点云；未连接相机或模型",
        ...(elapsed > 700 ? ["[演示] 正在加载示例工件与焊缝轨迹"] : []),
        ...(done ? ["[演示] 完成：3 条示例焊缝，未执行真实推理"] : []),
      ],
      result: done ? { n_seams: 3, seconds: 2.3 } : null,
    });
  }
  if (path === "/program") {
    const seam = demoSeams(body.frame).find((s) => s.id === body.seam_id);
    if (!seam) return json({ detail: "请先选择示例焊缝" }, 404);
    generated.set(body.frame, { frame: body.frame, seam_id: body.seam_id });
    return json({
      ls_name: "DEMO_ONLY",
      ls_text: [
        "; DEMO ONLY - NOT AN EXECUTABLE ROBOT PROGRAM",
        "; 仅供界面展示，禁止导入机器人控制器",
        `; Frame: ${body.frame} / Seam: ${body.seam_id}`,
        ...seam.trajectory_mm.map(
          (p, i) => `; P[${i + 1}] X=${p[0]} Y=${p[1]} Z=${p[2]} mm`,
        ),
      ].join("\n"),
      issues: [
        "演示程序不是可执行 .LS 文件，下载为 .demo.txt；没有进行真实标定或控制器校验。",
      ],
      waypoints_cam_mm: seam.trajectory_mm,
      waypoints_base_mm: [],
      wpr_list: seam.trajectory_mm.map(() => [180, 0, 0]),
      download: "",
    });
  }
  if (path === "/push") {
    if (generated.get(body.frame)?.seam_id !== body.seam_id)
      return json({ detail: "请先生成当前示例焊缝的演示程序" }, 404);
    return json({
      remote_path: "SIMULATED / 未发送到控制器",
      bytes: 0,
      existed_before: false,
      demo: true,
    });
  }
  return json(
    { detail: "此操作不在演示中提供；请退出演示后接入真实后端" },
    400,
  );
}
