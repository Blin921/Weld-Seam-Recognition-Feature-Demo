export type Vec = [number, number, number];
export type Header = {
  version: number;
  units: string;
  frame: string;
  frame_id: string;
  n: number;
  n_full: number;
  n_instances: number;
  source: string;
  center: Vec;
  extent: number[];
  offsets: { xyz: number; rgb: number; instance: number };
};
export type Cloud = {
  header: Header;
  xyz: Float32Array;
  rgb: Uint8Array;
  instance: Uint16Array;
};
export function parseCloud(buffer: ArrayBuffer): Cloud {
  if (buffer.byteLength < 2052) throw new Error("点云数据不完整");
  const size = new DataView(buffer).getUint32(0, true);
  if (size > 2048 || !size) throw new Error("点云头长度非法");
  const h: Header = JSON.parse(
    new TextDecoder().decode(new Uint8Array(buffer, 4, size)),
  );
  if (
    h.version !== 1 ||
    h.units !== "mm" ||
    h.frame !== "camera" ||
    !Number.isInteger(h.n) ||
    h.n < 0
  )
    throw new Error("不支持的点云协议");
  for (const [key, width, align] of [
    ["xyz", 12, 4],
    ["rgb", 3, 1],
    ["instance", 2, 2],
  ] as const) {
    const offset = h.offsets[key];
    if (
      !Number.isInteger(offset) ||
      offset < 2052 ||
      offset % align ||
      offset + h.n * width > buffer.byteLength
    )
      throw new Error("点云偏移越界");
  }
  return {
    header: h,
    xyz: new Float32Array(buffer, h.offsets.xyz, h.n * 3),
    rgb: new Uint8Array(buffer, h.offsets.rgb, h.n * 3),
    instance: new Uint16Array(buffer, h.offsets.instance, h.n),
  };
}
export const displayPoint = ([x, y, z]: Vec): Vec => [x, -y, z];
export function arcLengths(points: Vec[]) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++)
    lengths.push(
      lengths[i - 1] +
        Math.hypot(...points[i].map((v, j) => v - points[i - 1][j])),
    );
  return lengths;
}
export function samplePath(
  points: Vec[],
  distance: number,
): { point: Vec; segment: number } {
  if (!points.length) return { point: [0, 0, 0], segment: 0 };
  const lengths = arcLengths(points);
  let i = 1;
  while (i < lengths.length - 1 && lengths[i] < distance) i++;
  if (points.length === 1) return { point: points[0], segment: 0 };
  const t = Math.max(
    0,
    Math.min(
      1,
      (distance - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1),
    ),
  );
  return {
    point: points[i - 1].map((v, j) => v + (points[i][j] - v) * t) as Vec,
    segment: i - 1,
  };
}
export function pathAtTime(points: Vec[], seconds: number, speed = 100) {
  const lengths = arcLengths(points);
  let remaining = Math.max(0, seconds);
  for (let i = 1; i < points.length; i++) {
    const duration = (lengths[i] - lengths[i - 1]) / speed;
    if (remaining < duration) return lengths[i - 1] + remaining * speed;
    remaining -= duration;
    if (points.length >= 5 && (i === 2 || i === points.length - 2)) {
      if (remaining < 0.4) return lengths[i];
      remaining -= 0.4;
    }
  }
  return lengths.at(-1) ?? 0;
}
export function pathDuration(points: Vec[], speed = 100) {
  return (
    (arcLengths(points).at(-1) ?? 0) / speed + (points.length >= 5 ? 0.8 : 0)
  );
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const response = await fetch("/api" + path, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers:
      body instanceof File
        ? { "Content-Type": "application/octet-stream" }
        : body === undefined
          ? undefined
          : { "Content-Type": "application/json" },
    body:
      body === undefined
        ? undefined
        : body instanceof File
          ? body
          : JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response
      .json()
      .catch(() => ({ detail: "后端服务不可用" }));
    throw new ApiError(
      response.status,
      typeof data.detail === "string"
        ? data.detail
        : JSON.stringify(data.detail),
    );
  }
  return response.json();
}
export type Frame = {
  id: string;
  source: string;
  bytes: number;
  mtime: number;
  has_artifacts: boolean;
};
export type Seam = {
  id: number;
  shape: string;
  type: string;
  length_mm: number;
  trajectory_mm: Vec[];
};
export type Calib = {
  calib_tag: string;
  has_calib?: boolean;
  uncalibrated?: boolean;
  max_dev_mm?: number;
  mean_dev_mm?: number;
};
export type Program = {
  ls_name: string;
  ls_text: string;
  issues: string[];
  waypoints_cam_mm: Vec[];
  waypoints_base_mm: Vec[];
  wpr_list: Vec[];
  download: string;
};
export type Job = {
  id: string;
  kind: string;
  state: string;
  log: string[];
  error?: string;
  result?: { n_seams?: number; seconds?: number };
  seconds?: number;
};
