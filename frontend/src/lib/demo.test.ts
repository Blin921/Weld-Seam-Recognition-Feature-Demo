import { describe, it, expect } from "vitest";
import { demoCloud, demoRequest, demoSeams, demoPcd } from "./demo";
import { parseCloud } from "./core";
describe("explicit synthetic demonstration data", () => {
  it("provides a valid mm cloud with nonzero semantic colors and 6 objects", () => {
    const cloud = parseCloud(demoCloud("DEMO_PIPE_A"));
    expect(cloud.header.n).toBeGreaterThan(60000);
    expect(cloud.header.n_instances).toBe(6);
    expect(cloud.header.source).toBe("demo");
    expect(cloud.rgb.slice(0, 3)).toEqual(new Uint8Array([70, 130, 230]));
    expect(demoSeams("DEMO_PIPE_A")).toHaveLength(3);
  });
  it("generates preview coordinates and a nonexecutable example document", async () => {
    const response = await demoRequest("/program", {
      body: JSON.stringify({ frame: "DEMO_PIPE_A", seam_id: 1 }),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ls_text).toContain("NOT AN EXECUTABLE");
    expect(
      data.ls_text.split("\n").every((line: string) => line.startsWith(";")),
    ).toBe(true);
    expect(data.waypoints_cam_mm).toHaveLength(21);
    expect(data.waypoints_base_mm).toEqual([]);
  });
  it("simulates transfer with zero bytes and no destination connection", async () => {
    await demoRequest("/program", {
      body: JSON.stringify({ frame: "DEMO_PIPE_A", seam_id: 1 }),
    });
    const response = await demoRequest("/push", {
      body: JSON.stringify({
        frame: "DEMO_PIPE_A",
        seam_id: 1,
        host: "192.0.2.1",
      }),
    });
    const data = await response.json();
    expect(data.demo).toBe(true);
    expect(data.bytes).toBe(0);
    expect(data.remote_path).toContain("未发送到控制器");
  });
  it("exports standard ASCII PCD containing the exact built-in geometry and RGB", () => {
    const rows = demoPcd("DEMO_PIPE_A").trimEnd().split("\n");
    const dataRow = rows.indexOf("DATA ascii");
    expect(rows).toContain("FIELDS x y z rgb");
    expect(rows).toContain("TYPE F F F U");
    expect(rows).toContain("POINTS 66080");
    expect(rows.length - dataRow - 1).toBe(66080);
    const first = rows[dataRow + 1].split(" ").map(Number);
    expect(first).toEqual([-280, -70, 532, (70 << 16) | (130 << 8) | 230]);
  });
  it("imports a renamed matching fixture and preserves B geometry without changing A", async () => {
    const file = new Blob([demoPcd("DEMO_PIPE_B")]);
    const uploaded = await demoRequest("/frames/UPLOAD_USER_PART", {
      method: "PUT",
      body: file,
    });
    expect(uploaded.status).toBe(200);
    const view = await demoRequest("/view/UPLOAD_USER_PART");
    const cloud = parseCloud(await view.arrayBuffer());
    expect(cloud.header.frame_id).toBe("UPLOAD_USER_PART");
    expect(cloud.header.n).toBe(66080);
    expect(cloud.xyz[2]).toBe(552);
    expect(demoSeams("UPLOAD_USER_PART")[0].trajectory_mm[0][2]).toBe(552);
    expect(parseCloud(demoCloud("DEMO_PIPE_A")).xyz[2]).toBe(532);
    const listing = await (await demoRequest("/frames")).json();
    expect(
      listing.frames.find(
        (frame: { id: string }) => frame.id === "UPLOAD_USER_PART",
      ).bytes,
    ).toBe(file.size);
  });
  it("rejects unrelated data even with a matching name, and rejects oversized files", async () => {
    const invalid = await demoRequest("/frames/UPLOAD_DEMO_PIPE_A", {
      method: "PUT",
      body: new Blob(["not a point cloud"]),
    });
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).detail).toContain("配套");
    const oversized = await demoRequest("/frames/UPLOAD_TOO_LARGE", {
      method: "PUT",
      body: new Blob([new Uint8Array(8 * 1024 * 1024 + 1)]),
    });
    expect(oversized.status).toBe(413);
    const listing = await (await demoRequest("/frames")).json();
    expect(
      listing.frames.some(
        (frame: { id: string }) =>
          frame.id === "UPLOAD_TOO_LARGE" || frame.id === "UPLOAD_DEMO_PIPE_A",
      ),
    ).toBe(false);
  });
  it("rejects unknown frames", async () =>
    expect(
      (
        await demoRequest("/program", {
          body: JSON.stringify({ frame: "missing", seam_id: 1 }),
        })
      ).status,
    ).toBe(404));
});
